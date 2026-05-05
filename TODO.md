# TODO — Knowledge Mesh 実装タスク

> このファイルは `/prp-plan` に渡して実装計画を生成するための仕様書です.
> 各タスクは独立して実装可能なスコープに切り出しています.

---

## 優先度 1 — デモで必ず見せる機能

### TASK-01: SOS スキルマッチ — 返答できる人をハイライト表示

**目的**
SOS が投稿された時, 投稿者のタグ (interests / goals / activity_tags) と近い別ユーザーに「あなたが答えられます」バッジを表示する.
現状は全ユーザーに同じ「対応する」ボタンが出るだけで, ルーティングが機能していない.

**変更ファイル**
- `apps/api/app/schemas.py` — `SosOut` に `matched_user_ids: list[str]` フィールドを追加
- `apps/api/app/services.py` — SOS一覧取得時に, 投稿者のタグと各ユーザーのタグをJaccard similarityで比較し, スコア上位3名のIDを `matched_user_ids` に入れる
- `apps/api/app/routers.py` — `list_community_sos` の serialize に `matched_user_ids` を渡す
- `apps/web/components/sos-panel.tsx` — `SosItem` 型に `matched_user_ids: string[]` を追加. 現在ログインしているユーザーのIDが `matched_user_ids` に含まれる場合, 「対応する」ボタンを強調色 (オレンジ背景) にし「あなたが答えられます」ラベルを追加

**受け入れ条件**
- `yuki` (数学系) がSOSを出したとき, 数学タグを持つ `haruto` の「対応する」ボタンが強調表示される
- タグが一致しないユーザーのボタンは通常表示のまま

---

### TASK-02: Sync タブのカウンターをライブ議論数に修正

**目的**
現状 `sync` タブのバッジ数が `dashboard.recommendations.length` (推薦人数) になっている.
正しくは「今ライブ議論中の件数」を表示すべき.

**変更ファイル**
- `apps/web/app/dashboard/page.tsx` の `tabCounts` 定義 (約322行目)

**変更内容**
```typescript
// Before
sync: dashboard.recommendations.length,

// After
sync: dashboard.events.filter((e) => e.is_live).length,
```

**受け入れ条件**
- ライブ議論が0件のとき sync タブのバッジは表示されない (または "0")
- ライブ議論が2件あるとき sync タブに "2" が表示される

---

### TASK-03: Overview に「今ライブ議論中」カードを追加

**目的**
overview 画面に Sync ビューへの入口がなく, 議論ボードの存在に気づかれにくい.
Active SOS / Network / 5分Sync の3カードに加えて「Sync Live」カードを追加し, sync ビューへ誘導する.

**変更ファイル**
- `apps/web/app/dashboard/page.tsx` の overview セクション (約470行目の3カードを4カードに拡張)

**変更内容**
既存の3カード配列に以下を追加:
```typescript
["Sync Live", dashboard.events.filter((e) => e.is_live).length, "今ここで議論中のトピック", isDark ? "bg-[#132d1d] text-[#7ee787]" : "bg-[#dafbe1] text-[#116329]"],
```
カードクリック時に `?view=sync` へ遷移するリンクにする.

**受け入れ条件**
- overview に4枚目のカードが表示される
- カードをクリックすると sync ビューに遷移する
- ライブ議論件数が正しく表示される

---

### TASK-04: SOS 返答・議論参加でポイント加算

**目的**
現状ポイントは `compute_user_points` で relationship の数から動的に計算されるのみ.
SOS に返答したとき・ライブ議論に参加したときに, ポイントが増える仕組みを作る.

**現状確認**
- `User` モデルに `points` カラムは存在しない (毎回 `compute_user_points` で計算)
- ゲーミフィケーションのインセンティブが「エッジを増やす」以外にない

**変更内容**

Step 1 — `User` モデルに `bonus_points` カラムを追加:
- `apps/api/app/models.py` に `bonus_points: Mapped[int] = mapped_column(Integer, default=0)` を追加
- `apps/api/alembic/versions/0005_bonus_points.py` を作成

Step 2 — ポイント計算を拡張:
- `apps/api/app/services.py` の `compute_user_points` で `user.bonus_points` を加算する

Step 3 — ポイント付与ロジックを追加:
- `apps/api/app/routers.py` の `respond_sos` エンドポイントで返答者に `+20` bonus_points を付与
- `apps/api/app/routers.py` の `join_event` エンドポイントで参加者に `+10` bonus_points を付与

**受け入れ条件**
- SOS に返答するとランキングのポイントが +20 増える
- ライブ議論に参加するとポイントが +10 増える
- `alembic upgrade head` が通る

---

### TASK-05: Network view — 自分起点のスター型強調表示

**目的**
現状 NetworkMap はすべてのノードを同色・同サイズで表示する.
ログインユーザーのノードを大きく表示し, 直接つながっている1ホップのエッジを強調色にすることで
「自分のクラス (スター型ネットワーク)」を視覚的に表現する.

**変更ファイル**
- `apps/web/components/network-map.tsx`

**変更内容**
- ログインユーザーのノードを半径 `r=14` (通常は `r=8`) で表示
- ログインユーザーに直接つながるエッジを `stroke: #1f883d, strokeWidth: 2` で強調
- 1ホップ以内のノードに薄いハイライト背景を追加
- ログインユーザーのノードラベルを太字にする

**受け入れ条件**
- ログインユーザーのノードが他より大きく表示される
- 直接の繋がりのエッジが緑色で目立つ
- 2ホップ以上のエッジはグレーのまま

---

## 優先度 2 — デモ品質向上

### TASK-06: プロフィール編集フォームをダッシュボードに追加

**目的**
学生が自分の `interests`, `goals`, `activity_tags` を編集できるUIがない.
スキルマッチの精度はタグの充実度に依存するため, 編集フォームは必須.

**変更ファイル**
- `apps/web/components/profile-edit-panel.tsx` (新規作成)
- `apps/web/app/dashboard/page.tsx` — overview ビューに追加

**コンポーネント仕様**
- 現在の interests / goals / activity_tags をカンマ区切りのテキストエリアで表示・編集
- 「保存」ボタンで `PATCH /api/proxy/v1/users/{id}` を呼ぶ
- TanStack Query の `useMutation` を使い, 成功後に dashboard を invalidate
- light / dark テーマ対応

**API**
`PATCH /v1/users/{user_id}` は既存. payload: `{ interests: string[], goals: string[], activity_tags: string[] }`

**受け入れ条件**
- overview 画面に自分のプロフィール編集セクションが表示される
- interests を編集して保存すると, network view のスキルタグに反映される
- 他人のプロフィールは編集できない (自分のIDと一致する場合のみ表示)

---

### TASK-07: 議論ボードの重複参加ガード

**目的**
TODO.mdに「議論ボードは基本的に一人一個しか参加できないはず」と記載あり.
現状は複数の議論に同時参加できてしまう.

**変更ファイル**
- `apps/api/app/routers.py` — `join_event` エンドポイント

**変更内容**
join_event の処理に以下を追加:
```python
# 同コミュニティで is_live=True かつ既に参加中の議論があれば 409 を返す
already_joined = db.scalar(
    select(Event)
    .where(Event.community_id == event.community_id)
    .where(Event.is_live == True)
    .where(Event.participant_ids.contains([context.user.id]))
    .where(Event.id != event_id)
)
if already_joined:
    raise HTTPException(status_code=409, detail="Already participating in another live discussion")
```

- `apps/web/components/discussion-board.tsx` — joinMutation の onError で「既に別の議論に参加中です」トースト表示

**受け入れ条件**
- 1つの議論に参加中に別の議論の「参加する」を押すと 409 エラーになる
- フロントにエラーメッセージが表示される

---

### TASK-08: SOS チャット後に「知見エッジ追加」ボタンを表示

**目的**
SOS チャットで問題が解決したとき, 自動的に「知見を交換した」エッジを提案する.
これによりポイントが増え, ネットワークグラフも充実する.

**変更ファイル**
- `apps/web/components/sos-panel.tsx`

**変更内容**
チャットが `resolved` 状態のとき, 「知見エッジを追加する」ボタンを表示.
ボタンクリックで `POST /api/proxy/v1/relationships` を呼ぶ:
```json
{
  "community_id": "...",
  "to_user_id": "<相手のID>",
  "type": "知見を交換した",
  "strength": 3
}
```
成功後はボタンをグレーアウトして「追加済み」に変更.

**受け入れ条件**
- チャット終了後に「知見エッジを追加する」ボタンが表示される
- ボタンを押すと network view に新しいエッジが追加される
- 重複追加しようとすると API が 400 を返しボタンが無効化される

---

## 優先度 3 — 将来実装 (デモ後)

### TASK-09: GPS 距離マッチング

**目的**
SOS 投稿・議論ボードのスコアに物理的な近さを組み込む.

**設計メモ**
- v1 は `navigator.geolocation` をユーザーが許可した場合のみ取得
- 緯度経度を `User` セッションに一時保存 (DB に永続化しない)
- SOS マッチングスコアに距離係数を掛ける (近いほど高スコア)
- HTTPS 環境必須なためデモ当日の動作確認が必要

---

### TASK-10: WebSocket 移行 (議論ボード)

**目的**
30秒ポーリングを WebSocket に移行し, 参加者数の変化をリアルタイムで反映する.

**設計メモ**
- `apps/api/app/routers.py` に既に `SosConnectionManager` が実装済み
- 同じパターンで `DiscussionConnectionManager` を作り `/ws/events/{community_id}` を追加
- フロントは `useEffect` + `WebSocket` で接続し, `onmessage` で TanStack Query キャッシュを更新

---

### TASK-11: AI 自動ルーティング (SOS → 最適回答者の自動通知)

**目的**
SOS 投稿内容を LLM で分析し, 最も適切な回答者に push 通知 (またはバナー表示) を送る.

**設計メモ**
- `POST /v1/sos` 時に Anthropic API (claude-haiku-4-5) で topic を分析
- コミュニティ内ユーザーの interests/goals と照合してトップ3を選定
- WebSocket で対象ユーザーにリアルタイム通知
- API キーは環境変数 `ANTHROPIC_API_KEY` で管理

---

## 実装順序の推奨

```
TASK-02 (5分)  → TASK-03 (15分) → TASK-05 (30分)
     ↓
TASK-01 (1h)   → TASK-04 (1h)   → TASK-06 (1h)
     ↓
TASK-07 (30分) → TASK-08 (30分)
     ↓
TASK-09, 10, 11 (デモ後)
```

## Claude への指示

各タスクを実装するには以下のコマンドを実行:

```bash
/prp-plan TODO.md
```

PRD ではなく TODO.md を渡すことで, 次の pending タスクの実装計画が生成されます.
完了したタスクには `✅` を付けて status を更新してください.

## 完了済みタスク (参考)

- ✅ 認証機能 (NextAuth + FastAPI JWT)
- ✅ ナレッジグラフ可視化 (D3.js force-directed)
- ✅ SOS 投稿・返答・チャット
- ✅ SOS → 対面議論昇格ボタン
- ✅ ライブ議論ボード (sync view, 30秒ポーリング)
- ✅ シラバス検索 (1808科目)
- ✅ レコメンデーション (bridge / complementary / similar)
- ✅ ゲーミフィケーション (ポイント計算・バッジ・ランキング)
- ✅ Alembic マイグレーション (0001〜0004)
- ✅ BFF パターン (Next.js → FastAPI プロキシ)
