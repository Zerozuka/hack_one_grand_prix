"use client";

import { useState } from "react";

type CourseListItem = {
  id: string;
  course_title: string;
  instructor: string;
  term: string;
  day: string;
  period: string;
  departments: string[];
  lecture_plan_count: number;
};

type CourseDetail = {
  id: string;
  course_title: string;
  instructor: string;
  term: string;
  day: string;
  period: string;
  program: string;
  grade: string;
  credits: string;
  contents: string;
  lecture_plan: string[];
  departments: string[];
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SyllabusPanel({
  courses,
  communityId,
  courseQuery,
  mode,
  selectedUserId,
  currentPage,
  totalItems,
  pageSize,
  prevPageHref,
  nextPageHref,
}: {
  courses: CourseListItem[];
  communityId: string;
  courseQuery: string;
  mode: string;
  selectedUserId: string;
  currentPage: number;
  totalItems: number;
  pageSize: number;
  prevPageHref: string | null;
  nextPageHref: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(totalItems / pageSize);

  async function openDetail(courseId: string) {
    if (selectedId === courseId) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(courseId);
    setDetail(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/v1/courses/${courseId}`);
      if (res.ok) {
        const data = (await res.json()) as CourseDetail;
        setDetail(data);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-xl border border-[#d8dee4] bg-white shadow-sm">
        <svg viewBox="0 0 360 220" className="h-[190px] w-full">
          <rect width="360" height="220" rx="26" fill="#f8fafc" />
          <rect x="64" y="46" width="92" height="132" rx="18" fill="#ffffff" stroke="#38bdf8" strokeWidth="4" />
          <rect x="178" y="46" width="118" height="132" rx="18" fill="#ffffff" stroke="#cbd5e1" strokeWidth="4" />
          <path d="M86 78 h48 M86 102 h34 M86 126 h46" stroke="#38bdf8" strokeWidth="7" strokeLinecap="round" />
          <path d="M202 78 h62 M202 102 h46 M202 126 h68" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
        </svg>
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">Syllabus</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#24292f]">
            シラバスから知見を探す
          </h2>
          <form action="/dashboard" className="mt-5 grid gap-2">
            <input type="hidden" name="communityId" value={communityId} />
            <input type="hidden" name="view" value="syllabus" />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="selectedUserId" value={selectedUserId} />
            <input
              name="q"
              defaultValue={courseQuery}
              placeholder="線形代数 / Python"
              className="rounded-md border border-[#d0d7de] bg-white px-3 py-3 text-sm text-[#24292f] outline-none transition placeholder:text-[#57606a] focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
            />
            <button className="rounded-md bg-[#1f883d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37]">
              検索する
            </button>
          </form>
        </div>
      </aside>

      <section className="grid gap-3 content-start">
        {courses.map((course) => {
          const isSelected = selectedId === course.id;
          return (
            <article
              key={course.id}
              className={cx(
                "rounded-xl border shadow-sm transition",
                isSelected ? "border-[#0969da] bg-white" : "border-[#d8dee4] bg-white",
              )}
            >
              <button
                type="button"
                onClick={() => openDetail(course.id)}
                className="w-full p-5 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black tracking-[-0.03em] text-[#24292f]">
                      {course.course_title}
                    </p>
                    <p className="mt-1 text-sm text-[#57606a]">
                      {course.instructor} / {course.term} {course.day}{course.period}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#d8dee4] bg-[#f6f8fa] px-3 py-1 text-xs font-bold text-[#57606a]">
                      {course.lecture_plan_count} plans
                    </span>
                    <span className="text-xs text-[#57606a]">{isSelected ? "▲" : "▼"}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.departments.map((dept) => (
                    <span
                      key={dept}
                      className="rounded-full bg-[#eaeef2] px-3 py-1 text-xs font-semibold text-[#24292f]"
                    >
                      {dept}
                    </span>
                  ))}
                </div>
              </button>

              {isSelected ? (
                <div className="border-t border-[#d8dee4] px-5 py-4">
                  {loading ? (
                    <p className="text-sm text-[#57606a]">読み込み中...</p>
                  ) : detail ? (
                    <div className="space-y-4">
                      {detail.contents ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">授業内容</p>
                          <p className="mt-1 text-sm leading-6 text-[#24292f]">{detail.contents}</p>
                        </div>
                      ) : null}
                      {detail.lecture_plan.length > 0 ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#57606a]">
                            授業計画 ({detail.lecture_plan.length}回)
                          </p>
                          <ol className="mt-2 grid gap-1">
                            {detail.lecture_plan.map((topic, i) => (
                              <li key={i} className="flex gap-2 text-sm text-[#24292f]">
                                <span className="shrink-0 font-bold text-[#57606a]">{i + 1}.</span>
                                <span>{topic}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                      {detail.credits || detail.grade ? (
                        <div className="flex flex-wrap gap-4 text-sm text-[#57606a]">
                          {detail.credits ? <span>単位: {detail.credits}</span> : null}
                          {detail.grade ? <span>対象: {detail.grade}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-[#57606a]">詳細を取得できませんでした.</p>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between rounded-xl border border-[#d8dee4] bg-white px-5 py-3">
            <span className="text-xs text-[#57606a]">
              {currentPage + 1} / {totalPages} ページ ({totalItems} 件)
            </span>
            <div className="flex gap-2">
              {prevPageHref ? (
                <a
                  href={prevPageHref}
                  className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-3 py-1.5 text-xs font-semibold text-[#24292f] transition hover:bg-white"
                >
                  ← 前へ
                </a>
              ) : (
                <span className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-3 py-1.5 text-xs font-semibold text-[#57606a] opacity-40 cursor-not-allowed">
                  ← 前へ
                </span>
              )}
              {nextPageHref ? (
                <a
                  href={nextPageHref}
                  className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-3 py-1.5 text-xs font-semibold text-[#24292f] transition hover:bg-white"
                >
                  次へ →
                </a>
              ) : (
                <span className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-3 py-1.5 text-xs font-semibold text-[#57606a] opacity-40 cursor-not-allowed">
                  次へ →
                </span>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
