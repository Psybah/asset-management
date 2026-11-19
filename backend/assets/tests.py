from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Department, User

from . import depreciation as dep
from .models import Asset, AuditLog, Category, Location, Maintenance


class StraightLineTests(TestCase):
    def test_schedule(self):
        rows = dep.schedule(1_000_000, 100_000, 5, dep.STRAIGHT_LINE, start_year=2021)
        self.assertEqual([r.year for r in rows], [2021, 2022, 2023, 2024, 2025])
        self.assertTrue(all(r.depreciation == Decimal("180000.00") for r in rows))
        self.assertEqual([r.closing for r in rows], [Decimal(x) for x in (820000, 640000, 460000, 280000, 100000)])
        self.assertEqual(rows[1].opening, rows[0].closing)

    def test_book_value_prorated(self):
        purchased = date(2020, 1, 1)
        as_of = purchased + timedelta(days=500)
        t = Decimal(500) / Decimal("365.25")
        expected = (Decimal(1_000_000) - Decimal(180_000) * t).quantize(Decimal("0.01"))
        self.assertEqual(dep.book_value(1_000_000, 100_000, 5, dep.STRAIGHT_LINE, purchased, as_of), expected)

    def test_book_value_bounds(self):
        purchased = date(2020, 1, 1)
        self.assertEqual(dep.book_value(1_000_000, 100_000, 5, "straight_line", purchased, date(2019, 6, 1)), 1_000_000)
        self.assertEqual(dep.book_value(1_000_000, 100_000, 5, "straight_line", purchased, date(2030, 1, 1)), 100_000)
        self.assertEqual(dep.accumulated_depreciation(1_000_000, 100_000, 5, "straight_line", purchased,
                                                      date(2030, 1, 1)), 900_000)


class DecliningBalanceTests(TestCase):
    def test_schedule_double_declining(self):
        rows = dep.schedule(1_000_000, 100_000, 5, dep.DECLINING_BALANCE)
        self.assertEqual([r.depreciation for r in rows],
                         [Decimal(x) for x in ("400000", "240000", "144000", "86400", "29600")])
        self.assertEqual(rows[-1].closing, Decimal(100_000))  # last year drops exactly to salvage

    def test_never_below_salvage(self):
        rows = dep.schedule(1_000_000, 300_000, 5, dep.DECLINING_BALANCE)
        self.assertEqual([r.closing for r in rows], [Decimal(x) for x in (600000, 360000, 300000, 300000, 300000)])
        self.assertEqual(rows[2].depreciation, Decimal(60000))
        self.assertTrue(all(r.closing >= 300_000 for r in rows))

    def test_book_value_prorated_within_year(self):
        purchased = date(2020, 1, 1)
        as_of = purchased + timedelta(days=550)  # 1.5058 years -> inside year 2
        t = Decimal(550) / Decimal("365.25")
        expected = (Decimal(600_000) - Decimal(240_000) * (t - 1)).quantize(Decimal("0.01"))
        self.assertEqual(dep.book_value(1_000_000, 100_000, 5, dep.DECLINING_BALANCE, purchased, as_of), expected)

    def test_unknown_method(self):
        with self.assertRaises(ValueError):
            dep.schedule(100, 0, 3, "sum_of_years")


class ApiTestCase(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(name="IT")
        self.admin = User.objects.create_user("admin", password="admin123", role="admin", department=self.dept,
                                              first_name="Chiamaka", last_name="Okafor")
        self.manager = User.objects.create_user("manager", password="manager123", role="manager",
                                                first_name="Tunde", last_name="Bakare")
        self.staff = User.objects.create_user("staff", password="staff123", role="staff",
                                              first_name="Aisha", last_name="Bello")
        self.category = Category.objects.create(name="Laptops", icon="laptop", useful_life_years=4)
        self.location = Location.objects.create(name="Server Room", floor="2")
        self.asset = Asset.objects.create(name="HP EliteBook", category=self.category, purchase_cost=1_200_000,
                                          salvage_value=60_000, purchase_date=date.today() - timedelta(days=400),
                                          location=self.location, department=self.dept)
        self.client = APIClient()

    def as_user(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")


class AssetApiTests(ApiTestCase):
    def test_login_and_me(self):
        r = self.client.post("/api/auth/login/", {"username": "manager", "password": "manager123"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.data["user"]), {"id", "username", "name", "email", "role", "department",
                                               "department_name", "initials"})
        self.assertEqual(r.data["user"]["initials"], "TB")
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {r.data['token']}")
        self.assertEqual(self.client.get("/api/auth/me/").data["username"], "manager")
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        bad = self.client.post("/api/auth/login/", {"username": "manager", "password": "nope"}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_unauthenticated_is_rejected(self):
        self.assertEqual(self.client.get("/api/assets/").status_code, 401)

    def test_create_generates_tag_and_audits(self):
        self.as_user(self.manager)
        r = self.client.post("/api/assets/", {"name": "Dell Latitude", "category": self.category.id,
                                              "purchase_cost": 900000, "purchase_date": "2025-01-10"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["tag"], "AST-0002")
        self.assertEqual(r.data["useful_life_years"], 4)  # inherited from category
        self.assertEqual(r.data["status"], "available")
        self.assertIsInstance(r.data["current_value"], float)
        self.assertTrue(AuditLog.objects.filter(action="create", entity="asset", entity_id=r.data["id"]).exists())

    def test_staff_cannot_write(self):
        self.as_user(self.staff)
        self.assertEqual(self.client.get("/api/assets/").status_code, 200)
        self.assertEqual(self.client.post("/api/assets/", {"name": "x"}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/assets/{self.asset.id}/", {"name": "x"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/assets/{self.asset.id}/").status_code, 403)
        self.assertEqual(self.client.post(f"/api/assets/{self.asset.id}/checkout/", {"user": self.staff.id},
                                          format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/categories/", {"name": "x", "icon": "car"}, format="json").status_code, 403)

    def test_checkout_checkin_transitions(self):
        self.as_user(self.manager)
        url = f"/api/assets/{self.asset.id}"
        # checkin while available -> 400
        self.assertEqual(self.client.post(f"{url}/checkin/", {}, format="json").status_code, 400)

        r = self.client.post(f"{url}/checkout/", {"user": self.staff.id, "due_date": "2030-01-01", "note": "onboarding"},
                             format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "assigned")
        self.assertEqual(r.data["assigned_to"], self.staff.id)
        self.assertEqual(r.data["assigned_to_name"], "Aisha Bello")
        self.assertEqual(r.data["assigned_since"], timezone.localdate().isoformat())

        # second checkout -> 400
        self.assertEqual(self.client.post(f"{url}/checkout/", {"user": self.admin.id}, format="json").status_code, 400)
        active = self.client.get(f"/api/assignments/?asset={self.asset.id}&active=true").data
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0]["user_name"], "Aisha Bello")

        r = self.client.post(f"{url}/checkin/", {"condition": "fair", "note": "scratched lid"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["status"], r.data["assigned_to"], r.data["condition"]), ("available", None, "fair"))
        self.assertEqual(self.client.get("/api/assignments/?active=true").data, [])
        self.assertEqual(self.client.post(f"{url}/checkin/", {}, format="json").status_code, 400)

        types = [e["type"] for e in self.client.get(f"{url}/timeline/").data]
        self.assertEqual(types, ["checkin", "checkout"])  # newest first
        actions = [e["action"] for e in self.client.get("/api/audit/?limit=2").data]
        self.assertEqual(actions, ["checkin", "checkout"])

    def test_checkout_requires_user(self):
        self.as_user(self.manager)
        self.assertEqual(self.client.post(f"/api/assets/{self.asset.id}/checkout/", {}, format="json").status_code, 400)

    def test_dispose(self):
        self.as_user(self.manager)
        url = f"/api/assets/{self.asset.id}"
        r = self.client.post(f"{url}/dispose/", {"method": "sold", "reason": "Upgrade", "value": 300000}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "retired")
        self.assertEqual(self.client.post(f"{url}/checkout/", {"user": self.staff.id}, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"{url}/dispose/", {"method": "sold", "reason": "again"},
                                          format="json").status_code, 400)
        self.assertEqual(self.client.get(f"{url}/timeline/").data[0]["type"], "disposal")

    def test_maintenance_status_drives_asset_status(self):
        self.as_user(self.manager)
        r = self.client.post("/api/maintenance/", {"asset": self.asset.id, "kind": "corrective", "title": "Battery",
                                                   "scheduled_date": "2020-01-01", "status": "scheduled"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["overdue"])
        mid = r.data["id"]
        self.client.patch(f"/api/maintenance/{mid}/", {"status": "in_progress"}, format="json")
        self.assertEqual(Asset.objects.get(pk=self.asset.pk).status, "maintenance")
        r = self.client.patch(f"/api/maintenance/{mid}/", {"status": "done"}, format="json")
        self.assertEqual(r.data["completed_date"], timezone.localdate().isoformat())
        self.assertFalse(r.data["overdue"])
        self.assertEqual(Asset.objects.get(pk=self.asset.pk).status, "available")

    def test_maintenance_done_returns_to_assigned(self):
        self.as_user(self.manager)
        self.client.post(f"/api/assets/{self.asset.id}/checkout/", {"user": self.staff.id}, format="json")
        m = Maintenance.objects.create(asset=self.asset, title="Screen", scheduled_date=date.today())
        self.client.patch(f"/api/maintenance/{m.id}/", {"status": "in_progress"}, format="json")
        self.assertEqual(Asset.objects.get(pk=self.asset.pk).status, "maintenance")
        self.client.patch(f"/api/maintenance/{m.id}/", {"status": "done"}, format="json")
        self.assertEqual(Asset.objects.get(pk=self.asset.pk).status, "assigned")

    def test_filters_and_lookup(self):
        self.as_user(self.staff)
        self.assertEqual(len(self.client.get("/api/assets/?search=elitebook").data), 1)
        self.assertEqual(len(self.client.get("/api/assets/?status=assigned").data), 0)
        self.assertEqual(len(self.client.get(f"/api/assets/?category={self.category.id}").data), 1)
        r = self.client.get("/api/assets/by-tag/AST-0001/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], self.asset.id)
        self.assertEqual(self.client.get("/api/assets/by-tag/AST-9999/").status_code, 404)

    def test_depreciation_schedule_endpoint(self):
        self.as_user(self.staff)
        rows = self.client.get(f"/api/assets/{self.asset.id}/depreciation/").data
        self.assertEqual(len(rows), 4)
        self.assertEqual(set(rows[0]) >= {"year", "opening", "depreciation", "closing"}, True)
        self.assertEqual(rows[0]["year"], self.asset.purchase_date.year)
        self.assertEqual(rows[-1]["closing"], 60000.0)

    def test_reference_counts(self):
        self.as_user(self.staff)
        self.assertEqual(self.client.get("/api/categories/").data[0]["asset_count"], 1)
        self.assertEqual(self.client.get("/api/locations/").data[0]["asset_count"], 1)
        self.assertEqual(self.client.get("/api/departments/").data[0]["asset_count"], 1)
        people = self.client.get("/api/people/").data
        self.assertEqual(len(people), 3)
        self.assertIn("asset_count", people[0])


class DashboardQrCsvTests(ApiTestCase):
    def test_dashboard_shape(self):
        self.as_user(self.staff)
        r = self.client.get("/api/dashboard/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.data), {"totals", "by_category", "by_department", "by_status", "value_trend",
                                       "upcoming_maintenance", "recent_activity"})
        self.assertEqual(set(r.data["totals"]), {"assets", "purchase_value", "current_value", "assigned", "available",
                                                 "maintenance", "retired", "overdue_maintenance"})
        self.assertEqual(r.data["totals"]["assets"], 1)
        self.assertEqual(r.data["by_category"][0].keys(), {"name", "icon", "count", "value"})
        self.assertEqual(r.data["by_department"][0].keys(), {"name", "count", "value"})
        self.assertEqual([s["status"] for s in r.data["by_status"]], ["available", "assigned", "maintenance", "retired"])
        self.assertEqual(len(r.data["value_trend"]), 6)
        self.assertEqual(r.data["value_trend"][-1]["year"], timezone.localdate().year)
        self.assertAlmostEqual(r.data["value_trend"][-1]["value"], r.data["totals"]["current_value"], places=2)

    def test_qr_is_public_png(self):
        r = self.client.get(f"/api/assets/{self.asset.id}/qr/")  # no credentials
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "image/png")
        self.assertTrue(r.content.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_csv_with_query_token(self):
        self.assertEqual(self.client.get("/api/reports/assets.csv").status_code, 401)
        token, _ = Token.objects.get_or_create(user=self.staff)
        r = self.client.get(f"/api/reports/assets.csv?token={token.key}&status=available")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r["Content-Type"].startswith("text/csv"))
        body = r.content.decode("utf-8-sig")
        self.assertIn("AST-0001", body)
        self.assertEqual(len(body.strip().splitlines()), 2)


class SeedCommandTests(TestCase):
    def test_seed_runs(self):
        from django.core.management import call_command
        from io import StringIO

        call_command("seed", stdout=StringIO())
        self.assertEqual(Asset.objects.filter(status="assigned").count(), 25)
        self.assertTrue(User.objects.get(username="staff").check_password("staff123"))
        self.assertEqual(Asset.objects.get(pk=1).tag, "AST-0001")
        # every assigned asset has exactly one open assignment
        for a in Asset.objects.filter(status="assigned"):
            self.assertEqual(a.assignments.filter(checked_in_at__isnull=True).count(), 1)
