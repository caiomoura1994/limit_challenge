# Repository Guidelines

## Project Structure & Module Organization

The Django REST API lives in `backend/`. Domain code is split across `fleet/`, `offices/`, and `maintenance/`; shared configuration and routing are in `backend/server/`. Keep business rules in services or custom querysets. Migrations belong under each app's `migrations/`, and load tests live in `backend/load_tests/`.

The Next.js TypeScript UI is in `frontend/`. App Router pages are under `app/`; route-specific code stays nearby, while reusable code belongs in `components/`, `hooks/`, and `lib/`. Playwright tests are in `frontend/e2e/`, static assets in `frontend/public/`, and project media in `docs/`.

## Build, Test, and Development Commands

Run backend workflows from the repository root:

- `make install` prepares runtime dependencies in `backend/.venv`; `make install-dev` adds development tools.
- `make start` uses the local virtual environment; `make dev` installs development tools and starts the API.
- `make seed` migrates and creates sample data; `make test`, `make lint`, and `make check` run local verification.
- Prefix commands with `docker-`, such as `make docker-start`, `make docker-seed`, or `make docker-check`, to use Compose.

Run frontend workflows from `frontend/`:

- `npm install && npm run dev` starts the UI at `localhost:3000`.
- `npm run check` runs TypeScript, ESLint, and Prettier checks.
- `npm run build` creates a production build; `npm run test:e2e` runs Playwright.
- `npm run generate:api` refreshes generated API types from a running API.

## Coding Style & Naming Conventions

Python uses four-space indentation and Black. Follow Django conventions: `snake_case` functions/modules, `PascalCase` classes, and thin views. TypeScript is strict; Prettier enforces single quotes, semicolons, trailing commas, and a 100-character width. Use `PascalCase` components, `use-*.ts` hooks, and kebab-case filenames. Never edit `lib/api/schema.d.ts` manually.

## Testing Guidelines

Pytest-django discovers `tests.py`, `test_*.py`, and `*_tests.py`. Add tests near the affected app. Name Playwright specs `*.spec.ts`; fixtures must clean up created records. No numeric coverage threshold is enforced, but behavior changes should include regression tests. Run both check commands before submitting and E2E tests for UI workflows.

## Commit & Pull Request Guidelines

Recent history favors concise Conventional Commit subjects such as `feat: add grouped OpenAPI documentation`, `test: ...`, `docs: ...`, and `chore: ...`. Keep commits focused. Pull requests should explain behavior and trade-offs, link issues, list verification commands, and include screenshots or recordings for UI changes. Call out migrations, generated schema updates, and configuration changes.

## Configuration & Security

Copy `frontend/.env.example` to `.env.local` for local overrides. Do not commit secrets, local databases, or environment-specific URLs. The current permissive CORS, debug settings, and SQLite setup are development defaults, not production configuration.
