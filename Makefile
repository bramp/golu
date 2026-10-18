.PHONY: all setup deps dev format analyze analyze-web analyze-python test test-ci build assets preview

all: analyze test build

setup: deps
	pre-commit install

deps:
	npm ci
	uv sync --locked

dev:
	npm run dev

format:
	npm run format
	uv run ruff format .
	uv run ruff check --fix .

analyze: analyze-web analyze-python
	npm run format:check

analyze-web:
	npm run lint
	npm run typecheck

analyze-python:
	uv run ruff check .
	uv run ruff format --check .

test:
	npm test
	uv run pytest

test-ci: analyze test build

build:
	npm run build

assets:
	uv run python scripts/build_assets.py

preview:
	npm run preview
