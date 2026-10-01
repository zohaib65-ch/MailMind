import type { Metadata } from "next";
import { LoginCard } from "@/components/auth/login-card";
import { getEnv, isGmailConfigured } from "@/lib/utils/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <LoginCard mockMode={getEnv().MOCK_EMAIL_MODE} gmailEnabled={isGmailConfigured()} error={error} next={next} />
    </main>
  );
}
