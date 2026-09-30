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

Watch the [silent end-to-end frontend demonstration](./docs/fleet-tracker-demo.mp4) (1 minute 59 seconds).

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

- Pagination was not explicitly required, so list endpoints and the maintenance history endpoint use page-number pagination with 10 records per page. Vehicle details still return the complete maintenance history as requested.
- No VIN or license plate format was specified. VINs follow the standard 17-character maximum, while plates accept any non-empty value up to 20 characters instead of enforcing a country-specific pattern; both conflict checks are case-insensitive.
- A mechanic's certification number is treated as a case-insensitive business identifier and must be unique.
- Maintenance records describe completed work, so their date cannot be in the future and their cost cannot be negative. Maintenance type remains free text because the challenge does not define a canonical service taxonomy.
- Combined maintenance-date and mechanic filters must match the same maintenance record. A service by the requested mechanic outside the requested period does not match a different service inside that period.
- "Last 12 months" means the same calendar date one year earlier, with February 29 clamped to February 28. "More than 365 days" is strict: a vehicle serviced exactly 365 days ago is not overdue, and vehicles with no maintenance history are ordered first.
- Assigning a vehicle stores only its current office, as requested; no assignment history is retained. Consequently, office summaries attribute a vehicle's historical maintenance costs to its current office.
- The challenge does not specify a currency, so the UI treats all maintenance costs and report totals as US dollars (USD).
- Cascade behavior was not specified, so offices with vehicles, vehicles with maintenance records, and mechanics with maintenance records use protected deletion to preserve history.
- Authentication is intentionally omitted because the challenge marks JWT as an optional bonus.
- The project structure was not specified, so the domain was divided into three Django apps: `offices`, `fleet`, and `maintenance`.

## Trade-offs

The implementation favors clear data flow and correctness while keeping the challenge straightforward to run and review.

### Backend

- The challenge's local virtual-environment workflow was retained, while Docker Compose was added as the preferred development workflow for a reproducible, command-driven setup. Supporting both makes the project easier to run in different environments, at the cost of maintaining and testing two execution paths.
- The starter SQLite setup was retained instead of introducing PostgreSQL. This keeps local evaluation self-contained, but gives up PostgreSQL's stronger concurrency and production tooling.
- Office summaries and mechanic workloads are calculated from source records on every request. This keeps results current and avoids cache invalidation or denormalized counters, but aggregate-query cost grows with the dataset.
- Vehicle details include the complete maintenance history as required. Related data is prefetched to keep the query count bounded, but response size, serializer work, browser memory, and DOM size still grow with the history. A separate paginated history endpoint supports workflows that do not need the complete embedded result.
- VIN and active-license-plate conflicts are checked in the service for clear API errors and enforced again with database constraints for integrity under concurrent writes. This intentionally duplicates the rule across two layers.
- Certification uniqueness and maintenance-record rules are handled in services for every API write. Certification uniqueness and non-negative costs are also backed by database constraints for concurrent writes and non-API callers. Future-date validation remains application-level logic because its boundary moves every day and is not a stable database constraint.
- Keeping only the current office makes assignment simple and matches the requested endpoint, but historical spending moves between office summaries when a vehicle is reassigned. A production audit requirement would justify a separate assignment-history model.
- Maintenance type remains free text for flexibility and fidelity to the brief. A controlled taxonomy would improve reporting consistency once the accepted service categories are known.

### Frontend

- A small presentation-only UI layer—including the mascot and navigation progress—was added to make the interface more approachable and provide clearer feedback. These components remain isolated from form and API state, keeping the functional cost low, but still add assets and tests for polish that was not required by the brief.
- Server state lives in TanStack Query instead of another global store. Mutations invalidate related resources rather than updating the cache optimistically, which favors confirmed server data and simpler consistency at the cost of extra refetches and less immediate updates.
- React Hook Form centralizes form state and supports reusable typed Material UI fields, while shared Zod schemas provide consistent client-side validation through the resolver adapter. This reduces repeated form wiring and keeps cross-field rules outside presentation components, at the cost of additional dependencies and an integration layer; the backend remains the final validation authority.
- List filters and pagination live in the URL and change only when the user applies them. Links, reloads, and browser history therefore preserve the view while avoiding a request on every keystroke, at the cost of an explicit Apply action and URL parameters coupled to API filters.
- TypeScript request and response types are generated from the OpenAPI schema and committed. Builds do not require a running backend, but API changes require `npm run generate:api` to prevent stale types.
- Relationship fields use debounced, paginated server-side autocomplete rather than downloading whole catalogs into each form. Some table label lookups still collect all catalog pages for this challenge-sized dataset; at larger scale those rows should include display labels or use a dedicated lookup endpoint.
- Playwright tests exercise the real API and critical responsive workflows, giving stronger integration confidence than mocked requests. They are slower and require more setup than unit or component tests; focused lower-level tests would complement them as the UI grows.
