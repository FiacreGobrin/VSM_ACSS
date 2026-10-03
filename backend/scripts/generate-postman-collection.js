/**
 * Generates the Postman collection for the VMS-ACS API.
 *
 * Kept as a script rather than a hand-edited JSON blob so the folder layout,
 * auth defaults and variable wiring stay consistent and can be regenerated after
 * an endpoint change instead of drifting out of sync.
 *
 * Run:  node scripts/generate-postman-collection.js
 * Out:  postman/VMS-ACS_API.postman_collection.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(here, '..', 'postman', 'VMS-ACS_API.postman_collection.json');

/**
 * Builds a request against the `baseUrl` collection variable.
 * `opts`: { json, form, description, auth, query, test }
 */
function req(name, method, segments, opts = {}) {
  const clean = segments.filter(Boolean);
  const query = Object.entries(opts.query || {}).filter(([, v]) => v !== '' && v !== undefined);

  const url = {
    raw: `{{baseUrl}}/${clean.join('/')}${
      query.length ? '?' + query.map(([k, v]) => `${k}=${v}`).join('&') : ''
    }`,
    host: ['{{baseUrl}}'],
    path: clean,
  };
  if (query.length) url.query = query.map(([key, value]) => ({ key, value: String(value) }));

  const item = {
    name,
    request: {
      method,
      header: opts.json ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      ...(opts.json ? { body: { mode: 'raw', raw: JSON.stringify(opts.json, null, 2) } } : {}),
      ...(opts.form ? { body: { mode: 'formdata', formdata: opts.form } } : {}),
      ...(opts.description ? { description: opts.description } : {}),
      ...(opts.auth ? { auth: opts.auth } : {}),
      url,
    },
  };

  if (opts.test) {
    item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: opts.test } }];
  }
  return item;
}

const NOAUTH = { type: 'noauth' };
const text = (key, value) => ({ key, value: String(value), type: 'text' });
const fileField = (key) => ({ key, type: 'file', src: [] });

/** Captures the JWT into the `token` collection variable. */
const captureToken = [
  'const body = pm.response.json();',
  "pm.test('Login returns 200', () => pm.response.to.have.status(200));",
  "pm.test('Login returns a token', () => {",
  '  pm.expect(body.success).to.eql(true);',
  "  pm.expect(body.data.token).to.be.a('string').and.not.empty;",
  '});',
  'if (body.success && body.data && body.data.token) {',
  "  pm.collectionVariables.set('token', body.data.token);",
  "  console.log('Token captured:', body.data.token.slice(0, 24) + '...');",
  '} else {',
  "  console.error('Login failed:', JSON.stringify(body));",
  '}',
];

/**
 * Saves an id from the response into a collection variable so dependent requests
 * chain without the operator copy-pasting UUIDs by hand.
 */
const capture = (varName, accessor = 'body.data.id') => [
  'const body = pm.response.json();',
  `const id = ${accessor};`,
  'if (id) {',
  `  pm.collectionVariables.set('${varName}', String(id));`,
  `  console.log('${varName} =', id);`,
  '}',
];

const collection = {
  info: {
    _postman_id: 'b7f3c2a1-9d4e-4c8b-a1f2-5e6d7c8b9a01',
    name: 'VMS-ACS API (MongoDB)',
    description: [
      'Visitor Management, Access Control & CCTV Evidence API.',
      '',
      'HOW TO USE',
      '1. Set the `baseUrl` variable to your running API (default http://localhost:8080).',
      '2. Run "Auth > Login (admin)" FIRST - its test script captures the JWT into `token`.',
      '3. Every other request sends `Authorization: Bearer {{token}}` via collection-level auth.',
      '',
      'Responses use the envelope `{ success, data, meta }` or `{ success:false, error:{ code, message } }`.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{token}}', type: 'string' }],
  },
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          "// Error responses use HTTP 4xx with `{ success:false, error:{...} }`, so success",
          '// must be read from the body rather than assumed from the status code.',
          "pm.test('Response is JSON', () => { pm.response.to.be.json; });",
        ],
      },
    },
  ],
  variable: [
    { key: 'baseUrl', value: 'http://localhost:8080', type: 'string' },
    { key: 'token', value: '', type: 'string' },
    { key: 'zoneId', value: '', type: 'string' },
    { key: 'cameraId', value: '', type: 'string' },
    { key: 'visitorId', value: '', type: 'string' },
    { key: 'visitId', value: '', type: 'string' },
    { key: 'recordingId', value: '', type: 'string' },
    { key: 'alertId', value: '', type: 'string' },
  ],
  item: [],
};
// ------------------------------------------------------------- Health & Auth
collection.item.push({
  name: '01 - Health & Auth',
  item: [
    req('API Index (public)', 'GET', [''], {
      auth: NOAUTH,
      description: 'Lists every mounted endpoint. Public - no token needed.',
    }),
    req('Health Check', 'GET', ['health'], {
      description:
        'Uptime plus a live MongoDB round-trip. Use this to prove the database is genuinely reachable, not merely that the process started.',
    }),
    req('Login (admin)', 'POST', ['api', 'v1', 'auth', 'login'], {
      auth: NOAUTH,
      json: { username: 'admin', password: 'AdminPass123!' },
      description: 'Run this FIRST. Seeded credentials are admin / AdminPass123!.',
      test: captureToken,
    }),
    req('Login (guard - RBAC checks)', 'POST', ['api', 'v1', 'auth', 'login'], {
      auth: NOAUTH,
      json: { username: 'guard_john', password: 'GuardPass123!' },
      description:
        'Logs in as a guard to confirm 403s on privileged routes. Overwrites `token`, so re-run the admin login afterwards.',
      test: capture('guardToken', 'body.data.token'),
    }),
    req('Current User (me)', 'GET', ['api', 'v1', 'auth', 'me']),
    req('List Users', 'GET', ['api', 'v1', 'auth', 'users'], {
      query: { role: 'admin' },
      description: 'admin + auditor only.',
    }),
  ],
});

// ----------------------------------------------------------- Cameras & Zones
collection.item.push({
  name: '02 - Cameras & Zones',
  item: [
    req('List Security Zones', 'GET', ['api', 'v1', 'cameras', 'zones']),
    req('Create Security Zone', 'POST', ['api', 'v1', 'cameras', 'zones'], {
      json: { name: 'Loading Dock', description: 'Rear goods entrance', securityLevel: 3 },
      description: 'admin + operator. Saves zoneId for the requests below.',
      test: capture('zoneId'),
    }),
    req('List Cameras', 'GET', ['api', 'v1', 'cameras'], {
      query: { zoneId: '', status: '' },
      description: 'Optional filters: ?zoneId=<uuid> or ?status=online|offline|maintenance.',
    }),
    req('Register Camera', 'POST', ['api', 'v1', 'cameras'], {
      json: {
        name: 'Main Gate 01',
        streamUrl: 'rtsp://10.10.0.51:554/Streaming/Channels/101',
        model: 'Hikvision DS-2CD8A',
        zoneId: '',
        ipAddress: '10.10.0.51',
      },
      description: 'admin only. Put {{zoneId}} in zoneId to bind it to the zone you created.',
      test: capture('cameraId'),
    }),
    req('Get Camera', 'GET', ['api', 'v1', 'cameras', '{{cameraId}}']),
    req('Camera Heartbeat', 'POST', ['api', 'v1', 'cameras', '{{cameraId}}', 'heartbeat'], {
      description: 'Marks the camera online and stamps last_heartbeat_at.',
    }),
  ],
});

// ----------------------------------------------------------------- Visitors
collection.item.push({
  name: '03 - Visitors',
  item: [
    req('List Visitors', 'GET', ['api', 'v1', 'visitors'], {
      query: { q: '', status: 'active', limit: 20, offset: 0 },
      description:
        'Supports ?q= (matches name / ID number / company), ?status=active|blacklisted|flagged, plus limit/offset. Pagination metadata comes back in `meta`.',
    }),
    req('Create Visitor', 'POST', ['api', 'v1', 'visitors'], {
      json: {
        fullName: 'Sarah Connor',
        idType: 'national_id',
        idNumber: '1198580029381014',
        company: 'Cyberdyne Systems',
        email: 'sarah.connor@example.com',
        phone: '+250788000000',
      },
      description:
        'idType must be one of: national_id | passport | drivers_license | other. (id_type, id_number) is UNIQUE - re-posting the same pair returns 409 conflict.',
      test: capture('visitorId'),
    }),
    req('Get Visitor', 'GET', ['api', 'v1', 'visitors', '{{visitorId}}']),
    req('Update Visitor', 'PUT', ['api', 'v1', 'visitors', '{{visitorId}}'], {
      json: { company: 'Cyberdyne Systems Ltd', notes: 'VIP - escorted at all times' },
      description: 'admin + operator. Only the fields you send are changed.',
    }),
    req('Set Visitor Status', 'PATCH', ['api', 'v1', 'visitors', '{{visitorId}}', 'status'], {
      json: { status: 'flagged', notes: 'Reported by perimeter camera' },
      description:
        'status: active | blacklisted | flagged. Setting blacklisted means a recognition event raises a security alert.',
    }),
  ],
});
// -------------------------------------------------------------------- Visits
collection.item.push({
  name: '04 - Visits & Access Passes',
  item: [
    req('List Visits', 'GET', ['api', 'v1', 'visits'], {
      query: { status: 'scheduled', visitorId: '' },
      description: 'Supports ?status=scheduled|checked_in|checked_out|cancelled|denied and ?visitorId=.',
    }),
    req('Create Visit', 'POST', ['api', 'v1', 'visits'], {
      json: {
        visitorId: '{{visitorId}}',
        hostName: 'Dr. James Hall',
        hostEmail: 'j.hall@example.com',
        purpose: 'Server room inspection',
        badgeNumber: 'V-1042',
        expectedArrival: new Date(Date.now() + 3600_000).toISOString(),
        authorizedZones: [],
      },
      description:
        'Create the visitor first so {{visitorId}} is populated. Omit authorizedZones to default to the perimeter only.',
      test: capture('visitId'),
    }),
    req('Check In', 'POST', ['api', 'v1', 'visits', '{{visitId}}', 'check-in'], {
      json: { badgeNumber: 'V-1042' },
      description:
        'Moves status to checked_in and flips the on_site counter used by the dashboard.',
      test: capture('visitId'),
    }),
    req('Check Out', 'POST', ['api', 'v1', 'visits', '{{visitId}}', 'check-out'], {
      description: 'Moves status to checked_out and clears occupancy.',
    }),
  ],
});
// ------------------------------------------------------- CCTV Evidence (new)
collection.item.push({
  name: '05 - CCTV Evidence Upload',
  item: [
    req('List Recordings', 'GET', ['api', 'v1', 'recordings'], {
      query: { mediaKind: '', cameraId: '', limit: 24, offset: 0 },
      description:
        'Filters: ?mediaKind=video|image, ?cameraId=<uuid>. Pagination lands in `meta`.',
    }),
    req('Upload Recording', 'POST', ['api', 'v1', 'recordings'], {
      form: [
        fileField('file'),
        text('title', 'Main Gate - tailgating 22:14'),
        text('description', 'Two badges scanned, three persons through'),
        text('cameraId', '{{cameraId}}'),
        text('retentionDays', '30'),
      ],
      description: [
        'Body tab: set `file` to type **File** (not Text), then pick an .mp4/.webm/.mov/.jpg/.png.',
        'admin + operator only - a guard receives 403.',
        'The server verifies the file by MAGIC BYTES, so a renamed executable is rejected with 415 `unsupported_media_type` no matter what Content-Type Postman sends.',
        'Set cameraId to {{cameraId}} to attribute the clip to a registered camera.',
      ].join('\n'),
      test: capture('recordingId'),
    }),
    req('Upload Recording (minimal)', 'POST', ['api', 'v1', 'recordings'], {
      form: [text('title', 'Perimeter still - intruder'), fileField('file')],
      description:
        'The minimum viable upload: just `file` plus `title`. Pick a real file for the `file` part in the Body tab.',
      test: capture('recordingId'),
    }),
    req('Get Recording', 'GET', ['api', 'v1', 'recordings', '{{recordingId}}']),
    req('Stream Recording', 'GET', ['api', 'v1', 'recordings', '{{recordingId}}', 'stream'], {
      description: [
        'Streams the bytes with HTTP range support, so seeking works. Postman previews media inline.',
        'For a specific range, add the header `Range: bytes=0-1023`.',
        'Append `?download=1` to force a download instead of inline playback.',
      ].join('\n'),
    }),
    req('Download Recording', 'GET', [
      'api',
      'v1',
      'recordings',
      '{{recordingId}}',
      'stream?download=1',
    ]),
    req('Delete Recording', 'DELETE', ['api', 'v1', 'recordings', '{{recordingId}}'], {
      description:
        'admin only. Purges the registry row AND the stored file, and writes an audit entry. Irreversible.',
    }),
  ],
});
// --------------------------------------------- Identification & Alert Engine
collection.item.push({
  name: '06 - Detection & Alerts',
  item: [
    req('Ingest Detection', 'POST', ['api', 'v1', 'identification', 'detections'], {
      auth: NOAUTH,
      json: {
        cameraId: '{{cameraId}}',
        eventType: 'unrecognized_person',
        confidenceScore: 0.94,
        notes: 'Motion detected in restricted zone',
      },
      description: [
        'Optional auth, so camera gateways can post directly.',
        'eventType: recognized_visitor | unrecognized_person | unauthorized_zone_breach | blacklisted_person_alert | tailgating.',
        'This endpoint is what auto-generates security_alerts rows for blacklisted visitors and zone breaches.',
      ].join('\n'),
    }),
    req('List Detections', 'GET', ['api', 'v1', 'identification', 'detections'], {
      query: { cameraId: '', eventType: '', limit: 20 },
    }),
    req('List Alerts', 'GET', ['api', 'v1', 'identification', 'alerts'], {
      query: { isAcknowledged: 'false', severity: '' },
      description: 'severity: low | medium | high | critical.',
    }),
    req('Acknowledge Alert', 'POST', [
      'api',
      'v1',
      'identification',
      'alerts',
      '{{alertId}}',
      'acknowledge',
    ], {
      description:
        'admin + operator + guard. Copy an alert id from "List Alerts" into the {{alertId}} variable.',
    }),
  ],
});

// ------------------------------------------------------ Dashboard & Compliance
collection.item.push({
  name: '07 - Dashboard & Audit',
  item: [
    req('Dashboard Summary', 'GET', ['api', 'v1', 'dashboard', 'summary'], {
      description:
        'Single round-trip counters behind the SOC landing page: visitors on-site, camera fleet health, unacknowledged alerts, 24h audit volume.',
    }),
    req('Audit Log', 'GET', ['api', 'v1', 'audit'], {
      query: { action: '', entityType: '', limit: 50 },
      description:
        'Every upload, purge, status change and acknowledgement lands here. Try action=UPLOAD_RECORDING after uploading a clip.',
    }),
  ],
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2) + '\n', 'utf8');

const count = collection.item.reduce((n, g) => n + g.item.length, 0);
console.log(`Wrote ${outPath}`);
console.log(`${collection.item.length} folders, ${count} requests`);