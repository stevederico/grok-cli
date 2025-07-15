# Makefile for Grok-CLI

.PHONY: help install build test lint format preflight clean start debug release run-npx create-alias

help:
	@echo "Makefile for Grok-CLI"
	@echo ""
	@echo "Usage:"
	@echo "  make install          - Install npm dependencies"
	@echo "  make build            - Build the entire project"
	@echo "  make test             - Run the test suite"
	@echo "  make lint             - Lint the code"
	@echo "  make format           - Format the code"
	@echo "  make preflight        - Run formatting, linting, and tests"
	@echo "  make clean            - Remove generated files"
	@echo "  make start            - Start the CLI"
	@echo "  make debug            - Start the CLI in debug mode"
	@echo "  make release          - Publish a new release"
	@echo "  make run-npx          - Run the CLI using npx (for testing the published package)"
	@echo "  make create-alias     - Create a 'grokcli' alias for your shell"

install:
	npm install

build:
	npm run build

test:
	npm run test

lint:
	npm run lint

format:
	npm run format

preflight:
	npm run preflight

clean:
	npm run clean

start:
	npm run start

debug:
	npm run debug

release:
	npm run publish:release

run-npx:
	npx https://github.com/stevederico/grok-cli

create-alias:
	scripts/create_alias.sh
