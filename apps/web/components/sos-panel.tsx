"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type SosItem = {
  id: string;
  user_name: string;
  topic: string;
  status: "active" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

async function fetchSos(communityId: string) {
  const response = await fetch(`/api/proxy/v1/sos?community_id=${communityId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as SosItem[];
}

export function SosPanel({
  communityId,
  initialItems,
}: {
  communityId: string;
  initialItems: SosItem[];
}) {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");

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
      return response.json();
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
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sos", communityId] });
    },
  });

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">SOS</p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">5分Sync ヘルプリクエスト</h2>
        </div>
        <p className="max-w-sm text-right text-sm leading-6 text-stone-500">
          WebSocket API は用意してあり、画面はまず BFF 経由の永続データを使って安定表示する構成です。
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="例: 線形代数の証明で5分だけ相談したい"
          className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-stone-900"
        />
        <button
          type="button"
          disabled={!topic.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="rounded-full bg-[#b55233] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#9c4227] disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {createMutation.isPending ? "送信中..." : "SOS を出す"}
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {sosQuery.data.length === 0 ? (
          <div className="rounded-3xl bg-stone-50 px-4 py-5 text-sm text-stone-500">
            まだ SOS はありません。
          </div>
        ) : (
          sosQuery.data.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-stone-200 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">{item.user_name}</p>
                  <p className="mt-1 text-sm text-stone-600">{item.topic}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                    {item.status === "active" ? "募集中" : "解決済み"}
                  </span>
                  {item.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => resolveMutation.mutate(item.id)}
                      className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-900"
                    >
                      対応する
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
