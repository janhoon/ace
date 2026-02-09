.PHONY: help backend seed-admin seed-datasources frontend backend-lint frontend-lint lint security-local

EMAIL ?= admin@admin.com
PASSWORD ?= Admin1234
ORG ?= default

SEED_NAME :=
SEED_SLUG :=

ifneq ($(filter command line,$(origin NAME)),)
SEED_NAME := $(NAME)
endif

ifneq ($(filter command line,$(origin SLUG)),)
SEED_SLUG := $(SLUG)
endif

help:
	@printf "Available targets:\n"
	@printf "  make backend   Start Go backend (hot reload with air if installed)\n"
	@printf "  make backend-lint Run backend lint checks with golangci-lint\n"
	@printf "  make seed-admin [EMAIL=...] [PASSWORD=...] [ORG=...] [NAME=...] [SLUG=...]\n"
	@printf "                 Defaults: EMAIL=admin@admin.com PASSWORD=Admin1234 ORG=default\n"
	@printf "  make seed-datasources [ORG=...]\n"
	@printf "                 Seeds default connectors into existing ORG (default=default)\n"
	@printf "  make frontend  Start Vite frontend dev server\n"
	@printf "  make frontend-lint Run frontend lint checks (Biome + Knip)\n"
	@printf "  make lint      Run backend and frontend lint checks\n"
	@printf "  make security-local Run local security checks (govulncheck + gitleaks)\n"

backend:
	@set -e; \
	GO_BIN=""; \
	if [ -x "$$HOME/.go-sdk/go1.25.7/bin/go" ]; then \
		GO_BIN="$$HOME/.go-sdk/go1.25.7/bin/go"; \
	elif command -v go >/dev/null 2>&1; then \
		GO_BIN="$$(command -v go)"; \
	fi; \
	if [ -z "$$GO_BIN" ]; then \
		printf "Go is not installed.\n"; \
		printf "Install Go 1.25+ and retry make backend.\n"; \
		exit 1; \
	fi; \
	GO_TAG="$$($$GO_BIN env GOVERSION 2>/dev/null)"; \
	if [ -z "$$GO_TAG" ]; then \
		set -- $$($$GO_BIN version); \
		GO_TAG="$$3"; \
	fi; \
	GO_VER="$${GO_TAG#go}"; \
	GO_MAJOR="$${GO_VER%%.*}"; \
	GO_REST="$${GO_VER#*.}"; \
	GO_MINOR="$${GO_REST%%.*}"; \
	GO_MAJOR_NUM="$${GO_MAJOR%%[^0-9]*}"; \
	GO_MINOR_NUM="$${GO_MINOR%%[^0-9]*}"; \
	if [ "$$GO_MAJOR_NUM" -lt 1 ] || { [ "$$GO_MAJOR_NUM" -eq 1 ] && [ "$$GO_MINOR_NUM" -lt 25 ]; }; then \
		printf "Go %s is too old for backend/go.mod (requires 1.25+).\n" "$$GO_TAG"; \
		printf "Install Go 1.25+ or put it first on PATH.\n"; \
		exit 1; \
	fi; \
	GO_BIN_DIR="$${GO_BIN%/go}"; \
	PATH="$$GO_BIN_DIR:$$PATH"; \
	export PATH; \
	if command -v air >/dev/null 2>&1; then \
		cd backend && air; \
	else \
		printf "air is not installed. Falling back to go run ./cmd/api\n"; \
		printf "Install air for hot reload: go install github.com/air-verse/air@latest\n"; \
		cd backend && go run ./cmd/api; \
	fi

seed-admin:
	@set -e; \
	GO_BIN=""; \
	if [ -x "$$HOME/.go-sdk/go1.25.7/bin/go" ]; then \
		GO_BIN="$$HOME/.go-sdk/go1.25.7/bin/go"; \
	elif command -v go >/dev/null 2>&1; then \
		GO_BIN="$$(command -v go)"; \
	fi; \
	if [ -z "$$GO_BIN" ]; then \
		printf "Go is not installed.\n"; \
		printf "Install Go 1.25+ and retry make seed-admin.\n"; \
		exit 1; \
	fi; \
	if [ -n "$(SEED_NAME)" ] && [ -n "$(SEED_SLUG)" ]; then \
		cd backend && "$$GO_BIN" run ./cmd/seed-admin -email "$(EMAIL)" -password "$(PASSWORD)" -org "$(ORG)" -name "$(SEED_NAME)" -slug "$(SEED_SLUG)"; \
	elif [ -n "$(SEED_NAME)" ]; then \
		cd backend && "$$GO_BIN" run ./cmd/seed-admin -email "$(EMAIL)" -password "$(PASSWORD)" -org "$(ORG)" -name "$(SEED_NAME)"; \
	elif [ -n "$(SEED_SLUG)" ]; then \
		cd backend && "$$GO_BIN" run ./cmd/seed-admin -email "$(EMAIL)" -password "$(PASSWORD)" -org "$(ORG)" -slug "$(SEED_SLUG)"; \
	else \
		cd backend && "$$GO_BIN" run ./cmd/seed-admin -email "$(EMAIL)" -password "$(PASSWORD)" -org "$(ORG)"; \
	fi

seed-datasources:
	@set -e; \
	GO_BIN=""; \
	if [ -x "$$HOME/.go-sdk/go1.25.7/bin/go" ]; then \
		GO_BIN="$$HOME/.go-sdk/go1.25.7/bin/go"; \
	elif command -v go >/dev/null 2>&1; then \
		GO_BIN="$$(command -v go)"; \
	fi; \
	if [ -z "$$GO_BIN" ]; then \
		printf "Go is not installed.\n"; \
		printf "Install Go 1.25+ and retry make seed-datasources.\n"; \
		exit 1; \
	fi; \
	cd backend && "$$GO_BIN" run ./cmd/seed-datasources -org "$(ORG)"

frontend:
	@cd frontend && npm run dev

backend-lint:
	@set -e; \
	if ! command -v golangci-lint >/dev/null 2>&1; then \
		printf "golangci-lint is not installed.\n"; \
		printf "Install it from https://golangci-lint.run/welcome/install/ and retry make backend-lint.\n"; \
		exit 1; \
	fi; \
	cd backend && golangci-lint run ./...

frontend-lint:
	@cd frontend && npm run lint && npm run lint:dead-code

lint: backend-lint frontend-lint

security-local:
	@set -e; \
	if ! command -v docker >/dev/null 2>&1; then \
		printf "Docker is not installed.\n"; \
		printf "Install Docker to run gitleaks and retry make security-local.\n"; \
		exit 1; \
	fi; \
	printf "Running govulncheck (backend, Go 1.25.7 container)...\n"; \
	docker run --rm -v "$$PWD:/repo" -w /repo/backend golang:1.25.7 /bin/sh -c 'go run golang.org/x/vuln/cmd/govulncheck@latest ./...'; \
	printf "Running gitleaks (repo)...\n"; \
	docker run --rm -v "$$PWD:/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest detect --source . --redact --no-banner
