# ==========================================
# Meetify Docker Commands
# ==========================================

.PHONY: help build up down restart logs clean first-run

up:
	APP_VERSION=$$(cat version.txt) docker compose up -d

down:
	docker compose down

# Default target
help:
	@echo "Meetify Docker Commands:"
	@echo ""
	@echo "  make first-run - First time setup (recommended)"
	@echo "  make build     - Build Docker images"
	@echo "  make up        - Start all containers"
	@echo "  make down      - Stop all containers"
	@echo "  make restart   - Restart all containers"
	@echo "  make logs      - View logs"
	@echo "  make clean     - Remove containers and volumes"
	@echo "  make ps        - Show running containers"
	@echo "  make shell-be  - Enter backend shell"
	@echo "  make shell-db  - Enter database shell"
	@echo ""

# First run setup
first-run:
	@chmod +x first-run.sh
	@./first-run.sh

# Build Docker images
build:
	@echo "Building Docker images..."
	docker-compose build

# Start containers
up:
	@echo "Starting Meetify..."
	docker-compose up -d
	@echo "Meetify is running!"
	@echo "Frontend: http://localhost"
	@echo "Backend:  http://localhost:3000"

# Start with logs
up-logs:
	@echo "Starting Meetify with logs..."
	docker-compose up

# Stop containers
down:
	@echo "Stopping Meetify..."
	docker-compose down

# Restart containers
restart:
	@echo "Restarting Meetify..."
	docker-compose restart

# View logs
logs:
	docker-compose logs -f

# View specific service logs
logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-db:
	docker-compose logs -f db

# Show running containers
ps:
	docker-compose ps

# Clean everything (containers, volumes, networks)
clean:
	@echo "Cleaning up Docker resources..."
	docker-compose down -v
	docker system prune -f
	@echo "Cleanup complete!"

# Enter backend shell
shell-be:
	docker-compose exec backend sh

# Enter database shell
shell-db:
	docker-compose exec db mysql -u meetify_user -p meetify

# Check health
health:
	@echo "Backend health:"
	@curl -s http://localhost:3000/check-status | jq
	@echo ""
	@echo "Frontend health:"
	@curl -s http://localhost/ -o /dev/null -w "%{http_code}\n"

# Install dependencies
install:
	@echo "Installing backend dependencies..."
	cd src/server_js && npm install

# Run database migrations (if needed)
migrate:
	docker-compose exec db mysql -u meetify_user -p meetify < database/init.sql