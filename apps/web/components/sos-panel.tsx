"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  const [activeChatRequestId, setActiveChatRequestId] = useState<string | null>(
    initialItems.find(
      (item) =>
        item.status === "resolved" &&
        item.chat_id &&
        (item.user_id === currentUserId || item.responder_user_id === currentUserId),
    )?.id ?? null,
  );

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
          sosQuery.data.map((item) => (
            <article
              key={item.id}
              className={cx("rounded-xl border px-4 py-4 shadow-sm", ui.card)}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{item.user_name}</p>
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
                        "rounded-full border px-3 py-1 text-xs font-bold transition hover:border-[#ffab70] hover:text-[#ffab70]",
                        isDark ? "border-[#30363d] text-slate-200" : "border-stone-300 text-stone-700",
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
          ))
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
        </section>
      ) : null}
    </section>
  );
}
