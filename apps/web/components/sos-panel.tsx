"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type SosItem = {
  id: string;
  community_id: string;
  user_id: string;
  user_name: string;
  topic: string;
  status: "active" | "resolved";
  created_at: string;
  resolved_at: string | null;
  responder_user_id: string | null;
  responder_name: string | null;
  chat_id: string | null;
  matched_user_ids: string[];
};

type ChatMessage = {
  id: number;
  chat_id: string;
  sender_user_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

type SosChat = {
  id: string;
  request_id: string;
  community_id: string;
  requester_user_id: string;
  requester_name: string;
  responder_user_id: string;
  responder_name: string;
  topic: string;
  messages: ChatMessage[];
};

type SosTheme = "light" | "dark";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function fetchSos(communityId: string) {
  const response = await fetch(`/api/proxy/v1/sos?community_id=${communityId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as SosItem[];
}

async function fetchChat(requestId: string) {
  const response = await fetch(`/api/proxy/v1/sos/${requestId}/chat`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as SosChat;
}

export function SosPanel({
  communityId,
  initialItems,
  currentUserId,
  theme = "light",
}: {
  communityId: string;
  initialItems: SosItem[];
  currentUserId: string;
  theme?: SosTheme;
}) {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateLocation, setEscalateLocation] = useState("");
  const [addedEdges, setAddedEdges] = useState<Set<string>>(new Set());
  const [aiNotification, setAiNotification] = useState<{
    sosId: string;
    topic: string;
    aiTags: string[];
    posterName: string;
  } | null>(null);
  const [activeChatRequestId, setActiveChatRequestId] = useState<string | null>(
    initialItems.find(
      (item) =>
        item.status === "resolved" &&
        item.chat_id &&
        (item.user_id === currentUserId || item.responder_user_id === currentUserId),
    )?.id ?? null,
  );

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = process.env.NEXT_PUBLIC_API_WS_HOST ?? "localhost:8000";
    const ws = new WebSocket(`${proto}://${host}/v1/ws/sos/${communityId}`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          payload: {
            sos_id?: string;
            topic?: string;
            ai_tags?: string[];
            poster_name?: string;
            notify_user_ids?: string[];
          };
        };
        if (msg.type === "sos-ai-notify" && msg.payload.notify_user_ids?.includes(currentUserId)) {
          setAiNotification({
            sosId: msg.payload.sos_id ?? "",
            topic: msg.payload.topic ?? "",
            aiTags: msg.payload.ai_tags ?? [],
            posterName: msg.payload.poster_name ?? "",
          });
        }
        queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
      } catch {
        // ignore parse errors
      }
    };
    return () => ws.close();
  }, [communityId, currentUserId, queryClient]);

  const sosQuery = useQuery({
    queryKey: ["sos", communityId],
    queryFn: () => fetchSos(communityId),
    initialData: initialItems,
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/proxy/v1/sos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ community_id: communityId, topic }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json() as Promise<SosItem>;
    },
    onSuccess: async () => {
      setTopic("");
      await queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch("/api/proxy/v1/sos/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json() as Promise<SosItem>;
    },
    onSuccess: async (item) => {
      setActiveChatRequestId(item.id);
      await queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
      await queryClient.invalidateQueries({ queryKey: ["sos-chat", item.id] });
    },
  });

  const chatQuery = useQuery({
    queryKey: ["sos-chat", activeChatRequestId],
    queryFn: () => fetchChat(activeChatRequestId!),
    enabled: Boolean(activeChatRequestId),
    refetchInterval: 5_000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/proxy/v1/sos/${activeChatRequestId}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: message }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json() as Promise<SosChat>;
    },
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["sos-chat", activeChatRequestId] });
      await queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
    },
  });

  const addEdgeMutation = useMutation({
    mutationFn: async ({ toUserId }: { toUserId: string }) => {
      const response = await fetch("/api/proxy/v1/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community_id: communityId,
          to_user_id: toUserId,
          type: "project",
          strength: 3,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      if (activeChatRequestId) {
        setAddedEdges((prev) => new Set(prev).add(activeChatRequestId));
      }
      queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      const chat = chatQuery.data;
      const response = await fetch("/api/proxy/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community_id: communityId,
          title: chat?.topic ?? "SOS議論",
          time_label: "今すぐ",
          format: "対面議論",
          is_live: true,
          location: escalateLocation,
          sos_request_id: activeChatRequestId,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      setEscalateLocation("");
      setShowEscalate(false);
    },
  });

  const activeCount = sosQuery.data.filter((item) => item.status === "active").length;
  const isDark = theme === "dark";
  const ui = {
    panel: isDark
      ? "border-[#30363d] bg-[#161b22] text-slate-100 shadow-black/20"
      : "border-[#e9c9bc] bg-[linear-gradient(180deg,_#fff7f3_0%,_#fffdfb_100%)] text-stone-950 shadow-[0_18px_60px_rgba(181,82,51,0.12)]",
    eyebrow: isDark ? "text-[#ffab70]" : "text-[#9c4227]",
    muted: isDark ? "text-slate-400" : "text-stone-600",
    metric: isDark ? "bg-[#0d1117] text-[#ffab70]" : "bg-white text-[#b55233]",
    input: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-100 placeholder:text-slate-600 focus:border-[#ffab70]"
      : "border-[#efcdbf] bg-white text-stone-950 placeholder:text-stone-300 focus:border-[#b55233]",
    card: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-100"
      : "border-[#efcdbf] bg-white text-stone-950",
    resolved: isDark ? "bg-[#30363d] text-slate-200" : "bg-stone-100 text-stone-700",
    mine: isDark ? "bg-[#132d1d] text-[#dfffe6]" : "bg-[#dafbe1] text-[#116329]",
    theirs: isDark ? "bg-[#0d1117] text-slate-100" : "bg-white text-stone-950",
  };

  return (
    <section className={cx("rounded-xl border p-6 shadow-xl", ui.panel)}>
      {aiNotification ? (
        <div className={cx(
          "mb-4 rounded-xl border px-4 py-3",
          isDark ? "border-[#1f6feb] bg-[#0d1f38] text-[#79c0ff]" : "border-[#0969da] bg-[#ddf4ff] text-[#0550ae]",
        )}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">AI マッチ通知</p>
              <p className="mt-1 text-sm font-bold">
                {aiNotification.posterName} さんの SOS があなたに関係しています
              </p>
              <p className="mt-1 text-sm opacity-80">{aiNotification.topic}</p>
              {aiNotification.aiTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {aiNotification.aiTags.map((tag) => (
                    <span key={tag} className={cx(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      isDark ? "bg-[#1f6feb]/30" : "bg-[#0969da]/10",
                    )}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setAiNotification(null)}
              className="shrink-0 text-xs underline opacity-60 hover:opacity-100"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", ui.eyebrow)}>SOS</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">5分Sync ヘルプリクエスト</h2>
          <p className={cx("mt-2 text-sm leading-6", ui.muted)}>
            困りごとをすぐ投げて、近い知見を持つ人と 5 分で接続するための導線です。
          </p>
        </div>
        <div className={cx("rounded-xl px-4 py-3 text-right shadow-sm", ui.metric)}>
          <p className={cx("text-xs font-bold uppercase tracking-[0.18em]", ui.muted)}>Active</p>
          <p className="mt-1 text-4xl font-black tracking-[-0.05em]">{activeCount}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="例: 線形代数の証明で5分だけ相談したい"
          className={cx("rounded-xl border px-4 py-3 text-sm outline-none transition", ui.input)}
        />
        <button
          type="button"
          disabled={!topic.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="rounded-xl bg-[#c2410c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#9a3412] disabled:cursor-not-allowed disabled:bg-stone-500"
        >
          {createMutation.isPending ? "送信中..." : "SOS を出す"}
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {sosQuery.data.length === 0 ? (
          <div className={cx("rounded-xl border px-4 py-5 text-sm shadow-sm", ui.card, ui.muted)}>
            まだ SOS はありません。
          </div>
        ) : (
          sosQuery.data.map((item) => {
            const matched = item.matched_user_ids.includes(currentUserId);

            return (
              <article
                key={item.id}
                className={cx(
                  "rounded-xl border px-4 py-4 shadow-sm",
                  ui.card,
                  matched && item.status === "active"
                    ? isDark
                      ? "border-[#ffab70] shadow-[#ffab70]/10"
                      : "border-[#fb923c] shadow-[#fb923c]/20"
                    : undefined,
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{item.user_name}</p>
                      {matched && item.status === "active" ? (
                        <span className="rounded-full bg-[#fff1e5] px-2.5 py-1 text-[11px] font-black text-[#9a3412]">
                          あなたが答えられます
                        </span>
                      ) : null}
                    </div>
                    <p className={cx("mt-1 text-sm", ui.muted)}>{item.topic}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      item.status === "active"
                        ? "bg-[#fbe4da] text-[#9c4227]"
                        : ui.resolved
                    }`}>
                      {item.status === "active" ? "募集中" : "解決済み"}
                    </span>
                    {item.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => resolveMutation.mutate(item.id)}
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs font-bold transition",
                          matched
                            ? "border-[#fb923c] bg-[#fb923c] text-white hover:bg-[#f97316]"
                            : "hover:border-[#ffab70] hover:text-[#ffab70]",
                          !matched && (isDark ? "border-[#30363d] text-slate-200" : "border-stone-300 text-stone-700"),
                        )}
                      >
                        対応する
                      </button>
                    ) : item.chat_id &&
                      (item.user_id === currentUserId || item.responder_user_id === currentUserId) ? (
                      <button
                        type="button"
                        onClick={() => setActiveChatRequestId(item.id)}
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs font-bold transition hover:border-[#1f883d] hover:text-[#1f883d]",
                          activeChatRequestId === item.id
                            ? "border-[#1f883d] text-[#1f883d]"
                            : isDark
                              ? "border-[#30363d] text-slate-200"
                              : "border-stone-300 text-stone-700",
                        )}
                      >
                        チャットを開く
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {activeChatRequestId ? (
        <section className={cx("mt-6 rounded-xl border p-4", ui.card)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={cx("text-xs font-bold uppercase tracking-[0.2em]", ui.eyebrow)}>5分Sync Chat</p>
              <h3 className="mt-1 text-lg font-black tracking-[-0.03em]">
                {chatQuery.data?.requester_name ?? "相談者"} × {chatQuery.data?.responder_name ?? "対応者"}
              </h3>
              <p className={cx("mt-1 text-sm", ui.muted)}>
                {chatQuery.data?.topic ?? "チャットを読み込み中..."}
              </p>
            </div>
            <span className="rounded-full bg-[#dafbe1] px-3 py-1 text-xs font-bold text-[#116329]">
              Connected
            </span>
          </div>

          <div className="mt-4 grid max-h-[320px] gap-3 overflow-y-auto pr-1">
            {chatQuery.isError ? (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                チャットを開けませんでした。参加者だけが閲覧できます。
              </p>
            ) : null}
            {chatQuery.data?.messages.map((chatMessage) => {
              const mine = chatMessage.sender_user_id === currentUserId;
              return (
                <article
                  key={chatMessage.id}
                  className={cx(
                    "max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm",
                    mine ? "justify-self-end border-[#1f883d]/30" : "justify-self-start border-current/10",
                    mine ? ui.mine : ui.theirs,
                  )}
                >
                  <p className="text-xs font-bold opacity-70">{chatMessage.sender_name}</p>
                  <p className="mt-1 text-sm leading-6">{chatMessage.body}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="例: どこで詰まっているか、式や状況を書いてください"
              className={cx("rounded-xl border px-4 py-3 text-sm outline-none transition", ui.input)}
            />
            <button
              type="button"
              disabled={!message.trim() || sendMessageMutation.isPending || chatQuery.isError}
              onClick={() => sendMessageMutation.mutate()}
              className="rounded-xl bg-[#1f883d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-stone-500"
            >
              {sendMessageMutation.isPending ? "送信中..." : "送信"}
            </button>
          </div>

          {(() => {
            const activeItem = sosQuery.data.find((item) => item.id === activeChatRequestId);
            const chat = chatQuery.data;
            const isResolved = activeItem?.status === "resolved";
            const otherUserId = chat
              ? chat.requester_user_id === currentUserId
                ? chat.responder_user_id
                : chat.requester_user_id
              : null;
            const alreadyAdded = activeChatRequestId ? addedEdges.has(activeChatRequestId) : false;
            if (isResolved && otherUserId) {
              return (
                <button
                  type="button"
                  disabled={alreadyAdded || addEdgeMutation.isPending}
                  onClick={() => addEdgeMutation.mutate({ toUserId: otherUserId })}
                  className={cx(
                    "mt-3 w-full rounded-xl border px-4 py-2 text-sm font-bold transition",
                    alreadyAdded
                      ? isDark
                        ? "border-[#30363d] text-slate-500 cursor-not-allowed"
                        : "border-stone-200 text-stone-400 cursor-not-allowed"
                      : isDark
                        ? "border-[#1f6feb] text-[#79c0ff] hover:bg-[#0d1f38]"
                        : "border-[#0969da] text-[#0969da] hover:bg-[#ddf4ff]",
                  )}
                >
                  {alreadyAdded ? "✓ 知見エッジ追加済み" : "🔗 知見エッジを追加する"}
                </button>
              );
            }
            return null;
          })()}

          {!showEscalate ? (
            <button
              type="button"
              onClick={() => setShowEscalate(true)}
              className={cx(
                "mt-3 w-full rounded-xl border px-4 py-2 text-sm font-bold transition",
                isDark
                  ? "border-[#30363d] text-[#7ee787] hover:border-[#7ee787] hover:bg-[#0d1117]"
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
                className="rounded-xl bg-[#2e7d32] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1b5e20] disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {escalateMutation.isPending ? "投稿中..." : "開始"}
              </button>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
