# Meetify 🎥

**Meetify** — a self-hostable video conferencing platform built with WebRTC,
Node.js and Socket.IO. It supports both peer-to-peer calls and **mediasoup SFU
group calls**, and ships as a three-container Docker stack behind Nginx.

[![Version](https://img.shields.io/badge/version-1.1.0--beta-blue)](version.txt)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-Polyform%20Noncommercial-orange)](LICENSE.md)

> Changes are tracked in [CHANGELOG.md](CHANGELOG.md). The current version is in
> [`version.txt`](version.txt).

## ✨ Features

### 🎬 Conferencing
- **Two call modes** — **Private (P2P)** full-mesh WebRTC for small calls, and
  **Group (SFU)** routed through mediasoup for larger rooms. The host picks the
  mode when creating a conference.
- **Dynamic video grid** with a **pin / spotlight** mode for focusing one tile.
- **Screen sharing** — `replaceTrack()` in P2P, a dedicated screen producer in SFU.
- **Media controls** — mute/unmute mic, camera on/off, per-participant state.

### 🛡️ Moderation
- **Host & co-host roles** — kick, force-mute (audio/video/screen), chat-ban,
  promote/demote co-host. Session-scoped, applied live over Socket.IO.

### 💬 Communication & engagement
- **Real-time chat** with unread badge, **participant list**, media indicators.
- **In-app notifications** — admin broadcasts with a real-time bell widget.
- **Support tickets** — users open and track tickets with threaded replies.
- **Donate page** — wallet addresses with copy + locally-generated QR codes
  (no third-party requests) and social links, all configured from the admin panel.

### 🔐 Auth & security
- **JWT authentication** in `httpOnly` cookies (and `Authorization: Bearer`).
- **Email verification** and **password reset** via SMTP.
- **bcrypt** hashing for user **and** conference passwords.
- **Socket.IO connections require a valid JWT** (enforced, not optional).
- **Rate limiting** on HTTP endpoints, Cloudflare-aware client-IP resolution.
- **Admin panel** protected by Nginx `auth_request`.

### ⚙️ Conference management
- Create / edit / delete conferences with name, description, schedule,
  participant limit, public/private, optional password.
- Status (Scheduled / Ongoing / Ended) computed from start/end timestamps.
- Admin dashboard: stats, user & conference management, SMTP, socials,
  notifications, support tickets.

## 🛠️ Technology Stack

**Backend** — Node.js 22 + Express, Socket.IO (signaling, chat, SFU control),
**mediasoup** (SFU), `mysql2` pool, JWT + cookie-parser, bcrypt, nodemailer,
express-rate-limit, multer.

**Frontend** — Vanilla HTML/CSS/JS (no build step), WebRTC + mediasoup-client,
Socket.IO client. "Deep Space Precision" design system.

**Infrastructure** — Docker Compose (db / backend / frontend), Nginx reverse
proxy + static server, MySQL 8.0 with a persistent volume.

## 🏗️ Architecture

Three containers on `meetify-network`:

| Container | Image | Exposes |
|-----------|-------|---------|
| `meetify-db` | MySQL 8.0 | 3306 |
| `meetify-backend` | Node.js (`src/server_js`) | 3000; UDP+TCP **40000–40059** (mediasoup RTC) |
| `meetify-frontend` | Nginx (`src/app`) | 80, 443 |

**Request flow:** Browser → Nginx (80) → proxies `/api/*`, `/socket.io/`,
`/check-status`, `/uploads/` to `backend:3000`; everything else is static.

**Two call modes:**
- **P2P** — full-mesh; each client opens one `RTCPeerConnection` per peer via the
  `offer`/`answer`/`ice-candidate` relay. Hard cap of **8** participants.
- **SFU** — one mediasoup `Router` per room; clients produce their tracks once and
  consume each peer's producers. Media flows over the 40000–40059 port range, so
  in production **`MEDIASOUP_ANNOUNCED_IP` must be the server's reachable IP**.

> For a deeper map of the backend (routes, services, socket events, schema
> migrations) see [CLAUDE.md](CLAUDE.md).

## 🚀 Quick Start

**Requirements:** Docker + Docker Compose.

```bash
git clone https://github.com/axl214v/Meetify.git
cd Meetify

cp .env.example .env        # then edit secrets (see below)
make first-run              # build images + start all containers
```

App is served at **http://localhost**. macOS users with XAMPP on port 80, see
[QuickStart-Macos.md](QuickStart-Macos.md). Full Docker reference:
[Docker.md](Docker.md).

### Minimum `.env` to change

```env
DB_PASSWORD=change_me
JWT_SECRET=change_me                 # see generator below
SERVER_URL=http://localhost:3000
CLIENT_URL=http://localhost

# Required for SFU group calls beyond localhost:
MEDIASOUP_ANNOUNCED_IP=127.0.0.1     # set to your LAN/public IP in production
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Check status
```bash
make health                 # backend /check-status + frontend HTTP status
docker compose ps
docker compose logs -f backend
```

## 📚 API Reference

All routes are under `/api` (proxied by Nginx). Auth is via the `token` cookie or
`Authorization: Bearer`.

| Prefix | Highlights |
|--------|-----------|
| `/api/auth` | register, login, logout, `/me`, `/token`, forgot/reset-password, verify-email, resend-verification, refresh |
| `/api/users` | profile GET/PUT, avatar upload/delete, stats, delete account |
| `/api/conferences` | list (filters: `search`, `status`, `isPublic`, `limit`, `offset`), create (with `mode`), get, update, delete, join, leave, participants, `user/my` |
| `/api/admin` | stats, server info, user mgmt, conference mgmt (delete/kick), SMTP, socials, notifications, support tickets |
| `/api/notifications` | latest broadcast notifications |
| `/api/support` | user tickets: list, create, get + replies, reply |
| `/api/logs` | client error capture, query, stats |
| `/api/public/socials` | **public** — visible donate/crypto/social links (no auth) |
| `/check-status`, `/api/health` | health checks |

### WebSocket events (Socket.IO)

A valid JWT must be sent in `socket.handshake.auth.token`.

**Signaling / chat / moderation (Client → Server):**
`join-conference`, `offer`, `answer`, `ice-candidate`, `chat-message`,
`media-state-change`, `screen-share-start`, `screen-share-stop`,
`leave-conference`, `host:kick`, `host:force-media`, `host:chat-ban`,
`host:promote-co-host`, `host:demote-co-host`.

**SFU control (Client → Server, ack-based):**
`sfu:get-rtp-capabilities`, `sfu:create-transport`, `sfu:connect-transport`,
`sfu:produce`, `sfu:get-producers`, `sfu:consume`, `sfu:resume-consumer`,
`sfu:close-producer`.

**Server → Client:** `room-participants`, `user-connected`, `user-disconnected`,
`offer`/`answer`/`ice-candidate`, `chat-message`, `user-media-state`,
`user-screen-share-start`/`stop`, `join-rejected` (`kicked`|`full`),
`force-muted`, `chat-blocked`, `user-chat-banned`, `user-kicked`,
`force-disconnect`, `user-role-change`, `error`, and SFU:
`sfu:new-producer`, `sfu:producer-closed`, `sfu:consumer-closed`.

## 🗄️ Database

Eight InnoDB tables, created and migrated in place on startup by
`utils/initDatabase.js` (no migration framework — missing columns/FKs are added
via `information_schema` checks):

| Table | Purpose |
|-------|---------|
| `users` | accounts, role, email verification, trust level |
| `conferences` | meetings; `mode` (`p2p`/`sfu`), bcrypt password, schedule |
| `conference_members` | join/leave tracking (unique per conf+user) |
| `password_reset_tokens` | one-time reset tokens |
| `app_settings` | key/value — SMTP, `social_links` JSON, admin settings |
| `notifications` | admin broadcast notifications |
| `support_tickets` | support tickets |
| `ticket_replies` | threaded ticket replies |

Full DDL lives in `utils/initDatabase.js`; a schema summary is in
[CLAUDE.md](CLAUDE.md#database-schema).

## 🐳 Docker

```bash
make up / make down / make restart       # lifecycle
make logs / make logs-backend            # logs
make shell-be / make shell-db            # shells
make health                              # health check

# Rebuild after a code change:
docker compose build --no-cache backend && docker compose up -d backend
docker compose build frontend && docker compose up -d frontend   # frontend is static-copied at build time

# Nuclear reset (DELETES DB data):
docker compose down -v
```

See [Docker.md](Docker.md) for the full guide (production, TURN, backups,
troubleshooting).

## 🔒 Security

JWT in `httpOnly; Secure; SameSite` cookies · Socket.IO JWT enforced · user and
conference passwords bcrypt-hashed · HTTP rate limiting with Cloudflare-aware IP
resolution · admin static files behind Nginx `auth_request`.

Known gaps and how to report a vulnerability: [SECURITY.md](SECURITY.md).

## 🗺️ Roadmap

- [ ] TURN server (coturn config included, commented out in `docker-compose.yml`)
- [ ] HTTPS / SSL termination in Nginx
- [ ] Conference recording
- [ ] Redis adapter for Socket.IO clustering / multi-instance SFU
- [ ] Breakout rooms
- [ ] Virtual backgrounds
- [ ] Persistent moderation log
- [ ] Mobile application

Recently shipped (see [CHANGELOG.md](CHANGELOG.md)): SFU group calls, host/co-host
moderation, email verification & password reset, in-app notifications, support
tickets, donate page.

## 📦 Versioning

Meetify follows [Semantic Versioning](https://semver.org) (loosely, while in
`beta`). Every notable change is recorded in [CHANGELOG.md](CHANGELOG.md), and the
current version string lives in [`version.txt`](version.txt) — bump both together
when cutting a release.

## 🤝 Contributing

See [contributing.md](contributing.md).

## 👨‍💻 Author

**axl214** — [@axl214v](https://github.com/axl214v)

## 📄 License

Licensed under the **Polyform Noncommercial License 1.0.0** — see [LICENSE.md](LICENSE.md).
- **Personal / educational use:** free.
- **Commercial use:** requires a separate license — contact [legal@meetify.cc](mailto:legal@meetify.cc).

"Meetify" and its logo are trademarks — see [TRADEMARK.md](TRADEMARK.md).
