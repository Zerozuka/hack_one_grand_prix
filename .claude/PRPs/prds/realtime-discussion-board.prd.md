# リアルタイム議論ボード (Live Discussion Board)

## Problem Statement

大学生は授業・独学中に「AIでは解決できない深い疑問」に直面しても, それを誰かと議論する場がない. SNS は対象が広すぎ, LINEは既存の人間関係に依存する. 結果として表面的なAI回答で済ませてしまい, 対面での議論による深い理解が失われている.

## Evidence

- Assumption: 生成AIの普及により, 学生が「検索・AI回答 → 解決」で学習を完結させるケースが増えている
- Assumption: 大学内に「今ここで議論中」の可視化手段がないため, 同じ疑問を持つ学生が互いを発見できていない
- READE.md より: 「AIに答えを教えてもらうだけでなく, それらについて議論することで, より深い理解と納得を得る体験が必要」

## Proposed Solution

SOS 質問フローを起点に, Slack スレッド型のテキスト議論と「今ここで対面議論中」ボードを組み合わせたフロー. SOS 投稿 → スキルマッチによるルーティング → テキスト議論 → 対面議論への昇格, という段階的エスカレーションで「議論への参加コスト」を下げる. GPS 距離をマッチングスコアに組み込むことで物理的に近い人を優先的に引き合わせる.

## Key Hypothesis

スキルセット自動計測 + GPS距離マッチング機能があれば, 質問内容から最適な回答者へのルーティングが実現し, 対面議論の発生率が高まる. それは「SOS投稿からチャット返信までの時間」と「対面議論昇格数 / SOS解決数の比率」でわかる.

## What We're NOT Building

- GPS によるリアルタイム位置追跡 (プライバシーリスク / 3日以内に実装不可) — 代替として自己申告の場所入力
- 自動タイマーによる議論終了 (v1は手動終了のみ)
- 音声・映像通話機能
- 教授・外部ユーザーの参加機能

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| SOS → チャット返信率 | > 50% | resolved / total SOS |
| 対面議論昇格数 | 1回以上 / デモ | is_live=true の Event 生成数 |
| 議論ボード表示からの参加 | 1回以上 / デモ | join アクション数 |

## Open Questions

- [ ] **参加動機問題**: 忙しい学生が対面で教えに来るだろうか? → ゲーミフィケーション (ポイント付与) が十分なインセンティブになるか要検証
- [ ] GPS 取得の代替手段: `navigator.geolocation` は HTTPS + ユーザー許可が必要. デモ環境で動作するか確認が必要
- [ ] スキルスコア自動計測: タグベースの既存スコアで十分か, それとも別のスコアリングが必要か

---

## Users & Context

**Primary User**
- **Who**: 授業受講中または独学中の学部生. AIや検索で解決できない概念的な疑問を持っている
- **Current behavior**: ChatGPT に聞いて「なんとなく理解した気」で次に進む
- **Trigger**: 授業中・自習室でわからない問題に詰まった瞬間
- **Success state**: 同じ授業を取っている, または同じ領域を学ぶ人と繋がり, 5〜30分の議論で「深い納得感」を得た

**Job to Be Done**
勉強している内容がわからない時, 誰かと深い議論がしたくて, その質問に答えてくれる人・議論してくれる人を得るためにこれを使う.

**Non-Users**
教授・外部の人間 (大学コミュニティ外). オンライン完結を希望するユーザー (このプロダクトは対面を価値の中心に置く).

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | SOS チャットから「対面で議論しよう」昇格ボタン | SOSと議論ボードを繋ぐ核心フロー |
| Must | 独立した「今ここで議論中」ポスト投稿フォーム | SOSを経由しない自発的議論の開始 |
| Must | ライブ議論一覧ボード (場所・トピック・参加者表示) | 議論の発見と可視化 |
| Must | 「参加する」ボタン (参加者数が増える) | 議論への低コスト参入 |
| Must | 議論の手動終了ボタン | 投稿者がクローズできる |
| Should | スキルタグ + 距離ベースのマッチングスコア | 適切なルーティングの実現 |
| Could | GPS 距離をマッチングスコアに組み込む | 物理的近接性の考慮 |
| Won't | 自動タイマー終了 | v1 スコープ外 |
| Won't | 音声・映像通話 | v1 スコープ外 |

### MVP Scope

1. SOS チャット内に「対面で議論しよう」ボタンを追加し, 場所を入力して `is_live=True` のイベントを生成
2. `sync` view に独立投稿フォーム + ライブ議論一覧を表示
3. 各議論カードに「参加する」「終了」ボタン
4. 30秒ポーリングでリアルタイム更新

### User Flow

```
[SOS を投稿] → [スキルマッチで返答者が通知される] → [チャットで議論]
     ↓                                                        ↓
[独立投稿]                                          [「対面で議論しよう」ボタン]
     ↓                                                        ↓
                    [場所・トピックを入力して Live 議論を生成]
                                    ↓
                    [sync ボードにリアルタイム表示]
                                    ↓
                    [他の学生が「参加する」を押してジョイン]
                                    ↓
                    [対面で合流 → 議論終了 → 手動クローズ]
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- `Event` モデルに `is_live: bool`, `location: str | None`, `sos_request_id: str | None` を追加 (Alembic migration)
- `EventOut` / `EventUpsert` スキーマに同フィールドを追加
- `POST /v1/events` に `is_live=True` で投稿 → ライブ議論として扱う
- `PATCH /v1/events/{id}` で `is_live=False` にして終了
- `GET /v1/communities/{id}/dashboard` の `events` に `is_live` フィールドを含める
- `sync` view: `dashboard.events.filter(is_live)` でライブ議論を表示
- SOS チャット内に「対面で議論しよう」ボタンを追加 → `POST /v1/events` を呼ぶ
- ポーリング: 30秒ごとに `dashboard` を再取得 (既存パターンを踏襲)

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 参加動機の欠如 (ユーザーが使わない) | H | ゲーミフィケーション: 議論参加でポイント付与 |
| GPS 取得が HTTPS 環境でないと動作しない | M | v1 は自己申告の場所テキスト入力にフォールバック |
| Alembic migration が既存データを壊す | L | nullable カラム追加のみなので安全 |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | DB拡張 | `Event` モデルに `is_live`, `location`, `sos_request_id` を追加しマイグレーション | complete | - | - | `.claude/PRPs/plans/completed/live-discussion-board.plan.md` |
| 2 | API拡張 | スキーマ・サービス・エンドポイントを `is_live` 対応に更新 | complete | - | 1 | `.claude/PRPs/plans/completed/live-discussion-board.plan.md` |
| 3 | SOS昇格UI | SOS チャット内「対面で議論しよう」ボタン + 場所入力モーダル | complete | with 4 | 2 | `.claude/PRPs/plans/completed/live-discussion-board.plan.md` |
| 4 | 議論ボードUI | `sync` view にライブ議論一覧 + 独立投稿フォームを実装 | complete | with 3 | 2 | `.claude/PRPs/plans/completed/live-discussion-board.plan.md` |
| 5 | 結合テスト | E2Eフロー確認 + ポーリング動作確認 | pending | - | 3, 4 | - |

### Phase Details

**Phase 1: DB拡張**
- **Goal**: `Event` テーブルに3カラム追加
- **Scope**: `models.py` + `alembic/versions/0004_live_discussion.py`
- **Success signal**: `alembic upgrade head` が通る

**Phase 2: API拡張**
- **Goal**: `is_live` フラグでライブ議論の作成・終了・一覧取得が機能する
- **Scope**: `schemas.py`, `services.py`, `routers.py`
- **Success signal**: `POST /v1/events` で `is_live=True` を送るとボードに出る

**Phase 3: SOS昇格UI**
- **Goal**: SOS チャット画面から対面議論を開始できる
- **Scope**: `apps/web/components/sos-panel.tsx`
- **Success signal**: 「対面で議論しよう」ボタンを押すと `sync` ボードに表示される

**Phase 4: 議論ボードUI**
- **Goal**: `sync` view にライブ議論のリアルタイム一覧が表示される
- **Scope**: `apps/web/app/dashboard/page.tsx` の sync セクション + 新コンポーネント `discussion-board.tsx`
- **Success signal**: 議論カードが表示され, 参加・終了ボタンが機能する

**Phase 5: 結合テスト**
- **Goal**: SOS → チャット → 対面昇格 → ボード表示 → 参加 → 終了の全フローが通る
- **Scope**: デモデータで手動 E2E テスト
- **Success signal**: `docker compose up` で全フローが確認できる

### Parallelism Notes

Phase 3 (SOS昇格UI) と Phase 4 (議論ボードUI) は API が完成していれば並行開発可能.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 新モデルか既存拡張か | `Event` 拡張 | `DiscussionPost` 新規作成 | 3日の制約. 既存エンドポイントを流用できる |
| リアルタイム方式 | ポーリング (30秒) | WebSocket | WebSocket はフロント実装が複雑. ポーリングで十分デモ映えする |
| GPS vs 自己申告 | 自己申告テキスト | `navigator.geolocation` | HTTPSなし環境でのリスク回避. v2 で GPS 対応 |

---

## Research Summary

**Market Context**
「今・ここ・このトピック」の三軸を持つ対面特化の議論発見ツールは市場に存在しない. 最近傍は YikYak (位置ベース匿名掲示板) だが学習文脈がない. Slack/Discord は対象スコープが広すぎて大学内の物理的近接性を活かせない.

**Technical Context**
FastAPI の `Event` モデル + Next.js の `sync` view が既に土台として存在する. 追加コード量は最小. 最大のリスクは技術ではなく「参加動機」(ユーザーが本当に対面で議論しに来るか) であり, これはゲーミフィケーションとデモシナリオで補う必要がある.

---

*Generated: 2026-05-05*
*Status: DRAFT - needs validation*
