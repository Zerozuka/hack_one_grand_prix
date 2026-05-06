"use client";

type Theme = "light" | "dark";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SkillTree({
  tags,
  selectedTag,
  onSelect,
  theme = "light",
}: {
  tags: string[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
  theme?: Theme;
}) {
  const isDark = theme === "dark";
  const ui = {
    panel: isDark
      ? "border-[#30363d] bg-[#161b22] text-slate-100"
      : "border-[#d8dee4] bg-white text-[#24292f]",
    muted: isDark ? "text-slate-400" : "text-[#57606a]",
    text: isDark ? "text-slate-100" : "text-[#24292f]",
    badgeActive: isDark
      ? "border-[#1f6feb] bg-[#1f6feb] text-white"
      : "border-[#0969da] bg-[#0969da] text-white",
    badgeIdle: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-300 hover:border-[#58a6ff] hover:text-[#79c0ff]"
      : "border-[#d0d7de] bg-[#f6f8fa] text-[#24292f] hover:border-[#0969da] hover:text-[#0969da]",
  };

  const uniqueTags = [...new Set(tags)];

  return (
    <section className={cx("rounded-xl border p-5 shadow-sm", ui.panel)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", ui.muted)}>Skill Tree</p>
          <h3 className={cx("mt-1 text-lg font-black tracking-[-0.03em]", ui.text)}>
            あなたのスキルタグ
          </h3>
        </div>
        {selectedTag ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cx("text-xs underline", ui.muted)}
          >
            解除
          </button>
        ) : null}
      </div>

      {uniqueTags.length === 0 ? (
        <p className={cx("mt-4 text-sm", ui.muted)}>
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
                selectedTag === tag ? ui.badgeActive : ui.badgeIdle,
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
