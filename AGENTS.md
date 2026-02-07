# AGENTS.md
Guidance for coding agents working in this repository.
## 1) Repository layout
- Monorepo with two primary apps:
  - `backend/` (Go 1.25 API server)
  - `frontend/` (Vue 3 + TypeScript + Vite + Vitest)
- Key root files:
  - `Makefile` (dev and seeding tasks)
  - `docker-compose.yml` (local infra)
  - `mise.toml` (`go = 1.25`)
## 2) Prerequisites
- Node.js 18+
- Go 1.25+
- Docker + Docker Compose
- Optional: `air` for backend hot reload
## 3) Core development commands
Run from repo root unless noted.
### Infra
```bash
docker-compose up -d
docker-compose down
```
### Dev servers
```bash
make backend
make frontend
```
Notes:
- Backend runs on `http://localhost:8080`.
- Frontend runs on `http://localhost:5173`.
- `make backend` uses `air` if installed, else `go run ./cmd/api`.
### Seed data
```bash
make seed-admin
make seed-admin EMAIL=admin@example.com PASSWORD='AdminPass123' ORG='my-org' NAME='First Admin'
make seed-datasources
make seed-datasources ORG=my-org
```
## 4) Build, lint, and test
### Frontend (`frontend/`)
```bash
cd frontend
npm install
npm run dev
npm run build
npm run preview
npm run type-check
npm run test
npm run test:watch
```
Single test file:
```bash
cd frontend
npm run test -- src/api/datasources.spec.ts
```
Single test by name:
```bash
cd frontend
npm run test -- src/api/datasources.spec.ts -t "throws on 403"
```
### Backend (`backend/`)
```bash
cd backend
go run ./cmd/api
go build ./cmd/api
go test ./...
```
Single package / test function:
```bash
cd backend
go test ./internal/handlers -run TestDataSourceHandler_Query_InvalidUUID
go test ./internal/auth -run TestVerifyPasswordIncorrect -count=1
```
### Lint / format reality in this repo
- No committed ESLint/Prettier config.
- Frontend quality gate: `npm run type-check` + Vitest.
- Backend style gate: `gofmt` + `go test`.
- Format changed Go files with:
```bash
cd backend
gofmt -w <changed-files>
```
## 5) Style and coding conventions
Follow existing file patterns first; use these defaults when unclear.
### General
- Keep diffs small and targeted.
- Use descriptive names; avoid abbreviations unless already established.
- Do not add comments unless the logic is non-obvious.
- Preserve existing API contracts and payload shapes.
### Imports
#### Go
- Group imports as stdlib, blank line, external/internal.
- Let `gofmt` handle ordering/formatting.
#### TypeScript / Vue
- External imports first, then local imports.
- Use `import type` for type-only imports.
- Keep long import lists multiline and readable.
### Formatting
#### Go
- Use standard `gofmt` output (tabs, canonical spacing).
#### TypeScript / Vue
- 2-space indentation.
- Single quotes.
- No semicolons.
- Trailing commas for multiline objects/arrays/params.
- Prefer wrapped, readable long expressions.
### Typing discipline
- Frontend TS is strict (`strict`, `noUnusedLocals`, `noUnusedParameters`).
- Avoid `any`; prefer explicit interfaces/unions.
- Backend optional update fields typically use pointers in request structs.
- Use trailing underscore for reserved identifiers (example: `type_`).
### Naming
#### Go
- Exported: `PascalCase`; unexported: `camelCase`.
- Constructor pattern: `NewXxx(...)`.
- Handler method verbs: `Create`, `List`, `Get`, `Update`, `Delete`, `Query`.
#### Frontend
- Composables: `useXxx`.
- Vue component/view files: `PascalCase.vue`.
- Tests: `*.spec.ts`.
### Error handling
#### Backend
- Return early on auth/validation failures.
- Use appropriate HTTP status codes.
- Return JSON error payloads consistently in handlers.
- Use `context.WithTimeout` for DB/external operations.

#### Frontend
- Normalize caught errors with:
  - `e instanceof Error ? e.message : '<fallback>'`
- Keep user-facing messages concise and actionable.
## 6) Testing conventions
### Go tests
- Name tests `TestXxx`.
- Prefer table-driven tests for validation/type behavior.
- Assert expected vs actual clearly in failure messages.
### Vitest tests
- Use behavior-focused `describe` / `it` names.
- Mock `fetch` via `vi.fn()`; reset mocks in `beforeEach`.
- Assert request method/URL/headers for API-layer tests.
## 7) Cursor/Copilot rules status
- `.cursorrules`: not present
- `.cursor/rules/`: not present
- `.github/copilot-instructions.md`: not present
If any of these files are added later, treat them as higher-priority instructions and update this file.
## 8) Agent workflow tips
- Inspect nearby files before editing to mirror local patterns.
- After frontend edits, run `npm run type-check` and relevant tests.
- After backend edits, run targeted `go test` (or `go test ./...` when practical).
- Avoid introducing new dependencies unless clearly necessary.
- Keep commits scoped to one feature/fix area.
