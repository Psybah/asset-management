from django.contrib import admin

from .models import SurveyResponse


@admin.register(SurveyResponse)
class SurveyResponseAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "department", "role", "device", "adjective", "sus_score")
    list_filter = ("department", "role", "device", "adjective", "prior_software")
    readonly_fields = ("sus_score",)
    date_hierarchy = "created_at"

    @admin.display(description="SUS score")
    def sus_score(self, obj):
        return obj.sus_score
