<div align="center">
  <img src="src/app/assets/logo.png" alt="Meetify" height="56" />

  <p><strong>Privacy-focused WebRTC video conferencing</strong><br/>
  Open-source client · No third-party services · P2P and SFU modes</p>

  <p>
    <a href="https://meetify.cc">meetify.cc</a> &nbsp;·&nbsp;
    <a href="https://health.meetify.cc">Status</a> &nbsp;·&nbsp;
    <a href="CHANGELOG.md">Changelog</a> &nbsp;·&nbsp;
    <a href="https://github.com/axl214v/Meetify/discussions">Discussions</a>
  </p>

  [![Version](https://img.shields.io/badge/version-1.4.0--beta-blue)](version.txt)
  [![License](https://img.shields.io/badge/license-Polyform%20Noncommercial-orange)](LICENSE.md)
  [![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
  [![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://www.docker.com/)
</div>

---

## What is Meetify?

Meetify is a privacy-focused video conferencing platform built on WebRTC. Everything
that runs in your browser — this repository — is open source, so you can verify
exactly what the client does: no tracking, no third-party requests, no hidden
telemetry. The backend, SFU media server, and infrastructure that power the hosted
service at [meetify.cc](https://meetify.cc) are proprietary and are not distributed
as part of this repository.

The project started as a personal tool and the client was open-sourced for the
community to audit.

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

Meetify is designed to keep data off third-party services:

- **No Google Fonts** — Outfit and JetBrains Mono are self-hosted as WOFF2
- **No external CDN or analytics** — zero third-party requests on page load
- **Own STUN/TURN** — coturn relays WebRTC traffic without routing it through a third party
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

## Using Meetify

Meetify runs as a hosted service at **[meetify.cc](https://meetify.cc)** — own
STUN/TURN, Swiss hosting, no third-party requests. There is no public build of the
backend to self-host; the client in this repository is what your browser actually
runs when you use it. Live uptime status: **[health.meetify.cc](https://health.meetify.cc)**
([meetify-monitor](https://github.com/axl214v/meetify-monitor), an independent watchdog
running on separate infrastructure).

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
