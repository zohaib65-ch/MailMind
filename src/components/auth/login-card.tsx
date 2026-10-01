"use client";

import { Inbox, LoaderCircle, Mail, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/common/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api-client";

export function LoginCard({
  mockMode,
  gmailEnabled,
  error,
  next,
}: {
  mockMode: boolean;
  gmailEnabled: boolean;
  error?: string;
  next?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>(error);

  async function startDemo() {
    setLoading(true);
    setMessage(undefined);
    try {
      await api("/api/auth/demo", { method: "POST" });
      // Only allow same-site relative redirects.
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not start the demo");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-3">
        <Logo className="text-lg" />
        <div className="space-y-1">
          <CardTitle className="text-xl">Your inbox, understood</CardTitle>
          <CardDescription>
            MailMind classifies, summarises and drafts replies with AI — and never sends anything without your approval.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {mockMode && (
          <Button className="w-full" size="lg" onClick={startDemo} disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" /> : <Inbox />}
            {loading ? "Loading the demo inbox…" : "Try it with a demo inbox"}
          </Button>
        )}
        {mockMode && gmailEnabled && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" /> or <Separator className="flex-1" />
          </div>
        )}
        {gmailEnabled ? (
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href="/api/auth/google">
              <Mail />
              Connect Gmail
            </a>
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Gmail sign-in is off. Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to enable it.
          </p>
        )}
      </CardContent>
      {mockMode && (
        <CardFooter className="text-xs text-muted-foreground">
          The demo inbox is fictional mail for “Sam Taylor”. Sending only records the reply — nothing leaves your machine.
        </CardFooter>
      )}
    </Card>
  );
}
