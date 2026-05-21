# Aether - Real-Time Collaborative Code Editor

Aether is a browser-based collaborative coding workspace built around the idea of a lightweight VS Code / Replit-style environment that can run locally with Docker.

The project supports authenticated workspaces, shared editing, nested files and folders, room chat, live presence, Monaco Editor, AI-assisted coding, and sandboxed code execution. It is designed as a production-style portfolio project: the architecture is modular, the services are containerized, and the core workflows work end-to-end.

It is not pretending to be a full enterprise IDE. The current goal is more practical: a strong, understandable collaborative IDE that can be run, demonstrated, extended, and deployed on a VPS.

## What It Does

Users can sign up, create a room, invite others with a room ID, edit files together in real time, chat inside the room, run code, import local folders, and use AI tools for code completion, summaries, fixes, explanations, reviews, optimization, and DSA practice help.

The main workspace behaves like a small online IDE:

- Monaco-powered editor with tabs
- Nested file explorer
- Create, rename, delete, move, and import files/folders
- Autosave and dirty-state tracking
- Realtime code sync over Socket.IO
- Live room presence
- Chat panel
- Terminal/output panel
- Sandboxed execution for multiple languages
- AI assistant docked beside the code
- Inline AI ghost suggestions accepted with `Tab`
- Whole-file AI summary
- DSA playground with AI hints, fixes, complexity analysis, edge cases, and inline suggestions

## Tech Stack

**Frontend**

- Next.js App Router
- JavaScript
- TailwindCSS
- Monaco Editor
- Axios
- Zustand

**Backend**

- FastAPI
- Python Socket.IO
- Prisma Client Python
- JWT authentication
- bcrypt password hashing

**Data / Realtime**

- PostgreSQL
- Redis
- Socket.IO rooms

**Execution**

- Separate FastAPI executor service
- Docker container isolation
- Python, JavaScript, TypeScript, C++, and Java execution support
- Timeout, output limits, memory/process limits, and basic dangerous-pattern checks

**DevOps**

- Docker
- Docker Compose
- Nginx production reverse proxy
- Makefile commands

## High-Level Architecture

```mermaid
flowchart LR
    Browser["Next.js Frontend<br/>Monaco Editor"] -->|"REST API"| Backend["FastAPI Backend"]
    Browser <-->|"Socket.IO"| Backend

    Backend -->|"Prisma Client Python"| Postgres[("PostgreSQL")]
    Backend -->|"Presence + socket state"| Redis[("Redis")]
    Backend -->|"Code execution request"| Executor["Executor Service"]

    Executor -->|"Runs code with limits"| Runtime["Python / Node / g++ / Java"]
```

The frontend is responsible for the IDE experience. The backend owns auth, rooms, file metadata, chat messages, AI proxying, and realtime socket events. Redis keeps presence and socket state lightweight. PostgreSQL stores users, rooms, files, file versions, and messages. The executor is split out so running user code is not mixed directly into the main API process.

## Request Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant API as FastAPI
    participant DB as PostgreSQL
    participant R as Redis
    participant E as Executor

    U->>API: Login / Signup
    API->>DB: Store or verify user
    API-->>U: JWT token

    U->>API: Join room
    API->>DB: Check membership
    U->>API: Socket.IO connect with JWT
    API->>R: Track active user
    API-->>U: Room users + realtime events

    U->>API: Save file
    API->>DB: Update content + version
    API-->>U: Save result

    U->>API: Run code
    API->>E: Execute in sandbox service
    E-->>API: stdout / stderr / exit code
    API-->>U: Execution output
```

## Database Model

```mermaid
erDiagram
    User ||--o{ Room : owns
    User ||--o{ RoomMember : joins
    Room ||--o{ RoomMember : contains
    Room ||--o{ File : stores
    File ||--o{ File : children
    File ||--o{ FileVersion : has
    Room ||--o{ Message : has
    User ||--o{ Message : sends
```

## Main Features

### Authentication

- Signup
- Login
- JWT sessions
- Password hashing
- Protected API routes
- Protected frontend pages

### Rooms

- Create rooms
- Join by room ID
- Delete owned rooms
- Room member validation
- Invite flow through copied room ID

### Workspace / IDE

- Monaco Editor
- Multiple open tabs
- Active file state
- Dirty file indicators
- Save and Save All
- Autosave
- Nested folder tree
- Create file/folder
- Rename file/folder
- Delete file/folder
- Move files/folders
- Folder import
- Drag/drop import
- Chromium File System Access API support for local folder sync

### Realtime Collaboration

- Socket.IO room events
- Realtime file updates
- Presence list
- Typing indicators
- Remote cursor events
- Reconnect flow
- Conflict-aware file save/version handling

### Chat

- Room chat
- Persisted messages
- Sender details
- Realtime message delivery

### Code Execution

- Run active file
- Custom stdin
- stdout/stderr display
- Stop request
- Execution time and exit code
- Separate executor service

### AI Features

The AI layer uses the backend as a proxy so API keys are not exposed to the browser.

Workspace AI:

- Inline ghost suggestions
- Complete at cursor
- Explain selected code or whole file
- Fix code
- Optimize code
- Generate tests
- Review file
- Summarize whole active file
- Ask custom questions about the active file
- Send AI response to chat

DSA Playground AI:

- Inline suggestions while typing
- `Tab` accepts suggestions
- DSA snippets for common patterns
- Hints
- Bug fixing
- Complexity analysis
- Edge-case generation
- Optimization help
- Custom AI questions

## Project Structure

```text
./
  backend/
    src/
      controllers/      REST API handlers
      middleware/       auth, errors, rate limiting
      routes/           API router wiring
      services/         AI, execution, presence, terminal services
      sockets/          Socket.IO event handlers
      prisma/           Prisma schema and seed script
    tests/
    Dockerfile

  frontend/
    app/                Next.js pages and layouts
    components/         editor, explorer, chat, toolbar, modals
    hooks/              auth and UI hooks
    lib/                API, socket, local filesystem helpers
    store/              Zustand auth store
    Dockerfile

  executor/
    main.py             isolated code execution API
    Dockerfile
    test_executor.py

  docker/
    nginx.conf          production reverse proxy config

  docker-compose.yml
  docker-compose.prod.yml
  Makefile
  README.md
```

## Local Development

Start the backend stack:

```bash
docker compose up -d
```

Check containers:

```bash
docker compose ps
```

Run the frontend locally:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

Backend:

```text
http://localhost:8000
```

Executor:

```text
http://localhost:8080
```

The frontend is intentionally run outside Docker during local development because it gives faster hot reload and avoids rebuilding the frontend image after every UI change.

## Environment Variables

Create a `.env` file in the project root:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-this-password
POSTGRES_DB=collab
POSTGRES_PORT=5432

REDIS_PORT=6379
BACKEND_PORT=8000
EXECUTOR_PORT=8080

DATABASE_URL=postgresql://postgres:change-this-password@postgres:5432/collab
REDIS_URL=redis://redis:6379/0

JWT_SECRET=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_MINUTES=1440

CORS_ORIGINS=http://localhost:3000,http://frontend:3000
EXECUTOR_URL=http://executor:8080

GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.1-8b-instant

NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000

EXECUTION_TIMEOUT_SECONDS=10
EXECUTION_TMP_ROOT=/tmp
```

Important: if an API key was ever committed, pasted, or shared, rotate it before deployment.

## Useful Commands

```bash
make docker-up      # build and start containers in background
make docker-down    # stop containers
make build          # build Docker images
make migrate        # push Prisma schema
make seed           # seed demo data
make test           # run backend and executor tests
make clean          # remove containers and volumes
```

Manual equivalents:

```bash
docker compose up -d
docker compose logs -f backend
docker compose logs -f executor
docker compose down
```

## Production Deployment

The recommended deployment for this project is:

```text
aether.codexarena.app      -> Vercel frontend
api.aether.codexarena.app  -> VPS backend stack
```

That split keeps frontend builds fast on Vercel while the VPS runs the services that need Docker: FastAPI, executor, PostgreSQL, Redis, and HTTPS reverse proxy.

Recommended VPS size:

```text
Minimum comfortable: 2 vCPU / 4 GB RAM
Recommended: 4 vCPU / 8 GB+ RAM
Your 4 core / 24 GB server is enough for the full stack.
```

### DNS

Create these DNS records:

```text
aether.codexarena.app      CNAME   cname.vercel-dns.com
api.aether.codexarena.app  A       YOUR_SERVER_PUBLIC_IP
```

If you use Cloudflare, keep `api.aether.codexarena.app` as DNS-only until Caddy gets the first TLS certificate.

### VPS Backend Deployment

On the server:

```bash
git clone <your-repo-url> aether
cd aether
cp .env.example .env
nano .env
```

Set production values:

```env
API_DOMAIN=api.aether.codexarena.app
ACME_EMAIL=admin@codexarena.app

CORS_ORIGINS=https://aether.codexarena.app
NEXT_PUBLIC_API_URL=https://api.aether.codexarena.app/api
NEXT_PUBLIC_SOCKET_URL=https://api.aether.codexarena.app

JWT_SECRET=long-random-production-secret
POSTGRES_PASSWORD=strong-production-password
DATABASE_URL=postgresql://postgres:strong-production-password@postgres:5432/collab
REDIS_URL=redis://redis:6379/0
GROQ_API_KEY=rotated-production-key
```

Start the server stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
```

Check logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml logs -f caddy
docker compose -f docker-compose.yml -f docker-compose.server.yml logs -f backend
```

The server override exposes only ports `80` and `443`. PostgreSQL, Redis, backend, and executor stay inside the Docker network.

### Vercel Frontend Deployment

In Vercel, import the repo and set:

```text
Root Directory: frontend
Build Command: npm run build
Output: Next.js default
```

Environment variables:

```env
NEXT_PUBLIC_API_URL=https://api.aether.codexarena.app/api
NEXT_PUBLIC_SOCKET_URL=https://api.aether.codexarena.app
```

Add the custom domain in Vercel:

```text
aether.codexarena.app
```

## Deployment Notes

The app is ready for a portfolio/demo deployment on a VPS, but there are a few things to clean up before calling it a hardened production SaaS:

- Add real Prisma migrations instead of relying on `prisma db push`.
- Rotate all exposed AI keys.
- Use HTTPS only.
- Lock CORS to the real domain.
- Use strong database passwords.
- Consider managed PostgreSQL backups.
- Harden the executor if strangers will run arbitrary code.
- Add monitoring and log retention.
- Add CI checks for backend tests, frontend syntax/build, and Docker config.

## Security Notes

The executor is isolated into its own container and uses timeout/resource limits. That is good enough for a controlled demo, but public code execution is a serious security problem. For a real multi-tenant product, the executor should be upgraded to per-run containers, stronger seccomp/AppArmor profiles, network-disabled execution, or microVM isolation.

The backend keeps AI keys server-side. The browser only calls the backend AI endpoints.

## Testing

Backend tests:

```bash
cd backend
python -m pytest tests -q
```

Executor tests:

```bash
cd executor
python -m pytest test_executor.py -q
```

Frontend syntax check:

```bash
cd frontend
node --check app/playground/page.js
node --check "app/room/[id]/page.js"
```

Production config check:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
```

## Known Limitations

- Collaboration is version-aware, but it is not a full CRDT/OT editor yet.
- Local filesystem save-back depends on browser support for the File System Access API.
- Prisma migrations still need to be formalized.
- The executor is good for demo use, but not hardened enough for hostile public workloads.
- Frontend and socket tests should be expanded.

## Why This Project Matters

This project touches the kind of engineering that appears in real collaborative developer tools:

- realtime event systems
- authenticated multi-user workspaces
- state synchronization
- persistent file trees
- execution isolation
- AI-assisted coding
- Dockerized service architecture
- deployment tradeoffs

It is a strong resume project because it is not just CRUD. It combines frontend product work, backend APIs, realtime systems, data modeling, infrastructure, and security-aware execution design.

## Resume Bullets

- Built a real-time collaborative IDE using Next.js, Monaco Editor, FastAPI, Socket.IO, PostgreSQL, Redis, and Docker.
- Implemented authenticated rooms, nested file management, editor tabs, autosave, realtime code sync, chat, presence, and conflict-aware saves.
- Added a sandboxed code execution service supporting multiple languages with stdin, stdout/stderr capture, timeouts, and container resource limits.
- Integrated Groq-powered AI features including inline ghost completions, file summaries, code explanation, bug fixing, optimization, review, and DSA playground assistance.
- Designed a Docker Compose deployment with separate frontend, backend, executor, PostgreSQL, Redis, and Nginx reverse proxy services.

## Future Improvements

- Add Yjs or Automerge for CRDT-based collaboration.
- Add Redis Socket.IO adapter for multi-backend scaling.
- Add proper Prisma migration files.
- Add GitHub import/export.
- Add per-room roles and permissions.
- Add file version restore UI.
- Add stronger sandbox isolation for public execution.
- Add CI/CD pipeline.
- Add telemetry, metrics, and error monitoring.

