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
- `/categories/` `{id, name, icon, useful_life_years, asset_count, cover_urls}` — `cover_urls` (read-only) is up to 4 distinct absolute photo URLs from the category's assets (non-retired first, then by tag), `[]` if none — for folder tiles. `icon` is a Phosphor icon name in kebab-case e.g. `laptop`, `desktop`, `printer`, `chair`, `projector-screen`, `car`, `device-mobile`, `wifi-high`, `armchair`, `air-conditioner`
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
  notes, image_url (absolute URL of the photo | null, read-only), created_at, updated_at }
```

Actions:
- `GET /assets/by-tag/{tag}/` → asset (used by QR scan route)
- `GET /assets/{id}/qr/` → `image/png` QR encoding `{FRONTEND_URL}/scan/{tag}` (no auth required, so `<img>` works)
- `GET /assets/{id}/depreciation/` → `[{year, opening, depreciation, closing}]` full schedule over useful life
- `GET /assets/{id}/timeline/` → `[{id, type ("created"|"checkout"|"checkin"|"maintenance"|"disposal"|"update"), title, detail, actor_name, timestamp}]` newest first
- `POST /assets/{id}/checkout/` `{user, due_date?, note?}` → asset (400 if not available)
- `POST /assets/{id}/checkin/` `{condition?, note?}` → asset (400 if not assigned)
- `POST /assets/{id}/dispose/` `{method ("sold"|"donated"|"scrapped"|"lost"), reason, value?}` → asset (status → retired)
- `POST /assets/{id}/image/` multipart form, field `image` (manager+) → asset with new `image_url`. JPEG/PNG/WebP/GIF, max 5 MB. The server re-encodes it (EXIF stripped, longest side ≤ 1600 px; JPEG, or PNG if it has transparency) and replaces any previous photo. Errors: 400 `{image: ["..."]}` (missing / not an image / too large), 403 for staff.
- `DELETE /assets/{id}/image/` (manager+) → asset with `image_url: null`; 400 `{detail}` if it has no photo.
- Photo changes are audit-logged as `action: "update"` with timeline titles "Photo added" / "Photo updated" / "Photo removed".
- Photos are served from `/media/…` (outside `/api/`, no auth; Django serves them when `DEBUG` is on).

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

- `GET /dashboard/value-trend/?months=12` → `[{date, value}]` month-end fleet book value for the last `months` months (6–120, default 12), plus today as the final point. Used by the date filter on the dashboard's book value chart.

- `GET /public/assets/{tag}/` (public, no auth) → `{id, tag, name, category_name, category_icon, image_url, status, condition, location_name, department_name}` — what a scanned QR label shows to someone who is not signed in. No holder, cost or serial. Tag lookup is case-insensitive; 404 if unknown.

## Reports
- `GET /reports/assets.csv` → CSV of the register (accepts the same filters as `/assets/`), token auth via `?token=` query param also accepted
- `GET /reports/survey.csv` (manager+; `?token=` accepted) → CSV of raw survey responses, one row each: `id, created_at, department, role, age_group, computer_use, current_method, prior_software, device, department_other, role_other, tasks_completed, tasks_with_help, Q1..Q10, sus_score, adjective, comparison, liked, improvements` (task lists space-separated)

## Usability survey (SUS) — mirrors `docs/sus-questionnaire.md`
Public endpoints ignore any `Authorization` header (a stale token never blocks them).

- `GET /survey/form/` (public) → question definitions to render the form from:
```
{ title, intro,
  demographics: [{id, code ("A1".."A7"), label, options: [{value, label}], other_field (string | null),
                  allow_other, required}],
      // ids: department, role, age_group, computer_use, current_method, prior_software, device
      // other_field: "department_other" / "role_other" — free text, sent only when value == "other"
  tasks: [{id ("T1".."T7"), text}],
  task_outcomes: [{value ("without_help"|"with_help"|"not_completed"), label}],
  sus: {instructions, source, scale: [{value (1..5), label}], items: [{item (1..10), field ("q1".."q10"), text}]},
  adjective: {id: "adjective", code: "D1", label, source, options: [{value, label}] x7, required},
  comparison: {id: "comparison", code: "D2", label, options: [{value, label}] x5, required},
  open_questions: [{id ("liked"|"improvements"), code ("D3"|"D4"), label, required: false, max_length: 2000}] }
```
- `POST /survey/` (public, throttled to 30/hour per IP → 429) body:
```
{ department, department_other?, role, role_other?, age_group, computer_use, current_method,
  prior_software ("yes"|"no"), device,
  tasks_completed: ["T1", ...],    // completed with or without help
  tasks_with_help: ["T4", ...],    // subset of tasks_completed; tasks in neither = not completed
  q1..q10: 1..5, adjective, comparison, liked?, improvements? }
```
  → 201 `{id, sus_score}`; validation errors → 400 `{field: ["msg"]}`. SUS = ((q1−1)+(5−q2)+(q3−1)+…+(5−q10)) × 2.5.
- `GET /survey/results/` (manager+; staff 403) →
```
{ n, mean, median, sd (sample SD), min, max,      // null when n = 0 (sd is 0 when n = 1)
  benchmark: 68,
  grade_counts: [{band ("<50"|"50–67.9"|"68–80.2"|">80.3"), label, count, percent}],
  histogram: [{start, end, count}] x10,           // 0–10 … 90–100 (100 counts in the last bin)
  per_item: [{item, text, positive (odd item), mean, counts: {"1".."5": n}, percents: {"1".."5": pct}}],
  tasks: [{id, text, completed, percent, without_help, with_help, not_completed}],
  demographics: {department|role|age_group|computer_use|current_method|prior_software|device:
                 [{value, label, count, percent}]},   // every option listed, zero counts included
  adjectives: [{value, label, count, percent}],
  comparisons: [{value, label, count, percent}],
  comments: [{id, created_at, sus_score, liked, improvements}] }   // newest 50 with any text
```
  Percentages are of `n`, rounded to 1 dp; means/SD to 2 dp.

## Demo accounts (seeded by `python manage.py seed`)
`admin / admin123` · `manager / manager123` · `staff / staff123`

## Deviations / backend notes
No breaking deviations. Additions and clarifications from the backend implementation:
- Depreciation rows also include `period` (1..useful_life). `year` is the calendar year in which that depreciation year starts (year 1 begins on `purchase_date`).
- `current_value` is prorated daily within the current depreciation year (elapsed years = days / 365.25); retired assets stop depreciating on their disposal date.
- Dashboard: `totals.assets` and `by_status` count all assets including retired; money totals, `by_category` and `by_department` cover non-retired assets only. `value_trend` has 6 points: 31 Dec of each of the last 5 years, then today for the current year.
- Location `floor` is a short string (e.g. `"3"`, `"G"`, `"B"`). Generators use the Phosphor icon `lightning`; the seed also uses `monitor`, `credit-card` (POS terminals) and `hard-drives` (servers & UPS).
- `POST /auth/login/` with bad credentials → 400 `{detail}`. Action errors (checkout/checkin/dispose) → 400 `{detail: "..."}`; field validation errors use DRF's `{field: ["msg"]}` shape. Staff writes → 403 `{detail}`.
- `useful_life_years` on an asset is optional on create — it defaults to the category's value.
- `status` on asset PUT/PATCH cannot be changed to `assigned`/`retired` (use checkout/dispose); setting `maintenance`/`available` manually is allowed.
- `/audit/` also accepts `action=` and `entity=` filters.
- Seed data: fictional Lagos fintech office (case study: Squad by HabariPay). Every seeded asset has a photo; several assets of one model share the same file. `python manage.py seed` keeps existing survey responses.
