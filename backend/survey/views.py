import csv
import statistics
from collections import Counter

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from accounts.authentication import QueryParamTokenAuthentication
from accounts.permissions import IsManager

from . import questions as Q
from .models import SurveyResponse
from .serializers import SurveyResponseSerializer


class SurveySubmitThrottle(SimpleRateThrottle):
    """Per-IP limit on anonymous survey submissions (rate in REST_FRAMEWORK.DEFAULT_THROTTLE_RATES['survey'])."""

    scope = "survey"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def survey_form(request):
    return Response(Q.form_definition())


@api_view(["POST"])
@authentication_classes([])  # public: a stale token in the browser must not block a submission
@permission_classes([AllowAny])
@throttle_classes([SurveySubmitThrottle])
def survey_submit(request):
    serializer = SurveyResponseSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    response = serializer.save()
    return Response({"id": response.id, "sus_score": response.sus_score}, status=status.HTTP_201_CREATED)


def _safe_cell(value):
    """Neutralise spreadsheet formula injection in free text typed by anonymous respondents."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


def _pct(count, n):
    return round(100 * count / n, 1) if n else 0.0


def _distribution(values, options):
    counts = Counter(values)
    n = len(values)
    return [{"value": o["value"], "label": o["label"], "count": counts[o["value"]], "percent": _pct(counts[o["value"]], n)}
            for o in options]


def _band(score):
    for band in Q.SCORE_BANDS:
        if band["below"] is None or score < band["below"]:
            return band["band"]


def survey_results_data(responses):
    responses = list(responses)
    n = len(responses)
    scores = [r.sus_score for r in responses]

    def stat(fn):
        return round(fn(scores), 2) if scores else None

    bands = Counter(_band(s) for s in scores)
    histogram = []
    for start in range(0, 100, 10):
        end = start + 10
        count = sum(1 for s in scores if start <= s < end or (end == 100 and s == 100))
        histogram.append({"start": start, "end": end, "count": count})

    per_item = []
    for i, text in enumerate(Q.SUS_ITEMS):
        answers = [getattr(r, Q.SUS_FIELDS[i]) for r in responses]
        counts = Counter(answers)
        per_item.append({
            "item": i + 1,
            "text": text,
            "positive": i % 2 == 0,  # odd-numbered items are positively worded
            "mean": round(statistics.fmean(answers), 2) if answers else None,
            "counts": {str(v): counts[v] for v in range(1, 6)},
            "percents": {str(v): _pct(counts[v], n) for v in range(1, 6)},
        })

    tasks = []
    for t in Q.TASKS:
        done = sum(1 for r in responses if t["id"] in r.tasks_completed)
        helped = sum(1 for r in responses if t["id"] in r.tasks_completed and t["id"] in r.tasks_with_help)
        tasks.append({
            "id": t["id"], "text": t["text"], "completed": done, "percent": _pct(done, n),
            "without_help": done - helped, "with_help": helped, "not_completed": n - done,
        })

    comments = [
        {"id": r.id, "created_at": r.created_at, "sus_score": r.sus_score, "liked": r.liked,
         "improvements": r.improvements}
        for r in responses if r.liked.strip() or r.improvements.strip()
    ][:50]

    return {
        "n": n,
        "mean": stat(statistics.fmean),
        "median": stat(statistics.median),
        "sd": (round(statistics.stdev(scores), 2) if n > 1 else 0.0) if scores else None,
        "min": min(scores) if scores else None,
        "max": max(scores) if scores else None,
        "benchmark": 68,
        "grade_counts": [
            {"band": b["band"], "label": b["label"], "count": bands[b["band"]], "percent": _pct(bands[b["band"]], n)}
            for b in Q.SCORE_BANDS
        ],
        "histogram": histogram,
        "per_item": per_item,
        "tasks": tasks,
        "demographics": {
            d["id"]: _distribution([getattr(r, d["id"]) for r in responses], d["options"]) for d in Q.DEMOGRAPHICS
        },
        "adjectives": _distribution([r.adjective for r in responses], Q.ADJECTIVE["options"]),
        "comparisons": _distribution([r.comparison for r in responses], Q.COMPARISON["options"]),
        "comments": comments,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsManager])
def survey_results(request):
    return Response(survey_results_data(SurveyResponse.objects.order_by("-created_at", "-id")))


@api_view(["GET"])
@authentication_classes([QueryParamTokenAuthentication])
@permission_classes([IsAuthenticated, IsManager])
def survey_csv(request):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="sus-responses-{timezone.localdate()}.csv"'
    response.write("﻿")  # BOM so Excel opens UTF-8 correctly
    writer = csv.writer(response)
    demo = [d["id"] for d in Q.DEMOGRAPHICS]
    others = [d["other_field"] for d in Q.DEMOGRAPHICS if d["other_field"]]
    writer.writerow(["id", "created_at", *demo, *others, "tasks_completed", "tasks_with_help",
                     *[f.upper() for f in Q.SUS_FIELDS], "sus_score", "adjective", "comparison",
                     "liked", "improvements"])
    for r in SurveyResponse.objects.order_by("created_at", "id"):
        writer.writerow([
            r.id, timezone.localtime(r.created_at).strftime("%Y-%m-%d %H:%M"),
            *[getattr(r, f) for f in demo], *[_safe_cell(getattr(r, f)) for f in others],
            " ".join(r.tasks_completed), " ".join(r.tasks_with_help),
            *r.answers, f"{r.sus_score:.1f}", r.adjective, r.comparison,
            _safe_cell(r.liked), _safe_cell(r.improvements),
        ])
    return response
