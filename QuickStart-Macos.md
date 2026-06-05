# 🍎 Meetify Quick Start for macOS

The fastest path to a running Meetify on a Mac. For the full Docker reference see
[Docker.md](Docker.md).

## Prerequisites

1. **Install Docker Desktop for Mac**
   ```bash
   # Download from https://www.docker.com/products/docker-desktop
   # or via Homebrew:
   brew install --cask docker
   ```
2. **Start Docker Desktop** and wait for the whale icon in the menu bar to settle.

## 🚀 Quick Start (3 commands)

```bash
# 1. Setup environment
cp .env.example .env
nano .env                 # change DB_PASSWORD and JWT_SECRET

# 2. First run (build images + start everything)
make first-run

# 3. Open the app
open http://localhost
```

## ⚡ Alternative (manual)

```bash
docker compose build --no-cache
docker compose up -d
docker compose ps
docker compose logs -f
```

## 🔧 Troubleshooting

### Port 80 already in use (XAMPP)

macOS XAMPP runs Apache on port 80. Either stop it:
```bash
sudo lsof -i :80
sudo /Applications/XAMPP/xamppfiles/bin/apachectl stop
```
…or remap Meetify's frontend in `docker-compose.yml`:
```yaml
ports:
  - "8080:80"     # then open http://localhost:8080
```

### "Path not shared" error

Already handled — the images bake in all files instead of bind-mounting, so
Docker Desktop file sharing isn't required.

### Database connection failed
```bash
docker compose logs db        # first start takes ~20–30s for MySQL to init
docker compose restart db
```

### Can't access localhost
```bash
docker compose ps
docker compose logs backend
docker compose logs frontend
docker compose restart
```

### Group (SFU) calls

Private (P2P) calls work out of the box. **Group calls use mediasoup** and carry
media over the published `40000–40059` UDP/TCP ports. On a single Mac the default
`MEDIASOUP_ANNOUNCED_IP=127.0.0.1` is fine. To test group calls from **another
device on your LAN**, set it to your Mac's LAN IP in `.env`:
```bash
ipconfig getifaddr en0        # your LAN IP, e.g. 192.168.1.20
# .env:  MEDIASOUP_ANNOUNCED_IP=192.168.1.20
docker compose up -d backend
```

## 📊 Service URLs

- **Frontend:** http://localhost
- **Backend:** http://localhost:3000
- **Database:** localhost:3306

## 🛠️ Useful Commands

```bash
docker compose logs -f                 # all logs
docker compose logs -f backend         # one service
docker compose down                    # stop
docker compose restart
docker compose exec backend sh         # shell into a container

# Full reset (DELETES DB data):
docker compose down -v
docker system prune -af
```

## 🔍 Verify everything works

```bash
curl http://localhost:3000/check-status                 # backend
curl -o /dev/null -w "%{http_code}\n" http://localhost/ # frontend
docker compose exec db mysql -u meetify_user -p meetify -e "SHOW TABLES;"
```

## 📝 Notes for macOS users

1. **Docker Desktop must be running** — check the whale icon.
2. **First start is slow** — images build and mediasoup compiles (~5–10 min).
3. **MySQL needs ~20–30s** on first boot before it accepts connections.
4. **Stop XAMPP Apache/MySQL** before starting Docker to avoid port conflicts.

## 🆘 Still stuck?

```bash
# Complete reset and start fresh
docker compose down -v
docker system prune -af
make first-run
```

## 🎉 Success

When the backend log shows the database initialized and `/check-status` returns
`"status":"online"`, open **http://localhost** and start using Meetify.

---

**Need more detail?** See [Docker.md](Docker.md). Changes are tracked in
[CHANGELOG.md](CHANGELOG.md).
