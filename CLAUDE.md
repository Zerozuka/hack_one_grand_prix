# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Knowledge Mesh** — a university knowledge-matching platform for Keio University.  
Students post SOS requests, get matched by skill, chat, and escalate to in-person discussions.  
Faculty can manage the knowledge graph, view analytics, and oversee community activity.

Stack: **Next.js 15 + FastAPI + PostgreSQL**, fully containerized with Docker Compose.

## Running the App

```bash
# Start everything (runs migrations automatically)
docker compose up --build

# App:  http://localhost:8080
# API:  http://localhost:8000/v1/health
```

Demo credentials:

| Account | Password | Role |
|---|---|---|
| `tanaka.sensei` | `demo1234` | Faculty (full access) |
| `yuki` | `demo1234` | Student |
| `haruto` | `demo1234` | Student |
| `saki` | `demo1234` | Student |

## Development Commands

```bash
# Frontend type-check
cd apps/web && npm run build

# Backend lint
cd apps/api && uvx ruff check .

# Force reseed database
SEED_FORCE_RESET=true docker compose up --build
```

## Architecture

```
apps/
├── web/             # Next.js 15 (App Router) — frontend + BFF
│   ├── app/
│   │   ├── dashboard/   # Main dashboard (overview, network, sos, sync, courses tabs)
│   │   ├── login/
│   │   ├── register/
│   │   ├── admin/
│   │   └── api/proxy/   # BFF: proxies all /api/proxy/* → FastAPI with session auth
│   ├── components/
│   │   ├── network-map.tsx       # D3.js force-directed knowledge graph
│   │   ├── sos-panel.tsx         # SOS requests + chat + in-person escalation
│   │   ├── discussion-board.tsx  # Live discussion board (sync view)
│   │   ├── dashboard-sidebar.tsx
│   │   └── course-import-panel.tsx
│   └── lib/
│       ├── auth.ts   # Auth.js (NextAuth v5) session helpers
│       └── api.ts    # Typed fetch wrapper
└── api/             # FastAPI backend
    ├── app/
    │   ├── models.py    # SQLAlchemy ORM (Mapped[] style)
    │   ├── schemas.py   # Pydantic v2 request/response schemas
    │   ├── services.py  # Business logic (query layer)
    │   ├── routers.py   # All API endpoints
    │   ├── deps.py      # Auth dependencies + request context
    │   └── seed.py      # Demo data seeder
    └── alembic/
        └── versions/    # 0001_initial → 0004_live_discussion
packages/
└── contracts/       # Shared TypeScript types (frontend ↔ backend contract)
```

### BFF Pattern

Browser never calls FastAPI directly. All requests go through Next.js `/api/proxy/*`:

```
Browser → Next.js BFF (cookie session) → FastAPI (internal JWT) → PostgreSQL
```

`deps.py` exposes `get_request_context()` which resolves `user_id`, `community_id`, and `role` from the JWT on every request.

## Key Data Models

| Model | Key Fields |
|---|---|
| `User` | `id`, `community_id`, `name`, `role`, `interests`, `goals`, `points` |
| `Relationship` | `from_user_id`, `to_user_id`, `type`, `strength` |
| `Event` | `id`, `is_live`, `location`, `sos_request_id`, `creator_user_id`, `participant_ids` |
| `SosRequest` | `id`, `user_id`, `topic`, `status`, `responder_user_id`, `chat_id` |
| `SosChat` | `id`, `request_id`, messages (separate `SosChatMessage` rows) |
| `Course` | `id`, `title`, `instructor`, `lecture_contents`, `departments` |

## Migrations

Alembic runs automatically at API container startup (`alembic upgrade head`).  
To add a new migration:

```bash
# Inside the api container or with the venv active
alembic revision -m "describe_change"
# Edit the generated file, then:
alembic upgrade head
```

Migration files live in `apps/api/alembic/versions/`.  
Always use nullable columns or server defaults when adding columns to avoid breaking existing rows.

## Key API Endpoints

```
GET  /v1/health
GET  /v1/me
GET  /v1/communities/{id}/dashboard       # Main data fetch (used by dashboard page)

# Knowledge graph
GET|POST        /v1/relationships
DELETE          /v1/relationships/{id}

# Events & live discussions
GET|POST        /v1/events                # POST with is_live=true → live discussion
POST            /v1/events/{id}/join
POST            /v1/events/{id}/end

# SOS
GET|POST        /v1/sos
POST            /v1/sos/respond
GET             /v1/sos/{id}/chat
POST            /v1/sos/{id}/chat/messages
WS              /v1/ws/sos/{community_id}

# Recommendations & courses
GET             /v1/recommendations
GET             /v1/courses
GET             /v1/courses/{id}/matches

# Admin
GET             /v1/admin/users
```

## Frontend Patterns

- **Data fetching**: TanStack Query with `useQuery` / `useMutation`. Dashboard fetches via `apiFetch()` server-side, passes as `initialData`.
- **Polling**: SOS chat at 5s, SOS list at 15s, events/discussions at 30s.
- **Theming**: Components accept `theme: "light" | "dark"` prop. Dashboard passes theme down based on active view.
- **Auth**: `getAuthSession()` in server components; `useSession()` in client components.

## Dashboard Views

The dashboard (`/dashboard`) has 5 tab views controlled by `?view=` search param:

| View | Component | Description |
|---|---|---|
| `overview` | inline JSX | Stats, recommendations, ranking |
| `network` | `NetworkMap` | D3.js knowledge graph |
| `sos` | `SosPanel` | SOS requests + chat + escalation |
| `sync` | `DiscussionBoard` | Live in-person discussion board |
| `courses` | `CourseImportPanel` | Syllabus search + user matching |

## Environment Variables

See `.env.example`. Key vars:

- `DATABASE_URL` — PostgreSQL connection string
- `API_INTERNAL_JWT_SECRET` — shared secret between BFF and FastAPI
- `NEXTAUTH_SECRET` — Auth.js session encryption key
- `DEFAULT_COMMUNITY_ID` — community used for demo seeding
