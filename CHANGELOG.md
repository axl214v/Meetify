# Changelog

All notable changes to Meetify are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(while in `beta`, breaking changes may still land in minor releases).

The current version lives in [`version.txt`](version.txt) and is passed to the
containers as `APP_VERSION` by `make up`.

## [Unreleased]

_Nothing yet._

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

[Unreleased]: https://github.com/axl214v/Meetify/compare/v1.1.0-beta...HEAD
[1.1.0-beta]: https://github.com/axl214v/Meetify/releases/tag/v1.1.0-beta
[1.0.0-beta]: https://github.com/axl214v/Meetify/releases/tag/v1.0.0-beta
