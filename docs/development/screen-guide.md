# Knowledge Mesh Screen Guide

`docker compose up --build` のあとに `http://localhost:8080` を開くと、Knowledge Mesh のデモを確認できます。

## Login

ログイン画面では通常ログインとデモアカウントログインが使えます。

| Account | Password | Role |
|---|---|---|
| `tanaka.sensei` | `demo1234` | 教員 / 管理者 |
| `suzuki.sensei` | `demo1234` | 教員 / 管理者 |
| `yuki` | `demo1234` | 学生 |
| `haruto` | `demo1234` | 学生 |
| `saki` | `demo1234` | 学生 |

## Dashboard

ログイン後は `/dashboard` に遷移します。上部タブから主要画面を切り替えます。

| View | URL param | Purpose |
|---|---|---|
| Home | `view=home` | 現在の活動状況と次に押すべき導線 |
| Help | `view=help` | 困りごとの投稿、タグ検索、スレッド会話 |
| Discussion | `view=discussion` | 今すぐ/予定 Discussion の作成と参加 |
| My Class | `view=my-class` | スキルツリーとクラスメイト探索 |
| Syllabus | `view=syllabus` | シラバス検索と科目詳細 |

## Home

Home はデモの入口です。

- Active Help、Live Discussion、My Class、Syllabus の件数を確認できます。
- 「今すぐできること」から Help、Discussion、My Class に直接移動できます。
- ヘッダーの通知から、自分に関係する質問や Discussion を確認できます。

## Help

Help は「困っていること」を投稿する画面です。

- 質問本文を入力して投稿できます。
- タグを複数追加できます。
- タグ入力中は prefix が一致する候補が表示されます。
- 投稿済み質問はタグでフィルタできます。
- 回答者がつくとスレッドを開き、コメントできます。
- スレッド内から「議論しませんか？」を送り、Discussion に発展させられます。
- 会話後にコネクション追加の確認ができます。

## Discussion

Discussion は「今または予定された議論」を扱う画面です。

- `今すぐ` を選ぶと Live Discussion を作成できます。
- `予定を立てる` を選ぶと日時指定の予定 Discussion を作成できます。
- 毎週くり返しの予定も指定できます。
- 呼ぶ友達は名前、所属、タグで絞り込めます。
- おすすめ場所を確認し、`ここにする` で場所欄へ反映できます。
- 参加者は詳細、添付画像、コメントスレッド、リアクションを確認できます。
- Discussion 作成者だけが終了できます。

## My Class

My Class は自分の周りの知識ネットワークを見る画面です。

- 自分の興味や質問履歴由来のスキルツリーを確認できます。
- スキルを押すと、そのタグに近いクラスメイトを絞り込めます。
- `今いける`、`あとでOK`、`詳しい人` で探し方を切り替えられます。
- クラスメイトのプロフィールから Help または Discussion に進めます。

## Syllabus

Syllabus は授業データを検索する画面です。

- 科目名、教員名、授業内容で検索できます。
- 検索結果はページネーションで確認できます。
- 科目を開くと授業計画や詳細情報を確認できます。
- 今後は科目に紐づく質問、議論、履修者をより強く出す想定です。

## Admin

管理者ロールでログインするとヘッダーに `Admin` が表示されます。

- コミュニティ、ユーザー、関係性、イベント、コースを確認できます。
- コースデータのインポートや監査ログ確認のための土台があります。

## Demo Flow

発表で見せる場合は、次の順番が最も伝わりやすいです。

1. Home で「Help / Discussion / My Class」が主役であることを見せる。
2. Help で困りごとを投稿し、タグ候補とスレッドを見せる。
3. スレッドから Discussion に発展できることを見せる。
4. Discussion で場所、参加者、予定作成を見せる。
5. My Class で「知識ネットワークが行動につながる」ことを見せる。
