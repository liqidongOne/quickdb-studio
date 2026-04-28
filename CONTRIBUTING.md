# Contributing to quickdb-studio

Thanks for taking the time to contribute! Here's everything you need to know to get started.

## Development Setup

### Prerequisites
- **Go 1.22+**
- **Node.js 18+** (recommended 20+)
- **Docker** (optional, for local MySQL/Redis testing)

### Environment

```bash
# Generate a dev token (any string works locally)
export QUICKDB_STUDIO_TOKEN=devtoken

# Start dependent services (MySQL + Redis) via Docker
docker compose up -d

# Run the backend
go run ./cmd/quickdb-studio

# In another terminal, run the webui dev server
cd webui
npm install
npm run dev
```

The UI will be available at `http://127.0.0.1:17890` and the API at `http://127.0.0.1:17890/api/v1`.

## Project Structure

```
cmd/quickdb-studio/     # Entry point — token setup, HTTP server bootstrap
internal/
  ├── httpapi/          # HTTP handlers, auth middleware, SPA serving
  ├── storage/          # connections.json persistence
  ├── mysqlx/           # MySQL connection pool and schema queries
  ├── sqlguard/         # Read-only SQL validation (Vitess SQLParser)
  ├── redix/            # Redis read operations (SCAN, TYPE, GET, etc.)
  ├── security/         # Security utilities
  └── model/            # Shared data models
webui/                   # Frontend (Vite + React + TypeScript)
```

## Code Style

- **Go**: Follow `go fmt` and `go vet`. Run `golangci-lint run` if available.
- **TypeScript/React**: Run `cd webui && npx tsc -b` — project has strict type checking enabled.
- **Commits**: Use conventional commits (`fix: ...`, `feat: ...`, `chore: ...`).

## Testing

```bash
# Backend tests
go test ./...

# Frontend typecheck + build
cd webui && npm run build
```

All tests must pass and TypeScript must compile without errors before opening a PR.

## Pull Request Guidelines

- Keep PRs **small and focused** — one feature or fix per PR.
- **Don't mix refactoring with behavior changes** — makes review easier.
- Update **documentation** if user-facing behavior changes.
- Fill in the PR template with a clear description of what and why.
- Link related **Issues** (e.g. "Closes #12").

## Building for Release

```bash
# Full production build (frontend + backend, outputs to dist/)
make build
```

This runs `webui npm install && webui npm run build`, copies the dist output into `internal/webassets/webui_dist/`, then builds a single Go binary.

## License

By contributing, you agree your contributions will be licensed under the MIT License.
