"""`python manage.py seed` — wipe the asset data and load realistic demo data.

Case study: the Lagos office of Squad by HabariPay, a Nigerian fintech payments company
(a subsidiary of Guaranty Trust Holding Company). The data is FICTIONAL demo data shaped
like a fintech office (developer laptops, test devices, network gear, facilities) — the
staff names, serial numbers, prices and history are invented and are not Squad's records.

Simulates ~5 years of asset history: purchases, check-outs and returns, maintenance and
disposals. Every state change goes through the same service layer the API uses, with
backdated timestamps, so the audit log and per-asset timelines match the register.

Each asset model gets a product photo from `assets/seed_images/` (Wikimedia Commons, see
CREDITS.md), copied into MEDIA_ROOT/assets/seed/. Usability survey responses are real data
and are kept across reseeds.
"""

import random
import shutil
import string
from datetime import datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.core.management.color import no_style
from django.db import connection, transaction
from django.utils import timezone

from accounts.models import Department, User
from assets import audit, services
from assets.models import Asset, Category, Location, Maintenance
from survey.models import SurveyResponse

PASSWORD_DEFAULT = "password123"
SEED_IMAGES = Path(__file__).resolve().parents[2] / "seed_images"
SEED_MEDIA_DIR = "assets/seed"  # relative to MEDIA_ROOT

DEPARTMENTS = [
    "Engineering", "Product & Design", "Operations", "Compliance & Risk",
    "Finance", "Growth & Partnerships", "People & Culture",
]

RECEPTION, ENG_BAY, OPS_FLOOR = "Floor 1 — Reception", "Floor 2 — Engineering Bay", "Floor 3 — Operations"
LOCATIONS = [
    (RECEPTION, "1"),
    (ENG_BAY, "2"),
    (OPS_FLOOR, "3"),
    ("Server Room", "2"),
    ("Board Room", "3"),
    ("Store", "G"),
    ("Car Park & Generator House", "G"),
]
# where a department sits (assigned laptops/phones move with their holder)
DEPT_FLOOR = {
    "Engineering": ENG_BAY, "Product & Design": ENG_BAY,
    "Operations": OPS_FLOOR, "Compliance & Risk": OPS_FLOOR, "Finance": OPS_FLOOR,
    "Growth & Partnerships": RECEPTION, "People & Culture": RECEPTION,
}

# key: (name, phosphor icon, useful life, method, salvage %)
CATEGORIES = {
    "laptop": ("Laptops", "laptop", 4, "declining_balance", 5),
    "monitor": ("Monitors", "monitor", 5, "straight_line", 5),
    "phone": ("Test Devices & Phones", "device-mobile", 3, "declining_balance", 0),
    "pos": ("POS Terminals", "credit-card", 3, "straight_line", 0),
    "network": ("Network Equipment", "wifi-high", 5, "straight_line", 0),
    "server": ("Servers & UPS", "hard-drives", 5, "straight_line", 5),
    "printer": ("Printers & Copiers", "printer", 5, "straight_line", 5),
    "projector": ("Projectors & AV", "projector-screen", 5, "straight_line", 5),
    "ac": ("Air Conditioners", "air-conditioner", 8, "straight_line", 5),
    "generator": ("Generators", "lightning", 10, "straight_line", 10),
    "vehicle": ("Vehicles", "car", 5, "declining_balance", 15),
    "furniture": ("Office Furniture", "armchair", 10, "straight_line", 5),
}

# (category, name, vendor, 2026 price in NGN, serial prefix, how many, photo, default location)
# A list of locations is cycled through for multi-unit models.
CATALOGUE = [
    ("laptop", 'Apple MacBook Pro 16" M1 Pro', "iStore Lagos", 4_300_000, "C02", 7, "macbook-pro-16.jpg", ENG_BAY),
    ("laptop", 'Apple MacBook Air 13" M1', "iStore Lagos", 1_850_000, "FVF", 3, "macbook-air-13.jpg", ENG_BAY),
    ("laptop", "Lenovo ThinkPad T14", "Pointek Nigeria", 1_550_000, "PF", 4, "thinkpad.jpg", OPS_FLOOR),
    ("laptop", "HP EliteBook 840 G8", "Slot Systems Ltd", 1_600_000, "5CD", 4, "hp-elitebook.jpg", OPS_FLOOR),
    ("monitor", 'Dell 34" Curved Monitor S3423DWC', "Slot Systems Ltd", 720_000, "CN0", 6,
     "dell-curved-monitor.jpg", ENG_BAY),
    ("phone", "Apple iPhone 14 Pro (test device)", "iStore Lagos", 1_450_000, "F2L", 2, "iphone.jpg", ENG_BAY),
    ("phone", "Samsung Galaxy S23 (test device)", "Samsung Experience Store Ikeja", 1_150_000, "R5C", 2,
     "samsung-galaxy.jpg", ENG_BAY),
    ("phone", "itel A50 (low-end Android test device)", "Computer Village Phone Mart", 95_000, "ITL", 3,
     "android-budget-phone.jpg", ENG_BAY),
    ("pos", "PAX A920 Pro Android POS Terminal", "Ikeja POS Hardware Distributors", 450_000, "PAX", 4,
     "pos-terminal.jpg", OPS_FLOOR),
    ("network", "Cisco Catalyst 4506-E Core Switch", "Netcom Africa", 9_500_000, "FOX", 1, "cisco-switch.jpg",
     "Server Room"),
    ("network", "Ubiquiti UniFi U7 Pro Access Point", "Netcom Africa", 420_000, "UBQ", 4, "ubiquiti-ap.jpg",
     [RECEPTION, ENG_BAY, OPS_FLOOR, "Board Room"]),
    ("network", "Fortinet FortiGate Next-Gen Firewall", "Netcom Africa", 6_500_000, "FGT", 1,
     "fortigate-firewall.jpg", "Server Room"),
    ("server", "Dell PowerEdge R-series Rack Server", "Pointek Nigeria", 9_800_000, "SVR", 2, "rack-server.jpg",
     "Server Room"),
    ("server", "APC Smart-UPS 2200VA", "Netcom Africa", 1_350_000, "AS", 2, "apc-ups.jpg", "Server Room"),
    ("printer", "HP LaserJet 1020 Plus", "Computer Village Office Supplies", 260_000, "CNB", 2, "hp-laserjet.jpg",
     [OPS_FLOOR, RECEPTION]),
    ("printer", "Canon imageRUNNER ADVANCE Colour MFP", "Canon Office Imaging Lagos", 9_500_000, "CIR", 1,
     "mfp-copier.jpg", OPS_FLOOR),
    ("projector", "Epson EX3280 Projector", "Slot Systems Ltd", 750_000, "EPX", 2, "epson-projector.jpg",
     "Board Room"),
    ("ac", "Split Air Conditioner 1.5HP (wall-mounted)", "Coolwell Engineering", 650_000, "SAC", 4, "split-ac.jpg",
     [RECEPTION, ENG_BAY, OPS_FLOOR, "Server Room"]),
    ("ac", "Floor-Standing Air Conditioner 3HP", "Coolwell Engineering", 2_300_000, "FAC", 2, "floor-ac.jpg",
     ["Board Room", ENG_BAY]),
    ("generator", "Caterpillar 100kVA Diesel Generator", "Mantrac Nigeria", 48_000_000, "CAT", 1,
     "diesel-generator.jpg", "Car Park & Generator House"),
    ("vehicle", "Toyota Hilux 2.4 Double Cab (pool)", "Elizade Nigeria", 65_000_000, "AHT", 1, "toyota-hilux.jpg",
     "Car Park & Generator House"),
    ("vehicle", "Toyota Corolla 1.8 LE (pool)", "Elizade Nigeria", 40_000_000, "JTD", 1, "toyota-corolla.jpg",
     "Car Park & Generator House"),
    ("vehicle", "Toyota Hiace Van (logistics)", "Elizade Nigeria", 78_000_000, "JTF", 1, "toyota-hiace.jpg",
     "Car Park & Generator House"),
    ("furniture", "Ergonomic Mesh Task Chair", "Kaycee Office Furniture", 185_000, "FUR", 4, "office-chair.jpg",
     ENG_BAY),
    ("furniture", "12-Seater Conference Table", "Kaycee Office Furniture", 2_400_000, "FUR", 1,
     "conference-table.jpg", "Board Room"),
    ("furniture", "Electric Sit-Stand Desk", "Kaycee Office Furniture", 650_000, "FUR", 4, "standing-desk.jpg",
     ENG_BAY),
]

DEFAULT_DEPARTMENT = {
    "laptop": "Engineering", "monitor": "Engineering", "phone": "Engineering", "pos": "Operations",
    "network": "Engineering", "server": "Engineering", "printer": "Operations", "projector": "Operations",
    "ac": "Operations", "generator": "Operations", "vehicle": "Operations", "furniture": "Operations",
}

# Naira prices rose sharply after the 2023 devaluation; scale 2026 prices back by year.
PRICE_INDEX = {0: 1.0, 1: 0.92, 2: 0.8, 3: 0.55, 4: 0.42, 5: 0.35}

# (username, first, last, role, department, password) — fictional people
USERS = [
    ("admin", "Chiamaka", "Okafor", "admin", "Engineering", "admin123"),
    ("manager", "Tunde", "Bakare", "manager", "Operations", "manager123"),
    ("staff", "Aisha", "Bello", "staff", "Finance", "staff123"),
    ("emeka.nwosu", "Emeka", "Nwosu", "staff", "Engineering", None),
    ("funmi.adeyemi", "Funmilayo", "Adeyemi", "staff", "People & Culture", None),
    ("ibrahim.musa", "Ibrahim", "Musa", "staff", "Operations", None),
    ("ngozi.eze", "Ngozi", "Eze", "staff", "Compliance & Risk", None),
    ("seun.afolabi", "Oluwaseun", "Afolabi", "staff", "Finance", None),
    ("halima.abubakar", "Halima", "Abubakar", "staff", "Growth & Partnerships", None),
    ("chinedu.okeke", "Chinedu", "Okeke", "staff", "Engineering", None),
    ("yetunde.balogun", "Yetunde", "Balogun", "staff", "Product & Design", None),
    ("babatunde.oyelaran", "Babatunde", "Oyelaran", "manager", "Engineering", None),
    ("zainab.lawal", "Zainab", "Lawal", "staff", "Compliance & Risk", None),
    ("kelechi.obi", "Kelechi", "Obi", "staff", "Engineering", None),
    ("damilola.ajayi", "Damilola", "Ajayi", "staff", "Product & Design", None),
    ("tobi.adebayo", "Oluwatobi", "Adebayo", "staff", "Engineering", None),
    ("ifeoma.nnaji", "Ifeoma", "Nnaji", "staff", "Growth & Partnerships", None),
    ("usman.danjuma", "Usman", "Danjuma", "staff", "Operations", None),
    # Project supervisor — admin access for assessment (no department)
    ("oladejo", "Prof. B. F.", "Oladejo", "admin", None, "oladejo123"),
]

ASSIGNABLE = {"laptop", "monitor", "phone", "pos", "vehicle"}
ACTIVE_ASSIGNMENTS = 30
TECH = {"Engineering", "Product & Design"}


class Command(BaseCommand):
    help = "Wipe the asset data and load realistic demo data (Lagos fintech office). Keeps survey responses."

    def add_arguments(self, parser):
        parser.add_argument("--seed", type=int, default=2026, help="Random seed (default 2026)")

    def handle(self, *args, **opts):
        self.rng = random.Random(opts["seed"])
        self.today = timezone.localdate()

        # Survey responses are real usability data: keep them across the flush.
        kept_responses = list(SurveyResponse.objects.values())
        call_command("flush", interactive=False, verbosity=0)  # wipes data and resets id sequences
        if kept_responses:
            SurveyResponse.objects.bulk_create([SurveyResponse(**row) for row in kept_responses])
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [SurveyResponse]):
                    cursor.execute(sql)

        self.install_images()
        with transaction.atomic():
            self.build()
        with_photo = Asset.objects.exclude(image="").count()
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {User.objects.count()} users, {Department.objects.count()} departments, "
            f"{Location.objects.count()} locations, {Category.objects.count()} categories, "
            f"{Asset.objects.count()} assets ({with_photo} with photos), "
            f"{Maintenance.objects.count()} maintenance records, {audit_count()} audit entries. "
            f"Kept {len(kept_responses)} survey responses."
        ))
        self.stdout.write("Logins: admin/admin123 · oladejo/oladejo123 (supervisor) · manager/manager123 · staff/staff123 "
                          f"(other staff use {PASSWORD_DEFAULT})")

    # ------------------------------------------------------------------ helpers
    def install_images(self):
        """Fresh copy of the seed photos; uploads for the wiped assets are discarded too."""
        media_assets = Path(settings.MEDIA_ROOT) / "assets"
        shutil.rmtree(media_assets, ignore_errors=True)
        target = Path(settings.MEDIA_ROOT) / SEED_MEDIA_DIR
        target.mkdir(parents=True, exist_ok=True)
        for *_, photo, _ in CATALOGUE:
            src = SEED_IMAGES / photo
            if src.exists():
                shutil.copyfile(src, target / photo)
            else:
                self.stderr.write(f"Missing seed image {src}")

    def at(self, day, hour=None):
        hour = hour if hour is not None else self.rng.randint(8, 17)
        stamp = timezone.make_aware(datetime.combine(day, time(hour, self.rng.randint(0, 59))))
        return min(stamp, timezone.now() - timedelta(minutes=5))  # never in the future

    def serial(self, prefix):
        return prefix + "".join(self.rng.choices(string.ascii_uppercase + string.digits, k=8))

    def condition_for(self, purchase_date, on=None):
        age = ((on or self.today) - purchase_date).days / 365.25
        if age < 0.75:
            return "new"
        if age < 3:
            return "good"
        return "fair" if age < 4.5 or self.rng.random() < 0.6 else "poor"

    # ------------------------------------------------------------------ build
    def build(self):
        rng, today = self.rng, self.today
        depts = {name: Department.objects.create(name=name) for name in DEPARTMENTS}
        locs = {name: Location.objects.create(name=name, floor=floor) for name, floor in LOCATIONS}
        cats = {
            key: Category.objects.create(name=name, icon=icon, useful_life_years=life)
            for key, (name, icon, life, _, _) in CATEGORIES.items()
        }

        users = []
        for username, first, last, role, dept, password in USERS:
            u = User(username=username, first_name=first, last_name=last, role=role,
                     department=depts[dept] if dept else None,
                     email=f"{first.replace('Prof. ', '').replace('. ', '').replace('.', '')}.{last}@example.com".lower(),
                     is_staff=role == "admin", is_superuser=role == "admin",
                     date_joined=self.at(today - timedelta(days=5 * 365 + 60)))
            u.set_password(password or PASSWORD_DEFAULT)
            u.save()
            if dept:  # the supervisor account has no department and holds no assets
                users.append(u)
        admin, manager = users[0], users[1]
        actors = [manager, manager, manager, admin]  # managers do most of the day-to-day work

        def pool_for(asset):
            """Plausible holders: dev kit to Engineering/Product, business laptops to everyone else."""
            if asset.key == "vehicle":
                return [u for u in users if u.department.name == "Operations"]
            if asset.key == "monitor" or "MacBook Pro" in asset.name:
                return [u for u in users if u.department.name in TECH]
            if asset.key == "laptop":
                return [u for u in users if u.department.name not in TECH] + \
                       ([u for u in users if u.department.name == "Product & Design"] if "Air" in asset.name else [])
            if asset.key in ("phone", "pos"):
                return [u for u in users if u.department.name in TECH | {"Operations"}]
            return users

        # ---- plan purchases (oldest first so AST-0001 is the oldest asset)
        plans = []
        for key, name, vendor, price, prefix, count, photo, location in CATALOGUE:
            for i in range(count):
                days_ago = rng.randint(20, 5 * 365 - 30)
                if key in ("generator", "vehicle", "network", "server") and rng.random() < 0.6:
                    days_ago = rng.randint(3 * 365, 5 * 365 - 30)  # big-ticket items tend to be older
                if name.startswith(("Caterpillar", "Cisco Catalyst", "12-Seater", "Toyota Hilux")):
                    days_ago = rng.randint(5 * 365 - 25, 5 * 365 - 5)  # office fit-out, ~5 years ago
                loc = location[i % len(location)] if isinstance(location, list) else location
                plans.append((today - timedelta(days=days_ago), key, name, vendor, price, prefix, photo, loc))
        plans.sort(key=lambda p: p[0])

        assets = []
        for purchase_date, key, name, vendor, price, prefix, photo, loc in plans:
            _, _, life, method, salvage_pct = CATEGORIES[key]
            years_old = min(5, (today - purchase_date).days // 365)
            cost = Decimal(round(price * PRICE_INDEX[years_old] / 5000) * 5000)
            salvage = (cost * salvage_pct / 100).quantize(Decimal("1000"))
            created = self.at(purchase_date + timedelta(days=rng.randint(0, 3)), hour=10)
            asset = Asset.objects.create(
                name=name, category=cats[key], serial_number=self.serial(prefix), vendor=vendor,
                purchase_date=purchase_date, purchase_cost=cost, salvage_value=salvage,
                depreciation_method=method, useful_life_years=life,
                location=locs[loc], department=depts[DEFAULT_DEPARTMENT[key]],
                condition="new", created_at=created, image=f"{SEED_MEDIA_DIR}/{photo}",
            )
            asset.key = key
            asset.cursor = created.date() + timedelta(days=2)
            asset.returned = False
            actor = rng.choice(actors)
            audit.log(actor, "create", "asset", asset.pk,
                      f"{actor.name} registered {asset.tag} {asset.name} (₦{float(cost):,.2f}) from {vendor}",
                      asset=asset, title="Asset registered", timestamp=created)
            assets.append(asset)

        # a few assets were received into the Store first and then deployed
        for asset in rng.sample([a for a in assets if a.key in ("printer", "furniture", "ac", "monitor")], 6):
            when = self.at(asset.cursor)
            dest = asset.location
            audit.log(manager, "update", "asset", asset.pk,
                      f"{manager.name} updated {asset.tag} — location: Store → {dest.name}",
                      asset=asset, title="Details updated", timestamp=when)
            asset.cursor += timedelta(days=1)

        # ---- decide end states
        by_age = sorted(assets, key=lambda a: a.purchase_date)
        disposals = []
        for key, method, reason, value_pct in [
            ("laptop", "lost", "Stolen from a staff member's car at Ojota; police report filed", None),
            ("printer", "scrapped", "Fuser and main board failed; repair costlier than replacement", None),
            ("phone", "sold", "Sold to staff at book value after the test-device refresh", 1.0),
            ("pos", "scrapped", "Card reader and battery failed after drop; out of warranty", None),
        ]:
            asset = next(a for a in by_age if a.key == key and a not in disposals)
            asset.disposal_plan = (method, reason, value_pct)
            disposals.append(asset)
        disposal_days = {a.pk: today - timedelta(days=rng.randint(40, 200)) for a in disposals}

        in_progress_targets = [
            next(a for a in by_age if a.key == "ac" and a not in disposals),
            next(a for a in reversed(by_age) if a.key == "printer" and a not in disposals),
            next(a for a in by_age if a.key == "laptop" and a not in disposals),
        ]

        candidates = [a for a in assets if a.key in ASSIGNABLE and a not in disposals and a not in in_progress_targets]
        rng.shuffle(candidates)
        active = candidates[:ACTIVE_ASSIGNMENTS]
        # make sure the three demo logins have a laptop each
        holders = {}
        laptops = [a for a in active if a.key == "laptop"]
        for u in (admin, manager, users[2]):
            choice = next((a for a in laptops if a.pk not in holders and u in pool_for(a)), None) or \
                next((a for a in laptops if a.pk not in holders), None)
            if choice:
                holders[choice.pk] = u
        held = {(holders[a.pk].pk, a.key) for a in active if a.pk in holders}
        for asset in active:
            if asset.pk not in holders:
                # one laptop / monitor / vehicle per person where possible
                pool = pool_for(asset)
                free = [u for u in pool if (u.pk, asset.key) not in held] or pool
                holders[asset.pk] = rng.choice(free)
                held.add((holders[asset.pk].pk, asset.key))

        # ---- history: past loans, then current assignment
        loanable = ASSIGNABLE | {"projector"}
        for asset in assets:
            end = disposal_days.get(asset.pk, today)
            if asset.key not in loanable:
                continue
            for _ in range(rng.randint(0, 2) if asset.key != "projector" else rng.randint(1, 4)):
                start = asset.cursor + timedelta(days=rng.randint(1, 20))
                short = asset.key in ("projector", "pos")
                length = rng.randint(1, 6) if short else rng.randint(60, 420)
                back = start + timedelta(days=length)
                if back >= end - timedelta(days=30):
                    break
                borrower = rng.choice(pool_for(asset) if asset.key != "projector" else users)
                due = start + timedelta(days=length) if asset.key in ("projector", "vehicle", "pos") else None
                if asset.key == "projector":
                    note = rng.choice(["Merchant onboarding workshop off-site", "Partner pitch at Victoria Island",
                                       "Town hall"])
                elif asset.key == "pos":
                    note = rng.choice(["Field test with a pilot merchant", "Terminal integration testing"])
                else:
                    note = rng.choice(["", "New hire onboarding", "Project deployment", "Replacement for faulty unit"])
                actor = rng.choice(actors)
                services.checkout(asset, borrower, actor, due_date=due, note=note, when=self.at(start))
                cond = self.condition_for(asset.purchase_date, back).replace("new", "good")
                services.checkin(asset, rng.choice(actors), condition=cond,
                                 note="" if rng.random() < 0.7 else "Returned on exit/role change", when=self.at(back))
                asset.returned = True
                asset.cursor = back + timedelta(days=1)
            if asset in active:
                start = asset.cursor + timedelta(days=rng.randint(1, 30))
                if start >= today:
                    start = max(asset.cursor, today - timedelta(days=1))
                holder = holders[asset.pk]
                due = start + timedelta(days=rng.randint(30, 120)) if asset.key == "vehicle" else None
                services.checkout(asset, holder, rng.choice(actors), due_date=due, when=self.at(start))
                asset.department = holder.department
                if asset.key in ("laptop", "phone", "monitor", "pos"):
                    asset.location = locs[DEPT_FLOOR[holder.department.name]]
                if not asset.returned:
                    asset.condition = self.condition_for(asset.purchase_date)
                asset.save(update_fields=["department", "location", "condition"])

        for asset in assets:
            if not asset.returned and asset not in active:
                asset.condition = self.condition_for(asset.purchase_date)
                asset.save(update_fields=["condition"])

        # ---- maintenance
        def maint(asset, kind, title, sched, vendor, cost=0, status="done", completed=None, notes=""):
            record = Maintenance.objects.create(
                asset=asset, kind=kind, title=title, scheduled_date=sched, vendor=vendor,
                cost=Decimal(cost), status="scheduled", notes=notes,
                created_at=self.at(max(asset.purchase_date + timedelta(days=1),
                                       min(sched - timedelta(days=rng.randint(5, 20)), today - timedelta(days=1)))),
            )
            services.log_maintenance(record, rng.choice(actors), verb="scheduled", when=record.created_at)
            if status in ("in_progress", "done"):
                started = min(sched, today)
                record.status = "in_progress"
                record.save(update_fields=["status"])
                if status == "in_progress":
                    services.apply_maintenance_status(record, "scheduled")
                    services.log_maintenance(record, rng.choice(actors), verb="started", when=self.at(started))
            if status == "done":
                record.status = "done"
                record.completed_date = completed or (sched + timedelta(days=rng.randint(0, 3)))
                record.save(update_fields=["status", "completed_date"])
                services.log_maintenance(record, rng.choice(actors), verb="completed", when=self.at(record.completed_date))
            return record

        def past(asset, lo=60, hi=900):
            """A date in the asset's past life, before disposal."""
            end = disposal_days.get(asset.pk, today)
            span = (end - asset.purchase_date).days
            return asset.purchase_date + timedelta(days=rng.randint(min(lo, span // 2), max(min(hi, span - 10), min(lo, span // 2))))

        def of(key):
            return [a for a in assets if a.key == key and a not in disposals]

        def named(text):
            return next(a for a in assets if text in a.name and a not in disposals)

        generator = of("generator")[0]
        vehicles, acs, printers, net = of("vehicle"), of("ac"), of("printer"), of("network")
        ups = [a for a in of("server") if "UPS" in a.name]
        servers = [a for a in of("server") if "PowerEdge" in a.name]

        mantrac = "Mantrac Nigeria (Service Dept.)"
        for months in (12, 9, 6, 3):
            d = today - timedelta(days=months * 30 + rng.randint(0, 10))
            if d > generator.purchase_date:
                maint(generator, "preventive", "Quarterly service: oil, filters & load test", d, mantrac,
                      cost=rng.choice([285_000, 340_000, 410_000]))
        maint(generator, "preventive", "Quarterly service: oil, filters & load test",
              today - timedelta(days=12), mantrac, status="scheduled")                      # overdue
        maint(generator, "corrective", "Replace starter battery and fuel filter", past(generator), mantrac,
              cost=165_000)
        maint(ups[0], "corrective", "Replace UPS battery pack", past(ups[0]), "Netcom Africa", cost=420_000)
        maint(ups[-1], "preventive", "Battery health check & load test", today + timedelta(days=9), "Netcom Africa",
              status="scheduled")
        maint(servers[0], "corrective", "Replace failed RAID disk", past(servers[0]), "Pointek Nigeria", cost=380_000)

        maint(vehicles[0], "preventive", "10,000 km service", past(vehicles[0]), "Elizade Service Centre", cost=280_000)
        maint(vehicles[1], "corrective", "Brake pads and disc replacement", past(vehicles[1]), "Elizade Service Centre",
              cost=420_000)
        maint(vehicles[2], "preventive", "Vehicle licence & roadworthiness renewal", today - timedelta(days=6),
              "Lagos State Motor Vehicle Admin Agency", status="scheduled")                 # overdue
        maint(vehicles[0], "preventive", "20,000 km service", today + timedelta(days=21), "Elizade Service Centre",
              status="scheduled")

        maint(in_progress_targets[0], "corrective", "Gas refill and compressor check", today - timedelta(days=3),
              "Coolwell Engineering", cost=95_000, status="in_progress", notes="Unit blowing warm air")
        maint(acs[-1], "preventive", "Bi-annual servicing (all split units)", today - timedelta(days=20),
              "Coolwell Engineering", status="scheduled")                                   # overdue
        maint(acs[1], "preventive", "Bi-annual servicing", past(acs[1]), "Coolwell Engineering", cost=45_000)

        maint(in_progress_targets[1], "corrective", "Paper jam / fuser unit replacement", today - timedelta(days=2),
              "Canon Office Imaging Lagos" if "Canon" in in_progress_targets[1].name
              else "HP Authorised Service — Computer Village", cost=135_000, status="in_progress")
        maint(printers[0], "preventive", "Drum and toner kit replacement", past(printers[0]),
              "HP Authorised Service — Computer Village", cost=88_000)

        maint(in_progress_targets[2], "corrective", "Keyboard and battery replacement", today - timedelta(days=5),
              "iStore Lagos Service Centre" if "Apple" in in_progress_targets[2].name else "Slot Systems Service Desk",
              cost=165_000, status="in_progress", notes="Battery swelling reported")
        lt = [a for a in of("laptop") if a not in in_progress_targets]
        maint(lt[1], "corrective", "Cracked screen replacement", past(lt[1]),
              "iStore Lagos Service Centre" if "Apple" in lt[1].name else "Slot Systems Service Desk", cost=210_000)

        maint(named("Cisco Catalyst"), "preventive", "Firmware upgrade & config backup", today + timedelta(days=14),
              "Netcom Africa", status="scheduled")
        maint(named("FortiGate"), "preventive", "FortiGuard licence renewal", today - timedelta(days=4),
              "Netcom Africa", status="scheduled", notes="Licence expires end of month")    # overdue
        maint(net[1], "corrective", "Replace PoE injector", past(net[1]), "Netcom Africa", cost=35_000)
        pos = of("pos")
        maint(pos[0], "preventive", "Terminal firmware update & key re-injection", today + timedelta(days=5),
              "Ikeja POS Hardware Distributors", status="scheduled")

        # ---- disposals (last, so nothing happens after them)
        for asset in disposals:
            method, reason, value_pct = asset.disposal_plan
            when = self.at(disposal_days[asset.pk])
            asset.refresh_from_db()
            value = None
            if value_pct:
                value = asset.value_on(when.date()).quantize(Decimal("1000"))
            services.dispose(asset, admin, method, reason, value, when=when)


def audit_count():
    from assets.models import AuditLog

    return AuditLog.objects.count()
