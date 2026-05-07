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
}: {
  communityId: string;
  currentUserId: string;
  initialEvents: DiscussionTopic[];
}) {
  const queryClient = useQueryClient();
  const [newTopic, setNewTopic] = useState("");
  const [location, setLocation] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    <section className="rounded-xl border border-[#d8dee4] bg-white p-6 shadow-xl text-[#24292f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0969da]">Discussion</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#24292f]">
            ディスカッション
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#57606a]">
            学習トピックについて仲間と議論しましょう. トピックを作成して参加者を募れます.
          </p>
        </div>
        <div className="rounded-xl bg-[#ddf4ff] px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">Active</p>
          <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-[#0969da]">
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
          className="rounded-xl border border-[#d0d7de] bg-white px-4 py-3 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
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
          className="rounded-xl border border-[#d0d7de] bg-white px-4 py-3 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
        />
        <button
          type="button"
          disabled={!newTopic.trim() || createMutation.isPending || alreadyInTopic}
          onClick={() => createMutation.mutate()}
          title={alreadyInTopic ? "既に別の議論に参加中です" : undefined}
          className="rounded-xl bg-[#1f883d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {createMutation.isPending ? "作成中..." : alreadyInTopic ? "参加中" : "議論を始める"}
        </button>
      </div>

      {/* Topic list */}
      <div className="mt-6 grid gap-3">
        {topicsQuery.data.length === 0 ? (
          <div className="rounded-xl border border-[#d8dee4] bg-white px-4 py-5 text-sm text-[#57606a] shadow-sm">
            まだ議論トピックはありません. 最初のトピックを作成してみましょう.
          </div>
        ) : (
          topicsQuery.data.map((topic) => {
            const isParticipant = topic.participant_ids.includes(currentUserId);
            const isCreator = topic.creator_user_id === currentUserId;
            const isExpanded = expandedId === topic.id;

            return (
              <article key={topic.id} className="rounded-xl border border-[#d8dee4] bg-white shadow-sm">
                <div className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                            topic.is_live
                              ? "bg-[#dafbe1] text-[#116329]"
                              : "bg-[#eaeef2] text-[#57606a]",
                          )}
                        >
                          {topic.is_live ? "Active" : "Ended"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                        className="mt-1.5 text-left text-base font-bold text-[#24292f] transition hover:opacity-80"
                      >
                        {topic.title}
                      </button>
                      <p className="mt-1 text-xs text-[#57606a]">
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
                          className="rounded-full border border-[#1f883d] px-3 py-1 text-xs font-bold text-[#1f883d] transition hover:bg-[#dafbe1] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          参加する
                        </button>
                      ) : null}

                      {topic.is_live && (isParticipant || isCreator) ? (
                        <button
                          type="button"
                          onClick={() => endMutation.mutate(topic.id)}
                          disabled={endMutation.isPending}
                          className="rounded-full border border-[#d0d7de] px-3 py-1 text-xs font-bold text-[#57606a] transition hover:border-red-400 hover:text-red-600"
                        >
                          終了
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                        className="text-xs text-[#57606a]"
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-[#d8dee4] bg-[#f6f8fa] px-4 py-4">
                    <p className="text-xs text-[#57606a]">
                      形式: {topic.format} / {topic.time_label}
                    </p>
                    {topic.participant_names.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {topic.participant_names.map((name) => (
                          <span
                            key={name}
                            className="rounded-full bg-[#eaeef2] px-3 py-1 text-xs font-semibold text-[#24292f]"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[#57606a]">参加者はまだいません.</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {joinError ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
