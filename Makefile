.PHONY: help backend frontend

help:
	@printf "Available targets:\n"
	@printf "  make backend   Start Go backend (hot reload with air if installed)\n"
	@printf "  make frontend  Start Vite frontend dev server\n"

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
		printf "Install Go 1.25.6+ and retry make backend.\n"; \
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
		printf "Go %s is too old for backend/go.mod (requires 1.25.6+).\n" "$$GO_TAG"; \
		printf "Install Go 1.25.6+ or put it first on PATH.\n"; \
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

frontend:
	@cd frontend && npm run dev
