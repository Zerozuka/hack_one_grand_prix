# Plan: Live Discussion Board (全フェーズ)

## Summary
Event モデルを拡張してライブ議論機能を追加する. SOS チャットから対面議論に昇格できるボタンと, 独立投稿フォームを持つ `sync` ビューを実装する. 5 フェーズすべてをカバーする.

## User Story
As a 学生, I want SOS チャットから「対面で議論しよう」と押して場所を入力し, sync ボードに表示させることで, 他の学生がリアルタイムに参加できる, so that AI ではなく人との深い議論による理解が得られる.

## Problem → Solution
`sync` view がレコメンド表示のみ → ライブ議論ボード + SOS 昇格フローで対面議論を可視化・促進

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/realtime-discussion-board.prd.md`
- **PRD Phase**: 1〜5 (全フェーズ)
- **Estimated Files**: 8

---

## UX Design

### Before
```
sync view:
┌─────────────────────────────────────┐
│  5分Sync                            │
│  推薦の見方を選ぶ                    │
│  [橋渡し重視] [補完重視] [共通点重視] │
│                                     │
│  レコメンドカード × N               │
└─────────────────────────────────────┘
SOS chat: テキストのみ, 昇格手段なし
```

### After
```
sync view:
┌─────────────────────────────────────┐
│  ライブ議論ボード          Active: 2 │
│  [今ここで議論中を投稿]              │
│  場所: [______] トピック: [______]   │
│  [議論を始める]                      │
│                                     │
│  ┌─ LIVE ──────────────────────┐   │
│  │ 📍 中央図書館 3F             │   │
│  │ 線形代数の固有値について      │   │
│  │ 参加者: alice, bob (+2)      │   │
│  │ [参加する] [終了]            │   │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘

SOS chat:
┌─────────────────────────────────────┐
│  5分Sync Chat                       │
│  ...メッセージ...                    │
│  [対面で議論しよう 📍]               │← NEW
│  場所: [______] [議論を開始]        │
└─────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| sync view | レコメンドカード | ライブ議論ボード + 投稿フォーム | 既存レコメンドは削除せずタブ切り替え可 |
| SOS chat | テキスト送信のみ | 「対面で議論しよう」ボタン追加 | chat が resolved の時のみ表示 |
| 議論カード | なし | 参加・終了ボタン | creator または manager のみ終了可 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/api/app/models.py` | 153-175 | Event + EventParticipant 既存定義 |
| P0 | `apps/api/app/routers.py` | 506-580 | Event CRUD エンドポイントパターン |
| P0 | `apps/api/app/schemas.py` | 77-92 | EventOut / EventUpsert 既存定義 |
| P0 | `apps/api/alembic/versions/0003_auth_password.py` | all | マイグレーションパターン |
| P1 | `apps/api/app/services.py` | 160-181 | list_community_events パターン |
| P1 | `apps/web/components/sos-panel.tsx` | all | UI/Query パターン |
| P1 | `apps/web/app/dashboard/page.tsx` | 62-96, 690-760 | DashboardData 型 + sync view |

---

## Patterns to Mirror

### MIGRATION_PATTERN
```python
# SOURCE: apps/api/alembic/versions/0003_auth_password.py
revision = "0004_live_discussion"
down_revision = "0003_auth_password"

def upgrade() -> None:
    op.add_column("events", sa.Column("is_live", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("events", sa.Column("location", sa.String(255), nullable=True))
    op.add_column("events", sa.Column("sos_request_id", sa.String(64), nullable=True))
    op.add_column("events", sa.Column("creator_user_id", sa.String(64), nullable=True))
```

### MODEL_PATTERN
```python
# SOURCE: apps/api/app/models.py:153-163
class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))
    # nullable カラムは Mapped[str | None] で宣言
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
```

### ROUTER_PERMISSION_PATTERN
```python
# SOURCE: apps/api/app/routers.py:648 (SOS create - member level)
if context.role_for(payload.community_id) is None and not context.is_platform_admin():
    raise HTTPException(status_code=403, detail="Forbidden")
# ライブ議論はメンバーが作れる → ensure_can_manage ではなく上記を使う
```

### ROUTER_ENDPOINT_PATTERN
```python
# SOURCE: apps/api/app/routers.py:519-540
@router.post("/events", response_model=EventOut)
def create_event(payload: EventUpsert, context: RequestContext = Depends(get_request_context), db: Session = Depends(get_db)) -> EventOut:
    event = Event(id=f"event-{uuid4()}", ...)
    db.add(event); db.flush()
    for participant_id in payload.participant_ids:
        db.add(EventParticipant(event_id=event.id, user_id=participant_id))
    log_action(db, context.user.id, "create", "event", event.id, payload.title)
    db.commit()
```

### TANSTACK_MUTATION_PATTERN
```tsx
// SOURCE: apps/web/components/sos-panel.tsx:105-120
const createMutation = useMutation({
  mutationFn: async () => {
    const response = await fetch("/api/proxy/v1/sos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ community_id: communityId, topic }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<SosItem>;
  },
  onSuccess: async () => {
    setTopic("");
    await queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
  },
});
```

### TANSTACK_QUERY_PATTERN
```tsx
// SOURCE: apps/web/components/sos-panel.tsx:89-96
const sosQuery = useQuery({
  queryKey: ["sos", communityId],
  queryFn: () => fetchSos(communityId),
  initialData: initialItems,
  refetchInterval: 15_000,  // 議論ボードは 30_000
});
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/api/app/models.py` | UPDATE | Event に is_live, location, sos_request_id, creator_user_id 追加 |
| `apps/api/alembic/versions/0004_live_discussion.py` | CREATE | マイグレーション |
| `apps/api/app/schemas.py` | UPDATE | EventOut / EventUpsert に新フィールド追加 |
| `apps/api/app/services.py` | UPDATE | list_community_events に新フィールドを含める |
| `apps/api/app/routers.py` | UPDATE | create_event 権限変更 + join/end エンドポイント追加 |
| `apps/web/components/discussion-board.tsx` | CREATE | ライブ議論ボードコンポーネント |
| `apps/web/components/sos-panel.tsx` | UPDATE | 「対面で議論しよう」ボタン追加 |
| `apps/web/app/dashboard/page.tsx` | UPDATE | DashboardData 型拡張 + sync view 差し替え |

## NOT Building
- GPS リアルタイム位置追跡
- 自動タイマー終了
- 音声・映像通話
- WebSocket (ポーリングで代替)

---

## Step-by-Step Tasks

### Task 1: Event モデル拡張
- **ACTION**: `apps/api/app/models.py` の `Event` クラスに4フィールド追加
- **IMPLEMENT**:
```python
class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    time_label: Mapped[str] = mapped_column(String(255))
    format: Mapped[str] = mapped_column(Text)
    is_live: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sos_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    creator_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    community: Mapped["Community"] = relationship(back_populates="events")
    participants: Mapped[list["EventParticipant"]] = relationship(back_populates="event", cascade="all, delete-orphan")
```
- **MIRROR**: MODEL_PATTERN
- **IMPORTS**: `Boolean` は既存 import に追加 (`from sqlalchemy import Boolean, ...`)
- **GOTCHA**: `Boolean` は既に models.py でインポート済みか確認すること
- **VALIDATE**: `python -c "from app.models import Event; print(Event.__table__.columns.keys())"` で4フィールドが出ること

### Task 2: Alembic マイグレーション作成
- **ACTION**: `apps/api/alembic/versions/0004_live_discussion.py` を新規作成
- **IMPLEMENT**:
```python
"""add live discussion fields to events

Revision ID: 0004_live_discussion
Revises: 0003_auth_password
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_live_discussion"
down_revision = "0003_auth_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("is_live", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("events", sa.Column("location", sa.String(255), nullable=True))
    op.add_column("events", sa.Column("sos_request_id", sa.String(64), nullable=True))
    op.add_column("events", sa.Column("creator_user_id", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "creator_user_id")
    op.drop_column("events", "sos_request_id")
    op.drop_column("events", "location")
    op.drop_column("events", "is_live")
```
- **MIRROR**: MIGRATION_PATTERN
- **GOTCHA**: `down_revision` は必ず `"0003_auth_password"` にすること
- **VALIDATE**: `alembic check` でマイグレーションが認識されること

### Task 3: スキーマ更新
- **ACTION**: `apps/api/app/schemas.py` の `EventOut` と `EventUpsert` に新フィールド追加
- **IMPLEMENT**:
```python
class EventOut(BaseModel):
    id: str
    community_id: str
    title: str
    time_label: str
    format: str
    participant_ids: list[str]
    participant_names: list[str]
    is_live: bool = False
    location: str | None = None
    sos_request_id: str | None = None
    creator_user_id: str | None = None


class EventUpsert(BaseModel):
    community_id: str
    title: str
    time_label: str
    format: str
    participant_ids: list[str] = Field(default_factory=list)
    is_live: bool = False
    location: str | None = None
    sos_request_id: str | None = None
```
- **MIRROR**: MODEL_PATTERN (nullable は `| None = None`)
- **GOTCHA**: `EventOut` の既存フィールドの順序を変えないこと
- **VALIDATE**: `python -c "from app.schemas import EventOut, EventUpsert; print('ok')"` が通ること

### Task 4: サービス更新
- **ACTION**: `apps/api/app/services.py` の `list_community_events` を更新して新フィールドを含める
- **IMPLEMENT**: `EventOut(...)` 生成部分に4フィールドを追加
```python
results.append(
    EventOut(
        id=event.id,
        community_id=event.community_id,
        title=event.title,
        time_label=event.time_label,
        format=event.format,
        participant_ids=ids,
        participant_names=[users_by_id[user_id].name for user_id in ids if user_id in users_by_id],
        is_live=event.is_live,
        location=event.location,
        sos_request_id=event.sos_request_id,
        creator_user_id=event.creator_user_id,
    )
)
```
- **MIRROR**: ROUTER_ENDPOINT_PATTERN
- **VALIDATE**: GET /events でレスポンスに `is_live` フィールドが含まれること

### Task 5: ルーター更新 (create_event 権限変更 + 新エンドポイント)
- **ACTION**: `apps/api/app/routers.py` を3箇所修正
- **IMPLEMENT**:

**5a. create_event 修正** — `is_live=True` の場合はメンバーが作成可能:
```python
@router.post("/events", response_model=EventOut)
def create_event(
    payload: EventUpsert,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> EventOut:
    if payload.is_live:
        if context.role_for(payload.community_id) is None and not context.is_platform_admin():
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        ensure_can_manage(context, payload.community_id)
    event = Event(
        id=f"event-{uuid4()}",
        community_id=payload.community_id,
        title=payload.title,
        time_label=payload.time_label,
        format=payload.format,
        is_live=payload.is_live,
        location=payload.location,
        sos_request_id=payload.sos_request_id,
        creator_user_id=context.user.id,
    )
    db.add(event)
    db.flush()
    db.add(EventParticipant(event_id=event.id, user_id=context.user.id))
    for participant_id in payload.participant_ids:
        if participant_id != context.user.id:
            db.add(EventParticipant(event_id=event.id, user_id=participant_id))
    log_action(db, context.user.id, "create", "event", event.id, payload.title)
    db.commit()
    users = list_community_users(db, payload.community_id)
    events = list_community_events(db, payload.community_id, {user.id: user for user in users})
    return next(e for e in events if e.id == event.id)
```

**5b. join エンドポイント追加** (delete_event の後に追記):
```python
@router.post("/events/{event_id}/join", response_model=EventOut)
def join_event(
    event_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> EventOut:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if context.role_for(event.community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    existing = db.scalar(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == context.user.id,
        )
    )
    if existing is None:
        db.add(EventParticipant(event_id=event_id, user_id=context.user.id))
        log_action(db, context.user.id, "join", "event", event_id, event.title)
        db.commit()
    users = list_community_users(db, event.community_id)
    events = list_community_events(db, event.community_id, {user.id: user for user in users})
    return next(e for e in events if e.id == event_id)
```

**5c. end エンドポイント追加**:
```python
@router.post("/events/{event_id}/end", response_model=EventOut)
def end_event(
    event_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> EventOut:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    is_creator = event.creator_user_id == context.user.id
    is_participant = db.scalar(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == context.user.id,
        )
    ) is not None
    can_manage = context.role_for(event.community_id) in ("community_manager",) or context.is_platform_admin()
    if not (is_creator or is_participant or can_manage):
        raise HTTPException(status_code=403, detail="Forbidden")
    event.is_live = False
    log_action(db, context.user.id, "end", "event", event_id, event.title)
    db.commit()
    users = list_community_users(db, event.community_id)
    events = list_community_events(db, event.community_id, {user.id: user for user in users})
    return next(e for e in events if e.id == event_id)
```
- **MIRROR**: ROUTER_ENDPOINT_PATTERN, ROUTER_PERMISSION_PATTERN
- **GOTCHA**: `join_event` で重複参加を防ぐため既存チェックが必須
- **VALIDATE**: `ruff check apps/api/` でエラーなし

### Task 6: DiscussionBoard コンポーネント作成
- **ACTION**: `apps/web/components/discussion-board.tsx` を新規作成
- **IMPLEMENT**:
```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type LiveEvent = {
  id: string;
  community_id: string;
  title: string;
  location: string | null;
  is_live: boolean;
  participant_ids: string[];
  participant_names: string[];
  creator_user_id: string | null;
  sos_request_id: string | null;
  time_label: string;
  format: string;
};

type Theme = "light" | "dark";

async function fetchEvents(communityId: string) {
  const res = await fetch(`/api/proxy/v1/events?community_id=${communityId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as LiveEvent[];
}

export function DiscussionBoard({
  communityId,
  currentUserId,
  initialEvents,
  theme = "light",
}: {
  communityId: string;
  currentUserId: string;
  initialEvents: LiveEvent[];
  theme?: Theme;
}) {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState("");
  const [topic, setTopic] = useState("");
  const isDark = theme === "dark";

  const ui = {
    panel: isDark
      ? "border-[#30363d] bg-[#161b22] text-slate-100"
      : "border-[#c8e6c9] bg-[linear-gradient(180deg,#f1f8e9_0%,#fafffe_100%)] text-stone-950",
    eyebrow: isDark ? "text-[#7ee787]" : "text-[#2e7d32]",
    muted: isDark ? "text-slate-400" : "text-stone-500",
    input: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-100 placeholder:text-slate-600 focus:border-[#7ee787]"
      : "border-[#a5d6a7] bg-white text-stone-950 placeholder:text-stone-300 focus:border-[#2e7d32]",
    card: isDark ? "border-[#30363d] bg-[#0d1117]" : "border-[#c8e6c9] bg-white",
    badge: isDark ? "bg-[#132d1d] text-[#7ee787]" : "bg-[#dafbe1] text-[#116329]",
    metric: isDark ? "bg-[#0d1117] text-[#7ee787]" : "bg-white text-[#2e7d32]",
  };

  const eventsQuery = useQuery({
    queryKey: ["events", communityId],
    queryFn: () => fetchEvents(communityId),
    initialData: initialEvents,
    refetchInterval: 30_000,
  });

  const liveEvents = eventsQuery.data.filter((e) => e.is_live);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/proxy/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community_id: communityId,
          title: topic,
          time_label: "今すぐ",
          format: "対面議論",
          is_live: true,
          location,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<LiveEvent>;
    },
    onSuccess: async () => {
      setLocation("");
      setTopic("");
      await queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/proxy/v1/events/${eventId}/join`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<LiveEvent>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    },
  });

  const endMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/proxy/v1/events/${eventId}/end`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<LiveEvent>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    },
  });

  return (
    <section className={`rounded-xl border p-6 shadow-xl ${ui.panel}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.22em] ${ui.eyebrow}`}>Live</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">議論ボード</h2>
          <p className={`mt-2 text-sm leading-6 ${ui.muted}`}>
            今ここで誰かと話したいトピックを投稿. 近くにいる人が参加できます.
          </p>
        </div>
        <div className={`rounded-xl px-4 py-3 text-right shadow-sm ${ui.metric}`}>
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${ui.muted}`}>Active</p>
          <p className="mt-1 text-4xl font-black tracking-[-0.05em]">{liveEvents.length}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="場所 (例: 図書館 3F)"
          className={`rounded-xl border px-4 py-3 text-sm outline-none transition ${ui.input}`}
        />
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="トピック (例: 線形代数の固有値)"
          className={`rounded-xl border px-4 py-3 text-sm outline-none transition ${ui.input}`}
        />
        <button
          type="button"
          disabled={!location.trim() || !topic.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="rounded-xl bg-[#2e7d32] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1b5e20] disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {createMutation.isPending ? "投稿中..." : "議論を始める"}
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {liveEvents.length === 0 ? (
          <div className={`rounded-xl border px-4 py-5 text-sm shadow-sm ${ui.card} ${ui.muted}`}>
            現在ライブ議論はありません. 最初に投稿してみましょう.
          </div>
        ) : (
          liveEvents.map((event) => {
            const isParticipant = event.participant_ids.includes(currentUserId);
            const isCreator = event.creator_user_id === currentUserId;
            return (
              <article key={event.id} className={`rounded-xl border px-4 py-4 shadow-sm ${ui.card}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ui.badge}`}>LIVE</span>
                      {event.location ? (
                        <span className={`text-xs ${ui.muted}`}>📍 {event.location}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-bold">{event.title}</p>
                    <p className={`mt-1 text-sm ${ui.muted}`}>
                      参加者: {event.participant_names.join(", ") || "なし"}
                      {event.participant_names.length > 0 ? ` (${event.participant_names.length}名)` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isParticipant ? (
                      <button
                        type="button"
                        onClick={() => joinMutation.mutate(event.id)}
                        disabled={joinMutation.isPending}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          isDark
                            ? "border-[#7ee787] text-[#7ee787] hover:bg-[#132d1d]"
                            : "border-[#2e7d32] text-[#2e7d32] hover:bg-[#dafbe1]"
                        }`}
                      >
                        参加する
                      </button>
                    ) : null}
                    {isParticipant || isCreator ? (
                      <button
                        type="button"
                        onClick={() => endMutation.mutate(event.id)}
                        disabled={endMutation.isPending}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          isDark
                            ? "border-[#30363d] text-slate-400 hover:border-rose-400 hover:text-rose-400"
                            : "border-stone-300 text-stone-500 hover:border-rose-500 hover:text-rose-500"
                        }`}
                      >
                        終了
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
```
- **MIRROR**: TANSTACK_MUTATION_PATTERN, TANSTACK_QUERY_PATTERN
- **GOTCHA**: `refetchInterval: 30_000` (30秒ポーリング)
- **VALIDATE**: `pnpm typecheck` でエラーなし

### Task 7: SOS パネルに昇格ボタン追加
- **ACTION**: `apps/web/components/sos-panel.tsx` の chat セクション下部に「対面で議論しよう」ボタンと場所入力を追加
- **IMPLEMENT**: `activeChatRequestId` が存在し chat が取得できている場合に表示するセクションを追加

chat セクション (`<section className={cx("mt-6 rounded-xl border p-4", ui.card)}>`) の送信フォームの**後**に追加:

```tsx
// State を追加 (既存の useState 群の近くに)
const [escalateLocation, setEscalateLocation] = useState("");
const [showEscalate, setShowEscalate] = useState(false);

// Mutation を追加
const escalateMutation = useMutation({
  mutationFn: async () => {
    const res = await fetch("/api/proxy/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        community_id: communityId,
        title: chatQuery.data?.topic ?? "SOS議論",
        time_label: "今すぐ",
        format: "対面議論",
        is_live: true,
        location: escalateLocation,
        sos_request_id: activeChatRequestId,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  onSuccess: async () => {
    setEscalateLocation("");
    setShowEscalate(false);
  },
});

// 送信フォームの後に追加する JSX:
{!showEscalate ? (
  <button
    type="button"
    onClick={() => setShowEscalate(true)}
    className={cx(
      "mt-3 w-full rounded-xl border px-4 py-2 text-sm font-bold transition",
      isDark
        ? "border-[#30363d] text-[#7ee787] hover:border-[#7ee787]"
        : "border-[#a5d6a7] text-[#2e7d32] hover:bg-[#f1f8e9]",
    )}
  >
    📍 対面で議論しよう
  </button>
) : (
  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
    <input
      value={escalateLocation}
      onChange={(e) => setEscalateLocation(e.target.value)}
      placeholder="場所を入力 (例: 図書館 3F 窓際)"
      className={cx("rounded-xl border px-4 py-2 text-sm outline-none transition", ui.input)}
    />
    <button
      type="button"
      disabled={!escalateLocation.trim() || escalateMutation.isPending}
      onClick={() => escalateMutation.mutate()}
      className="rounded-xl bg-[#2e7d32] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1b5e20] disabled:bg-stone-400"
    >
      {escalateMutation.isPending ? "投稿中..." : "開始"}
    </button>
  </div>
)}
```
- **MIRROR**: TANSTACK_MUTATION_PATTERN
- **GOTCHA**: `showEscalate` の State は `activeChatRequestId` が変わった時にリセットする (`useEffect` は不要, ボタンクリックで制御)
- **VALIDATE**: SOS chat で「対面で議論しよう」が表示されること

### Task 8: Dashboard 型拡張 + sync view 差し替え
- **ACTION**: `apps/web/app/dashboard/page.tsx` の2箇所を修正

**8a. `DashboardData` 型の `events` を拡張**:
```tsx
events: Array<{
  id: string;
  title: string;
  time_label: string;
  format: string;
  participant_ids: string[];
  participant_names: string[];
  is_live: boolean;
  location: string | null;
  sos_request_id: string | null;
  creator_user_id: string | null;
}>;
```

**8b. sync view の中身を差し替え** (`{view === "sync" ? (` ブロック):
```tsx
{view === "sync" ? (
  <DiscussionBoard
    communityId={communityId}
    currentUserId={dashboard.selected_user.id}
    initialEvents={dashboard.events}
    theme={theme}
  />
) : null}
```

**8c. import 追加** (ファイル先頭のインポート群に):
```tsx
import { DiscussionBoard } from "@/components/discussion-board";
```
- **MIRROR**: SosPanel の使われ方パターン
- **GOTCHA**: 既存の sync セクション全体 (`<section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">...</section>`) を丸ごと `<DiscussionBoard ... />` に置き換える
- **VALIDATE**: `pnpm typecheck` でエラーなし, sync view に DiscussionBoard が表示されること

---

## Validation Commands

### Backend
```bash
cd apps/api
ruff check app/
python -c "from app.models import Event; cols = [c.name for c in Event.__table__.columns]; assert 'is_live' in cols and 'location' in cols, cols"
python -c "from app.schemas import EventOut, EventUpsert; print('schemas ok')"
```
EXPECT: エラーなし

### Frontend
```bash
cd apps/web
pnpm typecheck
```
EXPECT: Zero type errors

### Migration (Docker 環境)
```bash
docker compose up -d db
docker compose run --rm api alembic upgrade head
```
EXPECT: `Running upgrade 0003_auth_password -> 0004_live_discussion`

---

## Acceptance Criteria
- [ ] `alembic upgrade head` が通る
- [ ] `ruff check apps/api/` でエラーなし
- [ ] `pnpm typecheck` でエラーなし
- [ ] sync view に DiscussionBoard が表示される
- [ ] 「議論を始める」ボタンで投稿できる
- [ ] 「参加する」「終了」ボタンが機能する
- [ ] SOS chat に「対面で議論しよう」ボタンが表示される
- [ ] 30秒ポーリングで更新される

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Docker DB が起動していないと migration 確認不可 | M | M | コード変更のみ検証し migration は起動時に通る前提 |
| sync view の既存 JSX が複雑で置き換え箇所の特定が難しい | L | M | `{view === "sync" ?` で grep して特定 |
