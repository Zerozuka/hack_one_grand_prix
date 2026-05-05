# Knowledge Mesh

> 大学を「知能が同期する巨大なクラス」にアップデートする, 学生間知識マッチングプラットフォーム

生成AIの普及で「検索 → AI回答 → 解決」が当たり前になった現代, 対面で議論し教え合う体験が失われています.  
Knowledge Mesh は SOS をトリガーに学生をつなぎ, チャットから対面議論への昇格まで段階的に「深い納得感」を引き出します.

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 (App Router) / TypeScript / Tailwind CSS |
| 状態管理 | TanStack Query (サーバー状態) / React useState (ローカル状態) |
| 認証 | Auth.js (NextAuth v5) — セッションCookie方式 |
| BFF | Next.js API Routes が FastAPI へのプロキシとして機能 |
| バックエンド | FastAPI / SQLAlchemy 2.0 (Mapped型) / Pydantic v2 |
| DB | PostgreSQL 16 / Alembic (マイグレーション管理) |
| グラフ描画 | D3.js v7 (force-directed layout) |
| インフラ | Docker Compose / Nginx (リバースプロキシ) |

---

## 工夫した点

### 1. BFF パターンによるセキュアなAPI通信

ブラウザは直接 FastAPI を叩かず, Next.js の `/api/proxy/*` を経由します.  
セッション検証・ユーザーID付与・JWT署名をサーバーサイドで完結させることで, クレデンシャルをクライアントに露出しない設計にしました.

```
Browser → Next.js BFF → FastAPI → PostgreSQL
         (Cookie Auth)  (Internal JWT)
```

### 2. SOS → チャット → 対面議論への段階的エスカレーション

「困った瞬間」を起点に3段階で接続コストを下げる設計です.

```
SOS投稿 → スキルマッチで回答者を発見
   ↓
リアルタイムチャット (5秒ポーリング)
   ↓
「対面で議論しよう」ボタン → 場所を入力 → sync ボードに即時掲載
   ↓
他の学生が「参加する」 → 対面で合流 → 手動クローズ
```

SOS解決後のチャットから対面議論への昇格は `Event.is_live` フラグで管理し, 独立投稿との統一APIで実現しています.

### 3. リアルタイム議論ボード (Live Discussion Board)

`sync` view では「今ここで議論中」のイベントを30秒ポーリングで表示します.  
参加者数・場所・トピックをカード表示し, 1クリックで参加できます.  
WebSocketを避けてポーリングを選んだ理由は, デモ環境でのHTTPS制約回避と実装コストの削減です.

### 4. D3.js スター型知識グラフ

学生をノード, 知見共有の関係をエッジとしてforce-directed graphで可視化します.  
ノード色でロール (キーノード / 新規参加 / 橋渡し候補 / 孤立ノード) を識別し,  
「誰がコミュニティの結節点か」を直感的に把握できます.

### 5. 1808科目シラバスとのスキルマッチング

慶應義塾大学2010年度シラバス全1808科目を内包し,  
授業トピックと学生の専門・興味タグをセマンティックにマッチングします.  
「この授業で困っている学生に誰をつなぐか」を高解像度に提示します.

### 6. ゲーミフィケーションによる参加動機設計

SOS解決・議論参加・知見エッジ追加でポイントが加算されます.  
別分野との接続はボーナス付き. バッジ (橋渡し師 / ファーストコネクト / キーノード) も付与されます.  
「忙しい学生が教えに来る動機」を仕組みで解決しています.

### 7. Alembic による安全なスキーマ進化

`0001_init` から `0004_live_discussion` まで, すべての変更をマイグレーションで管理します.  
nullable カラム追加のみで既存データを壊さない設計を徹底しています.

---

## 起動方法

```bash
docker compose up --build
```

| エンドポイント | 内容 |
|---|---|
| `http://localhost:8080` | アプリ本体 |
| `http://localhost:8000/v1/health` | API ヘルスチェック |

停止:

```bash
docker compose down
```

本番寄り設定:

```bash
docker compose -f docker-compose.prod.yml up --build
```

---

## デモアカウント

| アカウント | パスワード | ロール |
|---|---|---|
| `tanaka.sensei` | `demo1234` | 教員 (キャンパス全体を管理) |
| `suzuki.sensei` | `demo1234` | 教員 |
| `yuki` | `demo1234` | 学生 |
| `haruto` | `demo1234` | 学生 |
| `saki` | `demo1234` | 学生 |

---

## アーキテクチャ

```
apps/
├── web/             # Next.js フロントエンド + BFF
│   ├── app/         # App Router (dashboard, login, register, admin)
│   └── components/  # SosPanel, DiscussionBoard, NetworkMap, ...
└── api/             # FastAPI バックエンド
    ├── app/
    │   ├── models.py    # SQLAlchemy ORM
    │   ├── schemas.py   # Pydantic スキーマ
    │   ├── services.py  # ビジネスロジック
    │   └── routers.py   # APIエンドポイント
    └── alembic/         # DBマイグレーション
packages/
└── contracts/       # フロント・バック共通の型定義
```

---

## 主なAPIエンドポイント

```
GET  /v1/me
GET  /v1/communities/{id}/dashboard
GET  /v1/recommendations
GET|POST      /v1/sos
POST          /v1/sos/respond
GET           /v1/sos/{id}/chat
POST          /v1/sos/{id}/chat/messages
GET|POST      /v1/events
POST          /v1/events/{id}/join
POST          /v1/events/{id}/end
GET           /v1/courses
GET           /v1/admin/*
```

---

## データ構成 (デモ初期値)

- コミュニティ: 2件 (東キャンパス理工学部 / 西キャンパス文理融合)
- アカウント: 5件 / 学生ノード: 13件 / 知見エッジ: 8件
- イベント: 4件 / コース: 1,808件

初回起動時に `data/demo-data.json` と `data/courses.json` から自動 seed されます.  
強制 reseed: `SEED_FORCE_RESET=true docker compose up`

---

## 環境変数

`.env.example` を参照してください.  
主要変数: `DATABASE_URL`, `API_INTERNAL_JWT_SECRET`, `NEXTAUTH_SECRET`, `DEFAULT_COMMUNITY_ID`

---

## バックアップ / リストア

バックアップ:

```bash
docker compose exec postgres pg_dump -U knowledge_mesh knowledge_mesh > backup.sql
```

リストア:

```bash
cat backup.sql | docker compose exec -T postgres psql -U knowledge_mesh -d knowledge_mesh
```
