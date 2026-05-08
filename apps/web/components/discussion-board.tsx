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

type UserProfile = {
  id: string;
  name: string;
  group_label: string;
  role_label: string;
  node_role: string;
  bio: string;
  availability: string | null;
  interests: string[];
  goals: string[];
  activity_tags: string[];
  relationship_count: number;
};

type DiscussionMeta = {
  style: string;
  topicType: "question" | "study" | "project" | "review";
  detail: string;
  imageName: string | null;
  suggestedReason: string | null;
};

const topicTypes: Array<{ id: DiscussionMeta["topicType"]; label: string; body: string }> = [
  { id: "question", label: "質問", body: "詰まりを一緒にほどく" },
  { id: "study", label: "勉強会", body: "同じ範囲を一緒に進める" },
  { id: "project", label: "制作", body: "手を動かして作る" },
  { id: "review", label: "復習", body: "終わった内容を確認する" },
];

const locationCandidates = [
  { name: "日吉図書館 1F ラーニングコモンズ", area: "静かめ", map: "H-1", hint: "証明・読解など集中したい話に向いています." },
  { name: "日吉食堂 奥テーブル", area: "集まりやすい", map: "H-2", hint: "5分Syncや軽い相談に集まりやすい場所です." },
  { name: "第4校舎 独立館 自習スペース", area: "ホワイトボード", map: "H-3", hint: "数式や図を描きながら議論しやすい場所です." },
  { name: "日吉駅側 銀杏並木入口", area: "合流地点", map: "H-0", hint: "初対面でも待ち合わせしやすい場所です." },
];

const topicSuggestions = [
  "線形代数",
  "微分積分",
  "確率統計",
  "情報基礎",
  "物理学基礎",
  "Python実装",
  "データ構造",
  "英語プレゼン",
];

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function parseMeta(format: string): DiscussionMeta {
  try {
    const parsed = JSON.parse(format) as Partial<DiscussionMeta>;
    return {
      style: parsed.style ?? "対面議論",
      topicType: parsed.topicType ?? "question",
      detail: parsed.detail ?? "",
      imageName: parsed.imageName ?? null,
      suggestedReason: parsed.suggestedReason ?? null,
    };
  } catch {
    return {
      style: format || "対面議論",
      topicType: "question",
      detail: "",
      imageName: null,
      suggestedReason: null,
    };
  }
}

function stringifyMeta(meta: DiscussionMeta) {
  return JSON.stringify(meta);
}

function recommendLocation(topic: string, invitedUsers: UserProfile[]) {
  const text = `${topic} ${invitedUsers.flatMap((user) => [...user.interests, ...user.goals]).join(" ")}`;
  if (/証明|線形|解析|数学/.test(text)) return locationCandidates[0];
  if (/実装|Python|制作|プロジェクト|コード/.test(text)) return locationCandidates[2];
  if (invitedUsers.length >= 2) return locationCandidates[1];
  return locationCandidates[3];
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
  users,
  initialInviteUserId,
  initialTopic,
}: {
  communityId: string;
  currentUserId: string;
  initialEvents: DiscussionTopic[];
  users: UserProfile[];
  initialInviteUserId?: string;
  initialTopic?: string;
}) {
  const queryClient = useQueryClient();
  const [newTopic, setNewTopic] = useState(initialTopic ?? "");
  const [location, setLocation] = useState("");
  const [topicType, setTopicType] = useState<DiscussionMeta["topicType"]>("question");
  const [detail, setDetail] = useState("");
  const [imageName, setImageName] = useState<string | null>(null);
  const [inviteFilter, setInviteFilter] = useState("");
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>(
    initialInviteUserId && initialInviteUserId !== currentUserId ? [initialInviteUserId] : [],
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const [threadDrafts, setThreadDrafts] = useState<Record<string, string>>({});
  const [threadMessages, setThreadMessages] = useState<Record<string, Array<{ id: string; userId: string; body: string }>>>({});

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

  useEffect(() => {
    if (initialInviteUserId && initialInviteUserId !== currentUserId) {
      setSelectedInviteIds((prev) => prev.includes(initialInviteUserId) ? prev : [...prev, initialInviteUserId]);
    }
  }, [currentUserId, initialInviteUserId]);

  useEffect(() => {
    if (initialTopic) {
      setNewTopic((prev) => prev || initialTopic);
      setTopicType("question");
    }
  }, [initialTopic]);

  const activeTopics = topicsQuery.data.filter((t) => t.is_live);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const invitedUsers = selectedInviteIds.map((id) => usersById.get(id)).filter(Boolean) as UserProfile[];
  const inviteNeedle = inviteFilter.trim().toLowerCase();
  const filteredInviteUsers = users
    .filter((user) => user.id !== currentUserId)
    .filter((user) => {
      if (!inviteNeedle) return true;
      const haystack = [
        user.name,
        user.group_label,
        user.role_label,
        user.bio,
        ...user.interests,
        ...user.goals,
        ...user.activity_tags,
      ].join(" ").toLowerCase();
      return haystack.includes(inviteNeedle);
    })
    .slice(0, 12);
  const matchedTopicSuggestions =
    newTopic.trim().length > 0
      ? topicSuggestions.filter((suggestion) => suggestion.includes(newTopic.trim()) && suggestion !== newTopic).slice(0, 4)
      : topicSuggestions.slice(0, 4);
  const suggestedLocation = recommendLocation(newTopic, invitedUsers);
  const endedCount = topicsQuery.data.length - activeTopics.length;
  const alreadyInTopic = activeTopics.some((t) => t.participant_ids.includes(currentUserId));
  const alreadyCreatedTopic = activeTopics.some((t) => t.creator_user_id === currentUserId);
  const createBlocked = alreadyInTopic || alreadyCreatedTopic;
  const createBlockedTitle = alreadyCreatedTopic
    ? "既に自分が作成した議論があります"
    : alreadyInTopic
      ? "既に別の議論に参加中です"
      : undefined;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/proxy/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community_id: communityId,
          title: newTopic,
          time_label: "今すぐ",
          format: stringifyMeta({
            style: "対面議論",
            topicType,
            detail,
            imageName,
            suggestedReason: suggestedLocation.hint,
          }),
          participant_ids: selectedInviteIds,
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
      setDetail("");
      setImageName(null);
      setSelectedInviteIds([]);
      setTopicType("question");
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

  function toggleInvite(userId: string) {
    setSelectedInviteIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function pushReaction(topicId: string, emoji: string) {
    setReactions((prev) => ({
      ...prev,
      [topicId]: [...(prev[topicId] ?? []), emoji],
    }));
  }

  function notifyArrival(topic: DiscussionTopic) {
    const names = topic.participant_names.filter(Boolean).join(", ");
    setNotice(`${names || "参加者"} に「5分後に着きます」を送る準備ができました.`);
  }

  function postThreadMessage(topicId: string) {
    const body = threadDrafts[topicId]?.trim();
    if (!body) return;
    setThreadMessages((prev) => ({
      ...prev,
      [topicId]: [
        ...(prev[topicId] ?? []),
        { id: `${topicId}-${Date.now()}`, userId: currentUserId, body },
      ],
    }));
    setThreadDrafts((prev) => ({ ...prev, [topicId]: "" }));
  }

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
      <div className="mt-6 rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-4">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {topicTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setTopicType(type.id)}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                    topicType === type.id
                      ? "border-[#24292f] bg-[#24292f] text-white"
                      : "border-[#d0d7de] bg-white text-[#57606a] hover:border-[#0969da] hover:text-[#0969da]",
                  )}
                  title={type.body}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTopic.trim() && !createMutation.isPending && !createBlocked) {
                  createMutation.mutate();
                }
              }}
              placeholder="トピック (例: 統計学の検定手法)"
              className="w-full rounded-xl border border-[#d0d7de] bg-white px-4 py-3 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
            />
            {matchedTopicSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <span className="self-center text-xs font-semibold text-[#57606a]">補完:</span>
                {matchedTopicSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setNewTopic(suggestion)}
                    className="rounded-full border border-[#0969da] bg-[#ddf4ff] px-3 py-1 text-xs font-bold text-[#0969da] transition hover:bg-[#ccecff]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="詳細 (今どこで詰まっているか / 何を決めたいか)"
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
                  onChange={(e) => setImageName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              {imageName ? (
                <span className="rounded-full bg-[#ddf4ff] px-3 py-1 text-xs font-semibold text-[#0969da]">
                  {imageName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-[#d8dee4] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">呼ぶ友達</p>
                <span className="rounded-full bg-[#eaeef2] px-2.5 py-0.5 text-[11px] font-bold text-[#57606a]">
                  慶應 日吉キャンパス
                </span>
              </div>
              <input
                value={inviteFilter}
                onChange={(e) => setInviteFilter(e.target.value)}
                placeholder="名前・学部・タグで絞り込み (例: 線形, Python)"
                className="mt-3 w-full rounded-lg border border-[#d0d7de] bg-white px-3 py-2 text-xs text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
              />
              <div className="mt-3 grid max-h-36 gap-2 overflow-y-auto pr-1">
                {filteredInviteUsers.map((user) => {
                  const selected = selectedInviteIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleInvite(user.id)}
                      className={cx(
                        "rounded-lg border px-3 py-2 text-left transition",
                        selected
                          ? "border-[#0969da] bg-[#ddf4ff]"
                          : "border-[#d8dee4] bg-white hover:border-[#0969da]",
                      )}
                    >
                      <span className="block text-sm font-bold text-[#24292f]">{user.name}</span>
                      <span className="block text-xs text-[#57606a]">{user.group_label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[#d8dee4] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">おすすめ場所</p>
                  <p className="mt-1 text-sm font-black text-[#24292f]">{suggestedLocation.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#57606a]">{suggestedLocation.hint}</p>
                </div>
                <span className="rounded-full bg-[#eaeef2] px-2.5 py-1 text-xs font-bold text-[#57606a]">
                  {suggestedLocation.map}
                </span>
              </div>
              <div className="mt-3 grid h-24 place-items-center rounded-lg border border-dashed border-[#d0d7de] bg-[#f6f8fa] text-xs font-bold text-[#57606a]">
                CAMPUS MAP / {suggestedLocation.area}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="場所 (例: 中央食堂, 図書館3F)"
                  className="rounded-xl border border-[#d0d7de] bg-white px-4 py-2.5 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
                />
                <button
                  type="button"
                  onClick={() => setLocation(suggestedLocation.name)}
                  className="rounded-xl border border-[#0969da] px-4 py-2.5 text-xs font-bold text-[#0969da] hover:bg-[#ddf4ff]"
                >
                  ここにする
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!newTopic.trim() || createMutation.isPending || createBlocked}
            onClick={() => createMutation.mutate()}
            title={createBlockedTitle}
            className="rounded-xl bg-[#1f883d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {createMutation.isPending ? "作成中..." : createBlocked ? "進行中" : "議論を始める"}
          </button>
        </div>
      </div>
      {createBlocked || endedCount > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#57606a]">
          {createBlocked ? (
            <span className="rounded-full bg-[#eaeef2] px-3 py-1">
              {alreadyCreatedTopic
                ? "自分が作成した進行中の議論は1件までです."
                : "参加中の議論があるため, 新規作成は一時停止中です."}
            </span>
          ) : null}
          {endedCount > 0 ? (
            <span className="rounded-full bg-[#f6f8fa] px-3 py-1">終了済み {endedCount} 件は非表示です.</span>
          ) : null}
        </div>
      ) : null}

      {/* Topic list */}
      <div className="mt-6 grid gap-3">
        {activeTopics.length === 0 ? (
          <div className="rounded-xl border border-[#d8dee4] bg-white px-4 py-5 text-sm text-[#57606a] shadow-sm">
            まだ議論トピックはありません. 最初のトピックを作成してみましょう.
          </div>
        ) : (
          activeTopics.map((topic) => {
            const isParticipant = topic.participant_ids.includes(currentUserId);
            const isCreator = topic.creator_user_id === currentUserId;
            const isExpanded = expandedId === topic.id;
            const meta = parseMeta(topic.format);
            const typeLabel = topicTypes.find((type) => type.id === meta.topicType)?.label ?? "質問";

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
                        <span className="rounded-full bg-[#ddf4ff] px-2.5 py-0.5 text-[11px] font-bold text-[#0969da]">
                          {typeLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                        className="mt-1.5 block text-left text-base font-black text-[#24292f] transition hover:opacity-80"
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

                      {topic.is_live && isCreator ? (
                        <button
                          type="button"
                          onClick={() => endMutation.mutate(topic.id)}
                          disabled={endMutation.isPending}
                          className="rounded-full border border-[#d0d7de] px-3 py-1 text-xs font-bold text-[#57606a] transition hover:border-red-400 hover:text-red-600"
                        >
                          終了
                        </button>
                      ) : null}

                      {isParticipant ? (
                        <button
                          type="button"
                          onClick={() => notifyArrival(topic)}
                          className="rounded-full border border-[#0969da] px-3 py-1 text-xs font-bold text-[#0969da] transition hover:bg-[#ddf4ff]"
                        >
                          5分後に着きます
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
                    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                      <div>
                        <p className="text-xs text-[#57606a]">
                          形式: {meta.style} / {topic.time_label}
                        </p>
                        {isParticipant ? (
                          <div className="mt-3 rounded-xl border border-[#d8dee4] bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">参加者限定 Details</p>
                            <p className="mt-2 text-sm leading-6 text-[#24292f]">
                              {meta.detail || "詳細はまだありません. 参加者で話しながら詰めていきましょう."}
                            </p>
                            {meta.imageName ? (
                              <p className="mt-2 text-xs font-semibold text-[#0969da]">添付画像: {meta.imageName}</p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {["👍", "🙋", "👀", "🔥"].map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => pushReaction(topic.id, emoji)}
                                  className="rounded-full border border-[#d0d7de] bg-white px-3 py-1 text-sm transition hover:border-[#0969da]"
                                >
                                  {emoji}
                                </button>
                              ))}
                              {(reactions[topic.id] ?? []).map((emoji, index) => (
                                <span key={`${emoji}-${index}`} className="rounded-full bg-[#ddf4ff] px-2.5 py-1 text-xs">
                                  {emoji}
                                </span>
                              ))}
                            </div>
                            <div className="mt-4 rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-3">
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">Thread</p>
                              <div className="mt-3 grid gap-2">
                                {(threadMessages[topic.id] ?? []).length === 0 ? (
                                  <p className="text-sm text-[#57606a]">まだコメントはありません. ここで議論を進められます.</p>
                                ) : null}
                                {(threadMessages[topic.id] ?? []).map((message) => {
                                  const author = usersById.get(message.userId);
                                  return (
                                    <div key={message.id} className="rounded-xl border border-[#d8dee4] bg-white px-3 py-2">
                                      <p className="text-xs font-bold text-[#57606a]">{author?.name ?? "参加者"}</p>
                                      <p className="mt-1 text-sm leading-6 text-[#24292f]">{message.body}</p>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                                <input
                                  value={threadDrafts[topic.id] ?? ""}
                                  onChange={(e) => setThreadDrafts((prev) => ({ ...prev, [topic.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      postThreadMessage(topic.id);
                                    }
                                  }}
                                  placeholder="コメントを入力"
                                  className="rounded-xl border border-[#d0d7de] bg-white px-4 py-2.5 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da]"
                                />
                                <button
                                  type="button"
                                  onClick={() => postThreadMessage(topic.id)}
                                  disabled={!threadDrafts[topic.id]?.trim()}
                                  className="rounded-xl bg-[#0969da] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0550ae] disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                  送信
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed border-[#d0d7de] bg-white px-4 py-4 text-sm text-[#57606a]">
                            詳細・添付・連絡は参加者だけが見られます. 参加するとSlackのスレッドのように内容を確認できます.
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#d8dee4] bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">Place</p>
                        <p className="mt-1 text-sm font-black text-[#24292f]">{topic.location ?? "場所未定"}</p>
                        <div className="mt-3 grid h-24 place-items-center rounded-lg border border-dashed border-[#d0d7de] bg-[#f6f8fa] text-xs font-bold text-[#57606a]">
                          MAP PREVIEW
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#57606a]">
                          {meta.suggestedReason ?? "集まりやすい場所を選んでください."}
                        </p>
                      </div>
                    </div>

                    {topic.participant_ids.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {topic.participant_ids.map((id, index) => {
                          const participant = usersById.get(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => participant && setProfileUser(participant)}
                              className="rounded-full bg-[#eaeef2] px-3 py-1 text-xs font-semibold text-[#24292f] transition hover:bg-[#ddf4ff] hover:text-[#0969da]"
                            >
                              {participant?.name ?? topic.participant_names[index] ?? "参加者"}
                            </button>
                          );
                        })}
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

      {notice ? (
        <div className="mt-4 rounded-xl border border-[#0969da] bg-[#ddf4ff] px-4 py-3 text-sm font-bold text-[#0550ae]">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-3 text-xs underline opacity-70 hover:opacity-100"
          >
            閉じる
          </button>
        </div>
      ) : null}

      {profileUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setProfileUser(null)}>
          <div
            className="w-full max-w-md rounded-xl border border-[#d8dee4] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">Participant</p>
                <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#24292f]">{profileUser.name}</h3>
                <p className="mt-1 text-sm text-[#57606a]">{profileUser.group_label} / {profileUser.role_label}</p>
              </div>
              <button
                type="button"
                onClick={() => setProfileUser(null)}
                className="shrink-0 rounded-full px-3 py-1 text-sm text-[#57606a] hover:text-[#24292f]"
              >
                ✕
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#57606a]">
              {profileUser.bio || "プロフィールはまだありません."}
            </p>
            {profileUser.availability ? (
              <p className="mt-3 rounded-xl bg-[#dafbe1] px-3 py-2 text-xs font-bold text-[#116329]">
                {profileUser.availability}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[...profileUser.interests, ...profileUser.goals, ...profileUser.activity_tags].slice(0, 12).map((tag) => (
                <span key={tag} className="rounded-full bg-[#ddf4ff] px-2.5 py-0.5 text-xs font-semibold text-[#0969da]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
