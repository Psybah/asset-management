# Ledger — backend (Django REST Framework)

API for the corporate office Asset Management System. Contract: [`../docs/API.md`](../docs/API.md).

## Setup

```bash
cd backend
python3 -m venv .venv            # Python 3.14
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed            # wipes asset data, loads the demo office (keeps survey responses)
python manage.py runserver       # http://localhost:8000/api/
```

Demo logins: `admin / admin123` · `manager / manager123` · `staff / staff123`
(the other seeded staff use `password123`).

The seed models a fictional Lagos fintech office for the case study (Squad by HabariPay):
~70 assets with backdated history, maintenance and disposals. Names, serials and prices are
invented — not Squad's records. Each asset model has a product photo from Wikimedia Commons
(`assets/seed_images/`, licences in `assets/seed_images/CREDITS.md`), copied into `media/assets/seed/`.

## Tests

```bash
python manage.py test
```

## Configuration (env vars or `backend/.env`)

| Variable | Default |
| --- | --- |
| `DATABASE_URL` | SQLite `backend/db.sqlite3` (set e.g. `postgres://user:pass@host/db` to use Postgres) |
| `FRONTEND_URL` | `http://localhost:5173` (encoded in asset QR codes as `{FRONTEND_URL}/scan/{tag}`) |
| `CORS_ALLOWED_ORIGINS` | extra comma-separated origins (localhost:5173 is always allowed) |
| `MEDIA_ROOT` | `backend/media` (uploaded asset photos, served at `/media/` when `DEBUG` is on) |
| `SURVEY_THROTTLE_RATE` | `30/hour` (public survey submissions per IP) |
| `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` | dev-friendly defaults |

## Layout

- `accounts/` — custom `User` (role: admin/manager/staff, department), departments, token login, role permission
- `assets/depreciation.py` — pure straight-line / declining-balance maths
- `assets/services.py` — checkout, check-in, dispose, maintenance status rules (+ audit entries)
- `assets/views.py` — REST endpoints, dashboard, CSV report, QR codes
- `assets/management/commands/seed.py` — demo data generator (+ `assets/seed_images/` photos)
- `survey/` — SUS usability questionnaire: question definitions (`questions.py`), public form/submit,
  manager-only results aggregation and CSV export; responses are viewable in Django admin
