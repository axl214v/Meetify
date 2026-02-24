# 🍎 Meetify Quick Start for macOS

## Prerequisites

1. **Install Docker Desktop for Mac**
   ```bash
   # Download from: https://www.docker.com/products/docker-desktop
   # Or install via Homebrew:
   brew install --cask docker
   ```

2. **Start Docker Desktop**
   - Open Docker Desktop app
   - Wait for Docker to start (whale icon in menu bar)

## 🚀 Quick Start (3 Commands)

```bash
# 1. Setup environment
cp .env.example .env
nano .env  # Change passwords

# 2. First run (automatic setup)
make first-run

# 3. Done! Open browser
open http://localhost
```

## ⚡ Alternative Method

```bash
# Build
docker-compose build --no-cache

# Start
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🔧 Troubleshooting

### "Path not shared" Error (Fixed! ✅)

We've already fixed this by removing volume mounts. The images now contain all files.

### Port Already in Use

```bash
# Check what's using port 80
sudo lsof -i :80

# If it's XAMPP Apache:
sudo /Applications/XAMPP/xamppfiles/bin/apachectl stop

# Or change port in docker-compose.yml:
ports:
  - "8080:80"  # Use port 8080 instead
```

### Database Connection Failed

```bash
# Wait a bit longer (first start takes ~30 seconds)
docker-compose logs db

# Restart database
docker-compose restart db
```

### Can't Access localhost

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs backend
docker-compose logs frontend

# Restart all
docker-compose restart
```

## 📊 Service URLs

- **Frontend**: http://localhost
- **Backend**: http://localhost:3000
- **Database**: localhost:3306

## 🛠️ Useful Commands

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend

# Stop all
docker-compose down

# Restart
docker-compose restart

# Enter container shell
docker-compose exec backend sh

# Clean everything
docker-compose down -v
docker system prune -af
```

## 🔍 Check Everything is Working

```bash
# Backend health
curl http://localhost:3000/check-status

# Frontend
curl http://localhost/

# Database
docker-compose exec db mysql -u meetify_user -p meetify -e "SHOW TABLES;"
```

## 📝 Notes for macOS Users

1. **Docker Desktop must be running** - Check the whale icon in menu bar
2. **First start is slow** - Images need to download and build (~5-10 min)
3. **Database takes time** - Wait 20-30 seconds for MySQL to initialize
4. **XAMPP conflicts** - Stop XAMPP Apache/MySQL before starting Docker

## 🆘 Still Having Issues?

```bash
# Complete reset
docker-compose down -v
docker system prune -af
rm -rf node_modules

# Start fresh
make first-run
```

## 🎉 Success!

If you see:
```
✅ Database is ready
✅ Backend is ready  
✅ Frontend is ready
```

You're all set! Open http://localhost and start using Meetify!

---

**Need help?** Check [DOCKER.md](DOCKER.md) for detailed documentation.