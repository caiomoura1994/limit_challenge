# Fleet Tracker frontend

The UI for the backend-focused challenge, built with Next.js, TypeScript, Material UI, React Hook Form, Zod, Axios, and TanStack Query. It connects to the real Django API.

## Run locally

Start the backend from `backend_focused/` with Python 3.10 or newer:

```bash
make seed
make start
```

To use Docker instead, run `make docker-start` followed by `make docker-seed`. See the root [README](../README.md) for installation and development commands.

Then, from `backend_focused/frontend/`:

```bash
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000/api`; override it in `.env.local` when using another API address. The backend must allow the frontend's origin through CORS.

## API types

Request, response, and filter types are generated from the backend's OpenAPI schema with `openapi-typescript`. The generated file is committed so a normal frontend build does not need a running API.

After changing the API, start it and run:

```bash
npm run generate:api
```

The default schema URL is `http://localhost:8000/api/schema/?format=json`. To use another address:

```bash
API_SCHEMA_URL='https://example.com/api/schema/?format=json' npm run generate:api
```

Do not edit `lib/api/schema.d.ts` manually. `lib/api/types.ts` exposes readable aliases for its generated types.

## Organization

```text
app/<resource>/components/  Components used only by that resource
app/<resource>/hooks/       Form and page behavior for that resource
components/forms/          Shared typed RHF controls backed by Material UI
components/mascot/          Decorative mascot, primary Add button, and form-dialog title
components/navigation/     Four main sections, local route tabs, and shared route configuration
components/reports/         Shared List/Chart controls and lazy-loaded MUI X bar chart
components/                Navigation, feedback, pagination, and common UI states
hooks/api/                 TanStack Query queries, mutations, and invalidation
lib/api/                   Typed Axios functions and generated API types
lib/validation/            Shared Zod schemas for forms and cross-field rules
theme.ts                   Shared Material UI theme
```

Pages cover vehicles, offices, mechanics, and maintenance records. List filters and pagination live in the URL. Forms use `FormProvider`, reusable RHF fields, and Zod schemas through `@hookform/resolvers`; server validation still appears on the corresponding field or in the form's error message. Successful mutations refresh affected queries.

Each list has a visible search form. Filtering runs on the API before pagination, so it includes records outside the current page:

| List        | Filters                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Vehicles    | Text search by VIN, plate, make or model; office, status, exact make/model, maintenance dates, mechanic certification |
| Offices     | Text search by name or city                                                                                           |
| Mechanics   | Text search by name or certification, active/inactive status                                                          |
| Maintenance | Text search by service, notes, vehicle or mechanic; vehicle, mechanic and maintenance date range                      |

Date ranges are inclusive and can have just a start or end date. Apply resets pagination; Clear removes the filters. Office summaries and mechanic workloads remain global and are labeled accordingly. From a vehicle's details, Manage maintenance opens the maintenance list already filtered to that vehicle.

The main navigation groups four sections: Vehicles, Offices, Mechanics, and Maintenance. On desktop these are top-level tabs; on mobile a labeled Section selector keeps them accessible without crowding the header. Local tabs below each section title link to All vehicles / Needing maintenance, All offices / Fleet summary, and All mechanics / Workload. The active section and view derive from the URL, so direct links, reloads, and browser history stay consistent. Vehicle details remain under All vehicles; Maintenance does not need a second navigation row.

The interface also uses vehicle details, maintenance history, and vehicles needing maintenance. Fleet summary (`/offices/summary`) and Mechanic workload (`/mechanics/workload`) retain their dedicated routes within Offices and Mechanics, instead of being embedded below the CRUD tables. Each report offers List and Chart views of the same complete API response, with separate count and cost metrics. Office costs cover the last 12 calendar months; mechanic workload covers the current calendar year. Layouts use Material UI Grid, Stack, tables, and dialogs.

Vehicle details display the complete maintenance history from the single `/api/vehicles/:id/` response. Every returned record is rendered, newest first (descending ID breaks same-date ties), with its mechanic information, cost, and notes. There is no client-side pagination, load-more control, or separate history request on this screen. The standalone Maintenance CRUD list keeps its API pagination and is available through Manage maintenance.

The small fleet mascot stays in the header and create/edit and record-detail dialog titles. Primary Add buttons reveal it on hover or keyboard focus, respecting reduced-motion preferences. These presentation-only components do not own form or API state. The optimized transparent illustration and its generation prompt are in `public/mascot/`.

`NavigationProgress` uses [nextjs-toploader](https://github.com/TheSGJ/nextjs-toploader) for a thin, theme-colored progress bar during client-side navigation, without a spinner or glow. Programmatic navigation imports `useRouter` from `nextjs-toploader/app`, including URL filters and pagination. Reduced-motion preferences disable crawling and transitions; existing page-level loading states still cover API requests.

## Checks

```bash
npm run check      # TypeScript, ESLint, and formatting
npm run build      # Production build
npm run test:e2e   # Browser integration checks
```

Browser tests require a running backend and a Playwright browser. Install Chromium with `npx playwright install chromium` if needed. Playwright starts the frontend dev server on port 3000 automatically, or reuses an existing server outside CI. Test fixtures track and clean up only the exact records created by each test, deleting related records first. See `playwright.config.ts` for test settings.

## Decisions

- Office, mechanic, and vehicle fields use server-side autocomplete: opening loads the first page, typing two or more characters searches after a 350 ms debounce, and scrolling (or keyboard navigation) loads more options. Existing selections resolve by ID when editing or restoring URL filters. Forms store only the selected ID. Table label lookups still fetch all catalog pages for this small challenge.
- Because the challenge does not specify a currency, the UI assumes all costs are US dollars (USD), shows `$` in cost inputs, and formats saved values and report totals as USD.
- Report charts use the MIT-licensed Community package `@mui/x-charts`, loaded only when the Chart view is opened. Horizontal bars include every returned record, keep duplicate names separate, use a zero baseline (including signed cost totals), and preserve full labels/exact values in tooltips and keyboard navigation. List view retains all fields, including latest service dates. No chart-specific backend or paid MUI feature is required.
- Authentication is not implemented. The frontend uses the challenge API as provided.
- Components and hooks stay close to their pages; only genuinely shared behavior moves into common folders.
