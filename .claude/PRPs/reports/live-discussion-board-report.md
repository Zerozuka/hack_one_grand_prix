# Implementation Report: Live Discussion Board

## Summary
Event モデルを拡張し, SOS チャットから対面議論への昇格フローと, リアルタイム議論ボード (`sync` view) を実装した.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Files Changed | 8 | 8 |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Event モデル拡張 | ✅ Complete | is_live, location, sos_request_id, creator_user_id 追加 |
| 2 | Alembic マイグレーション | ✅ Complete | 0004_live_discussion.py 作成 |
| 3 | スキーマ更新 | ✅ Complete | EventOut / EventUpsert に新フィールド追加 |
| 4 | サービス更新 | ✅ Complete | list_community_events に新フィールド含める |
| 5 | ルーター更新 | ✅ Complete | create_event 権限変更 + join/end エンドポイント追加 |
| 6 | DiscussionBoard コンポーネント | ✅ Complete | discussion-board.tsx 新規作成 |
| 7 | SOS 昇格ボタン | ✅ Complete | sos-panel.tsx に「対面で議論しよう」追加 |
| 8 | Dashboard 型拡張 + sync view 差し替え | ✅ Complete | community_id 不足のエラーを修正して通過 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| TypeScript (frontend) | ✅ Pass | Zero errors after community_id 追加修正 |
| ruff (backend) | ✅ No new errors | 既存の E501 等は元からあるプリエグジスティングエラー |
| Build | N/A | Docker 環境なしのためローカル型チェックで代替 |
| Migration | Pending | `docker compose up` 時に `alembic upgrade head` で適用 |

## Files Changed

| File | Action |
|---|---|
| `apps/api/app/models.py` | UPDATED — Event に4フィールド追加 |
| `apps/api/alembic/versions/0004_live_discussion.py` | CREATED |
| `apps/api/app/schemas.py` | UPDATED — EventOut / EventUpsert 拡張 |
| `apps/api/app/services.py` | UPDATED — list_community_events に新フィールド |
| `apps/api/app/routers.py` | UPDATED — create_event 権限 + join/end エンドポイント |
| `apps/web/components/discussion-board.tsx` | CREATED |
| `apps/web/components/sos-panel.tsx` | UPDATED — 昇格ボタン追加 |
| `apps/web/app/dashboard/page.tsx` | UPDATED — 型拡張 + sync view 差し替え |

## Deviations from Plan

- `can_manage` の実装を `UserRole` 比較から `context.can_manage()` メソッドに変更 (deps.py のメソッドが正しいパターンと判明)
- `DashboardData.events` に `community_id` フィールドを追加 (DiscussionBoard の型要件で必要と判明)

## Next Steps
- [ ] `/code-review` でレビュー
- [ ] `docker compose up --build` で動作確認
- [ ] `/prp-pr` で PR 作成
