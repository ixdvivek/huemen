# Huemen — freelance projects, invoices & receipts

Single-user web app (owner manages freelance projects). Mobile-first, installable PWA.
Live at https://ixdvivek.github.io/huemen/ — deployed automatically by `.github/workflows/deploy.yml` on every push to `main`.

## Stack
- React 19 + Vite + TypeScript, plain CSS (`src/styles.css`, design tokens in `:root`). No Tailwind.
- Supabase (project ref `vxclxgffaosjacrptvhb`) for auth (email + password, sign-ups disabled) and Postgres. Public URL + publishable key live in `src/config.ts` (safe to ship; RLS protects data).
- `HashRouter` (GitHub Pages has no SPA rewrites). Vite `base` is `/huemen/`.
- Sharing: `html-to-image` renders the invoice/receipt card to PNG; `jspdf` wraps that PNG into a single tall PDF page. Web Share API on touch devices, download elsewhere (`src/lib/share.ts`).
- UPI QR (`qrcode`) on INR invoices: `upi://pay?pa=…&am=<balance>&cu=INR&tn=<invoice no>`.

## Data model (`supabase/schema.sql`, `src/lib/types.ts`)
settings (jsonb per user) · clients · projects (currency INR|USD, status, rates jsonb) · deliverables (fixed | hourly, is_additional) · invoices (type advance|milestone|additional|final|custom, items jsonb, status draft|sent|void) · payments (one receipt each, `number` = receipt no) · activity (timeline).
Every table has `user_id default auth.uid()` and an "owner only" RLS policy. Schema changes: add a new migration via the Supabase connector (or SQL editor) AND update `schema.sql` + `types.ts`.

## Rules that matter
- No taxes. Currencies are INR and USD only, one per project; never convert between them. INR formats with Indian grouping (`en-IN`).
- Money maths lives in `src/lib/calc.ts`: project value = sum of deliverables; invoiced = non-void invoice totals; outstanding = invoiced − payments; to invoice = value − invoiced. Invoice state (paid/partial/overdue) is derived from payments, not stored.
- "Additional work" invoice lines without a deliverable create `is_additional` deliverables on save, which raises the project value.
- Invoice/receipt numbers: `nextNumber(prefix, existing)` in `format.ts` (prefixes from settings).
- The store (`src/lib/store.tsx`) loads everything once, keeps it in memory, caches a snapshot in localStorage for offline viewing, and refreshes when the tab regains focus.
- Shareable documents are `src/components/Documents.tsx` — keep them self-contained (no external images/fonts) so PNG export stays reliable.

## Working on it
- `npm run demo` → runs with sample data in localStorage, no login or network (use this for UI work and screenshots).
- `npm run dev` → real Supabase.
- `npm run build` → type-check + production build. Run it before pushing.
- Design reference: the "Freelance Invoicing App" design canvas in claude.ai (warm off-white #F3F2EF, white 20–28px cards, gray tray cards, black primary buttons, coral #E2622F accent, Figtree).
