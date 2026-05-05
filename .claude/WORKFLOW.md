# Knowledge Mesh 開発ワークフロー

READE.md の機能要件を実装するための標準ワークフロー.

---

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + TanStack Query + NextAuth |
| Backend | FastAPI + SQLAlchemy + PostgreSQL + Alembic |
| 開発コマンド | `pnpm dev` (web), `uvicorn` (api), `docker compose up` (full) |

---

## 全体フロー

```
PRD作成 → 実装計画 → 実装 → レビュー → チェックポイント → PR
  ↓           ↓         ↓       ↓            ↓             ↓
/prp-prd  /prp-plan  /prp-implement  /code-review  /checkpoint  /prp-pr
```

---

## フェーズ別ガイド

### Phase 0: PRD 作成（新機能の場合）

```
/prp-prd <機能名>
```

生成先: `.claude/PRPs/prds/<name>.prd.md`

### Phase 1: 実装計画

```
/prp-plan .claude/PRPs/prds/<name>.prd.md
```

または単発:

```
/prp-plan <機能の説明>
```

生成先: `.claude/PRPs/plans/<name>.plan.md`

### Phase 2: 実装

```
/prp-implement .claude/PRPs/plans/<name>.plan.md
```

**このプロジェクト固有の注意点:**
- Frontend: `apps/web/` — `pnpm typecheck` でエラーチェック
- Backend: `apps/api/` — `ruff check` + `pytest` でチェック
- DB変更時は必ず `alembic revision --autogenerate` でマイグレーション作成
- 新コンポーネントは `apps/web/components/` に配置
- API エンドポイントは `apps/api/app/routers.py`、ロジックは `services.py`

### Phase 3: コードレビュー

```
/code-review
```

### Phase 4: チェックポイント

```
/checkpoint create <feature-name>
```

### Phase 5: PR 作成

```
/prp-pr
```

---

## 現在の実装状況 (2026-05-05)

| 機能 | 状態 | ファイル |
|------|------|---------|
| Auth (NextAuth + JWT) | 完了 | `apps/web/lib/auth.ts`, `apps/api/app/security.py` |
| Community / User 管理 | 完了 | `apps/api/app/models.py` |
| グラフ可視化 (canvas) | 完了 | `apps/web/components/network-map.tsx` |
| SOS リクエスト・応答 | 完了 | `apps/web/components/sos-panel.tsx` |
| SOS フォローアップチャット | 完了 | `sos-panel.tsx` + `routers.py` |
| コースマッチング | 完了 | `apps/api/app/domain.py` |
| レコメンド (bridge/comp/sim) | 完了 | `apps/api/app/domain.py` |
| ゲーミフィケーション | 完了 | `apps/api/app/services.py` |
| WebSocket (サーバー側) | 完了 | `routers.py` `SosConnectionManager` |
| **リアルタイム議論ボード** | **未実装** | `sync` view がレコメンドのみ表示 |
| **WebSocket フロント接続** | **未実装** | フロントはポーリング (15s) のまま |
| **スター型ネットワーク表示** | **部分** | force simulation、star layout は未実装 |

---

## 優先実装リスト

### 1. リアルタイム議論ボード (最優先)

READE.md で「大学内のどこでどんな議論が発生しているか」を可視化する機能.

```bash
/prp-prd リアルタイム議論ボード: 学生が「今ここで議論中」をポストし, 他の学生が場所・トピックで参加できるボード
```

**関連ファイル:**
- `apps/web/app/dashboard/page.tsx` — `sync` view の中身を実装
- `apps/api/app/models.py` — `DiscussionPost` モデル追加候補
- `apps/api/app/routers.py` — WebSocket or ポーリングエンドポイント

### 2. SOS の WebSocket リアルタイム化

サーバー側は `SosConnectionManager` が実装済み. フロントのポーリングを WebSocket に置き換える.

```bash
/prp-plan SOS WebSocket リアルタイム化: apps/web/components/sos-panel.tsx のポーリングをWebSocketに置き換える
```

### 3. スター型ネットワーク表示

現状: force simulation で全ユーザーを表示.
目標: 自分を中心に「クラスメイト」をスター型に配置.

```bash
/prp-plan スター型ネットワーク: apps/web/components/network-map.tsx に ego-centric star layout を追加
```

---

## コーディング規則 (このプロジェクト)

### Frontend
- コンポーネントは `"use client"` か Server Component かを明示
- データフェッチは TanStack Query (`useQuery` / `useMutation`)
- API 呼び出しは `/api/proxy/v1/...` 経由 (NextAuth セッション付き)
- スタイルは Tailwind のユーティリティクラス
- theme (`light` / `dark`) を props で受け取るパターンを踏襲

### Backend
- ルーター: `apps/api/app/routers.py` にエンドポイント追加
- ロジック: `apps/api/app/services.py` に関数を切り出す
- DB モデル: `apps/api/app/models.py`、変更後は alembic マイグレーション必須
- スキーマ: `apps/api/app/schemas.py` に Pydantic モデル

---

## セッション管理

```
/save-session    # 長期作業前に保存
/resume-session  # 再開時
```
