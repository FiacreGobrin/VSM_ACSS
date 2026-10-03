/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_KEYCLOAK_CLIENT_ID?: string;
  readonly VITE_WS_URL?: string;
  /**
   * Base URL of the Express API that fronts Neon Postgres.
   * Leave unset in development — Vite proxies `/api` and `/health` to the
   * local backend (see `vite.config.ts`). Set this only when the API is
   * deployed to a different host, e.g. `https://vms-api.facility.lan`.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
