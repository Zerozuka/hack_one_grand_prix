"use client";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SkillTree({
  tags,
  selectedTag,
  onSelect,
}: {
  tags: string[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
}) {
  const uniqueTags = [...new Set(tags)];

  return (
    <section className="rounded-xl border border-[#d8dee4] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">Skill Tree</p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#24292f]">
            あなたのスキルタグ
          </h3>
        </div>
        {selectedTag ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs underline text-[#57606a]"
          >
            解除
          </button>
        ) : null}
      </div>

      {uniqueTags.length === 0 ? (
        <p className="mt-4 text-sm text-[#57606a]">
          Help タブで質問を投稿するとスキルタグが表示されます.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {uniqueTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSelect(selectedTag === tag ? null : tag)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                selectedTag === tag
                  ? "border-[#0969da] bg-[#0969da] text-white"
                  : "border-[#d0d7de] bg-[#f6f8fa] text-[#24292f] hover:border-[#0969da] hover:text-[#0969da]",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
