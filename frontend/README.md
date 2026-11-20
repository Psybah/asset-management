# Ledger — web app

React 19 + TypeScript single-page app for the Ledger asset management system.

```bash
npm install
npm run dev      # http://localhost:5173 — proxies /api and /media to Django on :8000
npm run build    # production build in dist/ (set VITE_API_URL to the API's URL + /api)
```

- `src/pages/` — one file per screen (Overview, Assets, Asset detail, Maintenance, People, Library, Activity, Usability, Survey, Login).
- `src/components/` — app shell, design system (`ui.tsx`), sheets, Upcoming panel; `charts/` are Bklit UI charts (shadcn registry); `bits/` is the React Bits Silk background; `ui-kit/icon-folder.tsx` is the 21st.dev Icon Folder.
- `src/lib/` — API client, auth, data hook, formatting, types.

Run both servers together from the repository root with `npm run dev`.
