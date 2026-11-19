# Ledger — backend (Django REST Framework)

API for the corporate office Asset Management System. Contract: [`../docs/API.md`](../docs/API.md).

## Setup

```bash
cd backend
python3 -m venv .venv            # Python 3.14
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed            # wipes the DB and loads demo data
python manage.py runserver       # http://localhost:8000/api/
```

Demo logins: `admin / admin123` · `manager / manager123` · `staff / staff123`
(the other seeded staff use `password123`).

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
| `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` | dev-friendly defaults |

## Layout

- `accounts/` — custom `User` (role: admin/manager/staff, department), departments, token login, role permission
- `assets/depreciation.py` — pure straight-line / declining-balance maths
- `assets/services.py` — checkout, check-in, dispose, maintenance status rules (+ audit entries)
- `assets/views.py` — REST endpoints, dashboard, CSV report, QR codes
- `assets/management/commands/seed.py` — demo data generator
