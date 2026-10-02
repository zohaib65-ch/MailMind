import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/login-card";
import { isGmailConfigured } from "@/lib/utils/env";
import { getCurrentUser } from "@/services/auth/dal";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <LoginCard gmailEnabled={isGmailConfigured()} error={error} />
    </main>
  );
}
