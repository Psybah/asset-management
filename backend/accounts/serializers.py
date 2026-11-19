from rest_framework import serializers

from .models import Department, User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    initials = serializers.CharField(read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = ["id", "username", "name", "email", "role", "department", "department_name", "initials"]


class PersonSerializer(UserSerializer):
    asset_count = serializers.IntegerField(read_only=True)

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ["asset_count"]


class DepartmentSerializer(serializers.ModelSerializer):
    asset_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "asset_count"]
