import csv
import io
import secrets
from collections import defaultdict
from datetime import date, timedelta

import qrcode
from PIL import Image, ImageOps, UnidentifiedImageError
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.authentication import QueryParamTokenAuthentication

from . import audit, services
from .audit import AuditedModelViewSetMixin
from .models import Asset, Assignment, AuditLog, Category, Location, Maintenance
from .serializers import (
    AssetSerializer,
    AssignmentSerializer,
    AuditLogSerializer,
    CategorySerializer,
    LocationSerializer,
    MaintenanceSerializer,
    TimelineSerializer,
)

User = get_user_model()


def _int_param(params, name):
    value = params.get(name)
    if value in (None, ""):
        return None
    if not str(value).isdigit():
        raise ValidationError({name: "Must be an integer id."})
    return int(value)


def filter_assets(queryset, params):
    """Shared by the asset list and the CSV report."""
    search = params.get("search", "").strip()
    if search:
        queryset = queryset.filter(
            Q(name__icontains=search) | Q(tag__icontains=search)
            | Q(serial_number__icontains=search) | Q(vendor__icontains=search)
        )
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    for field in ("category", "department", "location", "assigned_to"):
        value = _int_param(params, field)
        if value is not None:
            queryset = queryset.filter(**{f"{field}_id": value})
    return queryset


def asset_queryset():
    return Asset.objects.select_related("category", "location", "department", "assigned_to", "disposal")


# --------------------------------------------------------------------------- reference data
class CategoryViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    audit_entity = "category"

    def get_queryset(self):
        return Category.objects.annotate(asset_count=Count("assets", distinct=True)).order_by("name")


class LocationViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    serializer_class = LocationSerializer
    audit_entity = "location"

    def get_queryset(self):
        return Location.objects.annotate(asset_count=Count("assets", distinct=True)).order_by("name")


# --------------------------------------------------------------------------- assets
UPLOAD_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
UPLOAD_MAX_SIDE = 1600


def process_image_upload(upload):
    """Validate an uploaded photo and re-encode it (strips EXIF/GPS, caps size at 1600px).

    Returns (ContentFile, extension). Raises ValidationError for non-images or files over the limit.
    """
    limit = settings.ASSET_IMAGE_MAX_BYTES
    if upload.size > limit:
        raise ValidationError({"image": [f"Image must be {limit // (1024 * 1024)} MB or smaller."]})
    try:
        with Image.open(upload) as probe:
            fmt = probe.format
            probe.verify()
        upload.seek(0)
        with Image.open(upload) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail((UPLOAD_MAX_SIDE, UPLOAD_MAX_SIDE))
            has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
            out = io.BytesIO()
            if has_alpha:
                img.convert("RGBA").save(out, format="PNG", optimize=True)
                ext = "png"
            else:
                img.convert("RGB").save(out, format="JPEG", quality=85, optimize=True)
                ext = "jpg"
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError):
        raise ValidationError({"image": ["Upload a valid image (JPEG, PNG, WebP or GIF)."]})
    if fmt not in UPLOAD_FORMATS:
        raise ValidationError({"image": ["Upload a valid image (JPEG, PNG, WebP or GIF)."]})
    return ContentFile(out.getvalue()), ext


class CheckoutSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True))
    due_date = serializers.DateField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class CheckinSerializer(serializers.Serializer):
    condition = serializers.ChoiceField(choices=Asset.Condition.choices, required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class DisposeSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=["sold", "donated", "scrapped", "lost"])
    reason = serializers.CharField()
    value = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer

    def get_queryset(self):
        return filter_assets(asset_queryset(), self.request.query_params).order_by("tag")

    def perform_create(self, serializer):
        asset = serializer.save()
        audit.log(self.request.user, "create", "asset", asset.pk,
                  f"{self.request.user.name} registered {asset.tag} {asset.name} "
                  f"(₦{float(asset.purchase_cost):,.2f})",
                  asset=asset, title="Asset registered")

    def perform_update(self, serializer):
        instance = serializer.instance
        changes = []
        for field, new in serializer.validated_data.items():
            old = getattr(instance, field)
            if old != new:
                label = field.replace("_", " ")
                fmt = lambda v: getattr(v, "name", v) if v not in (None, "") else "—"
                changes.append(f"{label}: {fmt(old)} → {fmt(new)}" if field != "notes" else "notes edited")
        asset = serializer.save()
        if changes:
            audit.log(self.request.user, "update", "asset", asset.pk,
                      f"{self.request.user.name} updated {asset.tag} — " + "; ".join(changes),
                      asset=asset, title="Details updated")

    def perform_destroy(self, instance):
        pk, label, photo = instance.pk, f"{instance.tag} {instance.name}", instance.image.name
        instance.delete()
        if photo and not Asset.objects.filter(image=photo).exists():
            instance.image.storage.delete(photo)
        audit.log(self.request.user, "delete", "asset", pk, f"{self.request.user.name} deleted {label}")

    def _respond(self, asset):
        asset = asset_queryset().get(pk=asset.pk)
        return Response(AssetSerializer(asset, context=self.get_serializer_context()).data)

    @action(detail=False, url_path=r"by-tag/(?P<tag>[A-Za-z0-9_-]+)")
    def by_tag(self, request, tag=None):
        asset = get_object_or_404(asset_queryset(), tag__iexact=tag)
        return Response(self.get_serializer(asset).data)

    @action(detail=True, permission_classes=[AllowAny], authentication_classes=[])
    def qr(self, request, pk=None):
        asset = get_object_or_404(Asset, pk=pk)
        img = qrcode.make(f"{settings.FRONTEND_URL}/scan/{asset.tag}", box_size=10, border=2)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        response = HttpResponse(buf.getvalue(), content_type="image/png")
        response["Cache-Control"] = "public, max-age=3600"
        return response

    @action(detail=True, methods=["post", "delete"])
    def image(self, request, pk=None):
        """POST multipart `image` to set/replace the photo; DELETE to remove it (manager+)."""
        asset = self.get_object()
        actor = request.user
        if request.method == "DELETE":
            if not asset.image:
                return Response({"detail": "This asset has no photo."}, status=status.HTTP_400_BAD_REQUEST)
            asset.remove_image()
            audit.log(actor, "update", "asset", asset.pk, f"{actor.name} removed the photo of {asset.tag} {asset.name}",
                      asset=asset, title="Photo removed")
            return self._respond(asset)

        upload = request.FILES.get("image")
        if upload is None:
            raise ValidationError({"image": ["No file was submitted (multipart field “image”)."]})
        content, ext = process_image_upload(upload)
        previous = asset.image.name
        asset.image.save(f"{asset.tag.lower()}-{secrets.token_hex(4)}.{ext}", content, save=False)
        asset.save(update_fields=["image", "updated_at"])
        if previous and not Asset.objects.filter(image=previous).exists():
            asset.image.storage.delete(previous)
        audit.log(actor, "update", "asset", asset.pk,
                  f"{actor.name} {'replaced' if previous else 'added'} the photo of {asset.tag} {asset.name}",
                  asset=asset, title="Photo updated" if previous else "Photo added")
        return self._respond(asset)

    @action(detail=True)
    def depreciation(self, request, pk=None):
        asset = self.get_object()
        return Response([row.as_dict() for row in asset.depreciation_schedule()])

    @action(detail=True)
    def timeline(self, request, pk=None):
        asset = self.get_object()
        entries = asset.audit_entries.select_related("actor").order_by("-timestamp", "-id")
        return Response(TimelineSerializer(entries, many=True).data)

    @action(detail=True, methods=["post"])
    def checkout(self, request, pk=None):
        asset = self.get_object()
        data = CheckoutSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        services.checkout(asset, v["user"], request.user, due_date=v.get("due_date"), note=v.get("note", ""))
        return self._respond(asset)

    @action(detail=True, methods=["post"])
    def checkin(self, request, pk=None):
        asset = self.get_object()
        data = CheckinSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        services.checkin(asset, request.user, condition=v.get("condition") or None, note=v.get("note", ""))
        return self._respond(asset)

    @action(detail=True, methods=["post"])
    def dispose(self, request, pk=None):
        asset = self.get_object()
        data = DisposeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        services.dispose(asset, request.user, v["method"], v["reason"], v.get("value"))
        return self._respond(asset)


# --------------------------------------------------------------------------- assignments
class AssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AssignmentSerializer

    def get_queryset(self):
        qs = Assignment.objects.select_related("asset", "user").order_by("-checked_out_at")
        params = self.request.query_params
        if (asset := _int_param(params, "asset")) is not None:
            qs = qs.filter(asset_id=asset)
        if (user := _int_param(params, "user")) is not None:
            qs = qs.filter(user_id=user)
        active = params.get("active", "").lower()
        if active in ("true", "1", "yes"):
            qs = qs.filter(checked_in_at__isnull=True)
        elif active in ("false", "0", "no"):
            qs = qs.filter(checked_in_at__isnull=False)
        return qs


# --------------------------------------------------------------------------- maintenance
class MaintenanceViewSet(viewsets.ModelViewSet):
    serializer_class = MaintenanceSerializer

    def get_queryset(self):
        qs = Maintenance.objects.select_related("asset").order_by("scheduled_date", "id")
        params = self.request.query_params
        if (asset := _int_param(params, "asset")) is not None:
            qs = qs.filter(asset_id=asset)
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        return qs

    def perform_create(self, serializer):
        if serializer.validated_data["asset"].status == Asset.Status.RETIRED:
            raise ValidationError({"asset": "Cannot schedule maintenance for a retired asset."})
        record = serializer.save()
        services.apply_maintenance_status(record)
        services.log_maintenance(record, self.request.user)

    def perform_update(self, serializer):
        previous = serializer.instance.status
        record = serializer.save()
        services.apply_maintenance_status(record, previous)
        verb = services.STATUS_VERB.get(record.status) if record.status != previous else "updated"
        services.log_maintenance(record, self.request.user, verb=verb)

    def perform_destroy(self, instance):
        asset, pk, title = instance.asset, instance.pk, instance.title
        instance.status = Maintenance.Status.SCHEDULED
        services.apply_maintenance_status(instance, Maintenance.Status.IN_PROGRESS)
        instance.delete()
        audit.log(self.request.user, "delete", "maintenance", pk,
                  f"{self.request.user.name} deleted maintenance “{title}” on {asset.tag}",
                  asset=asset, title=f"Maintenance cancelled: {title}")


# --------------------------------------------------------------------------- audit
class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        params = self.request.query_params
        qs = AuditLog.objects.select_related("actor").order_by("-timestamp", "-id")
        for field in ("action", "entity"):
            if params.get(field):
                qs = qs.filter(**{field: params[field]})
        limit = _int_param(params, "limit") or 50
        return qs[: min(limit, 1000)]


# --------------------------------------------------------------------------- dashboard
def _f(value):
    return round(float(value), 2)


def fleet_value(assets, as_of):
    """Total book value on `as_of` of every asset owned that day (bought, not yet disposed)."""
    total = 0.0
    for a in assets:
        if a.purchase_date > as_of:
            continue
        disposal = getattr(a, "disposal", None) if a.status == Asset.Status.RETIRED else None
        if disposal and disposal.disposed_on <= as_of:
            continue
        total += float(a.value_on(as_of))
    return total


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_asset(request, tag):
    """What a QR label opens for someone who is not signed in.

    Deliberately limited: what the item is, its photo, status and where it belongs.
    No holder names, costs or serial numbers.
    """
    try:
        a = Asset.objects.select_related("category", "location", "department").get(tag__iexact=tag)
    except Asset.DoesNotExist:
        return Response({"detail": f"No asset with tag {tag}."}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        "id": a.id,
        "tag": a.tag,
        "name": a.name,
        "category_name": a.category.name,
        "category_icon": a.category.icon,
        "image_url": request.build_absolute_uri(a.image.url) if a.image else None,
        "status": a.status,
        "condition": a.condition,
        "location_name": a.location.name if a.location else None,
        "department_name": a.department.name if a.department else None,
    })


@api_view(["GET"])
def value_trend(request):
    """Month-end fleet book value for the last `months` months (6–120, default 12), ending today.

    Powers the date filter on the dashboard's book value chart.
    """
    try:
        months = max(6, min(120, int(request.query_params.get("months", 12))))
    except ValueError:
        months = 12
    today = timezone.localdate()
    assets = list(asset_queryset())
    points = []
    for back in range(months, 0, -1):
        y, m = divmod(today.year * 12 + today.month - 1 - back, 12)
        m += 1
        # last day of that month
        nxt = date(y + (m == 12), (m % 12) + 1, 1)
        points.append(nxt - timedelta(days=1))
    points.append(today)
    return Response([{"date": d.isoformat(), "value": _f(fleet_value(assets, d))} for d in points])


@api_view(["GET"])
def dashboard(request):
    """Fleet summary.

    `totals.assets` and `by_status` count every registered asset (including retired);
    all monetary figures, `by_category` and `by_department` cover the active fleet
    (non-retired assets). `value_trend` is the fleet book value at 31 Dec of each of
    the last five years plus today's value for the current year.
    """
    today = timezone.localdate()
    assets = list(asset_queryset())
    active = [a for a in assets if a.status != Asset.Status.RETIRED]
    values = {a.pk: a.current_value for a in active}

    status_counts = defaultdict(int)
    for a in assets:
        status_counts[a.status] += 1

    overdue_qs = Maintenance.objects.exclude(status=Maintenance.Status.DONE).filter(scheduled_date__lt=today)

    by_cat, by_dept = {}, {}
    for a in active:
        c = by_cat.setdefault(a.category_id, {"name": a.category.name, "icon": a.category.icon, "count": 0, "value": 0.0})
        c["count"] += 1
        c["value"] += float(values[a.pk])
        dname = a.department.name if a.department else "Unassigned"
        d = by_dept.setdefault(dname, {"name": dname, "count": 0, "value": 0.0})
        d["count"] += 1
        d["value"] += float(values[a.pk])

    trend = [
        {"year": year, "value": _f(fleet_value(assets, today if year == today.year else date(year, 12, 31)))}
        for year in range(today.year - 5, today.year + 1)
    ]

    upcoming = (
        Maintenance.objects.select_related("asset").exclude(status=Maintenance.Status.DONE)
        .order_by("scheduled_date", "id")[:5]
    )
    recent = AuditLog.objects.select_related("actor").order_by("-timestamp", "-id")[:8]

    return Response({
        "totals": {
            "assets": len(assets),
            "purchase_value": _f(sum(float(a.purchase_cost) for a in active)),
            "current_value": _f(sum(float(v) for v in values.values())),
            "assigned": status_counts[Asset.Status.ASSIGNED],
            "available": status_counts[Asset.Status.AVAILABLE],
            "maintenance": status_counts[Asset.Status.MAINTENANCE],
            "retired": status_counts[Asset.Status.RETIRED],
            "overdue_maintenance": overdue_qs.count(),
        },
        "by_category": sorted(
            ({**c, "value": _f(c["value"])} for c in by_cat.values()), key=lambda c: -c["value"]),
        "by_department": sorted(
            ({**d, "value": _f(d["value"])} for d in by_dept.values()), key=lambda d: -d["value"]),
        "by_status": [{"status": s, "count": status_counts[s]} for s in Asset.Status.values],
        "value_trend": trend,
        "upcoming_maintenance": MaintenanceSerializer(upcoming, many=True).data,
        "recent_activity": AuditLogSerializer(recent, many=True).data,
    })


# --------------------------------------------------------------------------- reports
CSV_COLUMNS = [
    ("Tag", lambda a: a.tag), ("Name", lambda a: a.name), ("Category", lambda a: a.category.name),
    ("Serial number", lambda a: a.serial_number), ("Vendor", lambda a: a.vendor),
    ("Purchase date", lambda a: a.purchase_date.isoformat()),
    ("Purchase cost (NGN)", lambda a: f"{a.purchase_cost:.2f}"),
    ("Salvage value (NGN)", lambda a: f"{a.salvage_value:.2f}"),
    ("Depreciation method", lambda a: a.get_depreciation_method_display()),
    ("Useful life (years)", lambda a: a.life),
    ("Current value (NGN)", lambda a: f"{a.current_value:.2f}"),
    ("Accumulated depreciation (NGN)", lambda a: f"{a.accumulated_depreciation:.2f}"),
    ("Location", lambda a: a.location.name if a.location else ""),
    ("Department", lambda a: a.department.name if a.department else ""),
    ("Status", lambda a: a.get_status_display()), ("Condition", lambda a: a.get_condition_display()),
    ("Assigned to", lambda a: a.assigned_to.name if a.assigned_to else ""),
    ("Assigned since", lambda a: a.assigned_since.isoformat() if a.assigned_since else ""),
]


@api_view(["GET"])
@authentication_classes([QueryParamTokenAuthentication])
@permission_classes([IsAuthenticated])
def assets_csv(request):
    assets = filter_assets(asset_queryset(), request.query_params).order_by("tag")
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="asset-register-{timezone.localdate()}.csv"'
    response.write("﻿")  # BOM so Excel opens UTF-8 (₦, names) correctly
    writer = csv.writer(response)
    writer.writerow([c for c, _ in CSV_COLUMNS])
    for a in assets:
        writer.writerow([fn(a) for _, fn in CSV_COLUMNS])
    return response
