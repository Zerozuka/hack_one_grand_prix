# Knowledge Mesh

**5分Sync を軸に、大学内の知見を PostgreSQL で運用できるようにしたリリース前提版です。**

`Knowledge Mesh` は、学生・教員の知見、関係、イベント、シラバス、SOS をまとめて扱い、
「今この悩みを解ける人」と 5 分でつながるための大学向けナレッジマッチング基盤です。

## アーキテクチャ

- `apps/web` — `Next.js` / `TypeScript` / `Auth.js` / BFF
- `apps/api` — `FastAPI` / `SQLAlchemy` / `Alembic`
- `postgres` — ユーザー、関係、イベント、コース、SOS、監査ログを永続化
- `packages/contracts` — API 契約共有

ブラウザは直接 API や DB を叩かず、Web 側の BFF とセッションを通してアクセスします。

## できること

- デモ認証または OIDC 前提のログイン
- コミュニティごとのダッシュボード表示
- 5分Sync 向け推薦表示
- 知見エッジ、イベント、SOS の API 管理
- シラバス検索とコース取込
- `/admin` での運用確認
- 監査ログと認証主体の紐付け確認

## 起動方法

```bash
docker compose up --build
```

起動後:

```text
http://localhost:8080
```

API ヘルス:

```text
http://localhost:8000/v1/health
```

停止:

```bash
docker compose down
```

本番寄り設定:

```bash
docker compose -f docker-compose.prod.yml up --build
```

## デモアカウント

- `tanaka.sensei / demo1234`
- `suzuki.sensei / demo1234`
- `yuki / demo1234`
- `haruto / demo1234`
- `saki / demo1234`

## データ管理

- 初回起動時に `data/demo-data.json` と `data/courses.json` から seed されます
- 2 回目以降は既存データがあると seed は自動スキップされます
- 強制 reseed したいときは `SEED_FORCE_RESET=true` を使います

## 主なエンドポイント

- `GET /v1/me`
- `GET /v1/communities`
- `GET /v1/communities/{community_id}/dashboard`
- `GET|POST|PATCH /v1/users`
- `GET|POST|DELETE /v1/relationships`
- `GET|POST|PATCH|DELETE /v1/events`
- `GET /v1/courses`
- `GET /v1/recommendations`
- `GET|POST /v1/sos`
- `POST /v1/sos/respond`
- `GET /v1/admin/*`

## 運用メモ

- DB マイグレーションは API コンテナ起動時に `alembic upgrade head` を実行します
- WebSocket SOS API は `apps/api` 側に用意してあります
- UI の詳しい説明は [SCREEN_GUIDE.md](/Users/sasaki/M1/hack_one_grand_prix/SCREEN_GUIDE.md:1) を参照してください

## 環境変数

- サンプルは [.env.example](/Users/sasaki/M1/hack_one_grand_prix/.env.example:1) にあります
- 主に使うのは `DATABASE_URL`, `API_INTERNAL_JWT_SECRET`, `NEXTAUTH_SECRET`, `DEFAULT_COMMUNITY_ID`

## バックアップ / リストア例

バックアップ:

```bash
docker compose exec postgres pg_dump -U knowledge_mesh knowledge_mesh > backup.sql
```

リストア:

```bash
cat backup.sql | docker compose exec -T postgres psql -U knowledge_mesh -d knowledge_mesh
```
