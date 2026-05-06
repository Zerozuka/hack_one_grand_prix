# TODO — Knowledge Mesh 実装タスク

各 Issue は **完全に独立して作業できる単位**.
Issue をひとつ選んで中のタスクを上から順に実装すれば完結する.
フロントエンド・バックエンドを問わず, 1人で最初から最後まで完結できるよう記述してある.

---

## 優先度 1 — デモで必ず見せる機能

### Issue-16: Home — 「高校のクラスで議論していたあの感覚」に寄せた Overview 再設計

**背景 (insight.md より)**
> 現在の Home Overview は一目見ると SOS を出して知見ネットワークで5分接続するのだろうかという
> ふうに見える. 大学生が高校の頃のように切磋琢磨して議論・質問できる場所に見せたい.

また「数学・情報・物理系の知見ネットワークをベースに、物理的に近い人をすばやく見つける」という
文言は GPS 機能が未実装のため **誤解を招く表現** なので削除する.

**ファイル**: `apps/web/app/dashboard/page.tsx`

- [ ] Home ビューのヒーロー見出し・サブコピーを書き換える
  - Before: 「SOS を出して...知見ネットワーク...5分接続」
  - After: 「今日も誰かが困っている. 5分の会話で, 理解が変わる.」などの表現
- [ ] GPS/物理距離に言及するコピーを全て削除する
- [ ] 3〜4枚のサマリーカードを以下の内容に整理する

  | カード | 表示内容 | リンク先 |
  |--------|----------|----------|
  | Help | アクティブな質問数 | `?view=help` |
  | Discussion | ライブ議論数 | `?view=discussion` |
  | My Class | 自分のネットワーク人数 | `?view=my-class` |
  | Syllabus | 科目数 (任意) | `?view=syllabus` |

- [ ] 各カードをクリックするとそのビューに遷移することを確認
- [ ] Home の印象が「SOS ツール」ではなく「学習コミュニティの入口」に変わっていることを確認

---

### Issue-11: Discussion — 場所フィールドを復元する (リグレッション修正)

**背景**
PDFスライド17「議論ボード」では「📍 中央食堂で統計学の議論中」と **場所情報** が核心UXとして
示されている. 自動整形ツールが場所入力フィールドを削除したため復元が必要.

**ファイル**: `apps/web/components/discussion-board.tsx`

- [ ] `location` state を復元: `const [location, setLocation] = useState("")`
- [ ] `createMutation` の body を修正

  ```typescript
  body: JSON.stringify({
    community_id: communityId,
    title: newTopic,
    time_label: "今すぐ",
    format: "対面議論",
    is_live: true,
    location: location.trim() || null,
  }),
  ```

  成功後に `setLocation("")` もリセット.
- [ ] フォームを3カラムグリッドに変更 (場所 / トピック / ボタン)

  ```tsx
  <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
    <input
      value={location}
      onChange={(e) => setLocation(e.target.value)}
      placeholder="場所 (例: 中央食堂, 図書館3F)"
      className={cx(...)}
    />
    <input
      value={newTopic}
      onChange={(e) => setNewTopic(e.target.value)}
      placeholder="トピック (例: 統計学の検定手法)"
      className={cx(...)}
    />
    <button ...>議論を始める</button>
  </div>
  ```

- [ ] イベントカードで `📍 {event.location}` が表示されることを確認
- [ ] 場所なし (空欄) でも投稿可能 (optional フィールド) であることを確認

---

### Issue-02: Help — タグのDB永続化

**背景 (insight.md より)**
> 質問タグは複数つけることができるようにする. 例えば「微分方程式」「線形代数」「Python」など.
> タグを押すと同じタグの質問を探すことができるようにする.

**概要**: 質問投稿時のタグをDBに保存し, 一覧取得時に返す. Issue-17 (タグ検索) の前提.

#### バックエンド — `apps/api/`

- [ ] `apps/api/app/models.py` の `SosRequest` に tags カラムを追加

  ```python
  tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
  ```

- [ ] `apps/api/alembic/versions/0006_sos_tags.py` を新規作成

  ```python
  def upgrade():
      op.add_column(
          "sos_requests",
          sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
      )
  def downgrade():
      op.drop_column("sos_requests", "tags")
  ```

- [ ] `apps/api/app/schemas.py` の `SosCreate` に `tags: list[str] = []` を追加
- [ ] `apps/api/app/schemas.py` の `SosOut` に `tags: list[str] = []` を追加
- [ ] `apps/api/app/routers.py` の `create_sos` で `SosRequest(... tags=body.tags)` を追加
- [ ] `apps/api/app/routers.py` の serialize 部分に `tags=req.tags` を追加
- [ ] `alembic upgrade head` を実行してマイグレーションを適用

#### フロントエンド — `apps/web/components/sos-panel.tsx`

- [ ] `HelpItem` 型に `tags: string[]` を追加
- [ ] 各 Help カードで `item.tags` をバッジとして表示する
- [ ] タグのローカル state (`itemTags`) を廃止する (APIから取得した値を使う)
- [ ] 投稿フォームの `tags: questionTags` はそのまま (変更なし)
- [ ] Help タブで投稿 → リロード後もタグがカードに表示されることを確認

---

### Issue-17: Help — タグによる質問フィルタリング

**背景 (insight.md より)**
> タグを押すと同じタグの質問を探すことができるようにする.

**前提**: Issue-02 完了後に着手.

**ファイル**: `apps/web/components/sos-panel.tsx`

- [ ] `activeTag: string | null` の state を追加
- [ ] 質問カード内のタグバッジをクリックすると `activeTag` にセットする

  ```tsx
  <button
    onClick={() => setActiveTag(tag === activeTag ? null : tag)}
    className={cx(
      "rounded-full px-2 py-0.5 text-xs font-bold transition",
      tag === activeTag ? "bg-orange-500 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
    )}
  >
    {tag}
  </button>
  ```

- [ ] Help 一覧を `activeTag` でフィルタリング

  ```tsx
  const filtered = activeTag
    ? sosItems.filter((item) => item.tags.includes(activeTag))
    : sosItems;
  ```

- [ ] アクティブなタグの上部に「{activeTag} でフィルター中」バナーと「× クリア」ボタンを表示
- [ ] タグをもう一度押すとフィルターが解除されることを確認

---

### Issue-03: Help — 投稿者による Close 機能

**背景 (insight.md より)**
> 解決した質問に対しては Github のように Close することができる.

#### バックエンド — `apps/api/app/routers.py`

- [ ] `POST /sos/{request_id}/close` エンドポイントを追加

  ```python
  @router.post("/sos/{request_id}/close")
  async def close_sos(
      request_id: str,
      context: Context = Depends(get_context),
      db: Session = Depends(get_db),
  ):
      req = db.get(SosRequest, request_id)
      if req is None:
          raise HTTPException(404, "SOS request not found")
      if req.user_id != context.user.id:
          raise HTTPException(403, "Only the author can close this request")
      req.status = SosStatus.resolved
      req.resolved_at = datetime.utcnow()
      db.commit()
      db.refresh(req)
      return serialize_sos(req, context.user.id, db)
  ```

- [ ] `curl -X POST /api/v1/sos/{id}/close` で 200 が返ることを確認
- [ ] 他人の質問に対して 403 が返ることを確認

#### フロントエンド — `apps/web/components/sos-panel.tsx`

- [ ] 自分の投稿にのみ「Close」ボタンを表示 (GitHub の Issue Close に近いデザイン)
- [ ] `POST /api/proxy/v1/sos/${requestId}/close` を呼ぶ

  ```ts
  const res = await fetch(`/api/proxy/v1/sos/${requestId}/close`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  ```

- [ ] Close するとカードのステータスが `resolved` に変わり, バッジが「Closed」になることを確認

---

## 優先度 2 — デモ品質向上

### ✅ Issue-01: NetworkMap → My Class — 自分起点スター型強調

**ファイル**: `apps/web/components/network-map.tsx`

- [x] ログインユーザーのノードを半径 `r=14` で描画 (通常は `r=8`)
- [x] 直接つながるエッジを `stroke: #1f883d, strokeWidth: 2.5` で強調
- [x] 他のエッジは `stroke: #888, strokeWidth: 1` のまま

---

### ✅ Issue-04: Help — SOS スキルマッチで回答者をハイライト

- [x] `SosOut.matched_user_ids: list[str]` 追加
- [x] Jaccard similarity によるマッチング
- [x] sos-panel.tsx で強調バッジ表示

---

### ✅ Issue-05: ポイント加算 — SOS返答・議論参加時

- [x] `User.bonus_points` カラム追加, migration 0005 適用済み
- [x] `respond_sos` で `+20`, `join_event` で `+10` ポイント付与

---

### ✅ Issue-06: My Class — プロフィール編集パネルを追加

- [x] `apps/web/components/profile-edit-panel.tsx` 新規作成
- [x] `PATCH /api/proxy/v1/users/{id}` で interests / goals / activity_tags を更新

---

### Issue-07: My Class — スキルツリーに過去の質問タグを自動生成

**背景 (insight.md より)**
> My Class の下部には自分のスキルツリー (自分が今まで質問してきた内容をもとに自動的に生成される)
> を表示する. それらのスキルツリーの要素を押すと, それに関連したネットワークが表示される.

**前提**: Issue-02 完了後に着手.

#### バックエンド — `apps/api/`

- [ ] `DashboardOut` に `my_skill_tags: list[str] = []` を追加
- [ ] `GET /communities/{id}/dashboard` で自分の過去SOS質問タグを集計

  ```python
  my_requests = db.scalars(
      select(SosRequest).where(SosRequest.user_id == actor_id)
  ).all()
  my_skill_tags = list(dict.fromkeys(tag for req in my_requests for tag in (req.tags or [])))
  ```

- [ ] レスポンスに `my_skill_tags` を含めて返す

#### フロントエンド — `apps/web/app/dashboard/page.tsx`

- [ ] `DashboardData` 型に `my_skill_tags?: string[]` を追加
- [ ] `<MyClassPanel>` の `skillTags` を `dashboard.my_skill_tags ?? me.user.activity_tags` に変更

#### フロントエンド — My Class のスキルツリー

- [ ] スキルタグをクリックすると NetworkMap をそのタグでフィルタリングする
  - `selectedSkillTag: string | null` を state に持つ
  - NetworkMap の `props` に `filterTag?: string` を追加
  - `filterTag` が指定されると, そのタグを持つユーザーに繋がるエッジのみ表示

---

### ✅ Issue-08: Discussion — 重複参加ガード

- [x] `join_event / create_event` に 409 ガード追加済み
- [x] フロントで `alreadyInTopic` フラグによるボタン無効化

---

### ✅ Issue-09: Home タブ — Discussion カードを追加・タブカウンター修正

- [x] `tabCounts` を `dashboard.events.filter((e) => e.is_live).length` に修正
- [x] Home ビューに「Sync Live」カードを追加

---

### ✅ Issue-10: Help — チャット解決後に知見エッジ追加ボタンを表示

- [x] `resolved` 状態のチャットに「🔗 知見エッジを追加する」ボタン表示
- [x] `POST /api/proxy/v1/relationships` でエッジ追加

---

### Issue-18: Help — 画像添付機能

**背景 (insight.md より)**
> また画像も添付できるようにする.

**設計メモ** (実装コスト高めのため後回し)

- フロント: `<input type="file" accept="image/*">` で画像を選択
- バックエンド: multipart/form-data で受け取り, base64 or object storage に保存
- `SosRequest` モデルに `image_url: str | null` カラムを追加 (migration 0007)
- チャットメッセージにも画像添付を拡張 (optional)

**受け入れ条件**

- Help の投稿フォームに画像添付ボタンがある
- 投稿されたカードに添付画像のサムネイルが表示される

---

## 優先度 3 — 将来実装 (デモ後)

### ✅ Issue-12: WebSocket 移行 (議論ボード)

- [x] `/v1/ws/events/{community_id}` WebSocket エンドポイント
- [x] create / join / end で `events_manager.broadcast` 呼び出し
- [x] refetchInterval 8秒, refetchOnMount / refetchOnWindowFocus 有効化

---

### ✅ Issue-13: AI 自動ルーティング (SOS → 最適回答者の自動通知)

- [x] Claude Haiku によるトピック分析
- [x] WebSocket で対象ユーザーへリアルタイム通知

---

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

---

## 実装順序の推奨

```
[完了] Issue-01, 04, 05, 06, 08, 09, 10, 12, 13
     ↓
Issue-16 (30分, Home コピー修正)   ← insight: 第一印象を変える
Issue-11 (30分, 場所フィールド復元) ← regression 修正
     ↓
Issue-02 (1h, タグDB) → Issue-17 (1h, タグ検索) → Issue-03 (30分, Close)
     ↓
Issue-07 (1h, スキルツリー) ← Issue-02 依存
     ↓
Issue-18 (画像添付, 工数大) → Issue-14, 15 (デモ後)
```

---

## 完了済みタスク (参考)

- ✅ 認証機能 (NextAuth + FastAPI JWT)
- ✅ ナレッジグラフ可視化 (D3.js force-directed, スター型強調)
- ✅ SOS 投稿・返答・チャット
- ✅ SOS → 対面議論昇格ボタン
- ✅ SOS スキルマッチ (Jaccard similarity + ハイライト)
- ✅ ライブ議論ボード (WebSocket リアルタイム + 8秒ポーリング)
- ✅ 議論ボード重複参加ガード (create / join 両方)
- ✅ 知見エッジ追加ボタン (SOS resolved 後)
- ✅ プロフィール編集パネル (interests / goals / activity_tags)
- ✅ ボーナスポイント (SOS返答 +20, 議論参加 +10)
- ✅ AI自動ルーティング (Claude Haiku, ANTHROPIC_API_KEY 任意)
- ✅ NetworkMap スター型強調 (自分ノード大, 直接エッジ緑)
- ✅ シラバス検索 (1808科目)
- ✅ レコメンデーション (bridge / complementary / similar)
- ✅ ゲーミフィケーション (ポイント計算・バッジ・ランキング)
- ✅ Alembic マイグレーション (0001〜0005)
- ✅ BFF パターン (Next.js → FastAPI プロキシ)
- ✅ ページ構成刷新 (Home / Help / Discussion / My Class / Syllabus)
