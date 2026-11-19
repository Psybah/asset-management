"""State transitions for assets. Each function validates, mutates and writes the audit entry."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import audit
from .models import Asset, Assignment, Disposal, Maintenance


def _money(v):
    return f"₦{float(v):,.2f}"


@transaction.atomic
def checkout(asset, user, actor, due_date=None, note="", when=None):
    when = when or timezone.now()
    if asset.status != Asset.Status.AVAILABLE:
        raise ValidationError({"detail": f"{asset.tag} is not available for checkout (status: {asset.status})."})
    if asset.assignments.filter(checked_in_at__isnull=True).exists():
        raise ValidationError({"detail": f"{asset.tag} already has an active assignment."})
    assignment = Assignment.objects.create(
        asset=asset, user=user, checked_out_by=actor if actor and actor.is_authenticated else None,
        checked_out_at=when, due_date=due_date, note=note or "",
    )
    asset.status = Asset.Status.ASSIGNED
    asset.assigned_to = user
    asset.assigned_since = timezone.localdate(when)
    asset.save(update_fields=["status", "assigned_to", "assigned_since", "updated_at"])
    due = f", due back {due_date:%d %b %Y}" if due_date else ""
    audit.log(actor, "checkout", "asset", asset.pk,
              f"{asset.tag} {asset.name} checked out to {user.name}{due}",
              asset=asset, title=f"Checked out to {user.name}", timestamp=when)
    return assignment


@transaction.atomic
def checkin(asset, actor, condition=None, note="", when=None):
    when = when or timezone.now()
    assignment = asset.assignments.filter(checked_in_at__isnull=True).select_related("user").first()
    if assignment is None or asset.status not in (Asset.Status.ASSIGNED, Asset.Status.MAINTENANCE):
        raise ValidationError({"detail": f"{asset.tag} is not currently assigned."})
    if condition and condition not in Asset.Condition.values:
        raise ValidationError({"condition": f"Must be one of {', '.join(Asset.Condition.values)}."})
    assignment.checked_in_at = when
    assignment.return_condition = condition or asset.condition
    if note:
        assignment.note = f"{assignment.note}\n{note}".strip()
    assignment.save()
    if condition:
        asset.condition = condition
    if asset.status == Asset.Status.ASSIGNED:
        asset.status = Asset.Status.AVAILABLE
    asset.assigned_to = None
    asset.assigned_since = None
    asset.save(update_fields=["status", "condition", "assigned_to", "assigned_since", "updated_at"])
    cond = f" in {assignment.return_condition} condition" if assignment.return_condition else ""
    audit.log(actor, "checkin", "asset", asset.pk,
              f"{asset.tag} {asset.name} returned by {assignment.user.name}{cond}" + (f" — {note}" if note else ""),
              asset=asset, title=f"Returned by {assignment.user.name}", timestamp=when)
    return assignment


@transaction.atomic
def dispose(asset, actor, method, reason, value=None, when=None):
    when = when or timezone.now()
    if asset.status == Asset.Status.RETIRED or hasattr(asset, "disposal"):
        raise ValidationError({"detail": f"{asset.tag} has already been disposed."})
    if method not in Disposal.Method.values:
        raise ValidationError({"method": f"Must be one of {', '.join(Disposal.Method.values)}."})
    if not reason:
        raise ValidationError({"reason": "This field is required."})
    active = asset.assignments.filter(checked_in_at__isnull=True)
    active.update(checked_in_at=when, return_condition=asset.condition)
    asset.maintenance.exclude(status=Maintenance.Status.DONE).update(
        status=Maintenance.Status.DONE, completed_date=timezone.localdate(when),
        notes="Closed automatically on disposal.",
    )
    Disposal.objects.create(
        asset=asset, method=method, reason=reason, value=value,
        disposed_on=timezone.localdate(when), disposed_by=actor if actor and actor.is_authenticated else None,
    )
    asset.status = Asset.Status.RETIRED
    asset.assigned_to = None
    asset.assigned_since = None
    asset.save(update_fields=["status", "assigned_to", "assigned_since", "updated_at"])
    proceeds = f" for {_money(value)}" if value not in (None, "") else ""
    audit.log(actor, "dispose", "asset", asset.pk,
              f"{asset.tag} {asset.name} disposed ({method}{proceeds}): {reason}",
              asset=asset, title=f"Disposed — {method}", timestamp=when)
    return asset


def apply_maintenance_status(record, previous_status=None):
    """Sync the asset's status with a maintenance record's status.

    in_progress -> asset becomes `maintenance`; done -> asset returns to `available`
    (or `assigned` if it still has an active assignment) and completed_date is set.
    """
    asset = record.asset
    if record.status == Maintenance.Status.DONE and not record.completed_date:
        record.completed_date = timezone.localdate()
        record.save(update_fields=["completed_date"])
    if asset.status == Asset.Status.RETIRED or record.status == previous_status:
        return
    if record.status == Maintenance.Status.IN_PROGRESS:
        asset.status = Asset.Status.MAINTENANCE
        asset.save(update_fields=["status", "updated_at"])
    elif asset.status == Asset.Status.MAINTENANCE and not asset.maintenance.filter(
        status=Maintenance.Status.IN_PROGRESS
    ).exclude(pk=record.pk).exists():
        has_active = asset.assignments.filter(checked_in_at__isnull=True).exists()
        asset.status = Asset.Status.ASSIGNED if has_active else Asset.Status.AVAILABLE
        asset.save(update_fields=["status", "updated_at"])


STATUS_VERB = {"scheduled": "scheduled", "in_progress": "started", "done": "completed"}


def log_maintenance(record, actor, verb=None, when=None):
    verb = verb or STATUS_VERB.get(record.status, "updated")
    asset = record.asset
    cost = f" ({_money(record.cost)})" if record.status == Maintenance.Status.DONE and record.cost else ""
    vendor = f" by {record.vendor}" if record.vendor else ""
    audit.log(actor, "maintenance", "maintenance", record.pk,
              f"{record.kind.capitalize()} maintenance “{record.title}” {verb} on {asset.tag}{vendor}{cost}",
              asset=asset, title=f"Maintenance {verb}: {record.title}", timestamp=when)
