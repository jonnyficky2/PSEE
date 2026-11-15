# PSEE local development

## Prerequisites

- Node.js 24 or newer
- npm
- A local OpenCode installation for real task execution
- Git repository with a usable `main` branch

The deterministic test suite does not require OpenCode, Ollama, 9Router, or provider credentials.

## Environment configuration

Optional variables:

```text
PSEE_HOST=127.0.0.1
PSEE_PORT=3000
PSEE_DB_PATH=.psee/psee_state.sqlite
PSEE_OPENCODE_BIN=opencode
PSEE_STATIC_ROOT=frontend
PSEE_CORS_ORIGIN=http://localhost:8080
```

`PSEE_STATIC_ROOT` defaults to `frontend` so the dashboard is served from the same origin as the API. Set it to an empty value to disable static serving.

Keep the default `/api` frontend base when using same-origin serving. For a separate static server, set the `psee-api-base` meta tag in `frontend/index.html` to the backend API base, for example `http://127.0.0.1:3000/api`, and set `PSEE_CORS_ORIGIN` to the frontend origin.

## Build

```bash
npm install
npm run build
```

This compiles both the backend and browser frontend. Frontend output is written to `frontend/dist/`.

## Startup

```bash
npm start
```

Open `http://127.0.0.1:3000/` for the dashboard. The API remains at `http://127.0.0.1:3000/api`.

Same-origin serving is the recommended local path. A separate static server is only needed when intentionally testing split origins with `PSEE_CORS_ORIGIN`.

## Browser access

Recommended local setup:

1. Run `npm run build`.
2. Start `npm start`.
3. Open `http://127.0.0.1:3000/` in a browser.
4. Confirm the dashboard shows **API connected**.
5. Submit a task and monitor it from the dashboard.

## Troubleshooting

- **Port already in use:** set `PSEE_PORT` to another free port.
- **API unreachable:** verify the backend URL in the `psee-api-base` meta tag remains `/api` for same-origin, or matches the backend when split.
- **CORS error:** set `PSEE_CORS_ORIGIN` to the exact frontend origin, including scheme and port.
- **Dashboard 404:** confirm `npm run build` wrote `frontend/dist/` and `PSEE_STATIC_ROOT` points at `frontend`.
- **OpenCode unavailable:** install OpenCode or use the deterministic test suite; the frontend itself can still load.
- **Stale database state:** stop the backend and remove `.psee/psee_state.sqlite` plus its `-wal` and `-shm` files only when reset is intended.

The backend API contract remains `docs/api/openapi.yaml`.
