# TODO — Knowledge Mesh 実装タスク

各 Issue は **完全に独立して作業できる単位**.
Issue をひとつ選んで中のタスクを上から順に実装すれば完結する.
フロントエンド・バックエンドを問わず, 1人で最初から最後まで完結できるよう記述してある.

---

## 優先度 1 — デモで必ず見せる機能

### Issue-35: Help — スレッドを開いた瞬間の自動メッセージを削除

**背景 (insight.md 追加 5/7 19:00 より)**
> Help に関してスレッドを開いた瞬間に「5分だけ一緒に見ます。ここで状況を教えてください。」っていきなり送らないようにしたい.

**ファイル**: `apps/api/app/services.py`

- [ ] `ensure_sos_chat` 関数内で `ChatMessage` を自動挿入している箇所を削除する

#### 動作確認

- [ ] スレッドを開いてもチャット欄が空で始まること
- [ ] 手動でメッセージを送ると通常通り表示されること

---

### Issue-36: Help — UI 細部修正 (placeholder / スレッド色)

**背景 (insight.md 追加 5/7 19:00 より)**
> Help のスレッドのコメントは placeholder が「返信を入力...」になっているけど「コメントを入力」にする.
> スレッドを開くについてだけど, 黒が今開いているもの, 青が開いていないものにしたい.

**ファイル**: `apps/web/components/sos-panel.tsx`

- [ ] チャット入力欄の `placeholder="返信を入力..."` → `placeholder="コメントを入力"` に変更
- [ ] スレッド開閉ボタンのスタイルを変更
  - 開いている (activeThread): 黒背景 / 白テキスト
  - 閉じている: 青テキスト / 透明背景

#### 動作確認

- [ ] placeholder が「コメントを入力」になっていること
- [ ] 開いているスレッドのボタンが黒, 閉じているものが青になっていること

---

### Issue-37: Help — タイムスタンプ表示

**背景 (insight.md 追加 5/7 19:00 より)**
> Help でスレッドのコメントは timestamp も追加していつ送られたかを記録したい.

**ファイル**: `apps/web/components/sos-panel.tsx`

- [ ] チャットメッセージ (`ChatMessage`) の `created_at` を各メッセージの横に表示する
  - フォーマット: `HH:MM` (当日) または `M/D HH:MM` (別日)

#### 動作確認

- [ ] 各コメントの横に送信時刻が表示されること

---

### Issue-38: Discussion — Active のみ表示 (Ended を非表示)

**背景 (insight.md 追加 5/7 19:00 より)**
> Ended を上に表示しない. Active を表示する.

**ファイル**: `apps/web/components/discussion-board.tsx`

- [ ] 議論一覧を `is_live === true` のものだけ表示するようにフィルタする
- [ ] `is_live === false` の Ended 議論は一覧から除外する (作成ボタン付近に「X 件終了」テキストのみ表示する形でもよい)

#### 動作確認

- [ ] Discussion タブに Ended の議論が表示されないこと
- [ ] Active の議論のみ一覧に出ること

---

### Issue-39: Discussion — Close 権限を作成者のみに制限

**背景 (insight.md 追加 5/7 19:00 より)**
> 依然として, Discussion を建てた人以外も Close できるようになっているので立てた人のみ Close できるようにする.

**ファイル**: `apps/api/app/routers.py`, `apps/web/components/discussion-board.tsx`

- [ ] バックエンド: `POST /v1/events/{id}/end` で `event.creator_user_id != context.user.id` の場合に 403 を返す
- [ ] フロントエンド: `event.creator_user_id === currentUserId` の場合のみ End ボタンを表示する

#### 動作確認

- [ ] 自分が作成した議論にのみ End ボタンが表示されること
- [ ] 他人の議論に End ボタンが表示されないこと
- [ ] 他人が API 直接呼び出しで End しようとすると 403 が返ること

---

### Issue-40: Discussion — 1ユーザー 1アクティブ議論に制限

**背景 (insight.md 追加 5/7 19:00 より)**
> 一人が複数の議論を建てられているようになっているが一つのみにする.

**ファイル**: `apps/api/app/routers.py`, `apps/web/components/discussion-board.tsx`

- [ ] バックエンド: `POST /v1/events` で `is_live=true` の場合, 同ユーザーが既に `is_live=true` のイベントを作成済みなら 409 を返す
- [ ] フロントエンド: 自分が既にアクティブな議論を持っている場合は作成ボタンを無効化 + 「既にアクティブな議論があります」を表示

#### 動作確認

- [ ] 1つ目の議論は作成できること
- [ ] 2つ目を作成しようとするとブロックされること
- [ ] 1つ目を End してから再作成できること

---

### Issue-41: Help — 複数スレッドを同時に展開できるようにする

**背景 (insight.md 追加 5/7 19:00 より)**
> 複数のスレッド開いたらそれぞれの Help に対してスレッドが表示されるようにする. 今は開いていたスレッドが上書きされる使用になってる.

**ファイル**: `apps/web/components/sos-panel.tsx`

- [ ] `activeThread: string | null` → `openThreadIds: Set<string>` に変更
- [ ] スレッドのトグルを `openThreadIds.has(id)` で判定するよう変更
- [ ] 複数スレッドが同時に展開されていても各スレッドのチャットが独立して表示されるよう修正

#### 動作確認

- [ ] 2つ以上のスレッドを同時に開けること
- [ ] それぞれのチャット内容が独立して表示されること
- [ ] 同じスレッドをもう一度クリックすると閉じること

---

## 優先度 2 — デモ品質向上

### Issue-19: Syllabus — 科目詳細に履修者・紐づき質問・議論を表示 (backend 未実装)

**背景 (insight.md 追加より)**
> Syllabus の各クラスをクリックしたらその詳細が出てきて, それを履修している人を表示させる.
> また議論や質問も紐づいていたら表示させる.

**進捗**: フロントエンドの展開パネル・基本詳細 (授業内容・授業計画・単位) は実装済み.
バックエンドの `enrolled_users` / `linked_sos` / `linked_events` フィールドが未実装.

**ファイル**: `apps/api/app/routers.py`, `apps/api/app/services.py`, `apps/web/components/syllabus-panel.tsx`

#### バックエンド

- [ ] `apps/api/app/schemas.py` の `CourseOut` に以下を追加
  ```python
  enrolled_users: list[UserProfileOut] = []
  linked_sos: list[SosOut] = []
  linked_events: list[EventOut] = []
  ```
- [ ] `apps/api/app/services.py` の `get_course_detail` を拡張
  - `enrolled_users`: `CourseDepartment.name` が `User.group_code` に含まれるユーザーを返す
  - `linked_sos`: `SosRequest.tags` または `topic` が科目タイトル / トピックと重複するものを返す
  - `linked_events`: `Event.title` が科目名と重複するものを返す (簡易キーワードマッチ)

#### フロントエンド

- [ ] `apps/web/components/syllabus-panel.tsx` の `CourseDetail` 型に追加
  ```ts
  enrolled_users: Array<{ id: string; name: string; group_label: string }>;
  linked_sos: Array<{ id: string; topic: string; tags: string[]; status: string }>;
  linked_events: Array<{ id: string; title: string; participant_names: string[] }>;
  ```
- [ ] 展開パネルに以下を追加表示
  - 履修者: 名前バッジ一覧
  - 紐づき質問カード (トピック + タグ + status バッジ)
  - 紐づき議論カード (タイトル + 参加者数)
- [ ] データなしの場合は「まだ質問・議論はありません」を表示

#### 動作確認

- [ ] 展開パネルに履修者リストが表示されること
- [ ] 展開パネルに紐づき質問・議論が表示されること
- [ ] 紐づきデータがない科目で空状態メッセージが出ること

---

### Issue-42: キャンパス明示フィルタリング

**背景 (insight.md 追加 5/7 19:00 より)**
> キャンパスによって質問や議論がフィルタされていると思うけどそれを暗黙的にやらないようにする.
> プロフィール編集の中にキャンパス情報を一つ選択して入れられるようにする.
> またそれによって Discussion や Help も明示的にフィルタできるようにする.

**ファイル**: `apps/web/components/sos-panel.tsx`, `apps/web/components/discussion-board.tsx`, `apps/web/components/profile-edit-panel.tsx`, `apps/web/app/dashboard/page.tsx`

- [ ] `SosPanel` にコミュニティ (キャンパス) セレクターを追加し, 選択したコミュニティの質問のみ表示する
- [ ] `DiscussionBoard` に同様のコミュニティフィルターを追加
- [ ] `ProfileEditPanel` にキャンパス選択 (所属コミュニティ切り替え) UIを追加
- [ ] `me.communities` を使って参加済みコミュニティ一覧をセレクターに表示

#### 動作確認

- [ ] キャンパスを切り替えると Help/Discussion の表示が切り替わること
- [ ] 「全キャンパス」表示オプションがあること

---

### Issue-43: Discussion — 予定 Discussion 機能

**背景 (insight.md 追加 5/7 19:00 より)**
> 何時間後に Discussion 行いますっていう予定も建てられるようにしたい.
> また毎週月曜日の 20:00 からとかも設定できるようにしたい.
> そしてその予定も表示させるようにする.

**設計メモ** (実装コスト大)

- [ ] `Event` モデルに `scheduled_at: datetime | null` と `recurrence: str | null` (例: `"weekly:MON:20:00"`) カラムを追加 (新規 migration)
- [ ] `EventUpsert` スキーマに `scheduled_at` と `recurrence` を追加
- [ ] `DiscussionBoard` の作成フォームに日時入力と繰り返し設定 UI を追加
- [ ] 予定済み議論を「予定一覧」セクションとして別表示する

#### 動作確認

- [ ] 将来の日時を指定して議論を予定できること
- [ ] 予定一覧に表示されること
- [ ] 当日時刻になると自動的に Active 扱いになること (or 手動開始ボタン)

---

### Issue-18: Help — 画像添付機能

**背景 (insight.md より)**
> また画像も添付できるようにする.

**設計メモ** (実装コスト高めのため後回し)

- [ ] フロント: `<input type="file" accept="image/*">` で画像を選択
- [ ] バックエンド: multipart/form-data で受け取り, base64 or object storage に保存
- [ ] `SosRequest` モデルに `image_url: str | null` カラムを追加 (migration 0007)
- [ ] チャットメッセージにも画像添付を拡張 (optional)

#### 動作確認

- [ ] Help の投稿フォームに画像添付ボタンがあること
- [ ] 投稿されたカードに添付画像のサムネイルが表示されること
- [ ] 非画像ファイルを添付しようとするとバリデーションエラーになること

---

## 優先度 3 — 将来実装 (デモ後)

### Issue-14: GPS 距離マッチング (PDFスライド20「SHORT v2」)

**設計メモ**

- `navigator.geolocation` で緯度経度を取得 (ユーザー許可が必要)
- セッションに一時保存, SOS マッチングスコアに距離係数を掛ける
- HTTPS 環境必須

---

### Issue-15: 大学間連携 (PDFスライド20「LONG」)

**設計メモ**

- 複数コミュニティをまたいだ関係グラフの federation
- OAuth / OIDC でのマルチテナント認証設計が前提

---

## デモ時の注意事項

PDFスライド9「接続コストを最小化する設計」で示されるフロー:

```
① SOS投稿 (10秒) → ② チャット → ③ 対面議論昇格 → ④ Discussion ボードで乱入
```

- デモ推奨アカウント: `tanaka.sensei` + `yuki` + `haruto` (全員 `campus-east`)
- `saki` / `suzuki.sensei` は `campus-west` のため Discussion イベントは共有されない (仕様)
- Discussion ボードはコミュニティ単位でリアルタイム同期 (WebSocket)
- **コード変更後はコンテナの再ビルドが必要**: `docker compose up --build`

---

## 実装順序の推奨

```
【クイック修正バッチ — 合計 1〜2h】
Issue-35  Help 自動メッセージ削除          (15分)
Issue-36  Help placeholder / スレッド色    (15分)
Issue-37  Help タイムスタンプ              (15分)
Issue-38  Discussion Active のみ表示       (15分)
Issue-39  Discussion Close 権限制限        (30分)
Issue-40  Discussion 複数議論制限          (30分)
     ↓
【中規模】
Issue-41  Help 複数スレッド同時展開        (1h)
Issue-19  Syllabus 詳細 backend 拡張       (2h)
     ↓
【大規模】
Issue-42  キャンパスフィルタリング         (2-3h)
Issue-43  予定 Discussion                  (3h+)
Issue-18  Help 画像添付                    (工数大)
     ↓
Issue-14, 15  GPS / 大学間連携             (デモ後)
```

---

## 完了済みタスク

### Issue-29: ヘッダーの検索欄を削除 ✅

- `apps/web/app/dashboard/page.tsx` のヘッダー `<form action="/dashboard">` 検索フォームを削除
- Syllabus タブ内のサイドバー検索フォームは引き続き動作

### Issue-33: My Class — スキルツリーの初期値を interests + 質問タグに変更 ✅

- `skillTags={[...new Set([...me.user.interests, ...(dashboard.my_skill_tags ?? [])])]}` に変更
- interests を先頭に置き, SOS 質問タグを後続追加, 重複は Set で排除

### Issue-31: Syllabus 検索 — 全件表示 & ページネーション ✅

- バックエンド: `schemas.py` に `CourseListPage(items, total)` を追加
- バックエンド: `services.py` の `list_courses` に `offset` パラメータ追加, `select(func.count())` で総件数取得
- バックエンド: `GET /v1/courses` を `CourseListPage` レスポンスに変更 (デフォルト 20件/ページ)
- フロントエンド: `loadDashboard` に `?page=` URL param を追加
- フロントエンド: `SyllabusPanel` に `currentPage / totalItems / pageSize / prevPageHref / nextPageHref` props を追加
- フロントエンド: 前ページ / 次ページ ボタン + 「X / Y ページ (N件)」表示を追加

### Issue-32: プロフィール編集を専用ページに変更 ✅

- `apps/web/app/profile/page.tsx` を新規作成 (`/v1/me` fetch → `ProfileEditPanel` フルページ表示)
- `apps/web/components/header-profile.tsx` を `<a href="/profile">` シンプルリンクに変更 (overlay 削除)
- `/profile` ページに「← ダッシュボードに戻る」ナビゲーション設置

### Issue-27: Help — Close 権限バグ修正 ✅

- バックエンド: `req.user_id != context.user.id` の場合に 403 を返すガードを実装
- フロントエンド: `item.user_id === currentUserId` の場合のみ Close ボタンを表示

### Issue-25: Light/Dark モード切り替えを削除 ✅

- `ThemeName` 型, `normalizeTheme`, `isDark`, `colors` オブジェクトを全て削除
- テーマ切り替えボタンをヘッダーから削除
- 全コンポーネント (`sos-panel`, `discussion-board`, `my-class-panel`, `skill-tree`, `profile-edit-panel`) の `theme` props を削除し Light スタイルにハードコード
- `page.tsx` からも `theme` URL param / form hidden input を削除

### Issue-21: Syllabus — 謎のアイコンを修正 ✅

- `CourseIllustration` SVG のオレンジ色 + 円アイコンを削除
- タブナビゲーションのビジュアルアイコン (`#`, `?`, `@` など) を削除してすっきりさせた

### Issue-24: バグ — 検索欄で検索後に文字が残る ✅

- `href` ヘルパーで `targetView !== "syllabus"` の場合に `q: undefined` を渡すよう修正
- Syllabus 以外のタブに移動すると URL から `?q=` が消えるため再表示時に空になる

### Issue-28: Help — 複数タグフィルター (toggle on/off) ✅

- `activeTag: string | null` → `activeTags: Set<string>` に変更
- `toggleTag(tag)` 関数で Set への追加 / 削除を実装
- フィルタリングロジックを OR 条件に変更
- アクティブなタグバッジを強調表示, 「× クリア」ボタンで全解除

### Issue-20: Migration — デモ用シードデータ増強 ✅

- `campus-east` ユーザーを 7名 → 20名に拡張 (情報・数学・物理の各学年)
- `campus-west` ユーザーを 6名 → 15名に拡張 (デザイン・社会・経済・心理等)
- SOS 質問を 102件追加 (active 88 / resolved 14, タグ付き 2〜3個/件)
- Discussion イベントを 20件追加 (ライブ 16件, location / creatorUserId 付き)
- `apps/api/app/scripts/seed.py` に `SosRequest`, `SosResponse` シーディングを追加
- `Event` の `is_live`, `location`, `creator_user_id` もシードに反映

### Issue-22: My Class — スキルツリーをメイン表示, ネットワーク削除 ✅

- `NetworkMap` (D3.js) を `MyClassPanel` から完全削除
- `SkillTree` をメイン上部に配置
- スキルツリーのタグクリックでそのタグを持つクラスメイトを下部に一覧表示
- タグ未選択時は全クラスメイトを表示

### Issue-23: ユーザープロフィール閲覧機能 ✅

- `my-class-panel.tsx` にインライン `ProfileModal` コンポーネントを実装
- 表示内容: 名前, groupLabel, bio, interests / goals / activityTags バッジ, 接続数, 自分バッジ
- クラスメイトカードクリックでモーダルを開く
- 「My Profile」カードから自分のプロフィールも閲覧可能
- `Node` 型に `bio?`, `interests?`, `goals?`, `activityTags?` を追加
- `page.tsx` で nodes に bio / interests / goals / activityTags を渡すよう修正

### Issue-26: ヘッダーアイコンをクリックしてプロフィール編集 ✅

- `apps/web/components/header-profile.tsx` を新規作成
- ヘッダーの名前/ロールをクリックすると `ProfileEditPanel` がスライドパネルで開く
- バックドロップクリックで閉じる
- → Issue-32 で専用ページに昇格

### Issue-19: Syllabus — 科目詳細パネル (基本情報) ✅ / backend 拡張は継続

- `apps/web/components/syllabus-panel.tsx` を新規作成
- 科目カードクリックで詳細を展開表示 (`GET /api/proxy/v1/courses/{id}` をクライアントサイドで fetch)
- 表示内容: 授業内容 (contents), 授業計画 (lecture_plan リスト), 単位・対象年次
- 履修者・紐づき質問・議論の表示は backend 未実装として継続

---

### Issue-16: Home — Overview 再設計 ✅

- ホーム見出し・サブコピーを「SOS/GPS」表現から学習コミュニティの入口に書き換え
- GPS/物理距離に言及するコピーを全て削除
- Help / Discussion / My Class / Syllabus の 4 枚サマリーカードに整理
- 各カードクリックで対応ビューに遷移

### Issue-11: Discussion — 場所フィールドを復元 ✅

- `location` state を復元
- フォームを 3 カラムグリッド (場所 / トピック / ボタン) に変更
- イベントカードで `📍 {event.location}` を表示

### Issue-02: Help — タグの DB 永続化 ✅

- `SosRequest` に `tags: Mapped[list[str]]` カラム追加, migration 0006 適用
- `SosCreate` / `SosOut` に `tags: list[str]` 追加
- フロントで tags をバッジ表示

### Issue-17: Help — タグによる質問フィルタリング (単一タグ) ✅

- `activeTag` state を追加, タグバッジクリックでフィルタ
- フィルター中バナーと「× クリア」ボタンを表示
- ※ 複数タグ対応は Issue-28 で完了

### Issue-03: Help — 投稿者による Close 機能 ✅

- `POST /sos/{request_id}/close` エンドポイント追加 (投稿者以外は 403)
- フロントで自分の投稿にのみ Close ボタンを表示
- Close 後にバッジが「Closed」に変わる

### Issue-01: NetworkMap → My Class — 自分起点スター型強調 ✅

- ログインユーザーのノードを半径 `r=14` で描画
- 直接つながるエッジを `stroke: #1f883d, strokeWidth: 2.5` で強調

### Issue-04: Help — SOS スキルマッチで回答者をハイライト ✅

- `SosOut.matched_user_ids: list[str]` 追加
- Jaccard similarity によるマッチング
- sos-panel.tsx で強調バッジ表示

### Issue-05: ポイント加算 — SOS 返答・議論参加時 ✅

- `User.bonus_points` カラム追加, migration 0005 適用
- `respond_sos` で +20, `join_event` で +10 ポイント付与

### Issue-06: My Class — プロフィール編集パネルを追加 ✅

- `apps/web/components/profile-edit-panel.tsx` 新規作成
- `PATCH /api/proxy/v1/users/{id}` で interests / goals / activity_tags を更新

### Issue-07: My Class — スキルツリーに過去の質問タグを自動生成 ✅

- `DashboardOut` に `my_skill_tags: list[str]` を追加
- `GET /communities/{id}/dashboard` で自分の過去 SOS 質問タグを集計して返す
- `<MyClassPanel>` の `skillTags` を `dashboard.my_skill_tags` に変更

### Issue-08: Discussion — 重複参加ガード ✅

- `join_event / create_event` に 409 ガード追加
- フロントで `alreadyInTopic` フラグによるボタン無効化

### Issue-09: Home タブ — Discussion カードを追加・タブカウンター修正 ✅

- `tabCounts` を `dashboard.events.filter((e) => e.is_live).length` に修正
- Home ビューに「Sync Live」カードを追加

### Issue-10: Help — チャット解決後に知見エッジ追加ボタンを表示 ✅

- `resolved` 状態のチャットに「🔗 知見エッジを追加する」ボタン表示
- `POST /api/proxy/v1/relationships` でエッジ追加

### Issue-12: WebSocket 移行 (議論ボード) ✅

- `/v1/ws/events/{community_id}` WebSocket エンドポイント
- create / join / end で `events_manager.broadcast` 呼び出し
- refetchInterval 8 秒, refetchOnMount / refetchOnWindowFocus 有効化

### Issue-13: AI 自動ルーティング (SOS → 最適回答者の自動通知) ✅

- Claude Haiku によるトピック分析
- WebSocket で対象ユーザーへリアルタイム通知

---

その他の完了済み基盤機能:

- ✅ 認証機能 (NextAuth + FastAPI JWT)
- ✅ ナレッジグラフ可視化 (D3.js force-directed, スター型強調)
- ✅ SOS 投稿・返答・チャット
- ✅ SOS → 対面議論昇格ボタン
- ✅ SOS スキルマッチ (Jaccard similarity + ハイライト)
- ✅ ライブ議論ボード (WebSocket リアルタイム + 8 秒ポーリング)
- ✅ 議論ボード重複参加ガード (create / join 両方)
- ✅ 知見エッジ追加ボタン (SOS resolved 後)
- ✅ プロフィール編集パネル (interests / goals / activity_tags)
- ✅ ボーナスポイント (SOS返答 +20, 議論参加 +10)
- ✅ AI 自動ルーティング (Claude Haiku, ANTHROPIC_API_KEY 任意)
- ✅ NetworkMap スター型強調 (自分ノード大, 直接エッジ緑)
- ✅ シラバス検索 (1808 科目, ページネーション付き)
- ✅ レコメンデーション (bridge / complementary / similar)
- ✅ ゲーミフィケーション (ポイント計算・バッジ・ランキング)
- ✅ Alembic マイグレーション (0001〜0006)
- ✅ BFF パターン (Next.js → FastAPI プロキシ)
- ✅ ページ構成刷新 (Home / Help / Discussion / My Class / Syllabus)
