# Security Policy

## Supported Versions

Meetify is in active `beta`. Security fixes land on the **latest** release only —
there are no long-term support branches yet. Always run the most recent version
(see [`version.txt`](version.txt) and [CHANGELOG.md](CHANGELOG.md)).

| Version | Supported |
| ------- | --------- |
| 1.1.x-beta (latest) | ✅ |
| < 1.1.0-beta | ❌ — please upgrade |

## Reporting a Vulnerability

**Please do not open public GitHub issues for security problems.**

Report privately by email to **security@meetify.cc** with the subject
`SECURITY: Meetify`. Where possible include:

- A description of the issue and its impact.
- Steps to reproduce (a proof of concept is ideal).
- The affected version/commit and your environment.
- Any suggested remediation.

**What to expect:**
- Acknowledgement within **72 hours**.
- An initial assessment (accepted / needs-info / declined) within **7 days**.
- For accepted reports, a fix or mitigation plan, and credit in the release notes
  if you'd like it.

Please give us reasonable time to release a fix before any public disclosure
(coordinated disclosure).

## Security Measures in Place

- **Authentication** — JWT in `httpOnly` cookies (also accepted as
  `Authorization: Bearer`). Socket.IO connections **require a valid JWT**.
- **Password storage** — user **and** conference passwords are bcrypt-hashed.
- **Account flows** — email verification and password reset; `resend-verification`
  is intentionally silent to avoid account enumeration.
- **Rate limiting** — HTTP endpoints (login, register, conference join/create,
  password reset) are rate-limited, with Cloudflare-aware real client-IP
  resolution (`CF-Connecting-IP`) to resist header spoofing.
- **Admin surface** — `/admin/` static files are protected by Nginx
  `auth_request`; admin APIs require `role = admin`.
- **Input handling** — server-side validation on API routes; client-side HTML
  escaping to mitigate XSS.

## Known Limitations (by design / not yet implemented)

These are documented, not secrets — please factor them into your deployment:

- **HTTPS is not enabled by default.** The Nginx SSL block is commented out;
  terminate TLS before exposing Meetify publicly. Browsers require a secure
  context for camera/microphone outside `localhost`.
- **No bundled TURN server.** coturn is commented out in `docker-compose.yml`;
  without it, calls may fail across restrictive NATs.
- **Socket.IO event payloads beyond WebRTC signaling are not rate-limited.**
- **Moderation state (kick/ban/co-host) is in-memory and session-scoped** — it is
  not persisted and resets when a room empties; there is no audit log.
- **mediasoup media ports (40000–40059)** must be firewalled to the intended
  audience; `MEDIASOUP_ANNOUNCED_IP` must point at the correct reachable address.

## Scope

In scope: the Meetify backend (`src/server_js`), frontend (`src/app`), and the
Docker/Nginx configuration in this repository. Out of scope: third-party
dependencies (report upstream), and issues that require a pre-compromised host or
privileged local access.
