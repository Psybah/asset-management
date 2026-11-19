from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from . import questions as Q


def _likert(item):
    return models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], help_text=Q.SUS_ITEMS[item - 1]
    )


class SurveyResponse(models.Model):
    """One completed usability questionnaire (anonymous; no user link, no IP stored)."""

    # Section A
    department = models.CharField(max_length=30, choices=Q.choices(Q.demographic("department")["options"]))
    department_other = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=30, choices=Q.choices(Q.demographic("role")["options"]))
    role_other = models.CharField(max_length=100, blank=True)
    age_group = models.CharField(max_length=30, choices=Q.choices(Q.demographic("age_group")["options"]))
    computer_use = models.CharField(max_length=30, choices=Q.choices(Q.demographic("computer_use")["options"]))
    current_method = models.CharField(max_length=30, choices=Q.choices(Q.demographic("current_method")["options"]))
    prior_software = models.CharField(max_length=30, choices=Q.choices(Q.demographic("prior_software")["options"]))
    device = models.CharField(max_length=30, choices=Q.choices(Q.demographic("device")["options"]))

    # Section B — task ids ("T1".."T7"). `tasks_with_help` is a subset of `tasks_completed`;
    # tasks in neither list were not completed.
    tasks_completed = models.JSONField(default=list, blank=True)
    tasks_with_help = models.JSONField(default=list, blank=True)

    # Section C — SUS items, 1 = strongly disagree … 5 = strongly agree
    q1 = _likert(1)
    q2 = _likert(2)
    q3 = _likert(3)
    q4 = _likert(4)
    q5 = _likert(5)
    q6 = _likert(6)
    q7 = _likert(7)
    q8 = _likert(8)
    q9 = _likert(9)
    q10 = _likert(10)

    # Section D
    adjective = models.CharField(max_length=30, choices=Q.choices(Q.ADJECTIVE["options"]))
    comparison = models.CharField(max_length=30, choices=Q.choices(Q.COMPARISON["options"]))
    liked = models.TextField(blank=True)
    improvements = models.TextField(blank=True)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Response #{self.pk} — SUS {self.sus_score}"

    @property
    def answers(self):
        return [getattr(self, f) for f in Q.SUS_FIELDS]

    @property
    def sus_score(self):
        return Q.sus_score(self.answers)
