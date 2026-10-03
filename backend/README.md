# CCTV Visitor Management & Access Authorization Backend

A production-grade, modular backend built with **Node.js (ESM)**, **Express 5**, and **MongoDB**. Designed specifically for high-security facilities requiring **visitor registration, access passes, role-based authorization, and real-time CCTV camera facial identification & security alerting**.

> **Storage engine: MongoDB.** The API speaks the official `mongodb` driver and targets either **MongoDB Atlas** (`mongodb+srv://`) or a self-hosted **mongod** (`mongodb://`), so the air-gapped appliance and a hosted cluster use the same code.

---

## 🏗 System Architecture

```text
c:\Users\Fiacre\Desktop\backend/
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration (MONGODB_URI)
├── .gitignore
├── package.json              # NPM scripts and dependencies
├── README.md                 # Complete documentation & API reference
├── migrations/
│   └── mongo/                # Numbered schema migrations (JS, not SQL)
│       ├── _helpers.js            # defineCollection / schema / index helpers
│       ├── 0001_initial_schema.js
│       ├── 0002_user_profiles_and_dashboard.js
│       └── 0003_recordings_and_media_upload.js
└── src/
    ├── index.js              # Server entry point & graceful shutdown
    ├── app.js                # Express 5 application setup & middleware pipeline
    ├── config/
    │   ├── env.js            # Zero-dependency .env loader
    │   └── config.js         # Config validation & MONGODB_URI parsing
    ├── platform/
    │   ├── db/
    │   │   ├── mongo.js      # MongoClient factory, ping, server info
    │   │   └── migrateMongo.js # Migration runner + schema_migrations collection
    │   └── storage/
    │       └── localDiskStorage.js # Filesystem blob storage for uploaded evidence
    ├── shared/
    │   ├── errors.js         # AppError hierarchy (BadRequest, Unauthorized, etc.)
    │   ├── logger.js         # Structured JSON/console logger
    │   ├── http/respond.js   # Standardized success/error JSON response envelopes
    │   ├── mongo/
    │   │   └── helpers.js    # Regex escaping, UUID ids, paging, projections
    │   ├── media/
    │   │   └── magicBytes.js # Content-type verification for uploaded media
    │   └── middleware/
    │       ├── auth.js       # JWT authentication & Role-Based Access Control (RBAC)
    │       ├── errorHandler.js # MongoDB error translation (11000, 121, 26)
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

## Quick Start: Connecting to MongoDB

### Step 1: Create a Database

**Option A - MongoDB Atlas (hosted)**
1. Log into [MongoDB Atlas](https://cloud.mongodb.com/) and create a free **M0** cluster.
2. Under **Database Access**, create a user *with a role on the target database*.
   Adding a user without granting a role is the most common cause of "not
   authorized" on Atlas.
3. Under **Network Access**, allow your client IP (or `0.0.0.0/0` while testing).
4. Click **Connect -> Drivers** and copy the connection string.

**Option B - Self-hosted (recommended for an air-gapped appliance)**
```bash
docker run -d --name vms-mongo -p 27017:27017 -v vms-mongo-data:/data/db mongo:8
```

### Step 2: Configure your `.env` File
```env
PORT=8080
NODE_ENV=development
MONGODB_URI=mongodb+srv://user:password@cluster0.example.net/vms_acs?appName=Cluster0
MONGODB_DB=vms_acs
JWT_SECRET=your_jwt_secret_change_in_production
```

> **Percent-encode credentials.** A username containing `@` (an email address)
> must be written as `%40`, otherwise the driver cannot distinguish the
> credentials from the hostname and the connection fails.

### Step 3: Run Connection Diagnostics
Verifies reachability, TLS, authentication, collections, applied migrations,
record counts and index coverage, with hints for common misconfigurations:
```powershell
npm.cmd run db:check
```

### Step 4: Run Database Migrations
Creates the ten collections with their JSON Schema validators and indexes:
```powershell
npm.cmd run migrate
```

### Step 5: (Optional) Seed Sample Data
Populate operators, zones, cameras, visitors, live visits, a detection and an alert:
```powershell
npm.cmd run db:seed
```
*Seeded credentials: `admin` / `AdminPass123!`, `guard_john` / `GuardPass123!`, `auditor_mugisha` / `AuditorPass123!`*

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
| `GET` | `/health` | Server uptime and MongoDB connection latency check |

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
`recordings/<year>/<month>/<uuid>.<ext>` key. MongoDB holds only the registry
index, never the bytes — a large clip would otherwise bloat every backup and
`mongodump`. Swap `platform/storage/localDiskStorage.js` for an
S3-compatible adapter if a sanctioned egress path is introduced.

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
