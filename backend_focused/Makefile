COMPOSE := docker compose
SERVICE := backend

PYTHON_BIN ?= $(shell command -v python3.13 2>/dev/null || command -v python3.12 2>/dev/null || command -v python3.11 2>/dev/null || command -v python3.10 2>/dev/null || command -v python3 2>/dev/null)
VENV_DIR := backend/.venv
VENV_BIN := $(VENV_DIR)/bin
VENV_PYTHON := $(VENV_BIN)/python
RUNTIME_STAMP := $(VENV_DIR)/.runtime-requirements-installed
DEV_STAMP := $(VENV_DIR)/.dev-requirements-installed

.DEFAULT_GOAL := help

.PHONY: help check-python venv install install-dev dev \
	start venv-start migrate seed seed-large seed-performance seed-clear test \
	load-test load-test-ui format format-check lint django-check migrations-check check \
	docker-build docker-up docker-start docker-down docker-logs docker-shell \
	docker-migrate docker-seed docker-seed-large docker-seed-performance \
	docker-seed-clear docker-test docker-load-test docker-load-test-ui \
	docker-format docker-format-check docker-lint docker-django-check \
	docker-migrations-check docker-check build up down logs shell

help: ## Show the available commands
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z_-]+:.*## / {printf "%-24s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Local virtual environment (default)

check-python:
	@test -n "$(PYTHON_BIN)" || (echo "Python 3.10 or newer is required." && exit 1)
	@$(PYTHON_BIN) -c 'import sys; sys.exit("Python 3.10 or newer is required; found %s.%s." % sys.version_info[:2]) if sys.version_info < (3, 10) else None'

venv: check-python ## Create backend/.venv with Python 3.10+
	@if [ ! -x "$(VENV_PYTHON)" ]; then \
		$(PYTHON_BIN) -m venv "$(VENV_DIR)"; \
	fi
	@$(VENV_PYTHON) -c 'import sys; sys.exit("The existing virtual environment uses Python %s.%s; recreate it with Python 3.10 or newer." % sys.version_info[:2]) if sys.version_info < (3, 10) else None'

$(RUNTIME_STAMP): backend/requirements.txt | venv
	$(VENV_PYTHON) -m pip install --requirement backend/requirements.txt
	@touch $@

$(DEV_STAMP): backend/requirements.txt backend/requirements-dev.txt | venv
	$(VENV_PYTHON) -m pip install --requirement backend/requirements-dev.txt
	@touch $(RUNTIME_STAMP) $@

install: $(RUNTIME_STAMP) ## Install runtime dependencies in backend/.venv

install-dev: $(DEV_STAMP) ## Install runtime and development dependencies in backend/.venv

dev: install-dev ## Install development dependencies and start the local API
	cd backend && .venv/bin/python manage.py migrate
	cd backend && .venv/bin/python manage.py runserver 0.0.0.0:8000

start: venv-start ## Start the local API with backend/.venv (default)

venv-start: migrate ## Start the local API at http://localhost:8000
	cd backend && .venv/bin/python manage.py runserver 0.0.0.0:8000

migrate: install ## Apply database migrations with backend/.venv
	cd backend && .venv/bin/python manage.py migrate

seed: migrate ## Fill an empty database with dummy data using backend/.venv
	cd backend && .venv/bin/python manage.py seed_data

seed-large: migrate ## Fill an empty database with a performance dataset using backend/.venv
	cd backend && .venv/bin/python manage.py seed_data \
		--offices 20 \
		--vehicles 100 \
		--mechanics 30 \
		--maintenance-records 20000 \
		--seed 42

seed-performance: migrate ## Add named 1k, 10k, 50k and 100k history vehicles using backend/.venv
	cd backend && DJANGO_LOG_SQL=false DJANGO_DEBUG=false \
		.venv/bin/python manage.py seed_performance

seed-clear: migrate ## Replace existing fleet data with dummy data using backend/.venv
	cd backend && .venv/bin/python manage.py seed_data --clear

test: install-dev ## Run the test suite with backend/.venv
	cd backend && .venv/bin/pytest

load-test: install-dev ## Run a headless load test against a local API at localhost:8000
	cd backend && DJANGO_LOG_SQL=false .venv/bin/locust \
		--locustfile load_tests/locustfile.py \
		--host http://localhost:8000 \
		--headless \
		--users 20 \
		--spawn-rate 5 \
		--run-time 30s \
		--stop-timeout 5s \
		--only-summary

load-test-ui: install-dev ## Open Locust at http://localhost:8089 for a local API
	cd backend && DJANGO_LOG_SQL=false .venv/bin/locust \
		--locustfile load_tests/locustfile.py \
		--host http://localhost:8000

format: install-dev ## Format backend code with Black using backend/.venv
	cd backend && .venv/bin/black .

format-check: install-dev ## Check backend formatting with backend/.venv
	cd backend && .venv/bin/black --check .

lint: format-check ## Run the configured backend lint check

django-check: install ## Run Django system checks with backend/.venv
	cd backend && .venv/bin/python manage.py check

migrations-check: install ## Check for missing migrations with backend/.venv
	cd backend && .venv/bin/python manage.py makemigrations --check --dry-run

check: lint test django-check migrations-check ## Run all local project checks

# Docker Compose alternatives

docker-build: ## Build the backend image
	$(COMPOSE) build

docker-up: ## Build and run the Docker API in the foreground
	$(COMPOSE) up --build

docker-start: ## Build and run the Docker API in the background
	$(COMPOSE) up --build --detach --wait

docker-down: ## Stop the Docker containers
	$(COMPOSE) down

docker-logs: ## Follow the Docker backend logs
	$(COMPOSE) logs --follow $(SERVICE)

docker-shell: docker-build ## Open a shell in a temporary backend container
	$(COMPOSE) run --rm $(SERVICE) sh

docker-migrate: docker-build ## Apply database migrations in Docker
	$(COMPOSE) run --rm $(SERVICE) python manage.py migrate

docker-seed: docker-migrate ## Fill an empty database with dummy data in Docker
	$(COMPOSE) run --rm $(SERVICE) python manage.py seed_data

docker-seed-large: docker-migrate ## Fill an empty database with a performance dataset in Docker
	$(COMPOSE) run --rm $(SERVICE) python manage.py seed_data \
		--offices 20 \
		--vehicles 100 \
		--mechanics 30 \
		--maintenance-records 20000 \
		--seed 42

docker-seed-performance: docker-migrate ## Add named performance vehicles in Docker
	$(COMPOSE) run --rm -e DJANGO_LOG_SQL=false -e DJANGO_DEBUG=false $(SERVICE) \
		python manage.py seed_performance

docker-seed-clear: docker-migrate ## Replace existing fleet data with dummy data in Docker
	$(COMPOSE) run --rm $(SERVICE) python manage.py seed_data --clear

docker-test: docker-build ## Run the test suite in Docker
	$(COMPOSE) run --rm $(SERVICE) pytest

docker-load-test: docker-start ## Run the headless load test in Docker
	$(COMPOSE) --profile load-test run --rm locust \
		locust --locustfile load_tests/locustfile.py \
		--host http://backend:8000 \
		--headless \
		--users 20 \
		--spawn-rate 5 \
		--run-time 30s \
		--stop-timeout 5s \
		--only-summary

docker-load-test-ui: docker-start ## Open the Docker Locust UI at http://localhost:8089
	$(COMPOSE) --profile load-test up locust

docker-format: docker-build ## Format backend code with Black in Docker
	$(COMPOSE) run --rm $(SERVICE) black .

docker-format-check: docker-build ## Check backend formatting in Docker
	$(COMPOSE) run --rm $(SERVICE) black --check .

docker-lint: docker-format-check ## Run the configured backend lint check in Docker

docker-django-check: docker-build ## Run Django system checks in Docker
	$(COMPOSE) run --rm $(SERVICE) python manage.py check

docker-migrations-check: docker-build ## Check for missing migrations in Docker
	$(COMPOSE) run --rm $(SERVICE) python manage.py makemigrations --check --dry-run

docker-check: docker-lint docker-test docker-django-check docker-migrations-check ## Run all project checks in Docker

# Backward-compatible Docker aliases

build: docker-build ## Alias for docker-build

up: docker-up ## Alias for docker-up

down: docker-down ## Alias for docker-down

logs: docker-logs ## Alias for docker-logs

shell: docker-shell ## Alias for docker-shell
