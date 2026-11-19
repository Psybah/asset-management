from rest_framework import serializers

from .models import Asset, Assignment, AuditLog, Category, Location, Maintenance


class CategorySerializer(serializers.ModelSerializer):
    asset_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "icon", "useful_life_years", "asset_count"]


class LocationSerializer(serializers.ModelSerializer):
    asset_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Location
        fields = ["id", "name", "floor", "asset_count"]


class AssetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_icon = serializers.CharField(source="category.icon", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True, default=None)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    assigned_to_name = serializers.CharField(source="assigned_to.name", read_only=True, default=None)
    current_value = serializers.SerializerMethodField()
    accumulated_depreciation = serializers.SerializerMethodField()
    useful_life_years = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    class Meta:
        model = Asset
        fields = [
            "id", "tag", "name", "category", "category_name", "category_icon",
            "serial_number", "vendor", "purchase_date", "purchase_cost", "salvage_value",
            "depreciation_method", "useful_life_years",
            "location", "location_name", "department", "department_name",
            "status", "condition", "assigned_to", "assigned_to_name", "assigned_since",
            "current_value", "accumulated_depreciation", "notes", "created_at", "updated_at",
        ]
        read_only_fields = ["tag", "assigned_to", "assigned_since", "created_at", "updated_at"]

    def get_current_value(self, obj):
        return float(obj.current_value)

    def get_accumulated_depreciation(self, obj):
        return float(obj.accumulated_depreciation)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["useful_life_years"] = instance.life
        return data

    def validate_status(self, value):
        current = self.instance.status if self.instance else Asset.Status.AVAILABLE
        if value != current:
            if value == Asset.Status.ASSIGNED:
                raise serializers.ValidationError("Use the checkout action to assign an asset.")
            if value == Asset.Status.RETIRED:
                raise serializers.ValidationError("Use the dispose action to retire an asset.")
            if current in (Asset.Status.ASSIGNED, Asset.Status.RETIRED):
                raise serializers.ValidationError(
                    f"Asset is {current}; check it in first." if current == Asset.Status.ASSIGNED
                    else "Retired assets cannot be reactivated."
                )
        return value

    def validate(self, attrs):
        cost = attrs.get("purchase_cost", getattr(self.instance, "purchase_cost", None))
        salvage = attrs.get("salvage_value", getattr(self.instance, "salvage_value", 0)) or 0
        if cost is not None and cost < 0:
            raise serializers.ValidationError({"purchase_cost": "Must be zero or more."})
        if cost is not None and salvage > cost:
            raise serializers.ValidationError({"salvage_value": "Salvage value cannot exceed purchase cost."})
        return attrs


class AssignmentSerializer(serializers.ModelSerializer):
    asset_tag = serializers.CharField(source="asset.tag", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = Assignment
        fields = ["id", "asset", "asset_tag", "asset_name", "user", "user_name",
                  "checked_out_at", "due_date", "checked_in_at", "note", "return_condition"]


class MaintenanceSerializer(serializers.ModelSerializer):
    asset_tag = serializers.CharField(source="asset.tag", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Maintenance
        fields = ["id", "asset", "asset_tag", "asset_name", "kind", "title", "scheduled_date",
                  "completed_date", "cost", "vendor", "status", "notes", "overdue"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "actor_name", "action", "entity", "entity_id", "summary", "timestamp"]


TIMELINE_TYPE = {
    "create": "created", "update": "update", "checkout": "checkout", "checkin": "checkin",
    "maintenance": "maintenance", "dispose": "disposal", "delete": "update",
}
DEFAULT_TITLE = {
    "create": "Asset registered", "update": "Details updated", "checkout": "Checked out",
    "checkin": "Checked in", "maintenance": "Maintenance", "dispose": "Disposed", "delete": "Deleted",
}


class TimelineSerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    detail = serializers.CharField(source="summary")
    actor_name = serializers.CharField(read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "type", "title", "detail", "actor_name", "timestamp"]

    def get_type(self, obj):
        return TIMELINE_TYPE.get(obj.action, "update")

    def get_title(self, obj):
        return obj.title or DEFAULT_TITLE.get(obj.action, obj.action.title())
