import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";

async function fetchCommunities() {
  const apiBase = process.env.API_BASE_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiBase}/v1/communities`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json() as Array<{ id: string; name: string }>;
    return data.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return [
      { id: "campus-east", name: "東キャンパス 理工学部" },
      { id: "campus-west", name: "西キャンパス 文理融合" },
    ];
  }
}

export default async function RegisterPage() {
  const session = await getAuthSession();
  if (session) {
    redirect("/dashboard");
  }

  const communities = await fetchCommunities();

  return (
    <main className="min-h-screen bg-[#f6f8fa] px-6 py-8 text-[#24292f] md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <RegisterForm communities={communities} />
      </div>
    </main>
  );
}
