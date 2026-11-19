# Ledger — Asset Management for a Corporate Office

A web-based system for tracking an office's physical assets across their whole lifecycle: registration, QR labelling, assignment to staff, maintenance, depreciation and disposal, with a full audit trail.

> B.Sc. Computer Science final-year project, Department of Computer Science, University of Ibadan.

## Features

- **Asset register:** auto-generated tags (`AST-0001`), categories, locations, departments, serials, vendors.
- **QR labels:** every asset has a printable QR code that opens its page on any phone (`/scan/AST-0001`).
- **Assign and return:** check-out/check-in to staff with due dates, return condition and full history.
- **Maintenance:** preventive and corrective jobs, a scheduled → in progress → done board, and overdue detection.
- **Depreciation:** straight-line and declining-balance methods (IAS 16), with a per-year schedule and current book value.
- **Disposal:** retire an asset as sold, donated, scrapped or lost, with the reason and recovered value.
- **Audit trail:** every change is recorded with who made it, what changed and when.
- **Dashboard:** book value trend, utilisation, status split, departments, upcoming maintenance.
- **Roles:** `admin`, `manager` (read and write) and `staff` (read-only).
- **Reports:** CSV export of the filtered register.

## Stack

| Layer | Tech |
|---|---|
| Backend | Python, Django, Django REST Framework, token auth, SQLite (Postgres via `DATABASE_URL`) |
| Frontend | React, TypeScript, Vite, Tailwind CSS v4, Motion, Lenis, Phosphor Icons, Geist |

```
asset-management/
├── backend/      Django REST API (see backend/README.md)
├── frontend/     React single-page app
├── docs/         API contract, proposal, writeup
└── literature/   PDFs of every cited source
```

## Run locally

**Backend** (terminal 1):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed          # demo data
python manage.py runserver     # http://localhost:8000
```

**Frontend** (terminal 2):

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

### Demo accounts

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Manager | `manager` | `manager123` |
| Staff (read-only) | `staff` | `staff123` |

## Tests

```bash
cd backend && source .venv/bin/activate && python manage.py test
```

## API

See [docs/API.md](docs/API.md).

## Team

| Name | Matric No. | Role |
|---|---|---|
| Abiodun Oluwamurewa | E052852 | Team Leader |
| Jimmy Abegunde | — | |
| — | — | |
| — | — | |
