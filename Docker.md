# 🐳 Meetify Docker Setup

Complete guide for running Meetify with Docker. For a quick macOS path see
[QuickStart-Macos.md](QuickStart-Macos.md); for an architecture/code map see
[CLAUDE.md](CLAUDE.md).

## 📋 Prerequisites

- **Docker** >= 20.10
- **Docker Compose** v2 (the `docker compose` subcommand)
- **Make** (optional, for the convenience targets)

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

docker --version
docker compose version
```

## 🚀 Quick Start

```bash
git clone https://github.com/axl214v/Meetify.git
cd Meetify

cp .env.example .env
nano .env                 # change DB_PASSWORD, JWT_SECRET, MEDIASOUP_ANNOUNCED_IP

make first-run            # build images + start all containers
```

Access:
- **Frontend:** http://localhost
- **Backend API:** http://localhost:3000
- **Health check:** http://localhost:3000/check-status

> The database schema is created and migrated automatically on backend startup by
> `src/server_js/utils/initDatabase.js` — there is no separate import step.

## 🧩 Containers

| Container | Image | Ports |
|-----------|-------|-------|
| `meetify-db` | MySQL 8.0 | 3306 |
| `meetify-backend` | Node.js 22 (`src/server_js`) | 3000; **UDP+TCP 40000–40059** (mediasoup RTC media) |
| `meetify-frontend` | Nginx (`src/app`) | 80, 443 |

```
        ┌─────────────┐
        │   Browser   │
        └──────┬──────┘
               │  http / ws
               ↓
     ┌───────────────────┐
     │  Nginx :80 / :443 │  static files + reverse proxy
     │   (frontend)      │
     └─────────┬─────────┘
        /api/  │ /socket.io/  /check-status  /uploads/
               ↓
     ┌───────────────────────────────┐
     │  Backend :3000  (Express +    │
     │  Socket.IO + mediasoup SFU)   │──► RTC media :40000–40059 (UDP/TCP)
     └─────────┬─────────────────────┘
               ↓
        ┌──────────────┐
        │ MySQL :3306  │  persistent volume db_data
        └──────────────┘
```

## 🛠️ Commands

### Make

```bash
make help          # list targets
make build         # build images
make up / down     # start / stop containers (up reads version.txt → APP_VERSION)
make restart
make logs          # all logs
make logs-backend / logs-frontend / logs-db
make ps
make shell-be      # backend shell
make shell-db      # mysql shell
make health        # backend /check-status + frontend status
make clean         # down -v + prune  (DELETES DB data)
```

### Docker Compose

```bash
docker compose build
docker compose up -d
docker compose down
docker compose logs -f
docker compose restart backend
docker compose exec backend sh
docker compose exec db mysql -u root -p
```

### Rebuilding after code changes

```bash
# Backend change:
docker compose build --no-cache backend && docker compose up -d backend

# Frontend change (static files are copied into the Nginx image at build time):
docker compose build frontend && docker compose up -d frontend
```

## 🔧 Configuration (`.env`)

```env
# Application
NODE_ENV=production
PORT=3000

# Database
DB_USER=meetify_user
DB_PASSWORD=change_me_in_production
DB_NAME=meetify

# JWT
JWT_SECRET=long_random_secret_min_32_chars

# URLs
SERVER_URL=http://localhost:3000
CLIENT_URL=http://localhost

# mediasoup SFU (group calls) — see note below
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40059

# Conference limits
MAX_CONFERENCE_PARTICIPANTS=50
```

### mediasoup announced IP (important for group calls)

P2P calls work with any default. **Group (SFU) calls** carry media over the
40000–40059 port range and the server advertises an IP for clients to reach. For
anything beyond a single machine, set `MEDIASOUP_ANNOUNCED_IP` to the server's
**LAN or public IP**; `127.0.0.1` only works for local testing. The same port
range must be open in your firewall (UDP and TCP).

### STUN / TURN

```env
USE_OWN_STUN_SERVER=true
STUN_SERVER_URL=stun:your-domain.com:3478
TURN_SERVER_URL=turn:your-domain.com:3478
TURN_USERNAME=meetify_user
TURN_PASSWORD=secure_password
```

A TURN server is needed for clients behind restrictive NATs. The coturn service is
included but **commented out** in `docker-compose.yml`.

## 🐛 Troubleshooting

**Port already in use**
```bash
sudo lsof -i :80
sudo lsof -i :3000
sudo kill -9 <PID>
```

**Database connection failed**
```bash
docker compose logs db
docker compose restart db
```

**Container won't start / rebuild**
```bash
docker compose logs backend
docker compose build --no-cache backend && docker compose up -d backend
```

**mediasoup worker died / no media in group calls**
```bash
docker compose logs backend | grep -i mediasoup
# Verify MEDIASOUP_ANNOUNCED_IP is reachable and 40000–40059 is open.
```

**Reset everything (DELETES DB data)**
```bash
make clean          # or:
docker compose down -v && docker system prune -af
```

## 🔒 Production Deployment

1. **HTTPS** — uncomment and configure the SSL `server` block in
   `src/app/nginx.conf` (mount certs into the frontend container). WebRTC media
   capture requires a secure context in browsers outside `localhost`.
2. **Strong secrets** — set `NODE_ENV=production`, a random `DB_PASSWORD`, and a
   64-byte `JWT_SECRET`.
3. **mediasoup** — set `MEDIASOUP_ANNOUNCED_IP` to the public IP.
4. **TURN** — uncomment the `coturn` service in `docker-compose.yml` and point the
   `TURN_*` variables at it.
5. **Firewall**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 40000:40059/udp     # mediasoup RTC
   sudo ufw allow 40000:40059/tcp     # mediasoup RTC (TCP fallback)
   # If running TURN:
   sudo ufw allow 3478/tcp
   sudo ufw allow 3478/udp
   sudo ufw enable
   ```
   There is also a `docker-compose.prod.yml` and `deploy.sh` for production runs.

## 📈 Monitoring & Health

```bash
docker stats                                   # resource usage
docker system df                               # disk usage

curl http://localhost:3000/check-status        # backend (includes socket count)
curl -o /dev/null -w "%{http_code}\n" http://localhost/   # frontend
docker compose exec db mysqladmin ping -h localhost -u root -p
```

## 🔄 Updates & Backups

```bash
# Update
git pull origin main
make down && make build && make up

# Backup / restore the database
docker compose exec db mysqldump -u meetify_user -p meetify > backup.sql
docker compose exec -T db mysql -u meetify_user -p meetify < backup.sql
```

## 📞 Support

1. Check logs: `make logs`
2. Verify config: `cat .env`
3. Container status: `make ps`
4. Open an issue: [GitHub Issues](https://github.com/axl214v/Meetify/issues)

## 📄 License

Licensed under the **Polyform Noncommercial License 1.0.0** — see [LICENSE.md](LICENSE.md).

---

**Made with ❤️ by axl214**
