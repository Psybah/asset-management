"""Audit trail helpers. Logging happens in the view/service layer so the acting user is known."""

from django.utils import timezone


def log(actor, action, entity, entity_id, summary, asset=None, title="", timestamp=None):
    from .models import AuditLog

    return AuditLog.objects.create(
        actor=actor if (actor and actor.is_authenticated) else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        asset=asset,
        title=title,
        summary=summary,
        timestamp=timestamp or timezone.now(),
    )


def describe(instance):
    return str(getattr(instance, "name", None) or getattr(instance, "title", None) or instance)


class AuditedModelViewSetMixin:
    """Writes create/update/delete audit entries for simple CRUD viewsets."""

    audit_entity = None  # e.g. "category"

    def _label(self):
        return (self.audit_entity or "record").replace("_", " ")

    def perform_create(self, serializer):
        obj = serializer.save()
        log(self.request.user, "create", self.audit_entity, obj.pk,
            f"{self.request.user.name} created {self._label()} “{describe(obj)}”")

    def perform_update(self, serializer):
        changed = [f for f, v in serializer.validated_data.items() if getattr(serializer.instance, f, None) != v]
        obj = serializer.save()
        detail = f" ({', '.join(f.replace('_', ' ') for f in changed)})" if changed else ""
        log(self.request.user, "update", self.audit_entity, obj.pk,
            f"{self.request.user.name} updated {self._label()} “{describe(obj)}”{detail}")

    def perform_destroy(self, instance):
        pk, label = instance.pk, describe(instance)
        instance.delete()
        log(self.request.user, "delete", self.audit_entity, pk,
            f"{self.request.user.name} deleted {self._label()} “{label}”")
