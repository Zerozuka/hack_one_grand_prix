"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

type HelpItem = {
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

type HelpTheme = "light" | "dark";

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
  theme = "light",
}: {
  communityId: string;
  initialItems: HelpItem[];
  currentUserId: string;
  theme?: HelpTheme;
}) {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [questionTags, setQuestionTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [addedEdges, setAddedEdges] = useState<Set<string>>(new Set());
  const [itemTags, setItemTags] = useState<Record<string, string[]>>({});
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
          if (sosId && aiTags.length > 0) {
            setItemTags((prev) => ({ ...prev, [sosId]: aiTags }));
          }
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
      const item = (await response.json()) as HelpItem;
      if (questionTags.length > 0) {
        setItemTags((prev) => ({ ...prev, [item.id]: questionTags }));
      }
      return item;
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
      if (!response.ok) {
        // Fallback: use respond endpoint to mark as resolved
        const fallback = await fetch("/api/proxy/v1/sos/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId }),
        });
        if (!fallback.ok) throw new Error(await fallback.text());
        return fallback.json() as Promise<HelpItem>;
      }
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
  const isDark = theme === "dark";

  const allTags = [...new Set(Object.values(itemTags).flat())];
  const filteredItems = filterTag
    ? helpQuery.data.filter((item) => (itemTags[item.id] ?? []).includes(filterTag))
    : helpQuery.data;

  const ui = {
    panel: isDark
      ? "border-[#30363d] bg-[#161b22] text-slate-100 shadow-black/20"
      : "border-[#d8dee4] bg-white text-[#24292f] shadow-slate-200/70",
    eyebrow: isDark ? "text-[#79c0ff]" : "text-[#0969da]",
    muted: isDark ? "text-slate-400" : "text-[#57606a]",
    text: isDark ? "text-slate-100" : "text-[#24292f]",
    metric: isDark ? "bg-[#0d1117] text-[#79c0ff]" : "bg-[#ddf4ff] text-[#0969da]",
    input: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-100 placeholder:text-slate-600 focus:border-[#58a6ff]"
      : "border-[#d0d7de] bg-white text-[#24292f] placeholder:text-[#57606a] focus:border-[#0969da]",
    card: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-100"
      : "border-[#d8dee4] bg-white text-[#24292f]",
    closed: isDark ? "bg-[#30363d] text-slate-400" : "bg-[#eaeef2] text-[#57606a]",
    open: isDark ? "bg-[#132d1d] text-[#7ee787]" : "bg-[#dafbe1] text-[#116329]",
    mine: isDark ? "bg-[#132d1d] text-[#dfffe6]" : "bg-[#dafbe1] text-[#116329]",
    theirs: isDark ? "bg-[#0d1117] text-slate-100" : "bg-white text-[#24292f]",
    tag: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-300"
      : "border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]",
    tagActive: isDark
      ? "border-[#1f6feb] bg-[#1f6feb]/20 text-[#79c0ff]"
      : "border-[#0969da] bg-[#ddf4ff] text-[#0969da]",
  };

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !questionTags.includes(t)) {
      setQuestionTags((prev) => [...prev, t]);
    }
    setTagInput("");
    tagInputRef.current?.focus();
  }

  return (
    <section className={cx("rounded-xl border p-6 shadow-xl", ui.panel)}>
      {aiNotification ? (
        <div
          className={cx(
            "mb-4 rounded-xl border px-4 py-3",
            isDark
              ? "border-[#1f6feb] bg-[#0d1f38] text-[#79c0ff]"
              : "border-[#0969da] bg-[#ddf4ff] text-[#0550ae]",
          )}
        >
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
                    <span
                      key={tag}
                      className={cx(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        isDark ? "bg-[#1f6feb]/30" : "bg-[#0969da]/10",
                      )}
                    >
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
          <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", ui.eyebrow)}>Help</p>
          <h2 className={cx("mt-2 text-2xl font-black tracking-[-0.04em]", ui.text)}>
            質問 & ヘルプ
          </h2>
          <p className={cx("mt-2 text-sm leading-6", ui.muted)}>
            困ったことを投稿して, 仲間に質問・議論できます. タグをつけると同じテーマの質問をまとめて探せます.
          </p>
        </div>
        <div className={cx("rounded-xl px-4 py-3 text-right shadow-sm", ui.metric)}>
          <p className={cx("text-xs font-bold uppercase tracking-[0.18em]", ui.muted)}>Open</p>
          <p className="mt-1 text-4xl font-black tracking-[-0.05em]">{openCount}</p>
        </div>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={cx("text-xs font-semibold self-center", ui.muted)}>フィルタ:</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                filterTag === tag ? ui.tagActive : ui.tag,
              )}
            >
              {tag}
            </button>
          ))}
          {filterTag ? (
            <button
              type="button"
              onClick={() => setFilterTag(null)}
              className={cx("text-xs underline", ui.muted)}
            >
              解除
            </button>
          ) : null}
        </div>
      ) : null}

      {/* New question form */}
      <div className="mt-6 space-y-3">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例: 線形代数の固有値の証明で詰まっています"
          className={cx("w-full rounded-xl border px-4 py-3 text-sm outline-none transition", ui.input)}
        />

        {/* Tags input */}
        <div className="flex flex-wrap items-center gap-2">
          {questionTags.map((tag) => (
            <span
              key={tag}
              className={cx(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                ui.tagActive,
              )}
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
            className={cx(
              "min-w-[160px] flex-1 rounded-xl border px-3 py-2 text-xs outline-none transition",
              ui.input,
            )}
          />
          {tagInput.trim() ? (
            <button
              type="button"
              onClick={() => addTag(tagInput)}
              className={cx("rounded-xl px-3 py-2 text-xs font-bold transition", ui.tagActive)}
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
            className={cx(
              "rounded-xl px-5 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed",
              isDark
                ? "bg-[#238636] hover:bg-[#2ea043] disabled:bg-slate-700"
                : "bg-[#1f883d] hover:bg-[#1a7f37] disabled:bg-slate-400",
            )}
          >
            {createMutation.isPending ? "投稿中..." : "質問を投稿"}
          </button>
        </div>
      </div>

      {/* Question list */}
      <div className="mt-6 grid gap-3">
        {filteredItems.length === 0 ? (
          <div className={cx("rounded-xl border px-4 py-5 text-sm shadow-sm", ui.card, ui.muted)}>
            {filterTag ? `「${filterTag}」の質問はまだありません.` : "まだ質問はありません. 最初に投稿してみましょう."}
          </div>
        ) : (
          filteredItems.map((item) => {
            const tags = itemTags[item.id] ?? [];
            const matched = item.matched_user_ids.includes(currentUserId);
            const isAuthor = item.user_id === currentUserId;
            const isOpen = item.status === "active";

            return (
              <article
                key={item.id}
                className={cx(
                  "rounded-xl border px-4 py-4 shadow-sm",
                  ui.card,
                  matched && isOpen
                    ? isDark
                      ? "border-[#58a6ff] shadow-[#58a6ff]/10"
                      : "border-[#0969da] shadow-[#0969da]/10"
                    : undefined,
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cx("text-sm font-bold", ui.text)}>{item.user_name}</p>
                      <span
                        className={cx(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                          isOpen ? ui.open : ui.closed,
                        )}
                      >
                        {isOpen ? "Open" : "Closed"}
                      </span>
                      {matched && isOpen ? (
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-black",
                            isDark
                              ? "bg-[#1f6feb]/20 text-[#79c0ff]"
                              : "bg-[#ddf4ff] text-[#0969da]",
                          )}
                        >
                          あなたが答えられます
                        </span>
                      ) : null}
                    </div>
                    <p className={cx("mt-1.5 text-sm leading-6", ui.muted)}>{item.topic}</p>
                    {tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                            className={cx(
                              "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition",
                              filterTag === tag ? ui.tagActive : ui.tag,
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
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs font-bold transition",
                          isDark
                            ? "border-[#30363d] text-slate-400 hover:border-[#f85149] hover:text-[#f85149]"
                            : "border-[#d0d7de] text-[#57606a] hover:border-red-400 hover:text-red-600",
                        )}
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
                            ? isDark
                              ? "border-[#1f6feb] bg-[#1f6feb] text-white hover:bg-[#388bfd]"
                              : "border-[#0969da] bg-[#0969da] text-white hover:bg-[#0550ae]"
                            : isDark
                              ? "border-[#30363d] text-slate-300 hover:border-[#58a6ff] hover:text-[#79c0ff]"
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
                            ? isDark
                              ? "border-[#1f6feb] text-[#79c0ff]"
                              : "border-[#0969da] text-[#0969da]"
                            : isDark
                              ? "border-[#30363d] text-slate-300 hover:border-[#58a6ff]"
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
        <section className={cx("mt-6 rounded-xl border p-4", ui.card)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={cx("text-xs font-bold uppercase tracking-[0.2em]", ui.eyebrow)}>Thread</p>
              <h3 className={cx("mt-1 text-lg font-black tracking-[-0.03em]", ui.text)}>
                {chatQuery.data?.requester_name ?? "質問者"} × {chatQuery.data?.responder_name ?? "回答者"}
              </h3>
              <p className={cx("mt-1 text-sm", ui.muted)}>
                {chatQuery.data?.topic ?? "スレッドを読み込み中..."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cx("rounded-full px-3 py-1 text-xs font-bold", ui.open)}>
                Connected
              </span>
              <button
                type="button"
                onClick={() => setActiveChatRequestId(null)}
                className={cx("text-xs underline", ui.muted)}
              >
                閉じる
              </button>
            </div>
          </div>

          <div className="mt-4 grid max-h-[320px] gap-3 overflow-y-auto pr-1">
            {chatQuery.isError ? (
              <p
                className={cx(
                  "rounded-xl border px-4 py-3 text-sm",
                  isDark
                    ? "border-[#f85149]/40 bg-[#3d1f19] text-[#ffa198]"
                    : "border-red-200 bg-red-50 text-red-700",
                )}
              >
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
                    mine ? ui.mine : ui.theirs,
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
              className={cx("rounded-xl border px-4 py-3 text-sm outline-none transition", ui.input)}
            />
            <button
              type="button"
              disabled={!message.trim() || sendMessageMutation.isPending || chatQuery.isError}
              onClick={() => sendMessageMutation.mutate()}
              className={cx(
                "rounded-xl px-5 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed",
                isDark
                  ? "bg-[#238636] hover:bg-[#2ea043] disabled:bg-slate-700"
                  : "bg-[#1f883d] hover:bg-[#1a7f37] disabled:bg-slate-400",
              )}
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
                      ? isDark
                        ? "border-[#30363d] cursor-not-allowed text-slate-500"
                        : "border-[#d0d7de] cursor-not-allowed text-slate-400"
                      : isDark
                        ? "border-[#1f6feb] text-[#79c0ff] hover:bg-[#0d1f38]"
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
