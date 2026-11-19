# Ledger — API contract

Base URL: `http://localhost:8000/api/`  ·  Auth: DRF Token — header `Authorization: Token <key>`
All list endpoints return plain arrays (no pagination). Dates `YYYY-MM-DD`, money as numbers (NGN).

## Roles
`admin` (everything) · `manager` (create/edit assets, checkout, maintenance, dispose) · `staff` (read-only; can see everything, edits return 403)

## Auth
- `POST /auth/login/` `{username, password}` → `{token, user}`
- `GET /auth/me/` → `user`
- `POST /auth/logout/` → 204
- `user` = `{id, username, name, email, role, department, department_name, initials}`

## Reference data (full CRUD, manager+ to write)
- `/categories/` `{id, name, icon, useful_life_years, asset_count}` — `icon` is a Phosphor icon name in kebab-case e.g. `laptop`, `desktop`, `printer`, `chair`, `projector-screen`, `car`, `device-mobile`, `wifi-high`, `armchair`, `air-conditioner`
- `/locations/` `{id, name, floor, asset_count}`
- `/departments/` `{id, name, asset_count}`
- `/people/` (read-only list of users) `[user + {asset_count}]`

## Assets
`/assets/` list/create, `/assets/{id}/` retrieve/update/delete. Query params: `search` (name, tag, serial, vendor), `status`, `category`, `department`, `location`, `assigned_to`.

Asset:
```
{ id, tag ("AST-0001", auto, read-only), name, category, category_name, category_icon,
  serial_number, vendor, purchase_date, purchase_cost, salvage_value,
  depreciation_method ("straight_line" | "declining_balance"), useful_life_years,
  location, location_name, department, department_name,
  status ("available" | "assigned" | "maintenance" | "retired"),
  condition ("new" | "good" | "fair" | "poor"),
  assigned_to (user id | null), assigned_to_name, assigned_since,
  current_value (computed, read-only), accumulated_depreciation (read-only),
  notes, created_at, updated_at }
```

Actions:
- `GET /assets/by-tag/{tag}/` → asset (used by QR scan route)
- `GET /assets/{id}/qr/` → `image/png` QR encoding `{FRONTEND_URL}/scan/{tag}` (no auth required, so `<img>` works)
- `GET /assets/{id}/depreciation/` → `[{year, opening, depreciation, closing}]` full schedule over useful life
- `GET /assets/{id}/timeline/` → `[{id, type ("created"|"checkout"|"checkin"|"maintenance"|"disposal"|"update"), title, detail, actor_name, timestamp}]` newest first
- `POST /assets/{id}/checkout/` `{user, due_date?, note?}` → asset (400 if not available)
- `POST /assets/{id}/checkin/` `{condition?, note?}` → asset (400 if not assigned)
- `POST /assets/{id}/dispose/` `{method ("sold"|"donated"|"scrapped"|"lost"), reason, value?}` → asset (status → retired)

## Assignments
- `GET /assignments/?asset=&user=&active=true` → `[{id, asset, asset_tag, asset_name, user, user_name, checked_out_at, due_date, checked_in_at, note, return_condition}]`

## Maintenance (full CRUD, manager+ to write)
- `/maintenance/?asset=&status=` → `{id, asset, asset_tag, asset_name, kind ("preventive"|"corrective"), title, scheduled_date, completed_date, cost, vendor, status ("scheduled"|"in_progress"|"done"), notes, overdue (bool, computed)}`
- Setting `status` to `in_progress` puts asset into `maintenance`; `done` returns it to `available` (or `assigned` if it still has an active assignment) and sets `completed_date` if empty.

## Audit log
- `GET /audit/?limit=50` → `[{id, actor_name, action ("create"|"update"|"delete"|"checkout"|"checkin"|"dispose"|"maintenance"), entity, entity_id, summary, timestamp}]` newest first

## Dashboard
`GET /dashboard/` →
```
{ totals: {assets, purchase_value, current_value, assigned, available, maintenance, retired, overdue_maintenance},
  by_category: [{name, icon, count, value}],
  by_department: [{name, count, value}],
  by_status: [{status, count}],
  value_trend: [{year, value}],          // fleet book value per year, last 5 yrs → now
  upcoming_maintenance: [maintenance x5],
  recent_activity: [audit x8] }
```

## Reports
- `GET /reports/assets.csv` → CSV of the register (accepts the same filters as `/assets/`), token auth via `?token=` query param also accepted

## Demo accounts (seeded by `python manage.py seed`)
`admin / admin123` · `manager / manager123` · `staff / staff123`

## Deviations / backend notes
No breaking deviations. Additions and clarifications from the backend implementation:
- Depreciation rows also include `period` (1..useful_life). `year` is the calendar year in which that depreciation year starts (year 1 begins on `purchase_date`).
- `current_value` is prorated daily within the current depreciation year (elapsed years = days / 365.25); retired assets stop depreciating on their disposal date.
- Dashboard: `totals.assets` and `by_status` count all assets including retired; money totals, `by_category` and `by_department` cover non-retired assets only. `value_trend` has 6 points: 31 Dec of each of the last 5 years, then today for the current year.
- Location `floor` is a short string (e.g. `"3"`, `"G"`, `"B"`). Generators use the Phosphor icon `lightning`.
- `POST /auth/login/` with bad credentials → 400 `{detail}`. Action errors (checkout/checkin/dispose) → 400 `{detail: "..."}`; field validation errors use DRF's `{field: ["msg"]}` shape. Staff writes → 403 `{detail}`.
- `useful_life_years` on an asset is optional on create — it defaults to the category's value.
- `status` on asset PUT/PATCH cannot be changed to `assigned`/`retired` (use checkout/dispose); setting `maintenance`/`available` manually is allowed.
- `/audit/` also accepts `action=` and `entity=` filters.
