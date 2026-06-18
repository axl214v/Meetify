<div align="center">
  <img src="src/app/assets/logo.png" alt="Meetify" height="56" />

  <p><strong>Privacy-focused open-source WebRTC video conferencing</strong><br/>
  Self-hostable · No third-party services · P2P and SFU modes</p>

  <p>
    <a href="https://meetify.cc">meetify.cc</a> &nbsp;·&nbsp;
    <a href="Docker.md">Self-hosting guide</a> &nbsp;·&nbsp;
    <a href="CHANGELOG.md">Changelog</a> &nbsp;·&nbsp;
    <a href="https://github.com/axl214v/Meetify/discussions">Discussions</a>
  </p>

  [![Version](https://img.shields.io/badge/version-1.2.0--beta-blue)](version.txt)
  [![License](https://img.shields.io/badge/license-Polyform%20Noncommercial-orange)](LICENSE.md)
  [![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
  [![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://www.docker.com/)
</div>

---

## What is Meetify?

Meetify is a self-hostable video conferencing platform built on WebRTC, Node.js, and Socket.IO. It ships as a three-container Docker stack (Nginx + Node.js + MySQL) and requires no third-party services to run.

The project started as a personal tool and is now open-sourced for the community.

## Features

**Conferencing**
- Two call modes — **P2P** (full-mesh, up to 8) and **SFU** (mediasoup, scales further)
- Screen sharing, dynamic video grid, pin/spotlight mode
- Per-participant media controls, real-time mute/unmute state

**Moderation**
- Host and co-host roles — kick, force-mute, chat-ban
- Promote/demote co-hosts mid-call, all applied live over Socket.IO

**Communication**
- Real-time chat with unread badge, participant list
- Admin broadcast notifications with bell widget
- Support ticket system with threaded replies

**Management**
- Schedule conferences with start/end times (Scheduled / Ongoing / Ended)
- Optional conference passwords (bcrypt-hashed), public/private rooms
- Admin dashboard — stats, user management, SMTP, notifications, support

## Conference Modes

| | P2P | SFU |
|---|---|---|
| Transport | Direct browser-to-browser | Routed through mediasoup |
| Max participants | 8 | Configurable |
| Infrastructure | Only STUN/TURN | STUN/TURN + mediasoup ports |
| Best for | Small calls, minimal setup | Group meetings |

Both modes are available from the same conference create form — the host picks at creation time.

## Privacy

Meetify is designed to keep data on your server:

- **No Google Fonts** — Outfit and JetBrains Mono are self-hosted as WOFF2
- **No external CDN or analytics** — zero third-party requests on page load
- **Own STUN/TURN** — coturn ships with the stack; WebRTC traffic stays on your infrastructure
- **No tracking cookies** — a single `httpOnly` session cookie, nothing else
- **Error telemetry** — JS errors are reported to *your* server only, never to a third party. Fully documented in [PRIVACY.md](PRIVACY.md)
- **Swiss hosting** on the live instance at meetify.cc (nFADP / GDPR equivalent)

## Security

- JWT in `httpOnly; Secure; SameSite` cookies + `Authorization: Bearer` support
- Socket.IO connections require a valid JWT (unauthenticated connections are rejected)
- User and conference passwords hashed with bcrypt (cost 10)
- HTTP rate limiting with Cloudflare-aware IP resolution (`CF-Connecting-IP`)
- Admin panel protected by Nginx `auth_request`
- All log endpoints require admin authentication

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Self-Hosting

**Requirements:** Docker + Docker Compose.

```bash
git clone https://github.com/axl214v/Meetify.git
cd Meetify

cp .env.example .env   # edit secrets (see below)
make first-run         # builds images and starts all containers
```

Open **http://localhost**. macOS users with XAMPP on port 80 — see [QuickStart-Macos.md](QuickStart-Macos.md).

### Minimum `.env` changes

```env
DB_PASSWORD=your_strong_password
JWT_SECRET=your_64_byte_hex_secret   # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SERVER_URL=https://your-domain.com
CLIENT_URL=https://your-domain.com

# For SFU group calls — set to your server's public IP:
MEDIASOUP_ANNOUNCED_IP=127.0.0.1

# STUN/TURN — already configured to use bundled coturn:
COTURN_PUBLIC_IP=your-server-ip
TURN_PASSWORD=your_turn_secret
```

Full guide including HTTPS, TURN, backups, and troubleshooting: [Docker.md](Docker.md).

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 22, Express, Socket.IO |
| SFU | mediasoup 3 |
| Database | MySQL 8.0, mysql2 pool |
| Auth | JWT, bcrypt, nodemailer |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Infrastructure | Docker Compose, Nginx, coturn |

## Architecture

```
Browser → Nginx :80/:443 → /api/* /socket.io/ /uploads/  → backend:3000
                         → static files (HTML/CSS/JS/fonts)

backend:3000 → MySQL :3306
             → mediasoup RTC :40000–40059 (UDP/TCP)

coturn :3478  → STUN/TURN relay (runs on separate VPS)
```

Routes, socket events, and schema details: [Docker.md](Docker.md) and `src/server_js/utils/initDatabase.js`.

## Roadmap

- [x] SFU group calls (mediasoup)
- [x] Host/co-host moderation
- [x] Email verification and password reset
- [x] In-app notifications and support tickets
- [x] Self-hosted STUN/TURN (coturn)
- [x] Self-hosted fonts (no Google Fonts)
- [ ] HTTPS / SSL in Nginx (certs provisioned by deploy script, SSL block present but commented out)
- [ ] Conference recording
- [ ] Redis adapter for Socket.IO clustering
- [ ] Breakout rooms
- [ ] Mobile application

## Contributing

Pull requests are welcome. Before opening one:

1. Open an issue or discussion to describe what you want to change
2. Fork the repo and create a branch from `main`
3. PRs into `main` require one approval

By contributing you agree to the terms in [CONTRIBUTING.md](CONTRIBUTING.md) — your contributions are licensed under the project's license and the maintainer retains commercial rights.

## License

Licensed under the **Polyform Noncommercial License 1.0.0** — see [LICENSE.md](LICENSE.md).

- **Personal / educational / self-hosted use:** free
- **Commercial use:** requires a separate license — [legal@meetify.cc](mailto:legal@meetify.cc)

"Meetify" and its logo are trademarks — see [TRADEMARK.md](TRADEMARK.md).

---

<div align="center">
  <sub>Built by <a href="https://github.com/axl214v">axl214v</a> · <a href="https://meetify.cc">meetify.cc</a></sub>
</div>
