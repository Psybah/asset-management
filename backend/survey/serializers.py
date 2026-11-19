from rest_framework import serializers

from . import questions as Q
from .models import SurveyResponse


class SurveyResponseSerializer(serializers.ModelSerializer):
    tasks_completed = serializers.ListField(child=serializers.ChoiceField(choices=Q.TASK_IDS), required=False,
                                            default=list, max_length=len(Q.TASK_IDS))
    tasks_with_help = serializers.ListField(child=serializers.ChoiceField(choices=Q.TASK_IDS), required=False,
                                            default=list, max_length=len(Q.TASK_IDS))
    liked = serializers.CharField(required=False, allow_blank=True, max_length=2000, default="")
    improvements = serializers.CharField(required=False, allow_blank=True, max_length=2000, default="")
    sus_score = serializers.FloatField(read_only=True)

    class Meta:
        model = SurveyResponse
        fields = [
            "id", "department", "department_other", "role", "role_other", "age_group", "computer_use",
            "current_method", "prior_software", "device", "tasks_completed", "tasks_with_help",
            *Q.SUS_FIELDS, "adjective", "comparison", "liked", "improvements", "sus_score", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        errors = {}
        for d in Q.DEMOGRAPHICS:
            other = d["other_field"]
            if other and attrs.get(d["id"]) != "other":
                attrs[other] = ""  # only kept when "Other" was ticked
        completed = list(dict.fromkeys(attrs.get("tasks_completed", [])))
        with_help = list(dict.fromkeys(attrs.get("tasks_with_help", [])))
        if extra := [t for t in with_help if t not in completed]:
            errors["tasks_with_help"] = f"Must be a subset of tasks_completed (not completed: {', '.join(extra)})."
        if errors:
            raise serializers.ValidationError(errors)
        order = {t: i for i, t in enumerate(Q.TASK_IDS)}
        attrs["tasks_completed"] = sorted(completed, key=order.get)
        attrs["tasks_with_help"] = sorted(with_help, key=order.get)
        return attrs
