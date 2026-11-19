from django.contrib import admin

from .models import Asset, Assignment, AuditLog, Category, Disposal, Location, Maintenance


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("tag", "name", "category", "status", "department", "assigned_to", "purchase_cost")
    list_filter = ("status", "category", "department", "location")
    search_fields = ("tag", "name", "serial_number", "vendor")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "actor", "action", "entity", "entity_id", "summary")
    list_filter = ("action", "entity")


admin.site.register([Category, Location, Assignment, Maintenance, Disposal])
