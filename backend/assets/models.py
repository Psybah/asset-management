import re
from datetime import date

from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import Department

from . import depreciation


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, default="package", help_text="Phosphor icon name (kebab-case)")
    useful_life_years = models.PositiveIntegerField(default=5)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Location(models.Model):
    name = models.CharField(max_length=100, unique=True)
    floor = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Asset(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        ASSIGNED = "assigned", "Assigned"
        MAINTENANCE = "maintenance", "In maintenance"
        RETIRED = "retired", "Retired"

    class Condition(models.TextChoices):
        NEW = "new", "New"
        GOOD = "good", "Good"
        FAIR = "fair", "Fair"
        POOR = "poor", "Poor"

    class Method(models.TextChoices):
        STRAIGHT_LINE = depreciation.STRAIGHT_LINE, "Straight-line"
        DECLINING_BALANCE = depreciation.DECLINING_BALANCE, "Declining balance"

    tag = models.CharField(max_length=20, unique=True, editable=False)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="assets")
    serial_number = models.CharField(max_length=100, blank=True)
    vendor = models.CharField(max_length=150, blank=True)
    purchase_date = models.DateField(default=date.today)
    purchase_cost = models.DecimalField(max_digits=14, decimal_places=2)
    salvage_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    depreciation_method = models.CharField(max_length=20, choices=Method.choices, default=Method.STRAIGHT_LINE)
    useful_life_years = models.PositiveIntegerField(null=True, blank=True)
    location = models.ForeignKey(Location, null=True, blank=True, on_delete=models.SET_NULL, related_name="assets")
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="assets"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    condition = models.CharField(max_length=10, choices=Condition.choices, default=Condition.NEW)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_assets"
    )
    assigned_since = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["tag"]

    def __str__(self):
        return f"{self.tag} {self.name}"

    @staticmethod
    def next_tag():
        numbers = [int(m.group(1)) for t in Asset.objects.values_list("tag", flat=True) if (m := re.match(r"AST-(\d+)$", t))]
        return f"AST-{(max(numbers, default=0) + 1):04d}"

    def save(self, *args, **kwargs):
        if not self.tag:
            self.tag = Asset.next_tag()
        if not self.useful_life_years and self.category_id:
            self.useful_life_years = self.category.useful_life_years
        super().save(*args, **kwargs)

    # --- depreciation -------------------------------------------------------
    @property
    def life(self):
        return self.useful_life_years or (self.category.useful_life_years if self.category_id else 0)

    def valuation_date(self, as_of=None):
        """Retired assets stop depreciating on their disposal date."""
        as_of = as_of or timezone.localdate()
        disposal = getattr(self, "disposal", None) if self.status == self.Status.RETIRED else None
        if disposal and disposal.disposed_on < as_of:
            return disposal.disposed_on
        return as_of

    def value_on(self, as_of=None):
        return depreciation.book_value(
            self.purchase_cost, self.salvage_value, self.life, self.depreciation_method,
            self.purchase_date, self.valuation_date(as_of),
        )

    @property
    def current_value(self):
        return self.value_on()

    @property
    def accumulated_depreciation(self):
        return depreciation._money(self.purchase_cost) - self.current_value

    def depreciation_schedule(self):
        return depreciation.schedule(
            self.purchase_cost, self.salvage_value, self.life, self.depreciation_method,
            start_year=self.purchase_date.year,
        )


class Assignment(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="assignments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assignments")
    checked_out_at = models.DateTimeField(default=timezone.now)
    checked_out_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    due_date = models.DateField(null=True, blank=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True)
    return_condition = models.CharField(max_length=10, choices=Asset.Condition.choices, blank=True)

    class Meta:
        ordering = ["-checked_out_at"]

    @property
    def is_active(self):
        return self.checked_in_at is None


class Maintenance(models.Model):
    class Kind(models.TextChoices):
        PREVENTIVE = "preventive", "Preventive"
        CORRECTIVE = "corrective", "Corrective"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="maintenance")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.PREVENTIVE)
    title = models.CharField(max_length=200)
    scheduled_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vendor = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["scheduled_date", "id"]
        verbose_name_plural = "maintenance"

    @property
    def overdue(self):
        return self.status != self.Status.DONE and self.scheduled_date < timezone.localdate()


class Disposal(models.Model):
    class Method(models.TextChoices):
        SOLD = "sold", "Sold"
        DONATED = "donated", "Donated"
        SCRAPPED = "scrapped", "Scrapped"
        LOST = "lost", "Lost"

    asset = models.OneToOneField(Asset, on_delete=models.CASCADE, related_name="disposal")
    method = models.CharField(max_length=10, choices=Method.choices)
    reason = models.TextField()
    value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    disposed_on = models.DateField(default=date.today)
    disposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"
        CHECKOUT = "checkout"
        CHECKIN = "checkin"
        DISPOSE = "dispose"
        MAINTENANCE = "maintenance"

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=20, choices=Action.choices)
    entity = models.CharField(max_length=50)  # e.g. "asset", "maintenance", "category"
    entity_id = models.PositiveBigIntegerField(null=True, blank=True)
    # The asset this entry concerns (if any) — powers the per-asset timeline.
    asset = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_entries")
    title = models.CharField(max_length=200, blank=True)
    summary = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-timestamp", "-id"]

    @property
    def actor_name(self):
        return self.actor.name if self.actor else "System"
