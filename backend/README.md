# CCTV Visitor Management & Access Authorization Backend

A production-grade, modular backend built with **Node.js (ESM)**, **Express 5**, and **Neon Serverless PostgreSQL**. Designed specifically for high-security facilities requiring **visitor registration, access passes, role-based authorization, and real-time CCTV camera facial identification & security alerting**.

---

## 🏗 System Architecture

```text
c:\Users\Fiacre\Desktop\backend/
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration (Neon connection)
├── .gitignore
├── package.json              # NPM scripts and dependencies
├── README.md                 # Complete documentation & API reference
├── migrations/
│   ├── 0001_initial_schema.up.sql    # Full schema DDL for Neon PostgreSQL
│   └── 0001_initial_schema.down.sql  # Safe schema rollback
└── src/
    ├── index.js              # Server entry point & graceful shutdown
    ├── app.js                # Express 5 application setup & middleware pipeline
    ├── config/
    │   ├── env.js            # Zero-dependency .env loader
    │   └── config.js         # Config validation & Neon SSL auto-tuning
    ├── platform/
    │   ├── db/
    │   │   ├── pool.js       # Neon-resilient pg.Pool with SSL handling
    │   │   └── migrate.js    # Built-in migration runner with schema_migrations
    │   └── storage/
    │       └── localDiskStorage.js # Filesystem blob storage for uploaded evidence
    ├── shared/
    │   ├── errors.js         # AppError hierarchy (BadRequest, Unauthorized, etc.)
    │   ├── logger.js         # Structured JSON/console logger
    │   ├── http/respond.js   # Standardized success/error JSON response envelopes
    │   ├── media/
    │   │   └── magicBytes.js # Content-type verification for uploaded media
    │   └── middleware/
    │       ├── auth.js       # JWT authentication & Role-Based Access Control (RBAC)
    │       ├── errorHandler.js # Centralized Postgres & App error translation
    │       └── requestLogger.js# Request latency & HTTP status logger
    ├── modules/
    │   ├── health/           # GET /health — Database ping & uptime status
    │   ├── auth/             # POST /api/v1/auth/login, register, me
    │   ├── visitors/         # CRUD /api/v1/visitors (Identity profile, photo, blacklist)
    │   ├── visits/           # Passes, Check-in & Check-out (/api/v1/visits)
    │   ├── cameras/          # CCTV Registry & Security Zones (/api/v1/cameras)
    │   ├── recordings/       # Evidence upload & retained clips (/api/v1/recordings)
    │   ├── identification/   # AI CCTV Recognition events & Alerts engine
    │   └── audit/            # Security & compliance audit log history
    └── scripts/
        ├── db-check.js       # npm run db:check — Diagnostics & table inspection
        ├── migrate.js        # npm run migrate  — Run pending schema migrations
        └── seed.js           # npm run db:seed  — Seed realistic sample data
```

---

## ⚡ Quick Start: Connecting to Neon Database

### Step 1: Create a Database on Neon
1. Log into your [Neon Console](https://console.neon.tech/).
2. Click **Create Project** (e.g. `cctv-visitor-backend`).
3. Under the **Connection Details** dashboard card:
   - Select **Direct Connection** (recommended for backend services & migrations).
   - Ensure `sslmode=require` is present in the URI.
   - Copy the connection URI:
     ```text
     postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
     ```

### Step 2: Configure your `.env` File
Open `.env` and set `DATABASE_URL`:
```env
PORT=8080
NODE_ENV=development
DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
JWT_SECRET=your_jwt_secret_change_in_production
```

### Step 3: Run Connection Diagnostics
Run the built-in diagnostic tool to test network reachability, TLS handshake, and check Neon tables:
```powershell
npm.cmd run db:check
```

### Step 4: Run Database Migrations
Create all necessary tables (`users`, `zones`, `visitors`, `visits`, `cameras`, `identifications`, `security_alerts`, `audit_logs`, `recordings`) in your Neon database:
```powershell
npm.cmd run migrate
```

### Step 5: (Optional) Seed Sample Data
Populate default administrator users, zones, cameras, and sample visitor profiles:
```powershell
npm.cmd run db:seed
```
*Default seeded admin credentials: `username: admin`, `password: AdminPass123!`*

### Step 6: Start the Backend Server
```powershell
npm.cmd run dev
```
The server will start listening at `http://localhost:8080`.

---

## 📡 API Reference & Core Endpoints

### 1. Health & Status
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API Information and root endpoint directory |
| `GET` | `/health` | Server uptime and Neon PostgreSQL connection latency check |

### 2. Authentication & Authorization (RBAC)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Log in with username/password, receives JWT token |
| `POST` | `/api/v1/auth/register` | Public/Admin | Register a new user (`admin`, `operator`, `guard`, `auditor`) |
| `GET` | `/api/v1/auth/me` | Bearer Token | Retrieve currently logged-in user profile |
| `GET` | `/api/v1/auth/users` | admin, auditor | List the operator & role registry (supports `?role=`, `?q=`) |

### 3. Visitor Management
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/visitors` | admin, operator, guard | Register new visitor with national ID / passport & photo |
| `GET` | `/api/v1/visitors` | any authenticated | List visitors (supports `?q=search`, `?status=active`, pagination) |
| `GET` | `/api/v1/visitors/:id` | any authenticated | Get full visitor profile |
| `PUT` | `/api/v1/visitors/:id` | admin, operator | Update visitor profile details |
| `PATCH` | `/api/v1/visitors/:id/status` | admin, operator, guard | Update status (`active`, `blacklisted`, `flagged`) |

### 4. Visits & Access Passes
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/visits` | admin, operator, guard | Schedule a visit pass with host, purpose, and authorized zones |
| `GET` | `/api/v1/visits` | any authenticated | List visits (supports `?status=checked_in`, `?visitorId=`) |
| `POST` | `/api/v1/visits/:id/check-in` | admin, operator, guard | Check-in visitor, assign physical badge, record timestamp |
| `POST` | `/api/v1/visits/:id/check-out` | admin, operator, guard | Check-out visitor upon departure |

### 5. CCTV Cameras & Security Zones
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/cameras/zones` | any authenticated | List security zones with security level (1-5) |
| `POST` | `/api/v1/cameras/zones` | admin, operator | Create a new security zone |
| `GET` | `/api/v1/cameras` | any authenticated | List all registered CCTV surveillance cameras |
| `POST` | `/api/v1/cameras` | admin | Register a new CCTV camera (IP, RTSP stream URL, zone) |
| `POST` | `/api/v1/cameras/:id/heartbeat`| any authenticated | Record online status heartbeat from camera |

### 6. CCTV Evidence Library (Video & Still Uploads)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/recordings` | admin, operator | Upload a CCTV clip or reference still (`multipart/form-data`, field `file`). Verified by magic bytes before anything is written to disk |
| `GET` | `/api/v1/recordings` | any authenticated | List retained evidence (`?cameraId=`, `?zoneId=`, `?mediaKind=video\|image`, pagination) |
| `GET` | `/api/v1/recordings/:id` | any authenticated | Get one recording's registry metadata |
| `GET` | `/api/v1/recordings/:id/stream` | any authenticated | Stream the media bytes with HTTP range support. Add `?download=1` to force a download |
| `DELETE` | `/api/v1/recordings/:id` | admin | Purge the recording: deletes both the registry row and the stored object |

Upload fields: `file` (required), `title` (required), `description`, `cameraId`,
`zoneId`, `identificationId`, `recordedAt`, `retentionDays`.

Every upload and purge writes an `audit_logs` entry (`UPLOAD_RECORDING` /
`DELETE_RECORDING`), so evidence handling stays inside the compliance trail.

**Storage.** Clips are written to the local volume at `UPLOAD_DIR` (default
`backend/uploads`, git-ignored) under a generated
`recordings/<year>/<month>/<uuid>.<ext>` key. Postgres holds only the registry
index, never the bytes — a large clip would otherwise bloat every backup and
row-level dump. Swap `platform/storage/localDiskStorage.js` for an
S3-compatible adapter if a sanctioned egress path is ever introduced.

**Verification.** A client-supplied `Content-Type` is attacker-controlled, so
`shared/media/magicBytes.js` re-derives the type from the file's leading bytes
(MP4/QuickTime `ftyp`, WebM/EBML, JPEG, PNG, WebP). The sniffed type is
authoritative: a `.mp4` that is actually an executable is rejected with `415`
and never reaches the filesystem.

**Security notes.**
- The media route is authenticated and range-capable. It is deliberately *not* a
  static mount, which would expose every retained clip to anyone who could
  reach the port and bypass the audit trail.
- Stored paths are resolved and checked against the upload root, so a corrupted
  `storage_path` row cannot be used to read arbitrary files.
- Responses carry `X-Content-Type-Options: nosniff` and a restrictive
  `Content-Security-Policy`.

### 7. CCTV Identification & Security Alerts
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/identification/detections` | Gateway / Auth | Ingest camera AI detection event. **Automatically triggers security alerts** if an unrecognized person enters a restricted zone or a blacklisted person is recognized. |
| `GET` | `/api/v1/identification/detections` | any authenticated | List detection logs with camera and visitor details |
| `GET` | `/api/v1/identification/alerts` | any authenticated | List security alerts (`?severity=critical`, `?isAcknowledged=false`) |
| `POST` | `/api/v1/identification/alerts/:id/acknowledge` | admin, operator, guard | Acknowledge and resolve an active security alert |

### 8. Audit Logging
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/audit` | admin, auditor | Query immutable compliance and access audit trails |

### 9. Dashboard Aggregates
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/summary` | Bearer Token | Single-round-trip operational counters (visitors on-site, expected arrivals, camera fleet health, unacknowledged alerts, 24h audit volume) backing the SOC landing page |

---

## 🔌 Frontend Integration

The React console (`../frontend`) never connects to Neon directly — a browser
cannot hold a Postgres connection string, and doing so would expose the
credentials. All traffic flows through this Express layer:

```text
React (Vite :3000)  ──fetch──▶  Vite dev proxy  ──▶  Express API (:8080)
                                                            │
                                                            ▼
                                              pg.Pool (SSL) ──▶ Neon Postgres
```

- **Dev (default):** Vite proxies `/api` and `/health` to `http://localhost:8080`
  (see `frontend/vite.config.ts`), so requests stay same-origin — no CORS
  preflight. No frontend config needed.
- **Deployed:** set `VITE_API_URL` (e.g. `https://vms-api.facility.lan`) and set
  `CORS_ORIGIN` in `backend/.env` to the console's origin.
- The JWT is persisted in `localStorage` under `vms_acs_jwt` and sent as
  `Authorization: Bearer <token>`. A `401` tears the session down client-side.

### Role Vocabulary Mapping

The database stores four roles while the console has a six-tier clearance model,
so `toConsoleRole()` in `frontend/src/types/auth.ts` performs the projection:

| DB `users.role` | Console role |
|---|---|
| `admin` | `super_admin` |
| `operator` | `security_officer` |
| `guard` | `receptionist` |
| `auditor` | `auditor` |

Unrecognised values fall back to `auditor` (least privilege) so a malformed row
cannot escalate access.

### Seeded Credentials

| Username | Password | Role | Clearance |
|---|---|---|---|
| `admin` | `AdminPass123!` | admin | TOP_SECRET |
| `guard_john` | `GuardPass123!` | guard | RESTRICTED |
| `auditor_mugisha` | `AuditorPass123!` | auditor | RESTRICTED |
