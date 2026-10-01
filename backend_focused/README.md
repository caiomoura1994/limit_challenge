# Fleet Maintenance API

REST API for managing offices, vehicles, mechanics, and vehicle maintenance history.

The original take-home assignment is available in [CHALLENGE.md](./CHALLENGE.md).

## Running the project

Python 3.10 or newer is required for the default local workflow. The Makefile selects an available compatible Python and creates `backend/.venv` automatically.

### Local virtual environment (default)

```bash
make seed
make start
```

`make start` installs runtime dependencies when needed, applies migrations, and runs the API in the foreground. Use `make dev` instead to install the development requirements before starting. Press `Ctrl+C` to stop either local server.

The installation commands are also available separately:

```bash
make install       # runtime dependencies
make install-dev   # runtime, formatting, tests, seed helpers, and load testing
```

### Docker Compose

Docker remains available as an alternative workflow:

```bash
make docker-start
make docker-seed
```

Stop its containers with `make docker-down`. Run `make help` to see the local commands and their `docker-*` equivalents.

The API will be available at `http://localhost:8000/api/`.

- API documentation: `http://localhost:8000/docs/`
- OpenAPI schema: `http://localhost:8000/api/schema/`
- Health check: `http://localhost:8000/health/`

## Frontend

With the API running, start the Next.js interface in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [Fleet Tracker at localhost:3000](http://localhost:3000). The frontend uses the local API at `http://localhost:8000/api` by default. See [frontend/README.md](./frontend/README.md) for API type generation, configuration, architecture, and checks.

## Demo

Watch the [narrated and captioned end-to-end frontend demonstration](./docs/fleet-tracker-demo.mp4) (1 minute 59 seconds).

## Tests

```bash
make test
# or: make docker-test
```

Run formatting, tests, Django checks, and migration checks together:

```bash
make check
# or: make docker-check
```

## Seed data

Create a small dataset:

```bash
make seed
```

Create a larger dataset for performance testing:

```bash
make seed-large
```

Add four clearly named vehicles with large maintenance histories, preserving existing data:

```bash
make seed-performance
```

This adds `Veiculo 1 mil registros`, `Veiculo 10 mil registros`, `Veiculo 50 mil registros`, and `Veiculo 100 mil registros`: 161,000 maintenance records in total. Vehicles are listed newest first; the command creates them in reverse size order so these four initially appear at the top, from smallest to largest. Search for `Veiculo` or the specific model to find them again after other vehicles are added.

The command is repeatable: it reuses its reserved VINs and only fills missing records, without resetting the database or deleting extra records added later. Inserts are batched inside a transaction. SQL logging and Django debug query collection are disabled for this seed process, not the running API. The Docker equivalent is:

```bash
make docker-seed-performance
```

Vehicle details return the entire history in one response. Rendering 50,000–100,000 table rows can be expensive in the browser; these deliberately large datasets stress both API response size and frontend rendering, beyond the challenge's hundreds-of-records scenario.

Replace existing data with a new dataset:

```bash
make seed-clear
```

All seed commands use the local virtual environment by default. Prefix them with `docker-`, such as `make docker-seed-large`, to run them through Compose.

## Main endpoints

| Resource                     | Endpoint                                  |
| ---------------------------- | ----------------------------------------- |
| Offices CRUD                 | `/api/offices/`                           |
| Office summary               | `/api/offices/summary/`                   |
| Vehicles CRUD and search     | `/api/vehicles/`                          |
| Vehicle details              | `/api/vehicles/{id}/`                     |
| Maintenance history          | `/api/vehicles/{id}/maintenance-history/` |
| Assign office                | `/api/vehicles/{id}/assign-office/`       |
| Vehicles needing maintenance | `/api/vehicles/needing-maintenance/`      |
| Duplicate vehicle check      | `/api/vehicles/duplicate-check/`          |
| Mechanics CRUD               | `/api/mechanics/`                         |
| Mechanic workload            | `/api/mechanics/workload/`                |
| Maintenance records CRUD     | `/api/maintenance-records/`               |

Vehicle search supports free text (`search`: VIN, plate, make or model), `office`, `active`, `make`, `model`, maintenance date range, and mechanic certification number filters. Request examples are available in [`api.http`](./api.http).

Additional list filters support the frontend search forms:

- Offices: `search` by name or city.
- Mechanics: `search` by name or certification number, plus `active`.
- Maintenance records: `search` by service, notes, vehicle or mechanic; `vehicle`, `mechanic`, `maintenance_date_after`, and `maintenance_date_before`.

Filters combine and run before pagination. Date limits are inclusive. Summary and workload endpoints remain unfiltered.

## Performance testing

Locust was not required by the challenge. It was added to make load and stress testing repeatable, especially for endpoints that handle large maintenance histories.

Run the default Locust test:

```bash
make load-test
# or: make docker-load-test
```

The local command expects `make start` or `make dev` to be running in another terminal. The Docker command starts the containerized API automatically.

Open the Locust web interface:

```bash
make load-test-ui
# or: make docker-load-test-ui
```

## Assumptions

- Lists and maintenance history use 10-item pages. Vehicle details return the complete history, as required.
- VINs allow up to 17 characters and plates up to 20. VINs, active plates, and certification numbers are unique case-insensitively.
- Maintenance represents completed work: dates cannot be in the future, costs cannot be negative, and service type remains free text.
- Office costs use the previous 12 calendar months; workload uses the current year. February 29 maps to February 28, and overdue means strictly more than 365 days.
- Only the current office is stored, so historical costs follow the vehicle when reassigned. Costs use USD, related records are protected from deletion, and authentication remains out of scope.

## Trade-offs

### Backend

- Local and Docker workflows are both supported. SQLite keeps evaluation simple but is not intended as a production database.
- Office summaries and workloads are calculated live. Results stay current, but aggregation cost grows with the dataset.
- Vehicle details prefetch the complete history in a fixed query count. Payload and rendering cost still grow with history size, so a paginated history endpoint is also available.
- Services provide clear validation errors; database constraints protect key invariants. Future-date validation stays in the application because its boundary changes daily.
- A production project would add a `docs/` development harness: project-specific skills, repeatable workflows, debugging runbooks, architecture decisions, and operational guides. It is omitted here to keep the challenge focused.

### Frontend

- TanStack Query owns server state. Mutations refetch related data instead of applying optimistic updates.
- React Hook Form and shared Zod schemas keep form logic consistent; the backend remains the final authority.
- Filters and pagination live in the URL and update on **Apply**, preserving links and browser history without requesting on every keystroke.
- OpenAPI-generated types are committed so builds do not require a running backend; API changes require `npm run generate:api`.
- Relationship fields use debounced, paginated autocomplete. Playwright covers critical workflows against the real API.
