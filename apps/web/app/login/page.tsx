import { getAuthSession } from "@/lib/auth";

import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getAuthSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(181,82,51,0.18),_transparent_30%),linear-gradient(135deg,_#f6f2ea_0%,_#efe8da_45%,_#f8f4ed_100%)] px-6 py-10 md:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <LoginForm />
      </div>
    </main>
  );
}
