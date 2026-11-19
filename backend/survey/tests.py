from django.core.cache import cache
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import User

from . import questions as Q
from .models import SurveyResponse
from .views import SurveySubmitThrottle

# Worked example from docs/sus-questionnaire.md: odd items 17 + even items 17 -> 34 x 2.5 = 85.0
WORKED_EXAMPLE = [4, 2, 5, 1, 4, 2, 5, 2, 4, 1]


def payload(answers=WORKED_EXAMPLE, **extra):
    data = {
        "department": "engineering", "role": "use", "age_group": "25_34", "computer_use": "daily",
        "current_method": "spreadsheet", "prior_software": "no", "device": "desktop",
        "tasks_completed": ["T1", "T2", "T4"], "tasks_with_help": ["T4"],
        "adjective": "good", "comparison": "easier", "liked": "QR labels", "improvements": "",
    }
    data.update({f"q{i}": a for i, a in enumerate(answers, start=1)})
    data.update(extra)
    return data


class SusFormulaTests(TestCase):
    def test_worked_example(self):
        self.assertEqual(Q.sus_score(WORKED_EXAMPLE), 85.0)

    def test_another_hand_computed_example(self):
        # odd: (3-1)+(4-1)+(2-1)+(5-1)+(3-1) = 12 ; even: (5-3)+(5-2)+(5-4)+(5-1)+(5-2) = 13 ; (12+13)*2.5 = 62.5
        self.assertEqual(Q.sus_score([3, 3, 4, 2, 2, 4, 5, 1, 3, 2]), 62.5)

    def test_extremes(self):
        self.assertEqual(Q.sus_score([5, 1] * 5), 100.0)
        self.assertEqual(Q.sus_score([1, 5] * 5), 0.0)
        self.assertEqual(Q.sus_score([3] * 10), 50.0)

    def test_invalid(self):
        with self.assertRaises(ValueError):
            Q.sus_score([3] * 9)
        with self.assertRaises(ValueError):
            Q.sus_score([3] * 9 + [6])

    def test_model_property(self):
        r = SurveyResponse(**{f"q{i}": a for i, a in enumerate(WORKED_EXAMPLE, start=1)})
        self.assertEqual(r.sus_score, 85.0)


class SurveyApiTestCase(TestCase):
    def setUp(self):
        cache.clear()  # throttle history
        self.client = APIClient()
        self.manager = User.objects.create_user("manager", password="manager123", role="manager")
        self.staff = User.objects.create_user("staff", password="staff123", role="staff")

    def as_user(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return token


class SurveyFormTests(SurveyApiTestCase):
    def test_form_is_public_and_mirrors_questionnaire(self):
        r = self.client.get("/api/survey/form/")
        self.assertEqual(r.status_code, 200)
        d = r.data
        self.assertEqual([x["id"] for x in d["demographics"]],
                         ["department", "role", "age_group", "computer_use", "current_method", "prior_software",
                          "device"])
        self.assertEqual([x["code"] for x in d["demographics"]], ["A1", "A2", "A3", "A4", "A5", "A6", "A7"])
        dept = d["demographics"][0]
        self.assertEqual(dept["other_field"], "department_other")
        self.assertIn({"value": "compliance_risk", "label": "Compliance & Risk"}, dept["options"])
        self.assertEqual([t["id"] for t in d["tasks"]], ["T1", "T2", "T3", "T4", "T5", "T6", "T7"])
        self.assertEqual(len(d["sus"]["items"]), 10)
        self.assertEqual(d["sus"]["items"][0], {"item": 1, "field": "q1",
                                                "text": "I think that I would like to use this system frequently."})
        self.assertEqual(d["sus"]["items"][9]["text"],
                         "I needed to learn a lot of things before I could get going with this system.")
        self.assertEqual([s["value"] for s in d["sus"]["scale"]], [1, 2, 3, 4, 5])
        self.assertEqual(len(d["adjective"]["options"]), 7)
        self.assertEqual(d["adjective"]["options"][0]["label"], "Worst imaginable")
        self.assertEqual(len(d["comparison"]["options"]), 5)
        self.assertEqual([q["id"] for q in d["open_questions"]], ["liked", "improvements"])

    def test_form_ignores_stale_token(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token not-a-real-token")
        self.assertEqual(self.client.get("/api/survey/form/").status_code, 200)


class SurveySubmitTests(SurveyApiTestCase):
    def test_submit_anonymously(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token stale")  # must not block a public submission
        r = self.client.post("/api/survey/", payload(), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(set(r.data), {"id", "sus_score"})
        self.assertEqual(r.data["sus_score"], 85.0)
        saved = SurveyResponse.objects.get(pk=r.data["id"])
        self.assertEqual(saved.tasks_completed, ["T1", "T2", "T4"])
        self.assertEqual(saved.tasks_with_help, ["T4"])
        self.assertEqual(saved.answers, WORKED_EXAMPLE)

    def test_tasks_are_deduplicated_and_ordered(self):
        r = self.client.post("/api/survey/", payload(tasks_completed=["T7", "T1", "T7"], tasks_with_help=[]),
                             format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(SurveyResponse.objects.get().tasks_completed, ["T1", "T7"])

    def test_other_text_only_kept_for_other(self):
        self.client.post("/api/survey/", payload(department="other", department_other="Internal Audit",
                                                 role_other="ignored"), format="json")
        r = SurveyResponse.objects.get()
        self.assertEqual((r.department_other, r.role_other), ("Internal Audit", ""))

    def test_validation(self):
        cases = {
            "q3": payload(q3=6),
            "q10": payload(q10=0),
            "department": payload(department="marketing"),
            "adjective": payload(adjective="great"),
            "tasks_completed": payload(tasks_completed=["T9"]),
            "tasks_with_help": payload(tasks_completed=["T1"], tasks_with_help=["T2"]),
            "device": payload(device=""),
        }
        for field, data in cases.items():
            r = self.client.post("/api/survey/", data, format="json")
            self.assertEqual(r.status_code, 400, field)
            self.assertIn(field, r.data, field)
        missing = payload()
        del missing["q5"], missing["age_group"]
        r = self.client.post("/api/survey/", missing, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("q5", r.data)
        self.assertIn("age_group", r.data)
        self.assertEqual(SurveyResponse.objects.count(), 0)

    def test_comments_are_optional(self):
        data = payload()
        del data["liked"], data["improvements"], data["tasks_completed"], data["tasks_with_help"]
        r = self.client.post("/api/survey/", data, format="json")
        self.assertEqual(r.status_code, 201, r.data)

    def test_throttled_per_ip(self):
        old_rates = SurveySubmitThrottle.THROTTLE_RATES
        SurveySubmitThrottle.THROTTLE_RATES = {"survey": "2/hour"}
        try:
            codes = [self.client.post("/api/survey/", payload(), format="json").status_code for _ in range(3)]
        finally:
            SurveySubmitThrottle.THROTTLE_RATES = old_rates
        self.assertEqual(codes, [201, 201, 429])


class SurveyResultsTests(SurveyApiTestCase):
    def submit(self, answers, **extra):
        r = self.client.post("/api/survey/", payload(answers, **extra), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data["sus_score"]

    def test_permissions(self):
        self.assertEqual(self.client.get("/api/survey/results/").status_code, 401)
        self.as_user(self.staff)
        self.assertEqual(self.client.get("/api/survey/results/").status_code, 403)
        self.as_user(self.manager)
        self.assertEqual(self.client.get("/api/survey/results/").status_code, 200)

    def test_empty(self):
        self.as_user(self.manager)
        d = self.client.get("/api/survey/results/").data
        self.assertEqual(d["n"], 0)
        self.assertIsNone(d["mean"])
        self.assertEqual(sum(b["count"] for b in d["histogram"]), 0)
        self.assertEqual(d["per_item"][0]["percents"], {"1": 0.0, "2": 0.0, "3": 0.0, "4": 0.0, "5": 0.0})

    def test_aggregation(self):
        # hand-computed scores: 85.0, 62.5, 100.0, 50.0
        scores = [
            self.submit(WORKED_EXAMPLE, adjective="excellent"),
            self.submit([3, 3, 4, 2, 2, 4, 5, 1, 3, 2], tasks_completed=["T1"], tasks_with_help=[],
                        department="finance", device="smartphone"),
            self.submit([5, 1] * 5, adjective="best_imaginable", tasks_completed=Q.TASK_IDS,
                        tasks_with_help=["T3"]),
            self.submit([3] * 10, adjective="ok", tasks_completed=[], tasks_with_help=[], department="finance"),
        ]
        self.assertEqual(scores, [85.0, 62.5, 100.0, 50.0])
        self.as_user(self.manager)
        d = self.client.get("/api/survey/results/").data
        self.assertEqual(d["n"], 4)
        self.assertEqual(d["mean"], 74.38)  # 297.5 / 4 = 74.375
        self.assertEqual(d["median"], 73.75)  # (62.5 + 85) / 2
        self.assertEqual(d["sd"], 22.4)  # sample SD: sqrt(1504.6875 / 3) = 22.396
        self.assertEqual((d["min"], d["max"]), (50.0, 100.0))
        self.assertEqual({b["band"]: b["count"] for b in d["grade_counts"]},
                         {"<50": 0, "50–67.9": 2, "68–80.2": 0, ">80.3": 2})
        hist = {(b["start"], b["end"]): b["count"] for b in d["histogram"]}
        self.assertEqual(len(hist), 10)
        self.assertEqual((hist[(50, 60)], hist[(60, 70)], hist[(80, 90)], hist[(90, 100)]), (1, 1, 1, 1))

        q1 = d["per_item"][0]
        self.assertEqual(q1["item"], 1)
        self.assertEqual(q1["text"], Q.SUS_ITEMS[0])
        self.assertEqual(q1["mean"], 3.75)  # (4+3+5+3)/4
        self.assertEqual(q1["counts"], {"1": 0, "2": 0, "3": 2, "4": 1, "5": 1})
        self.assertEqual(q1["percents"], {"1": 0.0, "2": 0.0, "3": 50.0, "4": 25.0, "5": 25.0})

        tasks = {t["id"]: t for t in d["tasks"]}
        self.assertEqual((tasks["T1"]["completed"], tasks["T1"]["percent"]), (3, 75.0))
        self.assertEqual((tasks["T4"]["completed"], tasks["T4"]["with_help"], tasks["T4"]["without_help"]), (2, 1, 1))
        self.assertEqual((tasks["T3"]["completed"], tasks["T3"]["with_help"], tasks["T3"]["not_completed"]), (1, 1, 3))

        dept = {x["value"]: x for x in d["demographics"]["department"]}
        self.assertEqual((dept["finance"]["count"], dept["finance"]["percent"]), (2, 50.0))
        self.assertEqual(dept["operations"]["count"], 0)  # every option is listed
        self.assertEqual(set(d["demographics"]), {"department", "role", "age_group", "computer_use",
                                                  "current_method", "prior_software", "device"})
        adj = {x["value"]: x["count"] for x in d["adjectives"]}
        self.assertEqual((adj["excellent"], adj["best_imaginable"], adj["ok"], adj["awful"]), (1, 1, 1, 0))
        self.assertEqual(sum(x["count"] for x in d["comparisons"]), 4)
        self.assertEqual(len(d["comments"]), 4)  # every payload has "liked"

    def test_csv(self):
        self.submit(WORKED_EXAMPLE, liked="=HYPERLINK(\"http://evil\")")
        self.assertEqual(self.client.get("/api/reports/survey.csv").status_code, 401)
        staff_token = Token.objects.create(user=self.staff)
        self.assertEqual(self.client.get(f"/api/reports/survey.csv?token={staff_token.key}").status_code, 403)
        token = Token.objects.create(user=self.manager)
        r = self.client.get(f"/api/reports/survey.csv?token={token.key}")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r["Content-Type"].startswith("text/csv"))
        lines = r.content.decode("utf-8-sig").strip().splitlines()
        self.assertEqual(len(lines), 2)
        header = lines[0].split(",")
        self.assertIn("Q10", header)
        self.assertIn("sus_score", header)
        self.assertIn("85.0", lines[1])
        self.assertIn("T1 T2 T4", lines[1])
        self.assertIn("'=HYPERLINK", lines[1])  # formula injection neutralised
