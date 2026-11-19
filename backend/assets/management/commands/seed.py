"""`python manage.py seed` — wipe the database and load realistic demo data.

Simulates ~5 years of a Lagos corporate office's asset history: purchases, check-outs and
returns, maintenance and disposals. Every state change goes through the same service layer
the API uses, with backdated timestamps, so the audit log and per-asset timelines are
consistent with the current state of the register.
"""

import random
import string
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Department, User
from assets import audit, services
from assets.models import Asset, Category, Location, Maintenance

PASSWORD_DEFAULT = "password123"

DEPARTMENTS = ["Finance", "HR", "IT", "Operations", "Legal", "Executive"]

LOCATIONS = [
    ("Floor 1 — Reception", "1"),
    ("Floor 3 — Open Office", "3"),
    ("Server Room", "2"),
    ("Board Room", "4"),
    ("Store", "B"),
    ("Car Park & Generator House", "G"),
]

# key: (name, phosphor icon, useful life, method, salvage %)
CATEGORIES = {
    "laptop": ("Laptops", "laptop", 4, "declining_balance", 5),
    "desktop": ("Desktops", "desktop", 5, "straight_line", 5),
    "printer": ("Printers & Copiers", "printer", 5, "straight_line", 5),
    "projector": ("Projectors & Displays", "projector-screen", 5, "straight_line", 5),
    "ac": ("Air Conditioners", "air-conditioner", 8, "straight_line", 5),
    "generator": ("Generators", "lightning", 10, "straight_line", 10),
    "vehicle": ("Vehicles", "car", 5, "declining_balance", 15),
    "furniture": ("Office Furniture", "armchair", 10, "straight_line", 5),
    "phone": ("Mobile Phones", "device-mobile", 3, "declining_balance", 0),
    "network": ("Network Equipment", "wifi-high", 5, "straight_line", 0),
}

# (category, name, vendor, 2026 price in NGN, serial prefix, how many)
CATALOGUE = [
    ("laptop", "HP EliteBook 840 G9", "Slot Systems Ltd", 1_650_000, "5CD", 4),
    ("laptop", "Dell Latitude 5440", "Fouani Nigeria", 1_450_000, "DL", 4),
    ("laptop", "Lenovo ThinkPad T14 Gen 4", "Pointek Nigeria", 1_550_000, "PF", 3),
    ("laptop", 'Apple MacBook Pro 14" M3', "iStore Ikeja", 3_200_000, "C02", 3),
    ("desktop", "Dell OptiPlex 7010 + 24\" Monitor", "Fouani Nigeria", 980_000, "OPX", 4),
    ("desktop", "HP ProDesk 400 G9 + 22\" Monitor", "Slot Systems Ltd", 850_000, "8CG", 3),
    ("desktop", "Lenovo ThinkCentre M70q (Reception)", "Pointek Nigeria", 790_000, "MJ0", 1),
    ("printer", "HP LaserJet Pro M404dn", "Computer Village Office Supplies", 520_000, "PHB", 2),
    ("printer", "Kyocera ECOSYS M3655idn MFP", "Kyocera Document Solutions NG", 2_400_000, "KYC", 1),
    ("printer", "Canon imageRUNNER 2425 Copier", "Canon Office Imaging Lagos", 3_100_000, "CIR", 1),
    ("printer", "Epson EcoTank L6270", "Computer Village Office Supplies", 380_000, "X5N", 1),
    ("projector", "Epson EB-X51 Projector", "Slot Systems Ltd", 780_000, "EPX", 2),
    ("projector", "BenQ MH560 Projector", "Pointek Nigeria", 690_000, "BQM", 1),
    ("ac", "LG 1.5HP Split Air Conditioner", "LG Electronics Showroom VI", 620_000, "LGS", 3),
    ("ac", "Panasonic 2HP Split Air Conditioner", "Coolwell Engineering", 850_000, "PAN", 2),
    ("ac", "Samsung 3HP Floor-Standing AC", "Coolwell Engineering", 2_100_000, "SMF", 2),
    ("generator", "Mikano 60kVA Perkins Generator", "Mikano International", 28_000_000, "MKP", 1),
    ("generator", "Caterpillar 100kVA Diesel Generator", "Mantrac Nigeria", 46_000_000, "CAT", 1),
    ("generator", "Elepaq 7.5kVA Backup Generator", "Computer Village Office Supplies", 950_000, "EPQ", 1),
    ("vehicle", "Toyota Hilux 2.7 VVT-i (Pool)", "Elizade Nigeria", 62_000_000, "AHT", 1),
    ("vehicle", "Toyota Corolla 1.8 LE", "Elizade Nigeria", 38_000_000, "JTD", 1),
    ("vehicle", "Toyota Hiace Staff Bus", "Elizade Nigeria", 75_000_000, "JTF", 1),
    ("vehicle", "Lexus RX 350 (MD's Car)", "Elizade Nigeria", 120_000_000, "2T2", 1),
    ("furniture", "Executive Leather Office Chair", "Kaycee Office Furniture", 320_000, "FUR", 2),
    ("furniture", "12-Seater Conference Table", "Kaycee Office Furniture", 2_200_000, "FUR", 1),
    ("furniture", "Ergonomic Mesh Task Chair", "Kaycee Office Furniture", 165_000, "FUR", 1),
    ("furniture", "Steel Filing Cabinet (4-drawer)", "Kaycee Office Furniture", 210_000, "FUR", 1),
    ("furniture", "Reception Sofa Set", "Kaycee Office Furniture", 1_350_000, "FUR", 1),
    ("phone", "Apple iPhone 15", "iStore Ikeja", 1_350_000, "F2L", 2),
    ("phone", "Samsung Galaxy A55", "Samsung Experience Store Ikeja", 620_000, "R58", 2),
    ("phone", "Samsung Galaxy S24", "Samsung Experience Store Ikeja", 1_250_000, "R5C", 1),
    ("phone", "Tecno Camon 30", "Slot Systems Ltd", 380_000, "TCN", 2),
    ("network", "Cisco Catalyst 9200 48-port Switch", "Netcom Africa", 4_800_000, "FOC", 1),
    ("network", "Ubiquiti UniFi U6 Pro Access Point", "Netcom Africa", 290_000, "UBQ", 2),
    ("network", "MikroTik CCR2004 Core Router", "Netcom Africa", 1_100_000, "MKT", 1),
    ("network", "Fortinet FortiGate 60F Firewall", "Netcom Africa", 2_600_000, "FGT", 1),
]

DEFAULT_LOCATION = {
    "laptop": "Floor 3 — Open Office", "desktop": "Floor 3 — Open Office", "phone": "Floor 3 — Open Office",
    "printer": "Floor 3 — Open Office", "projector": "Board Room", "ac": "Floor 3 — Open Office",
    "generator": "Car Park & Generator House", "vehicle": "Car Park & Generator House",
    "furniture": "Floor 3 — Open Office", "network": "Server Room",
}
DEFAULT_DEPARTMENT = {
    "laptop": "IT", "desktop": "IT", "phone": "IT", "printer": "Operations", "projector": "Executive",
    "ac": "Operations", "generator": "Operations", "vehicle": "Operations", "furniture": "Operations",
    "network": "IT",
}

# Naira prices rose sharply after the 2023 devaluation; scale 2026 prices back by year.
PRICE_INDEX = {0: 1.0, 1: 0.92, 2: 0.8, 3: 0.55, 4: 0.42, 5: 0.35}

# (username, first, last, role, department, password)
USERS = [
    ("admin", "Chiamaka", "Okafor", "admin", "IT", "admin123"),
    ("manager", "Tunde", "Bakare", "manager", "Operations", "manager123"),
    ("staff", "Aisha", "Bello", "staff", "Finance", "staff123"),
    ("emeka.nwosu", "Emeka", "Nwosu", "staff", "IT", None),
    ("funmi.adeyemi", "Funmilayo", "Adeyemi", "staff", "HR", None),
    ("ibrahim.musa", "Ibrahim", "Musa", "staff", "Operations", None),
    ("ngozi.eze", "Ngozi", "Eze", "staff", "Legal", None),
    ("seun.afolabi", "Oluwaseun", "Afolabi", "staff", "Finance", None),
    ("halima.abubakar", "Halima", "Abubakar", "staff", "Executive", None),
    ("chinedu.okeke", "Chinedu", "Okeke", "staff", "IT", None),
    ("yetunde.balogun", "Yetunde", "Balogun", "staff", "HR", None),
    ("babatunde.oyelaran", "Babatunde", "Oyelaran", "manager", "Executive", None),
    ("zainab.lawal", "Zainab", "Lawal", "staff", "Legal", None),
    ("kelechi.obi", "Kelechi", "Obi", "staff", "Operations", None),
    ("damilola.ajayi", "Damilola", "Ajayi", "staff", "Finance", None),
]

ASSIGNABLE = {"laptop", "desktop", "phone", "vehicle"}


class Command(BaseCommand):
    help = "Wipe the database and load realistic demo data (Nigerian corporate office)."

    def add_arguments(self, parser):
        parser.add_argument("--seed", type=int, default=2026, help="Random seed (default 2026)")

    def handle(self, *args, **opts):
        self.rng = random.Random(opts["seed"])
        self.today = timezone.localdate()
        call_command("flush", interactive=False, verbosity=0)  # wipes data and resets id sequences
        with transaction.atomic():
            self.build()
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {User.objects.count()} users, {Department.objects.count()} departments, "
            f"{Location.objects.count()} locations, {Category.objects.count()} categories, "
            f"{Asset.objects.count()} assets, {Maintenance.objects.count()} maintenance records, "
            f"{audit_count()} audit entries."
        ))
        self.stdout.write("Logins: admin/admin123 · manager/manager123 · staff/staff123 "
                          f"(other staff use {PASSWORD_DEFAULT})")

    # ------------------------------------------------------------------ helpers
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
                     department=depts[dept], email=f"{first}.{last}@example.com".lower(),
                     is_staff=role == "admin", is_superuser=role == "admin",
                     date_joined=self.at(today - timedelta(days=5 * 365 + 60)))
            u.set_password(password or PASSWORD_DEFAULT)
            u.save()
            users.append(u)
        admin, manager = users[0], users[1]
        exec_md = next(u for u in users if u.username == "babatunde.oyelaran")
        actors = [manager, manager, manager, admin]  # managers do most of the day-to-day work

        # ---- plan purchases (oldest first so AST-0001 is the oldest asset)
        plans = []
        for key, name, vendor, price, prefix, count in CATALOGUE:
            for _ in range(count):
                days_ago = rng.randint(20, 5 * 365 - 30)
                if key in ("generator", "vehicle", "network") and rng.random() < 0.6:
                    days_ago = rng.randint(3 * 365, 5 * 365 - 30)  # big-ticket items tend to be older
                if name.startswith(("Toyota Hilux", "Mikano", "Cisco Catalyst", "Canon imageRUNNER")):
                    days_ago = rng.randint(5 * 365 - 25, 5 * 365 - 5)  # office fit-out, ~5 years ago
                plans.append((today - timedelta(days=days_ago), key, name, vendor, price, prefix))
        plans.sort(key=lambda p: p[0])

        assets = []
        for purchase_date, key, name, vendor, price, prefix in plans:
            _, _, life, method, salvage_pct = CATEGORIES[key]
            years_old = min(5, (today - purchase_date).days // 365)
            cost = Decimal(round(price * PRICE_INDEX[years_old] / 5000) * 5000)
            salvage = (cost * salvage_pct / 100).quantize(Decimal("1000"))
            created = self.at(purchase_date + timedelta(days=rng.randint(0, 3)), hour=10)
            asset = Asset.objects.create(
                name=name, category=cats[key], serial_number=self.serial(prefix), vendor=vendor,
                purchase_date=purchase_date, purchase_cost=cost, salvage_value=salvage,
                depreciation_method=method, useful_life_years=life,
                location=locs[DEFAULT_LOCATION[key]], department=depts[DEFAULT_DEPARTMENT[key]],
                condition="new", created_at=created,
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
        for asset in rng.sample([a for a in assets if a.key in ("printer", "furniture", "ac", "desktop")], 6):
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
            ("laptop", "lost", "Stolen from staff vehicle at Ojota; police report filed", None),
            ("printer", "scrapped", "Fuser and main board failed; repair costlier than replacement", None),
            ("phone", "sold", "Sold to staff at book value after handset refresh", 1.0),
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
        active = candidates[:25]
        # make sure the three demo logins and the MD have something assigned
        holders = {}
        laptops = [a for a in active if a.key == "laptop"]
        for u, asset in zip([admin, manager, users[2]], laptops):
            holders[asset.pk] = u
        lexus = next(a for a in assets if "Lexus" in a.name)
        if lexus in active:
            holders[lexus.pk] = exec_md
        others = [u for u in users]
        for asset in active:
            if asset.pk not in holders:
                holders[asset.pk] = rng.choice(others)

        # ---- history: past loans, then current assignment
        loanable = ASSIGNABLE | {"projector"}
        for asset in assets:
            end = disposal_days.get(asset.pk, today)
            if asset.key not in loanable:
                continue
            for _ in range(rng.randint(0, 2) if asset.key != "projector" else rng.randint(1, 4)):
                start = asset.cursor + timedelta(days=rng.randint(1, 20))
                length = rng.randint(1, 4) if asset.key == "projector" else rng.randint(60, 420)
                back = start + timedelta(days=length)
                if back >= end - timedelta(days=30):
                    break
                borrower = rng.choice(users)
                due = start + timedelta(days=length) if asset.key in ("projector", "vehicle") else None
                note = ("Client presentation off-site" if asset.key == "projector"
                        else rng.choice(["", "New hire onboarding", "Project deployment", "Replacement for faulty unit"]))
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
                if asset.key in ("laptop", "phone", "desktop"):
                    asset.location = locs["Floor 1 — Reception"] if (
                        holder.department.name == "HR" and asset.key == "desktop") else locs["Floor 3 — Open Office"]
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

        gens = [a for a in assets if a.key == "generator"]
        vehicles = [a for a in assets if a.key == "vehicle"]
        acs = [a for a in assets if a.key == "ac"]
        printers = [a for a in assets if a.key == "printer" and a not in disposals]
        laptops_all = [a for a in assets if a.key == "laptop" and a not in disposals]
        net = [a for a in assets if a.key == "network"]

        mikano = "Mikano International (Service Dept.)"
        for g in gens[:2]:
            for months in (9, 6, 3):
                d = today - timedelta(days=months * 30 + rng.randint(0, 10))
                if d > g.purchase_date:
                    maint(g, "preventive", "Quarterly service: oil, filters & load test", d, mikano,
                          cost=rng.choice([185_000, 240_000, 310_000]))
        maint(gens[0], "preventive", "Quarterly service: oil, filters & load test",
              today - timedelta(days=12), mikano, status="scheduled")                      # overdue
        maint(gens[1], "preventive", "Quarterly service: oil, filters & load test",
              today + timedelta(days=9), mikano, status="scheduled")
        maint(gens[2], "corrective", "Replace starter battery and carburettor clean",
              past(gens[2]), "Computer Village Office Supplies", cost=65_000)

        maint(vehicles[0], "preventive", "10,000 km service", past(vehicles[0]), "Elizade Service Centre", cost=280_000)
        maint(vehicles[1], "corrective", "Brake pads and disc replacement", past(vehicles[1]), "Elizade Service Centre",
              cost=420_000)
        maint(vehicles[2], "preventive", "Vehicle licence & roadworthiness renewal", today - timedelta(days=6),
              "Lagos State Motor Vehicle Admin Agency", status="scheduled")                 # overdue
        maint(vehicles[3], "preventive", "20,000 km service", today + timedelta(days=21), "Elizade Service Centre",
              status="scheduled")

        maint(in_progress_targets[0], "corrective", "Gas refill and compressor check", today - timedelta(days=3),
              "Coolwell Engineering", cost=95_000, status="in_progress", notes="Unit blowing warm air")
        maint(acs[-1], "preventive", "Bi-annual servicing (all split units, Floor 3)", today - timedelta(days=20),
              "Coolwell Engineering", status="scheduled")                                   # overdue
        maint(acs[1], "preventive", "Bi-annual servicing", past(acs[1]), "Coolwell Engineering", cost=45_000)

        maint(in_progress_targets[1], "corrective", "Paper jam / fuser unit replacement", today - timedelta(days=2),
              "HP Authorised Service — Computer Village", cost=135_000, status="in_progress")
        maint(printers[0], "preventive", "Drum and toner kit replacement", past(printers[0]),
              "HP Authorised Service — Computer Village", cost=88_000)

        maint(in_progress_targets[2], "corrective", "Keyboard and battery replacement", today - timedelta(days=5),
              "Slot Systems Service Desk", cost=165_000, status="in_progress", notes="Battery swelling reported")
        lt = [a for a in laptops_all if a not in in_progress_targets]
        maint(lt[1], "corrective", "Cracked screen replacement", past(lt[1]), "Slot Systems Service Desk", cost=210_000)

        maint(net[0], "preventive", "Firmware upgrade & config backup", today + timedelta(days=14), "Netcom Africa",
              status="scheduled")
        maint(net[-1], "preventive", "FortiGuard licence renewal", today - timedelta(days=4), "Netcom Africa",
              status="scheduled", notes="Licence expires end of month")                    # overdue

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
