"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

type HelpItem = {
  id: string;
  community_id: string;
  user_id: string;
  user_name: string;
  topic: string;
  tags: string[];
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

type HelpChat = {
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

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function fetchHelp(communityId: string) {
  const response = await fetch(`/api/proxy/v1/sos?community_id=${communityId}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as HelpItem[];
}

async function fetchChat(requestId: string) {
  const response = await fetch(`/api/proxy/v1/sos/${requestId}/chat`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as HelpChat;
}

export function SosPanel({
  communityId,
  initialItems,
  currentUserId,
}: {
  communityId: string;
  initialItems: HelpItem[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [questionTags, setQuestionTags] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
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
  const tagInputRef = useRef<HTMLInputElement>(null);

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
        if (msg.type === "sos-ai-notify") {
          const sosId = msg.payload.sos_id ?? "";
          const aiTags = msg.payload.ai_tags ?? [];
          if (msg.payload.notify_user_ids?.includes(currentUserId)) {
            setAiNotification({
              sosId,
              topic: msg.payload.topic ?? "",
              aiTags,
              posterName: msg.payload.poster_name ?? "",
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
      } catch {
        // ignore parse errors
      }
    };
    return () => ws.close();
  }, [communityId, currentUserId, queryClient]);

  const helpQuery = useQuery({
    queryKey: ["sos", communityId],
    queryFn: () => fetchHelp(communityId),
    initialData: initialItems,
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/proxy/v1/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ community_id: communityId, topic, tags: questionTags }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<HelpItem>;
    },
    onSuccess: async () => {
      setTopic("");
      setQuestionTags([]);
      setTagInput("");
      await queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch("/api/proxy/v1/sos/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<HelpItem>;
    },
    onSuccess: async (item) => {
      setActiveChatRequestId(item.id);
      await queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
      await queryClient.invalidateQueries({ queryKey: ["sos-chat", item.id] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/proxy/v1/sos/${requestId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<HelpItem>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: message }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<HelpChat>;
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

  const openCount = helpQuery.data.filter((item) => item.status === "active").length;
  const allTags = [...new Set(helpQuery.data.flatMap((item) => item.tags))];

  const filteredItems =
    activeTags.size > 0
      ? helpQuery.data.filter((item) => item.tags.some((t) => activeTags.has(t)))
      : helpQuery.data;

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !questionTags.includes(t)) {
      setQuestionTags((prev) => [...prev, t]);
    }
    setTagInput("");
    tagInputRef.current?.focus();
  }

  return (
    <section className="rounded-xl border border-[#d8dee4] bg-white p-6 shadow-xl text-[#24292f]">
      {aiNotification ? (
        <div className="mb-4 rounded-xl border border-[#0969da] bg-[#ddf4ff] px-4 py-3 text-[#0550ae]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">AI マッチ通知</p>
              <p className="mt-1 text-sm font-bold">
                {aiNotification.posterName} さんの質問があなたに関係しています
              </p>
              <p className="mt-1 text-sm opacity-80">{aiNotification.topic}</p>
              {aiNotification.aiTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {aiNotification.aiTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[#0969da]/10 px-2.5 py-0.5 text-xs font-semibold">
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
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0969da]">Help</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#24292f]">
            質問 & ヘルプ
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#57606a]">
            困ったことを投稿して, 仲間に質問・議論できます. タグをつけると同じテーマの質問をまとめて探せます.
          </p>
        </div>
        <div className="rounded-xl bg-[#ddf4ff] px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">Open</p>
          <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-[#0969da]">{openCount}</p>
        </div>
      </div>

      {/* Multi-tag filter */}
      {allTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs font-semibold text-[#57606a]">フィルタ:</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                activeTags.has(tag)
                  ? "border-[#0969da] bg-[#ddf4ff] text-[#0969da]"
                  : "border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]",
              )}
            >
              {tag}
            </button>
          ))}
          {activeTags.size > 0 ? (
            <button
              type="button"
              onClick={() => setActiveTags(new Set())}
              className="text-xs underline text-[#57606a]"
            >
              解除
            </button>
          ) : null}
        </div>
      ) : null}

      {activeTags.size > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#0969da] bg-[#ddf4ff] px-4 py-3 text-sm font-bold text-[#0550ae]">
          <span>[{[...activeTags].join(", ")}] でフィルター中</span>
          <button type="button" onClick={() => setActiveTags(new Set())} className="text-xs underline">
            × クリア
          </button>
        </div>
      ) : null}

      {/* New question form */}
      <div className="mt-6 space-y-3">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例: 線形代数の固有値の証明で詰まっています"
          className="w-full rounded-xl border border-[#d0d7de] bg-white px-4 py-3 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
        />

        <div className="flex flex-wrap items-center gap-2">
          {questionTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 rounded-full border border-[#0969da] bg-[#ddf4ff] px-3 py-1 text-xs font-semibold text-[#0969da]"
            >
              {tag}
              <button
                type="button"
                onClick={() => setQuestionTags((prev) => prev.filter((t) => t !== tag))}
                className="opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            placeholder="タグを追加 (Enter で確定)"
            className="min-w-[160px] flex-1 rounded-xl border border-[#d0d7de] bg-white px-3 py-2 text-xs text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
          />
          {tagInput.trim() ? (
            <button
              type="button"
              onClick={() => addTag(tagInput)}
              className="rounded-xl border border-[#0969da] bg-[#ddf4ff] px-3 py-2 text-xs font-bold text-[#0969da] transition"
            >
              追加
            </button>
          ) : null}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!topic.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="rounded-xl bg-[#1f883d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {createMutation.isPending ? "投稿中..." : "質問を投稿"}
          </button>
        </div>
      </div>

      {/* Question list */}
      <div className="mt-6 grid gap-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-[#d8dee4] bg-white px-4 py-5 text-sm text-[#57606a] shadow-sm">
            {activeTags.size > 0
              ? `選択したタグの質問はまだありません.`
              : "まだ質問はありません. 最初に投稿してみましょう."}
          </div>
        ) : (
          filteredItems.map((item) => {
            const tags = item.tags;
            const matched = item.matched_user_ids.includes(currentUserId);
            const isAuthor = item.user_id === currentUserId;
            const isOpen = item.status === "active";

            return (
              <article
                key={item.id}
                className={cx(
                  "rounded-xl border px-4 py-4 shadow-sm",
                  matched && isOpen
                    ? "border-[#0969da] bg-white shadow-[#0969da]/10"
                    : "border-[#d8dee4] bg-white",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-[#24292f]">{item.user_name}</p>
                      <span
                        className={cx(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                          isOpen ? "bg-[#dafbe1] text-[#116329]" : "bg-[#eaeef2] text-[#57606a]",
                        )}
                      >
                        {isOpen ? "Open" : "Closed"}
                      </span>
                      {matched && isOpen ? (
                        <span className="rounded-full bg-[#ddf4ff] px-2.5 py-0.5 text-[11px] font-black text-[#0969da]">
                          あなたが答えられます
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-[#57606a]">{item.topic}</p>
                    {tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={cx(
                              "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition",
                              activeTags.has(tag)
                                ? "border-[#0969da] bg-[#ddf4ff] text-[#0969da]"
                                : "border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]",
                            )}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {isOpen && isAuthor ? (
                      <button
                        type="button"
                        onClick={() => closeMutation.mutate(item.id)}
                        disabled={closeMutation.isPending}
                        className="rounded-full border border-[#d0d7de] px-3 py-1 text-xs font-bold text-[#57606a] transition hover:border-red-400 hover:text-red-600"
                      >
                        Close
                      </button>
                    ) : null}

                    {isOpen && !isAuthor ? (
                      <button
                        type="button"
                        onClick={() => resolveMutation.mutate(item.id)}
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs font-bold transition",
                          matched
                            ? "border-[#0969da] bg-[#0969da] text-white hover:bg-[#0550ae]"
                            : "border-[#d0d7de] text-[#57606a] hover:border-[#0969da] hover:text-[#0969da]",
                        )}
                      >
                        返信する
                      </button>
                    ) : null}

                    {!isOpen &&
                    item.chat_id &&
                    (item.user_id === currentUserId || item.responder_user_id === currentUserId) ? (
                      <button
                        type="button"
                        onClick={() => setActiveChatRequestId(item.id)}
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs font-bold transition",
                          activeChatRequestId === item.id
                            ? "border-[#0969da] text-[#0969da]"
                            : "border-[#d0d7de] text-[#57606a] hover:border-[#0969da]",
                        )}
                      >
                        スレッドを開く
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Thread/Chat */}
      {activeChatRequestId ? (
        <section className="mt-6 rounded-xl border border-[#d8dee4] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0969da]">Thread</p>
              <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#24292f]">
                {chatQuery.data?.requester_name ?? "質問者"} × {chatQuery.data?.responder_name ?? "回答者"}
              </h3>
              <p className="mt-1 text-sm text-[#57606a]">
                {chatQuery.data?.topic ?? "スレッドを読み込み中..."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#dafbe1] px-3 py-1 text-xs font-bold text-[#116329]">
                Connected
              </span>
              <button
                type="button"
                onClick={() => setActiveChatRequestId(null)}
                className="text-xs underline text-[#57606a]"
              >
                閉じる
              </button>
            </div>
          </div>

          <div className="mt-4 grid max-h-[320px] gap-3 overflow-y-auto pr-1">
            {chatQuery.isError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                スレッドを開けませんでした. 参加者のみ閲覧できます.
              </p>
            ) : null}
            {chatQuery.data?.messages.map((msg) => {
              const mine = msg.sender_user_id === currentUserId;
              return (
                <article
                  key={msg.id}
                  className={cx(
                    "max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm",
                    mine ? "justify-self-end" : "justify-self-start",
                    mine
                      ? "border-[#dafbe1] bg-[#dafbe1] text-[#116329]"
                      : "border-[#d8dee4] bg-white text-[#24292f]",
                  )}
                >
                  <p className="text-xs font-bold opacity-70">{msg.sender_name}</p>
                  <p className="mt-1 text-sm leading-6">{msg.body}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && message.trim()) {
                  e.preventDefault();
                  sendMessageMutation.mutate();
                }
              }}
              placeholder="返信を入力..."
              className="rounded-xl border border-[#d0d7de] bg-white px-4 py-3 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
            />
            <button
              type="button"
              disabled={!message.trim() || sendMessageMutation.isPending || chatQuery.isError}
              onClick={() => sendMessageMutation.mutate()}
              className="rounded-xl bg-[#1f883d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {sendMessageMutation.isPending ? "送信中..." : "送信"}
            </button>
          </div>

          {(() => {
            const activeItem = helpQuery.data.find((item) => item.id === activeChatRequestId);
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
                      ? "cursor-not-allowed border-[#d0d7de] text-slate-400"
                      : "border-[#0969da] text-[#0969da] hover:bg-[#ddf4ff]",
                  )}
                >
                  {alreadyAdded ? "✓ コネクション追加済み" : "🔗 コネクションに追加する"}
                </button>
              );
            }
            return null;
          })()}
        </section>
      ) : null}
    </section>
  );
}
