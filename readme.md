# Meetify 🎥

**Meetify** — A web-based video conferencing platform built with WebRTC, Node.js, and Socket.IO. Deployed via Docker with Nginx as a reverse proxy.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-blue)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://www.docker.com/)

## ✨ Features

### 🎬 Video Conferencing
- **WebRTC peer-to-peer** — real-time video/audio between participants
- **Dynamic video grid** — adapts based on participant count
- **Screen sharing** — replace camera track mid-call without renegotiation
- **Media controls** — mute/unmute microphone, turn camera on/off

### 💬 Communication
- **Real-time chat** — via Socket.IO with unread message badge
- **Participant list** — shows all connected users with join time
- **Media state indicators** — mic/camera status per participant
- **User roles** — host and participant with different permissions

### 🔐 Security
- **JWT authentication** — stored in `httpOnly` cookies (not localStorage)
- **bcrypt hashing** — for user passwords (10 rounds)
- **Rate limiting** — on HTTP endpoints via express-rate-limit
- **CORS** — configured for allowed origins
- **Input validation** — on all API endpoints
- **XSS protection** — HTML escaping on client side

### ⚙️ Conference Management
- **Create/delete conferences** — with name, description, schedule, participant limit
- **Password-protected conferences** — optional per-conference password
- **Join/leave** — with participant tracking in DB
- **Scheduling** — optional start/end times with status detection (Scheduled/Ongoing/Ended/Active)

## 🛠️ Technology Stack

### Backend
- **Node.js + Express.js** — REST API server
- **Socket.IO** — WebRTC signaling and real-time chat
- **mysql2** — MySQL/MariaDB database driver with connection pooling
- **JWT + cookie-parser** — token-based auth via httpOnly cookies
- **bcrypt** — password hashing
- **express-rate-limit** — rate limiting (with `trust proxy` enabled for Nginx)

### Frontend
- **Vanilla HTML/CSS/JS** — no framework, served as static files
- **WebRTC API** — peer-to-peer video/audio
- **Socket.IO client** — signaling and chat
- **Nginx** — static file server and reverse proxy to backend

### Infrastructure
- **Docker Compose** — orchestrates db, backend, frontend containers
- **Nginx** — reverse proxy for `/api/`, `/socket.io/`, `/check-status`
- **MySQL 8.0** — persistent data via Docker volume

## ⚠️ Known Limitations

- **Participant cap ~6–8 users** — full-mesh WebRTC topology means every peer connects to every other peer (N×(N-1)/2 connections). Advertising 50 participants is not realistic without an SFU (e.g. mediasoup, LiveKit).
- **TURN server required** for connections across NAT (not included by default — coturn config is commented out in docker-compose.yml)
- **WebRTC requires HTTPS in production** — works on localhost without it
- **No conference recording**
- **Socket.IO JWT auth is TODO** — middleware exists but verification is commented out

## 📁 Project Structure

```
meetify/
├── src/
│   ├── server_js/                    # Backend (Node.js)
│   │   ├── config/
│   │   │   ├── config.js             # Env-based config
│   │   │   └── database.js           # mysql2 connection pool
│   │   ├── controllers/
│   │   │   ├── authController.js     # Register, login (sets httpOnly cookie), logout
│   │   │   ├── userController.js     # User profile
│   │   │   └── conferenceController.js
│   │   ├── middleware/
│   │   │   └── auth.js               # JWT middleware (checks header + cookie)
│   │   ├── models/
│   │   │   ├── User.js               # findByEmail, findById, create
│   │   │   └── Conference.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js         # /api/auth/*
│   │   │   ├── userRoutes.js         # /api/users/*
│   │   │   ├── conferenceRoutes.js   # /api/conferences/*
│   │   │   ├── healthRoutes.js
│   │   │   └── logRoutes.js          # /api/logs/* (error logger)
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   └── userService.js
│   │   ├── sockets/
│   │   │   └── conferenceSocket.js   # WebRTC signaling, chat, media state
│   │   ├── app.js                    # Express app + Socket.IO setup
│   │   └── index.js                  # Entry point, starts server on 0.0.0.0
│   │
│   └── app/                          # Frontend (static files served by Nginx)
│       ├── auth/
│       │   ├── Auth.html
│       │   ├── Reg.html
│       │   ├── auth.js               # Login → redirects to conf.html if already authed
│       │   ├── reg.js                # Registration
│       │   └── auth_reg.css
│       ├── Conf/
│       │   ├── pages/
│       │   │   ├── conf.html
│       │   │   ├── conf_create.html
│       │   │   ├── conf_join.html
│       │   │   └── conf_room.html
│       │   ├── js/
│       │   │   ├── conf.js
│       │   │   ├── conf_create.js
│       │   │   ├── conf_join.js
│       │   │   ├── conf_room.js      # WebRTC logic, socket, media controls
│       │   │   └── conf_utils.js     # Shared utilities
│       │   └── conf.css
│       ├── err/
│       │   ├── error-logger.js       # Client-side error reporting to /api/logs
│       │   └── 404.html
│       ├── index.html
│       └── styles.css
│
├── src/server_js/Dockerfile
├── src/app/Dockerfile
├── src/app/nginx.conf
├── docker-compose.yml
├── .env
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Requirements
- **Docker** + **Docker Compose**

### 1. Clone
```bash
git clone https://github.com/axl214v/meetify.git
cd meetify
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

DB_HOST=db
DB_USER=meetify_user
DB_PASSWORD=your_db_password
DB_NAME=meetify
DB_PORT=3306

JWT_SECRET=generate_with_node_-e_require_crypto_randomBytes_64_toString_hex
JWT_EXPIRES_IN=24h

SERVER_URL=http://localhost:3000
CLIENT_URL=http://localhost
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Run
```bash
docker compose up -d --build
```

App will be available at: **http://localhost**

### 4. Check status
```bash
docker compose ps
docker compose logs backend
curl http://localhost/check-status
```

## 📚 API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, sets `httpOnly` cookie |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user (requires auth) |
| POST | `/api/auth/change-password` | Change password (requires auth) |

**Register request:**
```json
{ "name": "John Doe", "email": "john@example.com", "password": "password123" }
```

**Login response:** sets `token` cookie + returns user object.

### Conferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conferences` | List conferences (paginated, searchable) |
| POST | `/api/conferences` | Create conference |
| GET | `/api/conferences/:id` | Get conference details |
| PUT | `/api/conferences/:id` | Update conference (host only) |
| DELETE | `/api/conferences/:id` | Delete conference (host only) |
| POST | `/api/conferences/:id/join` | Join conference |
| POST | `/api/conferences/:id/leave` | Leave conference |
| GET | `/api/conferences/:id/participants` | Get participants |
| GET | `/api/conferences/user/my` | Get user's conferences |

**Query params for GET `/api/conferences`:**
- `limit` (default: 20, max: 100)
- `offset` (default: 0)
- `search` — search by name
- `status` — `upcoming` / `ongoing` / `ended`
- `isPublic` — `true` / `false`

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/check-status` | Health check with socket connection count |
| POST | `/api/logs` | Client-side error reporting |

### WebSocket Events (Socket.IO)

**Client → Server:**
| Event | Payload | Description |
|-------|---------|-------------|
| `join-conference` | `{ conferenceId, userId, userName }` | Join room |
| `leave-conference` | `{ conferenceId }` | Leave room |
| `offer` | `{ to, offer }` | WebRTC offer |
| `answer` | `{ to, answer }` | WebRTC answer |
| `ice-candidate` | `{ to, candidate }` | ICE candidate |
| `chat-message` | `{ conferenceId, message, timestamp }` | Send message |
| `media-state-change` | `{ conferenceId, audio, video }` | Toggle mic/cam |
| `screen-share-start` | `{ conferenceId }` | Start screen share |
| `screen-share-stop` | `{ conferenceId }` | Stop screen share |

**Server → Client:**
| Event | Description |
|-------|-------------|
| `room-participants` | Existing participants on join |
| `user-connected` | New participant joined |
| `user-disconnected` | Participant left |
| `offer` / `answer` / `ice-candidate` | WebRTC signaling |
| `chat-message` | New chat message |
| `user-media-state` | Participant toggled mic/cam |
| `user-screen-share-start/stop` | Screen share state |
| `force-disconnect` | Kicked from conference |

## 🗄️ Database Schema

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,        -- bcrypt hashed
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    host_id INT NOT NULL,
    password VARCHAR(255),                 -- plain text (TODO: hash with bcrypt)
    max_participants INT DEFAULT 50,
    is_public BOOLEAN DEFAULT TRUE,
    description TEXT,
    start_time DATETIME,
    end_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_host (host_id),
    INDEX idx_created (created_at),
    INDEX idx_name (name),                 -- for search
    INDEX idx_times (start_time, end_time) -- for status filtering
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conference_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conference_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_member (conference_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 🐳 Docker

```yaml
services:
  db:       # MySQL 8.0, port 3306
  backend:  # Node.js, port 3000 (internal), 0.0.0.0 bind
  frontend: # Nginx, ports 80/443
```

**Useful commands:**
```bash
# Rebuild single service
docker compose build --no-cache backend
docker compose up -d backend

# Full rebuild
docker compose down
docker compose up -d --build

# Logs
docker compose logs -f backend
docker compose logs --tail=50 frontend

# Shell into container
docker exec -it meetify-backend sh
docker exec -it meetify-frontend sh

# ⚠️ Nuclear — deletes DB data
docker compose down -v
```

## 🔒 Security Notes

- JWT tokens stored in `httpOnly; Secure; SameSite=Strict` cookies
- Socket.IO JWT verification is **not yet implemented** (TODO)
- Conference passwords are stored **unhashed** (TODO: bcrypt)
- Rate limiting covers HTTP routes only — Socket.IO events are unprotected
- CSP headers configured in Nginx — `unsafe-inline` required for current frontend

## 🗺️ Roadmap

- [ ] Socket.IO JWT authentication middleware
- [ ] Hash conference passwords with bcrypt
- [ ] Switch from mesh to SFU (mediasoup/LiveKit) for >6 participants
- [ ] TURN server setup (coturn config included, commented out)
- [ ] HTTPS / SSL termination in Nginx
- [ ] Conference recording
- [ ] Virtual backgrounds
- [ ] Breakout rooms
- [ ] Kick/ban moderation
- [ ] Email notifications
- [ ] Redis for Socket.IO clustering
- [ ] Mobile application

## 🧪 Testing

1. Start the stack: `docker compose up -d --build`
2. Open two browsers (or incognito tabs)
3. Register two users
4. User 1: create a conference
5. User 2: join the conference
6. Test video/audio, chat, screen sharing, leave

**Feature status:**
- [x] Registration and login
- [x] JWT auth via httpOnly cookie
- [x] Create / delete conference
- [x] Join / leave conference
- [x] Conference list with search and pagination
- [x] Video/audio (WebRTC)
- [x] Mute mic / turn off camera
- [x] Screen sharing
- [x] Real-time chat
- [x] Participant list
- [x] Room timer
- [x] Error logging (client-side)
- [ ] Socket.IO authentication
- [ ] Conference password hashing
- [ ] SFU for large rooms

## 👨‍💻 Author

**axl214**
- GitHub: [@axl214v](https://github.com/axl214v)

## 📄 License
This project is licensed under the **Polyform Noncommercial License 1.0.0**. 
- **Personal/Educational use:** Free.
- **Commercial use:** Requires a separate license. Contact [axl214v@gmail.com].
