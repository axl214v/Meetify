# 🐳 Meetify Docker Setup

Complete guide for running Meetify with Docker.

## 📋 Prerequisites

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Make** (optional, for convenience)

Install Docker:
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify installation
docker --version
docker-compose --version
```

## 🚀 Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/axl214v/meetify.git
cd meetify

# Copy environment file
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Build and Start

```bash
# Using Make (recommended)
make build
make up

# Or using docker-compose directly
docker-compose build
docker-compose up -d
```

### 3. Access Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/check-status

## 📁 Project Structure

```
meetify/
├── docker-compose.yml          # Docker orchestration
├── .env                        # Environment variables
├── Makefile                    # Convenience commands
├── database/
│   └── init.sql               # Database initialization
├── src/
│   ├── server_js/
│   │   ├── Dockerfile         # Backend container
│   │   └── ...
│   └── app/
│       ├── Dockerfile         # Frontend container
│       ├── nginx.conf         # Nginx configuration
│       └── ...
└── README.md
```

## 🛠️ Available Commands

### Using Make

```bash
make help        # Show all commands
make build       # Build Docker images
make up          # Start containers
make down        # Stop containers
make restart     # Restart containers
make logs        # View all logs
make logs-backend   # Backend logs only
make logs-frontend  # Frontend logs only
make logs-db     # Database logs only
make ps          # Show running containers
make clean       # Remove everything
make shell-be    # Enter backend shell
make shell-db    # Enter database shell
make health      # Check services health
```

### Using Docker Compose

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart backend

# Execute command in container
docker-compose exec backend sh
docker-compose exec db mysql -u root -p
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# Application
NODE_ENV=production
PORT=3000

# Database
DB_USER=meetify_user
DB_PASSWORD=change_me_in_production
DB_NAME=meetify

# JWT
JWT_SECRET=your_super_secret_key_32_chars_min

# URLs
SERVER_URL=http://localhost:3000
CLIENT_URL=http://localhost
```

### STUN/TURN Server

For production, configure your own TURN server:

```env
USE_OWN_STUN_SERVER=true
STUN_SERVER_URL=stun:your-domain.com:3478
TURN_SERVER_URL=turn:your-domain.com:3478
TURN_USERNAME=meetify_user
TURN_PASSWORD=secure_password
```

## 📊 Service Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       ↓
┌─────────────────┐
│  Nginx (Port 80)│
│   Frontend      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌──────────────┐
│ Backend │ │ Socket.IO    │
│ (3000)  │ │ WebRTC       │
└────┬────┘ └──────────────┘
     │
     ↓
┌──────────┐
│  MySQL   │
│  (3306)  │
└──────────┘
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :80

# Kill the process
sudo kill -9 <PID>
```

### Database Connection Failed

```bash
# Check database health
docker-compose logs db

# Restart database
docker-compose restart db

# Access database shell
docker-compose exec db mysql -u root -p
```

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Rebuild container
docker-compose build --no-cache backend
docker-compose up -d
```

### Reset Everything

```bash
# Remove all containers, volumes, and networks
make clean

# Or manually
docker-compose down -v
docker system prune -af
docker volume prune -f
```

## 🔒 Production Deployment

### 1. Enable HTTPS

Edit `src/app/nginx.conf`:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    # ... rest of config
}
```

### 2. Use Environment Variables

```bash
# Production .env
NODE_ENV=production
DB_PASSWORD=strong_random_password
JWT_SECRET=long_random_secret_key
```

### 3. Setup CoTURN

Uncomment CoTURN service in `docker-compose.yml`:
```yaml
coturn:
  image: coturn/coturn:latest
  network_mode: host
  volumes:
    - ./coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro
```

### 4. Configure Firewall

```bash
# Allow necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw enable
```

## 📈 Monitoring

### View Resource Usage

```bash
# All containers
docker stats

# Specific container
docker stats meetify-backend

# Disk usage
docker system df
```

### Health Checks

```bash
# Backend health
curl http://localhost:3000/check-status

# Frontend health
curl http://localhost/

# Database health
docker-compose exec db mysqladmin ping -h localhost -u root -p
```

## 🔄 Updates and Maintenance

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
make down
make build
make up
```

### Backup Database

```bash
# Create backup
docker-compose exec db mysqldump -u meetify_user -p meetify > backup.sql

# Restore backup
docker-compose exec -T db mysql -u meetify_user -p meetify < backup.sql
```

### View Logs

```bash
# All logs
make logs

# Last 100 lines
docker-compose logs --tail=100

# Follow specific service
docker-compose logs -f backend
```

## 🧹 Cleanup

### Remove Unused Resources

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything
make clean
```

## 📞 Support

If you encounter issues:

1. Check logs: `make logs`
2. Verify configuration: `cat .env`
3. Check container status: `make ps`
4. Open an issue: [GitHub Issues](https://github.com/axl214v/meetify/issues)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by axl214**