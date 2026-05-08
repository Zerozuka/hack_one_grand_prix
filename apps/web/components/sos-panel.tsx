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

type HelperUser = {
  id: string;
  name: string;
  group_label: string;
  availability: string | null;
  interests: string[];
  goals: string[];
  activity_tags: string[];
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

type HelpTopicParts = {
  title: string;
  detail: string;
  imageName: string | null;
  imageUrl: string | null;
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function serializeHelpTopic(title: string, detail: string, imageName: string | null, imageUrl: string | null) {
  return [
    title.trim(),
    detail.trim() ? `詳細: ${detail.trim()}` : "",
    imageName ? `添付画像: ${imageName}` : "",
    imageUrl ? `添付画像URL: ${imageUrl}` : "",
  ].filter(Boolean).join("\n\n");
}

function parseHelpTopic(topic: string): HelpTopicParts {
  const lines = topic.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const title = lines[0] ?? topic;
  const detailLine = lines.find((line) => line.startsWith("詳細:"));
  const imageLine = lines.find((line) => line.startsWith("添付画像:"));
  const imageUrlLine = lines.find((line) => line.startsWith("添付画像URL:"));
  return {
    title,
    detail: detailLine?.replace(/^詳細:\s*/, "") ?? "",
    imageName: imageLine?.replace(/^添付画像:\s*/, "") ?? null,
    imageUrl: imageUrlLine?.replace(/^添付画像URL:\s*/, "") ?? null,
  };
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

function discussionHref(item: HelpItem) {
  const parsed = parseHelpTopic(item.topic);
  const params = new URLSearchParams({
    view: "discussion",
    communityId: item.community_id,
    discussionTopic: parsed.title,
  });
  if (item.user_id) {
    params.set("inviteUserId", item.user_id);
  }
  return `/dashboard?${params.toString()}`;
}

function discussionThreadHref(chat: HelpChat) {
  const parsed = parseHelpTopic(chat.topic);
  const params = new URLSearchParams({
    view: "discussion",
    communityId: chat.community_id,
    discussionTopic: parsed.title,
  });
  params.set("inviteUserId", chat.requester_user_id);
  return `/dashboard?${params.toString()}`;
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const time = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) return time;
  const day = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(date);
  return `${day} ${time}`;
}

export function SosPanel({
  communityId,
  initialItems,
  currentUserId,
  users,
}: {
  communityId: string;
  initialItems: HelpItem[];
  currentUserId: string;
  users: HelperUser[];
}) {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [detail, setDetail] = useState("");
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [questionTags, setQuestionTags] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [helpSearch, setHelpSearch] = useState("");
  const [aiNotification, setAiNotification] = useState<{
    sosId: string;
    topic: string;
    aiTags: string[];
    posterName: string;
  } | null>(null);
  const [openThreadIds, setOpenThreadIds] = useState<Set<string>>(new Set());
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
        body: JSON.stringify({ community_id: communityId, topic: serializeHelpTopic(topic, detail, imageName, imageUrl), tags: questionTags }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<HelpItem>;
    },
    onSuccess: async () => {
      setTopic("");
      setDetail("");
      setImageName(null);
      setImageUrl(null);
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
      setOpenThreadIds((prev) => new Set(prev).add(item.id));
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

  const openCount = helpQuery.data.filter((item) => item.status === "active").length;
  const allTags = [...new Set(helpQuery.data.flatMap((item) => item.tags))];
  const intentTokens = [
    ...questionTags,
    tagInput,
    ...topic.split(/[\s　,、]+/),
  ].map((token) => token.trim().toLowerCase()).filter(Boolean);
  const helperCandidates = users
    .filter((user) => user.id !== currentUserId)
    .map((user) => {
      const userTags = [...user.interests, ...user.goals, ...user.activity_tags];
      const matchedTags = userTags.filter((tag) => {
        const lowerTag = tag.toLowerCase();
        return intentTokens.some((token) => lowerTag.includes(token) || lowerTag.startsWith(token));
      });
      const nameHit = intentTokens.some((token) => user.name.toLowerCase().includes(token) || user.group_label.toLowerCase().includes(token));
      return {
        user,
        matchedTags: [...new Set(matchedTags)].slice(0, 4),
        score: matchedTags.length * 3 + (nameHit ? 1 : 0) + (user.availability ? 0.5 : 0),
      };
    })
    .filter((candidate) => intentTokens.length > 0 && candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const filteredItems = helpQuery.data.filter((item) => {
    const parsed = parseHelpTopic(item.topic);
    const matchesTags = activeTags.size === 0 || item.tags.some((t) => activeTags.has(t));
    const needle = helpSearch.trim().toLowerCase();
    const matchesSearch =
      !needle ||
      [parsed.title, parsed.detail, item.user_name, ...item.tags].join(" ").toLowerCase().includes(needle);
    return matchesTags && matchesSearch;
  });

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

  function toggleThread(requestId: string) {
    setOpenThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  }

  function attachImage(file: File | undefined) {
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImageUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function inviteHref(userId: string) {
    const params = new URLSearchParams({
      communityId,
      view: "discussion",
      inviteUserId: userId,
      discussionTopic: topic.trim() || questionTags[0] || tagInput.trim() || "質問から相談",
    });
    return `/dashboard?${params.toString()}`;
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
      <div className="mt-4 grid gap-2">
        <input
          value={helpSearch}
          onChange={(e) => setHelpSearch(e.target.value)}
          placeholder="質問を検索 (例: 線形, Python, 証明)"
          className="rounded-xl border border-[#d0d7de] bg-white px-4 py-2.5 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
        />
      </div>

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
          placeholder="質問タイトル"
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

        {helperCandidates.length > 0 ? (
          <div className="rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0969da]">Suggested Helpers</p>
                <p className="mt-1 text-sm font-bold text-[#24292f]">助けてくれそうな人</p>
              </div>
              <span className="rounded-full bg-[#ddf4ff] px-2.5 py-1 text-[11px] font-bold text-[#0969da]">
                {helperCandidates.length}人
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {helperCandidates.map(({ user, matchedTags }) => (
                <article key={user.id} className="rounded-xl border border-[#d8dee4] bg-white p-3">
                  <p className="text-sm font-black text-[#24292f]">{user.name}</p>
                  <p className="mt-0.5 text-xs text-[#57606a]">{user.group_label}</p>
                  {user.availability ? (
                    <p className="mt-2 rounded-full bg-[#dafbe1] px-2.5 py-1 text-[11px] font-bold text-[#116329]">
                      {user.availability}
                    </p>
                  ) : null}
                  {matchedTags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {matchedTags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#ddf4ff] px-2 py-0.5 text-[11px] font-semibold text-[#0969da]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <a
                    href={inviteHref(user.id)}
                    className="mt-3 block rounded-lg bg-[#0969da] px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-[#0550ae]"
                  >
                    この人を呼んでDiscussion
                  </a>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="詳細 (どこまで分かっていて、どこで詰まっているか)"
          rows={3}
          className="w-full resize-none rounded-xl border border-[#d0d7de] bg-white px-4 py-3 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
        />

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-full border border-[#d0d7de] bg-white px-3 py-1.5 text-xs font-bold text-[#57606a] transition hover:border-[#0969da] hover:text-[#0969da]">
            画像を添付
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => attachImage(e.target.files?.[0])}
            />
          </label>
          {imageName ? (
            <span className="rounded-full bg-[#ddf4ff] px-3 py-1 text-xs font-semibold text-[#0969da]">
              {imageName}
            </span>
          ) : null}
        </div>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageName ?? "添付画像プレビュー"}
            className="max-h-52 w-full rounded-xl border border-[#d8dee4] object-cover"
          />
        ) : null}

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
            const parsedTopic = parseHelpTopic(item.topic);
            const matched = item.matched_user_ids.includes(currentUserId);
            const isAuthor = item.user_id === currentUserId;
            const isOpen = item.status === "active";
            const canViewThread =
              !isOpen &&
              Boolean(item.chat_id) &&
              (item.user_id === currentUserId || item.responder_user_id === currentUserId);
            const threadIsOpen = openThreadIds.has(item.id);

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
                    <h3 className="mt-1.5 text-base font-black tracking-[-0.03em] text-[#24292f]">
                      {parsedTopic.title}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#57606a]">
                      投稿者: {item.user_name}
                    </p>
                    {parsedTopic.detail ? (
                      <p className="mt-2 text-sm leading-6 text-[#57606a]">{parsedTopic.detail}</p>
                    ) : null}
                    {parsedTopic.imageName ? (
                      <p className="mt-2 text-xs font-semibold text-[#0969da]">添付画像: {parsedTopic.imageName}</p>
                    ) : null}
                    {parsedTopic.imageUrl ? (
                      <img
                        src={parsedTopic.imageUrl}
                        alt={parsedTopic.imageName ?? "添付画像"}
                        className="mt-3 max-h-64 w-full rounded-xl border border-[#d8dee4] object-cover"
                      />
                    ) : null}
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
                        onClick={() => toggleThread(item.id)}
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs font-bold transition",
                          threadIsOpen
                            ? "border-[#24292f] bg-[#24292f] text-white"
                            : "border-[#0969da] bg-transparent text-[#0969da] hover:bg-[#ddf4ff]",
                        )}
                      >
                        {threadIsOpen ? "スレッドを閉じる" : "スレッドを開く"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {canViewThread && threadIsOpen ? (
                  <HelpThread
                    communityId={communityId}
                    requestId={item.id}
                    currentUserId={currentUserId}
                    onClose={() => toggleThread(item.id)}
                  />
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function HelpThread({
  communityId,
  requestId,
  currentUserId,
  onClose,
}: {
  communityId: string;
  requestId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [edgeAdded, setEdgeAdded] = useState(false);
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(false);
  const [discussionRequested, setDiscussionRequested] = useState(false);

  const chatQuery = useQuery({
    queryKey: ["sos-chat", requestId],
    queryFn: () => fetchChat(requestId),
    refetchInterval: 5_000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (body?: string) => {
      const response = await fetch(`/api/proxy/v1/sos/${requestId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body ?? message }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<HelpChat>;
    },
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["sos-chat", requestId] });
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
          from_user_id: currentUserId,
          to_user_id: toUserId,
          type: "project",
          strength: 3,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      setEdgeAdded(true);
      queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
    },
  });

  const chat = chatQuery.data;
  const hasDiscussionRequest =
    discussionRequested || Boolean(chat?.messages.some((msg) => msg.body.includes("議論しませんか")));
  const otherUserId = chat
    ? chat.requester_user_id === currentUserId
      ? chat.responder_user_id
      : chat.requester_user_id
    : null;

  return (
    <section className="mt-4 rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0969da]">Thread</p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#24292f]">
            {chat?.requester_name ?? "質問者"} × {chat?.responder_name ?? "回答者"}
          </h3>
          <p className="mt-1 text-sm text-[#57606a]">
            {chat?.topic ?? "スレッドを読み込み中..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#dafbe1] px-3 py-1 text-xs font-bold text-[#116329]">
            Connected
          </span>
          <button type="button" onClick={onClose} className="text-xs underline text-[#57606a]">
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
        {chat?.messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d0d7de] bg-white px-4 py-5 text-sm text-[#57606a]">
            まだコメントはありません. ここから状況を共有できます.
          </div>
        ) : null}
        {chat?.messages.map((msg) => {
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
              <div className="flex items-center justify-between gap-3 text-xs font-bold opacity-70">
                <span>{msg.sender_name}</span>
                <time dateTime={msg.created_at}>{formatChatTime(msg.created_at)}</time>
              </div>
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
              sendMessageMutation.mutate(undefined);
            }
          }}
          placeholder="コメントを入力"
          className="rounded-xl border border-[#d0d7de] bg-white px-4 py-3 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
        />
        <button
          type="button"
          disabled={!message.trim() || sendMessageMutation.isPending || chatQuery.isError}
          onClick={() => sendMessageMutation.mutate(undefined)}
          className="rounded-xl bg-[#1f883d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {sendMessageMutation.isPending ? "送信中..." : "送信"}
        </button>
      </div>

      {chat ? (
        <div className="mt-3 rounded-xl border border-[#7c3aed] bg-[#f5f3ff] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6d28d9]">Discussion Request</p>
              <p className="mt-1 text-sm font-bold text-[#24292f]">このHelpを議論に広げますか？</p>
            </div>
            {!hasDiscussionRequest ? (
              <button
                type="button"
                onClick={() => {
                  setDiscussionRequested(true);
                  sendMessageMutation.mutate("議論しませんか？OKならDiscussionを立てましょう。");
                }}
                className="rounded-full bg-[#7c3aed] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6d28d9]"
              >
                議論しませんか？
              </button>
            ) : (
              <a
                href={discussionThreadHref(chat)}
                className="rounded-full bg-[#1f883d] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1a7f37]"
              >
                OKして議論を立てる
              </a>
            )}
          </div>
        </div>
      ) : null}

      {otherUserId ? (
        <button
          type="button"
          onClick={() => setShowConnectionPrompt(true)}
          className="mt-3 w-full rounded-xl border border-[#0969da] px-4 py-2 text-sm font-bold text-[#0969da] transition hover:bg-[#ddf4ff]"
        >
          会話を終了してコネクション確認へ
        </button>
      ) : null}

      {showConnectionPrompt && otherUserId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#d8dee4] bg-white p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0969da]">5分Sync 完了</p>
            <h4 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#24292f]">
              この人をコネクションに追加しますか？
            </h4>
            <p className="mt-2 text-sm leading-6 text-[#57606a]">
              会話が終わったあとに追加することで, 知見ネットワークに自然につながりが残ります.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                disabled={edgeAdded || addEdgeMutation.isPending}
                onClick={() => addEdgeMutation.mutate({ toUserId: otherUserId })}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-bold transition",
                  edgeAdded
                    ? "cursor-not-allowed bg-[#eaeef2] text-slate-400"
                    : "bg-[#0969da] text-white hover:bg-[#0550ae]",
                )}
              >
                {edgeAdded ? "コネクション追加済み" : "コネクションに追加する"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConnectionPrompt(false);
                  if (edgeAdded) onClose();
                }}
                className="rounded-xl border border-[#d0d7de] px-4 py-2 text-sm font-bold text-[#57606a] hover:bg-[#f6f8fa]"
              >
                {edgeAdded ? "閉じる" : "あとで"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
