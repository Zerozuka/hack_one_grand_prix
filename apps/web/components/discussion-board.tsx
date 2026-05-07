"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type DiscussionTopic = {
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

async function fetchTopics(communityId: string) {
  const res = await fetch(`/api/proxy/v1/events?community_id=${communityId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as DiscussionTopic[];
}

export function DiscussionBoard({
  communityId,
  currentUserId,
  initialEvents,
  theme = "light",
}: {
  communityId: string;
  currentUserId: string;
  initialEvents: DiscussionTopic[];
  theme?: Theme;
}) {
  const queryClient = useQueryClient();
  const [newTopic, setNewTopic] = useState("");
  const [location, setLocation] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isDark = theme === "dark";

  const ui = {
    panel: isDark
      ? "border-[#30363d] bg-[#161b22] text-slate-100 shadow-black/20"
      : "border-[#d8dee4] bg-white text-[#24292f] shadow-slate-200/70",
    eyebrow: isDark ? "text-[#79c0ff]" : "text-[#0969da]",
    muted: isDark ? "text-slate-400" : "text-[#57606a]",
    text: isDark ? "text-slate-100" : "text-[#24292f]",
    input: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-100 placeholder:text-slate-600 focus:border-[#58a6ff]"
      : "border-[#d0d7de] bg-white text-[#24292f] placeholder:text-[#57606a] focus:border-[#0969da]",
    card: isDark ? "border-[#30363d] bg-[#0d1117] text-slate-100" : "border-[#d8dee4] bg-white text-[#24292f]",
    activeBadge: isDark ? "bg-[#132d1d] text-[#7ee787]" : "bg-[#dafbe1] text-[#116329]",
    closedBadge: isDark ? "bg-[#30363d] text-slate-400" : "bg-[#eaeef2] text-[#57606a]",
    metric: isDark ? "bg-[#0d1117] text-[#7ee787]" : "bg-[#ddf4ff] text-[#0969da]",
    soft: isDark ? "border-[#30363d] bg-[#161b22]" : "border-[#d8dee4] bg-[#f6f8fa]",
    primary: isDark
      ? "bg-[#238636] text-white hover:bg-[#2ea043] disabled:bg-slate-700"
      : "bg-[#1f883d] text-white hover:bg-[#1a7f37] disabled:bg-slate-400",
    join: isDark
      ? "border-[#238636] text-[#7ee787] hover:bg-[#132d1d]"
      : "border-[#1f883d] text-[#1f883d] hover:bg-[#dafbe1]",
    leave: isDark
      ? "border-[#30363d] text-slate-400 hover:border-[#f85149] hover:text-[#f85149]"
      : "border-[#d0d7de] text-[#57606a] hover:border-red-400 hover:text-red-600",
  };

  const topicsQuery = useQuery({
    queryKey: ["events", communityId],
    queryFn: () => fetchTopics(communityId),
    initialData: initialEvents,
    initialDataUpdatedAt: 0,
    refetchInterval: 8_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = process.env.NEXT_PUBLIC_API_WS_HOST ?? "localhost:8000";
    const ws = new WebSocket(`${proto}://${host}/v1/ws/events/${communityId}`);
    ws.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    };
    ws.onerror = () => {
      queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    };
    return () => ws.close();
  }, [communityId, queryClient]);

  const activeTopics = topicsQuery.data.filter((t) => t.is_live);
  const alreadyInTopic = activeTopics.some((t) => t.participant_ids.includes(currentUserId));

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/proxy/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community_id: communityId,
          title: newTopic,
          time_label: "今すぐ",
          format: "対面議論",
          is_live: true,
          location: location.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<DiscussionTopic>;
    },
    onSuccess: async () => {
      setNewTopic("");
      setLocation("");
      await queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    },
  });

  const [joinError, setJoinError] = useState<string | null>(null);

  const joinMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const res = await fetch(`/api/proxy/v1/events/${topicId}/join`, { method: "POST" });
      if (!res.ok) {
        const body = await res.text();
        throw Object.assign(new Error(body), { status: res.status });
      }
      return res.json() as Promise<DiscussionTopic>;
    },
    onSuccess: async () => {
      setJoinError(null);
      await queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    },
    onError: (err: Error & { status?: number }) => {
      setJoinError(
        err.status === 409
          ? "既に別の議論に参加中です. 終了してから参加してください."
          : "参加に失敗しました. もう一度お試しください.",
      );
    },
  });

  const endMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const res = await fetch(`/api/proxy/v1/events/${topicId}/end`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<DiscussionTopic>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", communityId] });
    },
  });

  return (
    <section className={cx("rounded-xl border p-6 shadow-xl", ui.panel)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", ui.eyebrow)}>Discussion</p>
          <h2 className={cx("mt-2 text-2xl font-black tracking-[-0.04em]", ui.text)}>
            ディスカッション
          </h2>
          <p className={cx("mt-2 text-sm leading-6", ui.muted)}>
            学習トピックについて仲間と議論しましょう. トピックを作成して参加者を募れます.
          </p>
        </div>
        <div className={cx("rounded-xl px-4 py-3 text-right shadow-sm", ui.metric)}>
          <p className={cx("text-xs font-bold uppercase tracking-[0.18em]", ui.muted)}>Active</p>
          <p className={cx("mt-1 text-4xl font-black tracking-[-0.05em]", ui.text)}>
            {activeTopics.length}
          </p>
        </div>
      </div>

      {/* New topic form */}
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="場所 (例: 中央食堂, 図書館3F)"
          className={cx("rounded-xl border px-4 py-3 text-sm outline-none transition", ui.input)}
        />
        <input
          value={newTopic}
          onChange={(e) => setNewTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newTopic.trim() && !createMutation.isPending) {
              createMutation.mutate();
            }
          }}
          placeholder="トピック (例: 統計学の検定手法)"
          className={cx("rounded-xl border px-4 py-3 text-sm outline-none transition", ui.input)}
        />
        <button
          type="button"
          disabled={!newTopic.trim() || createMutation.isPending || alreadyInTopic}
          onClick={() => createMutation.mutate()}
          title={alreadyInTopic ? "既に別の議論に参加中です" : undefined}
          className={cx(
            "rounded-xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed",
            ui.primary,
          )}
        >
          {createMutation.isPending ? "作成中..." : alreadyInTopic ? "参加中" : "議論を始める"}
        </button>
      </div>

      {/* Topic list */}
      <div className="mt-6 grid gap-3">
        {topicsQuery.data.length === 0 ? (
          <div className={cx("rounded-xl border px-4 py-5 text-sm shadow-sm", ui.card, ui.muted)}>
            まだ議論トピックはありません. 最初のトピックを作成してみましょう.
          </div>
        ) : (
          topicsQuery.data.map((topic) => {
            const isParticipant = topic.participant_ids.includes(currentUserId);
            const isCreator = topic.creator_user_id === currentUserId;
            const isExpanded = expandedId === topic.id;

            return (
              <article key={topic.id} className={cx("rounded-xl border shadow-sm", ui.card)}>
                <div className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                            topic.is_live ? ui.activeBadge : ui.closedBadge,
                          )}
                        >
                          {topic.is_live ? "Active" : "Ended"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                        className={cx(
                          "mt-1.5 text-left text-base font-bold transition hover:opacity-80",
                          ui.text,
                        )}
                      >
                        {topic.title}
                      </button>
                      <p className={cx("mt-1 text-xs", ui.muted)}>
                        {topic.location ? `📍 ${topic.location} / ` : ""}
                        {topic.participant_names.length > 0
                          ? `参加者: ${topic.participant_names.join(", ")} (${topic.participant_names.length}名)`
                          : "参加者なし"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {topic.is_live && !isParticipant ? (
                        <button
                          type="button"
                          onClick={() => joinMutation.mutate(topic.id)}
                          disabled={joinMutation.isPending || alreadyInTopic}
                          title={alreadyInTopic ? "既に別の議論に参加中です" : undefined}
                          className={cx(
                            "rounded-full border px-3 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
                            ui.join,
                          )}
                        >
                          参加する
                        </button>
                      ) : null}

                      {topic.is_live && (isParticipant || isCreator) ? (
                        <button
                          type="button"
                          onClick={() => endMutation.mutate(topic.id)}
                          disabled={endMutation.isPending}
                          className={cx(
                            "rounded-full border px-3 py-1 text-xs font-bold transition",
                            ui.leave,
                          )}
                        >
                          終了
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                        className={cx("text-xs", ui.muted)}
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <div className={cx("border-t px-4 py-4", ui.soft)}>
                    <p className={cx("text-xs", ui.muted)}>
                      形式: {topic.format} / {topic.time_label}
                    </p>
                    {topic.participant_names.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {topic.participant_names.map((name) => (
                          <span
                            key={name}
                            className={cx(
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              isDark
                                ? "bg-[#30363d] text-slate-200"
                                : "bg-[#eaeef2] text-[#24292f]",
                            )}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={cx("mt-3 text-sm", ui.muted)}>参加者はまだいません.</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {joinError ? (
        <div
          className={cx(
            "mt-4 rounded-xl border px-4 py-3 text-sm font-medium",
            isDark
              ? "border-[#f85149]/40 bg-[#3d1f19] text-[#ffa198]"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
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
