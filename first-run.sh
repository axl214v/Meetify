#!/bin/bash

# ==========================================
# Meetify First Run Setup Script
# ==========================================

set -e

echo "============================================"
echo "  🚀 Meetify First Run Setup"
echo "============================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ .env created from .env.example"
        echo "⚠️  Please edit .env and change passwords before continuing!"
        echo ""
        read -p "Press Enter when you're ready to continue..."
    else
        echo "❌ .env.example not found"
        exit 1
    fi
else
    echo "✅ .env file exists"
fi

echo ""

# Stop any running containers
echo "🛑 Stopping any running containers..."
docker-compose down 2>/dev/null || true

# Build images
echo ""
echo "🔨 Building Docker images (this may take a few minutes)..."
docker-compose build --no-cache

# Start services
echo ""
echo "🚀 Starting Meetify services..."
docker-compose up -d

# Wait for services to start
echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check health
echo ""
echo "🏥 Checking service health..."

# Check database
if docker-compose exec -T db mysqladmin ping -h localhost -u root -p${DB_PASSWORD:-root_password} --silent 2>/dev/null; then
    echo "✅ Database is ready"
else
    echo "⚠️  Database is starting (this is normal on first run)"
fi

# Check backend
BACKEND_HEALTH=$(curl -s http://localhost:3000/check-status 2>/dev/null || echo "")
if [[ $BACKEND_HEALTH == *"online"* ]]; then
    echo "✅ Backend is ready"
else
    echo "⚠️  Backend is starting..."
fi

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend is ready"
else
    echo "⚠️  Frontend is starting..."
fi

echo ""
echo "============================================"
echo "  ✨ Meetify Setup Complete!"
echo "============================================"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost"
echo "   Backend:  http://localhost:3000"
echo ""
echo "📊 Useful commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart"
echo ""
echo "📖 For more info, see DOCKER.md"
echo ""