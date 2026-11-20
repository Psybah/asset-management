# Ledger — Asset Management for a Corporate Office

A web-based system for tracking an office's physical assets across their whole lifecycle: registration, QR labelling, assignment to staff, maintenance, depreciation and disposal, with a full audit trail.

> CSC 476 course project — Group 27, Department of Computer Science, University of Ibadan.

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

Requirements: Python 3.12+ and Node 20+.

```bash
npm run setup     # first time: installs everything, migrates, seeds demo data
npm run dev       # starts the API (http://localhost:8000) and the web app (http://localhost:5173) together
```

Other root commands: `npm run seed` (reset demo data; survey responses are kept), `npm test` (backend tests), `npm run build` (production build of the web app).

**Phones (QR scanning, usability survey):** `npm run dev` already serves the app on your network. Connect the phone to the **same Wi-Fi** as the laptop and open `http://<laptop-ip>:5173` (`npm run dev:lan` prints the exact address). The web server forwards `/api` to Django, so nothing else needs configuring, and QR codes automatically encode the laptop's network address. If the phone still can't connect, allow incoming connections for Node in macOS System Settings → Network → Firewall, or check that the Wi-Fi doesn't isolate devices (common on guest/office networks — use a phone hotspot instead).

The survey for participants is at `/survey` (no login).

<details><summary>Running the two servers separately</summary>

```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python manage.py migrate && python manage.py seed
python manage.py runserver
# second terminal
cd frontend && npm install && npm run dev
```
</details>

### Demo accounts

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Admin (supervisor, Prof. B. F. Oladejo) | `oladejo` | `oladejo123` |
| Manager | `manager` | `manager123` |
| Staff (read-only) | `staff` | `staff123` |

## Tests

```bash
cd backend && source .venv/bin/activate && python manage.py test
```

## API

See [docs/API.md](docs/API.md).

## Deployment

See [DEPLOY.md](DEPLOY.md) — a one-click Render blueprint (`render.yaml`) for the database, API and web app.

## Team

| Name | Matric No. | Role |
|---|---|---|
| Abiodun Oluwamurewa | E052852 | Team Leader — software implementation |
| Jimmy Abegunde | E051739 | Research — cited literature |
| Opeyemi Mosobalaje | E051727 | Compiled the writeup |

Supervisor: Prof. B. F. Oladejo. Case study: Squad by HabariPay (demo data is illustrative, not the company's records).
