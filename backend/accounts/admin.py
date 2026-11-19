from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Department, User


@admin.register(User)
class LedgerUserAdmin(UserAdmin):
    list_display = ("username", "first_name", "last_name", "role", "department", "is_active")
    list_filter = ("role", "department", "is_active")
    fieldsets = UserAdmin.fieldsets + (("Organisation", {"fields": ("role", "department")}),)


admin.site.register(Department)
