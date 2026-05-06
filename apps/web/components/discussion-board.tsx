"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function fetchEvents(communityId: string) {
  const res = await fetch(`/api/proxy/v1/events?community_id=${communityId}`, {
    cache: "no-store",
  });
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
      ? "border-[#30363d] bg-[#161b22] text-slate-100 shadow-black/20"
      : "border-[#c8e6c9] bg-[linear-gradient(180deg,#f1f8e9_0%,#fafffe_100%)] text-stone-950 shadow-[0_18px_60px_rgba(46,125,50,0.10)]",
    eyebrow: isDark ? "text-[#7ee787]" : "text-[#2e7d32]",
    muted: isDark ? "text-slate-400" : "text-stone-500",
    input: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-100 placeholder:text-slate-600 focus:border-[#7ee787]"
      : "border-[#a5d6a7] bg-white text-stone-950 placeholder:text-stone-300 focus:border-[#2e7d32]",
    card: isDark ? "border-[#30363d] bg-[#0d1117] text-slate-100" : "border-[#c8e6c9] bg-white text-stone-950",
    badge: isDark ? "bg-[#132d1d] text-[#7ee787]" : "bg-[#dafbe1] text-[#116329]",
    metric: isDark ? "bg-[#0d1117] text-[#7ee787]" : "bg-white text-[#2e7d32]",
  };

  const eventsQuery = useQuery({
    queryKey: ["events", communityId],
    queryFn: () => fetchEvents(communityId),
    initialData: initialEvents,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = process.env.NEXT_PUBLIC_API_WS_HOST ?? "localhost:8000";
    const ws = new WebSocket(`${proto}://${host}/v1/ws/events/${communityId}`);
    ws.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    };
    return () => ws.close();
  }, [communityId, queryClient]);

  const liveEvents = eventsQuery.data.filter((e) => e.is_live);
  const alreadyInLive = liveEvents.some((e) => e.participant_ids.includes(currentUserId));

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

  const [joinError, setJoinError] = useState<string | null>(null);

  const joinMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/proxy/v1/events/${eventId}/join`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.text();
        throw Object.assign(new Error(body), { status: res.status });
      }
      return res.json() as Promise<LiveEvent>;
    },
    onSuccess: async () => {
      setJoinError(null);
      await queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 409) {
        setJoinError("既に別の議論に参加中です. 終了してから参加してください.");
      } else {
        setJoinError("参加に失敗しました. もう一度お試しください.");
      }
    },
  });

  const endMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/proxy/v1/events/${eventId}/end`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<LiveEvent>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    },
  });

  return (
    <section className={cx("rounded-xl border p-6 shadow-xl", ui.panel)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", ui.eyebrow)}>Live</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">議論ボード</h2>
          <p className={cx("mt-2 text-sm leading-6", ui.muted)}>
            今ここで誰かと話したいトピックを投稿. 近くにいる人が参加できます.
          </p>
        </div>
        <div className={cx("rounded-xl px-4 py-3 text-right shadow-sm", ui.metric)}>
          <p className={cx("text-xs font-bold uppercase tracking-[0.18em]", ui.muted)}>Active</p>
          <p className="mt-1 text-4xl font-black tracking-[-0.05em]">{liveEvents.length}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="場所 (例: 図書館 3F)"
          className={cx("rounded-xl border px-4 py-3 text-sm outline-none transition", ui.input)}
        />
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="トピック (例: 線形代数の固有値)"
          className={cx("rounded-xl border px-4 py-3 text-sm outline-none transition", ui.input)}
        />
        <button
          type="button"
          disabled={!location.trim() || !topic.trim() || createMutation.isPending || alreadyInLive}
          onClick={() => createMutation.mutate()}
          title={alreadyInLive ? "既に別の議論に参加中です" : undefined}
          className="rounded-xl bg-[#2e7d32] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1b5e20] disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {createMutation.isPending ? "投稿中..." : alreadyInLive ? "参加中" : "議論を始める"}
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {liveEvents.length === 0 ? (
          <div className={cx("rounded-xl border px-4 py-5 text-sm shadow-sm", ui.card, ui.muted)}>
            現在ライブ議論はありません. 最初に投稿してみましょう.
          </div>
        ) : (
          liveEvents.map((event) => {
            const isParticipant = event.participant_ids.includes(currentUserId);
            const isCreator = event.creator_user_id === currentUserId;
            return (
              <article key={event.id} className={cx("rounded-xl border px-4 py-4 shadow-sm", ui.card)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cx("rounded-full px-2 py-0.5 text-xs font-bold", ui.badge)}>
                        LIVE
                      </span>
                      {event.location ? (
                        <span className={cx("text-xs", ui.muted)}>📍 {event.location}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-bold">{event.title}</p>
                    <p className={cx("mt-1 text-sm", ui.muted)}>
                      {event.participant_names.length > 0
                        ? `参加者: ${event.participant_names.join(", ")} (${event.participant_names.length}名)`
                        : "参加者なし"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isParticipant ? (
                      <button
                        type="button"
                        onClick={() => joinMutation.mutate(event.id)}
                        disabled={joinMutation.isPending || alreadyInLive}
                        title={alreadyInLive ? "既に別の議論に参加中です" : undefined}
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs font-bold transition",
                          alreadyInLive
                            ? isDark ? "border-[#30363d] text-slate-500 cursor-not-allowed" : "border-stone-200 text-stone-400 cursor-not-allowed"
                            : isDark ? "border-[#7ee787] text-[#7ee787] hover:bg-[#132d1d]" : "border-[#2e7d32] text-[#2e7d32] hover:bg-[#dafbe1]",
                        )}
                      >
                        {alreadyInLive ? "参加不可" : "参加する"}
                      </button>
                    ) : null}
                    {isParticipant || isCreator ? (
                      <button
                        type="button"
                        onClick={() => endMutation.mutate(event.id)}
                        disabled={endMutation.isPending}
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs font-bold transition",
                          isDark
                            ? "border-[#30363d] text-slate-400 hover:border-rose-400 hover:text-rose-400"
                            : "border-stone-300 text-stone-500 hover:border-rose-500 hover:text-rose-500",
                        )}
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

      {joinError ? (
        <div className={cx("mt-4 rounded-xl border px-4 py-3 text-sm font-medium", isDark ? "border-[#f85149]/40 bg-[#3d1f19] text-[#ffa198]" : "border-red-200 bg-red-50 text-red-700")}>
          {joinError}
          <button
            type="button"
            onClick={() => setJoinError(null)}
            className="ml-3 text-xs underline opacity-70 hover:opacity-100"
          >
            閉じる
          </button>
        </div>
      ) : null}
    </section>
  );
}
