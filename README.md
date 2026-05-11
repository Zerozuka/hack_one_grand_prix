# Knowledge Mesh

Hack-1 グランプリのテーマ「小さくなる日本」に対して開発した、大学内の学び合いを再設計する知識マッチングプラットフォームです。

生成AIによって一人で答えに辿り着くことは簡単になりました。一方で、誰かと議論しながら理解を深める時間や、同じキャンパスにいる学生同士の偶発的なつながりは弱くなっています。Knowledge Mesh は、学生の「困った」を起点に、質問、チャット、Discussion、対面での 5 分 Sync へと自然につなげることで、大学をもう一度「顔の見える小さな学習コミュニティ」の集合体として扱うアプリです。

## What You Can Do

- Help: 困っていることを投稿し、タグで整理できます。
- Thread: Help から回答者とチャットし、会話を残せます。
- Discussion: 今すぐ議論する場や、日時を指定した予定 Discussion を作れます。
- My Class: 自分の興味やスキルに近いクラスメイトを探し、質問や議論に誘導できます。
- Syllabus: 慶應義塾大学理工学部のシラバスデータを検索し、授業と質問・議論を結びつけます。
- Admin: コミュニティ、ユーザー、関係性、コースデータを管理できます。

## Demo

```bash
cp .env.example .env
docker compose up --build
```

起動後、ブラウザで `http://localhost:8080` を開いてください。

| Endpoint | Description |
|---|---|
| `http://localhost:8080` | Web app |
| `http://localhost:8000/v1/health` | API health check |

### Demo Accounts

| ID | Password | Role |
|---|---|---|
| `tanaka.sensei` | `demo1234` | 教員 / 管理者 |
| `suzuki.sensei` | `demo1234` | 教員 / 管理者 |
| `yuki` | `demo1234` | 学生 |
| `haruto` | `demo1234` | 学生 |
| `saki` | `demo1234` | 学生 |

データを初期状態に戻したい場合は、次のコマンドで seed を再実行します。

```bash
SEED_FORCE_RESET=true docker compose up --build
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| State / Data Fetching | TanStack Query, React local state |
| Auth | Auth.js / NextAuth, session cookie, dev credentials |
| BFF | Next.js API Routes, internal JWT proxy |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2 |
| Database | PostgreSQL 16, Alembic |
| Realtime-ish UX | WebSocket for SOS notification, polling for list/chat refresh |
| Infrastructure | Docker Compose |
| Runtime | Node.js 22, Python 3.12 |

## Architecture

ブラウザは FastAPI を直接呼びません。Next.js の BFF がセッションを検証し、内部 JWT を付与して API に中継します。

```text
Browser
  -> Next.js Web / BFF
  -> FastAPI
  -> PostgreSQL
```

この構成により、ブラウザに DB 接続情報や API 内部認証情報を出さずに、Web と API を分離しています。

## Repository Structure

```text
.
├── apps/
│   ├── web/                 # Next.js app, BFF routes, UI components
│   └── api/                 # FastAPI app, SQLAlchemy models, Alembic migrations
├── packages/
│   └── contracts/           # OpenAPI-derived shared TypeScript types
├── data/                    # Demo seed data and course data
├── scripts/                 # Import and contract generation scripts
├── docs/
│   ├── development/         # TODO, insights, screen guide
│   ├── pitch/               # Hackathon proposal and presentation scripts
│   ├── assets/              # Public presentation assets
│   └── archive/             # Old notes and generated presentation outputs
├── docker-compose.yml       # Local development compose
├── docker-compose.prod.yml  # Production-like compose
└── README.md
```

Root には起動・開発に必要なファイルだけを置き、発表資料や作業メモは `docs/` に分離しています。

## Main Features

### Help

学生が困っている内容を投稿し、タグで分類できます。投稿後は回答者とのスレッドを開き、必要に応じて Discussion に発展させられます。

### Discussion

「今すぐ話す」Discussion と、「予定を立てる」Discussion を作成できます。場所、参加者、詳細、添付画像、コメントスレッドを扱い、キャンパス内での学習会や短い相談を起こしやすくしています。

### My Class

学生の興味・目標・活動タグから、自分に近い人や質問しやすい人を探せます。プロフィールから Help や Discussion に移れるため、可視化だけで終わらず行動に接続できます。

### Syllabus

`data/courses.json` に含まれる 1,808 件のシラバスデータを検索できます。授業内容と質問・議論を結びつけることで、「この授業で困っている人に誰をつなぐか」を考えやすくしています。

### Admin

管理者はユーザー、関係性、イベント、コース、インポート状態などを確認できます。初期データは `data/demo-data.json` と `data/courses.json` から seed されます。

## API Overview

```text
GET  /v1/health
GET  /v1/me
GET  /v1/communities/{id}/dashboard

GET|POST /v1/users
GET|POST /v1/relationships

GET|POST /v1/sos
POST     /v1/sos/respond
POST     /v1/sos/{id}/close
GET      /v1/sos/{id}/chat
POST     /v1/sos/{id}/chat/messages
WS       /v1/ws/sos/{community_id}

GET|POST /v1/events
POST     /v1/events/{id}/join
POST     /v1/events/{id}/end
WS       /v1/ws/events/{community_id}

GET      /v1/courses
GET      /v1/courses/{id}
GET      /v1/admin/*
```

## Development

Frontend build:

```bash
npm run build:web
```

Frontend type check:

```bash
npm run typecheck:web
```

OpenAPI contracts:

```bash
npm run generate:contracts
```

Backend migrations are applied automatically when the API container starts.

```bash
docker compose up --build
```

## Environment Variables

`.env.example` contains the local defaults. For local demos, the default values are enough. For production-like use, change at least these values:

- `POSTGRES_PASSWORD`
- `API_INTERNAL_JWT_SECRET`
- `NEXTAUTH_SECRET`
- `AUTH_DEV_MODE`
- `NEXT_PUBLIC_ENABLE_OIDC`
- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`

`ANTHROPIC_API_KEY` is optional and only needed for AI-assisted SOS routing.

## Documentation

| Document | Purpose |
|---|---|
| [`docs/development/screen-guide.md`](docs/development/screen-guide.md) | Demo screen walkthrough |
| [`docs/development/todo.md`](docs/development/todo.md) | Remaining implementation tasks |
| [`docs/development/insight.md`](docs/development/insight.md) | Product and UX notes |
| [`docs/pitch/product-proposal.md`](docs/pitch/product-proposal.md) | Hackathon proposal |
| [`docs/pitch/technical-script.md`](docs/pitch/technical-script.md) | Technical presentation script |
| [`docs/assets/knowledge-mesh.pdf`](docs/assets/knowledge-mesh.pdf) | Presentation PDF |

## Notes

- This repository is optimized for a hackathon demo and release-oriented local deployment.
- The app is designed around a university or organization using multiple communities, not a public multi-tenant SaaS.
- OIDC settings are configurable, but local development uses demo credential login by default.
- The syllabus source PDF remains at the repository root because `scripts/parse_syllabus.py` currently reads it from there.
