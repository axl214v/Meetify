# Changelog

All notable changes to Meetify are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(while in `beta`, breaking changes may still land in minor releases).

The current version lives in [`version.txt`](version.txt) and is passed to the
containers as `APP_VERSION` by `make up`.

## [Unreleased]

_Nothing yet._

## [1.3.0-beta] — 2026-06-20

### Added
- **Adaptive quality monitor** (`conf_room.js`). WebRTC stats are polled every 5 s
  via `RTCPeerConnection.getStats()` (P2P: all peer connections; SFU: send
  transport's underlying RTCPeerConnection). Four tiers are applied automatically
  based on measured RTT and outbound packet-loss fraction (two consecutive matching
  polls required to avoid flapping):

  | Tier | Trigger | Video | Audio | P2P bitrate cap |
  |------|---------|-------|-------|-----------------|
  | `excellent` | RTT < 50 ms, loss < 0.5 % | 1920 × 1080 @ 30 fps | stereo (ideal) | 4 Mbit/s |
  | `good` _(default)_ | RTT < 150 ms, loss < 2 % | 1280 × 720 @ 30 fps | stereo (ideal) | 2 Mbit/s |
  | `degraded` | RTT < 400 ms or loss < 8 % | 640 × 360 @ 20 fps | mono | 500 kbit/s |
  | `poor` | RTT ≥ 400 ms or loss ≥ 8 % | 320 × 180 @ 15 fps | mono | 200 kbit/s |

  Resolution and framerate are applied via `MediaStreamTrack.applyConstraints()`;
  audio channel count via the same API; P2P bitrate via
  `RTCRtpSender.setParameters()`. A transient toast notifies users on quality
  change and on recovery.
- **VP9 codec** registered in mediasoup `mediaCodecs` ahead of VP8. Chrome,
  Firefox and Edge negotiate VP9 automatically (~30–40 % bandwidth savings at
  equivalent visual quality); Safari and older browsers fall back to VP8.
- **Camera submenu with flip and rotate** in the conference room. The video
  control bar now has a dedicated camera menu (▾) with three actions: flip
  horizontal, flip vertical, and rotate 90°. Transforms are CSS-only and apply
  to the local preview only — the transmitted stream is unaffected. Works on
  desktop and mobile.
- **Mobile-responsive conference room.** Video grid, controls, and sidebars
  reworked for small screens: the wordmark swaps to the logo-mark below 480 px,
  mode cards collapse on narrow viewports, and the admin tables are wrapped in
  scroll containers. iOS input zoom (font-size < 16 px) is fixed.

### Changed
- **`x-google-start-bitrate` removed** from VP8 and VP9 codec parameters.
  mediasoup uses TWCC-based congestion control (GoogCCC), which converges on the
  right bitrate within 1–2 s regardless of this legacy Chrome-specific SDP hint.
- **`initialAvailableOutgoingBitrate`** raised from 800 kbit/s to **2.5 Mbit/s**.
  GoogCCC now starts with a budget sufficient for 720p without a ramp-up phase,
  consistent with the self-hosted STUN/TURN setup introduced in 1.2.0-beta.

## [1.2.0-beta] — 2026-06-16

### Added
- **Self-hosted fonts.** Outfit and JetBrains Mono are now served from
  `/assets/fonts/` as WOFF2 with proper `unicode-range` subsetting. All 13 HTML
  pages no longer reference Google Fonts — zero third-party requests on page load.
- **Bundled coturn STUN/TURN.** A `coturn/coturn` container starts automatically
  alongside the app. Config is passed entirely via CLI args so Docker Compose
  substitutes `COTURN_PUBLIC_IP` / `TURN_PASSWORD` before launch (coturn does not
  support shell variable syntax in config files).
- **ICE servers served from backend.** The server sends `iceServers` inside the
  `room-participants` socket event; `conf_room.js` populates `rtcConfig` from that
  response instead of hardcoding Google STUN addresses. Changing the STUN/TURN
  endpoint requires only an `.env` update — no frontend rebuild.
- **Auto-provision coturn in `deploy.sh`.** Step 5 SSHes into `meetify-mail`
  (62.60.186.59), installs Docker if absent, opens ufw ports, and starts/restarts
  the coturn container with credentials read from the main server's `.env`.
  `TURN_PASSWORD` is now generated automatically on first deploy.
- **Copyright notice** added to `LICENSE.md`
  (`Copyright © 2024–2026 axl214v. All rights reserved.`).
- **Repository made public** with branch protection on `main`: PRs require
  1 approval, force-push and branch deletion are disabled. Owner can still push
  directly.

### Changed
- `stunServer.js` defaults point to `62.60.186.59:3478`; TURNS/5349 entry
  removed (not running); hardcoded fallback credential removed.
- `Docker.md` STUN/TURN section rewritten: documents `COTURN_PUBLIC_IP`, Option
  A (same VPS) vs Option B (dedicated VPS for IP privacy), and required firewall
  ports.
- `.env.example` STUN/TURN block updated with `COTURN_PUBLIC_IP` and production
  guidance comments.

### Fixed
- **Unauthenticated log endpoints.** `GET /api/logs/errors`, `GET /api/logs/stats`,
  and `DELETE /api/logs/errors` had no auth middleware despite containing user IDs
  and user-agents. All three now require `authenticateToken + requireRole('admin')`.

### Security
- **20 Dependabot vulnerabilities patched** (0 remaining):
  - `nodemailer` 6 → 9 (CRLF injection, DoS, SMTP command injection, TLS bypass)
  - `bcrypt` 5 → 6 (drops `@mapbox/node-pre-gyp` and vulnerable `tar`)
  - `path-to-regexp`, `qs`, `ws`, `ip-address`, `brace-expansion` via `npm audit fix`

### Privacy
- **Error telemetry disclosed.** `PRIVACY.md` and `/legal/privacy.html` now
  document the automatic browser error reporting: what is collected (error message,
  stack trace, URL, browser/OS, viewport, user ID, session ID), why, who can
  access it, and that it is never shared with third parties.

## [1.1.0-beta] — 2026-06-06

The first release tracked in this changelog. Covers everything between the
`1.0.0-beta` baseline and the Deep Space redesign.

### Added
- **Group calls (SFU).** mediasoup-backed conferences alongside classic P2P. The
  create form has a Private/Group mode selector with per-mode participant caps;
  the room negotiates RTP capabilities, transports, producers and consumers
  through the new `sfu/mediasoup.js` worker pool and `sfuSocket.js` handlers.
  `conferences.mode` (`p2p` | `sfu`) persists the choice.
- **Host & co-host moderation.** Kick, force-mute (audio/video/screen), chat-ban,
  and promote/demote co-host, with an in-room kebab-menu UI. State is
  session-scoped (in-memory).
- **Crypto donations.** Public `/donate` page with copy-to-clipboard wallet
  addresses and locally-generated QR codes (vendored `qrcode-generator`, **no
  external requests**). Managed from the admin **Socials** tab, which now handles
  donate / crypto / social link categories.
- **Support tickets.** Users open and track tickets with threaded replies
  (max 5 open per user); admins manage them from a dedicated tab.
- **In-app notifications.** Admin broadcast notifications with categories
  (info / update / maintenance / warning) and a real-time bell widget on the
  landing, app and admin surfaces, with a modal detail view.
- **Email flows.** Password-reset emails with a forgot-password rate limit,
  an email-verification banner with resend, and SMTP passwordless IP-relay
  support (`smtp_ignore_tls`).
- **Legal & privacy.** Browsable Privacy Policy and Terms pages (GDPR Art. 6
  basis, minimum age 16, breach notification), registration consent + age
  checkboxes, and a session-only cookie-consent banner.
- **Room pin/spotlight** mode for video tiles.
- **Conference editing** modal and a conference-ID badge on hosted cards.
- **Richer admin stats** — verified users, live socket connections, public/avg
  conference metrics, new stat cards, and auto-refresh.

### Changed
- **Deep Space Precision redesign** across all pages — new landing (call-mockup
  hero, gradient cards), image-based logo in nav and room header.
- **Logo optimized** from ~2 MB to ~95 KB; added a 256×256 square icon mark and
  refreshed favicons.
- **Backend upgraded to Node 22** (required by mediasoup 3.20+).
- License changed to **Polyform Noncommercial 1.0.0**; trademark added.

### Fixed
- **Landing performance** — removed the animated `backdrop-filter` / blur-orb
  jank that stuttered on macOS; promoted blur layers to the GPU and added
  `prefers-reduced-motion` handling.
- **Real client IP behind Cloudflare** — rate limiters now key off
  `CF-Connecting-IP` (`utils/ip.js`) instead of a spoofable forwarded header;
  fixed IPv6 (`::ffff:`) handling.
- Avatar-deletion path, `/uploads/` Nginx location precedence, and `no-cache`
  headers for JS/CSS to stop stale assets being served.
- Several auth bugs: `changePassword` crash, `forgotPassword` return value,
  reset-token invalidation on reissue, and silent `resend-verification`
  (no email enumeration).

### Security
- **Socket.IO JWT authentication is now enforced** — connections without a valid
  token in `socket.handshake.auth.token` are rejected.
- **Conference passwords are bcrypt-hashed** on create/update and verified with
  `bcrypt.compare` on join (previously stored in plain text).
- `/admin/` static files protected with Nginx `auth_request`.

## [1.0.0-beta] — 2026-04-30

Baseline release (pre-changelog). Summarized from history.

### Added
- Core peer-to-peer video conferencing (full-mesh WebRTC) with real-time chat,
  screen sharing and media controls.
- JWT authentication via `httpOnly` cookies; registration/login; bcrypt-hashed
  user passwords.
- Conference CRUD, scheduling (Scheduled/Ongoing/Ended computed from
  timestamps), public/private conferences, participant tracking.
- Admin panel, avatar upload, and client-side error logging to `/api/logs`.

[Unreleased]: https://github.com/axl214v/Meetify/compare/v1.3.0-beta...HEAD
[1.3.0-beta]: https://github.com/axl214v/Meetify/compare/v1.2.0-beta...v1.3.0-beta
[1.2.0-beta]: https://github.com/axl214v/Meetify/compare/v1.1.0-beta...v1.2.0-beta
[1.1.0-beta]: https://github.com/axl214v/Meetify/releases/tag/v1.1.0-beta
[1.0.0-beta]: https://github.com/axl214v/Meetify/releases/tag/v1.0.0-beta
