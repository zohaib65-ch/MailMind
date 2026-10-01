import { Mail, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/** Sign-in is "Sign in with Google": it identifies you and connects your Gmail in one step. */
export function LoginCard({ gmailEnabled, error }: { gmailEnabled: boolean; error?: string }) {
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
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {gmailEnabled ? (
          <Button asChild size="lg" className="w-full">
            <a href="/api/auth/google">
              <Mail />
              Sign in with Google
            </a>
          </Button>
        ) : (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Gmail is not set up yet</AlertTitle>
            <AlertDescription>
              Create a Google OAuth client and set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in{" "}
              <code>.env</code>, then restart. See <code>docs/02-getting-started.md</code>.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        MailMind asks for Gmail access to read your mail, change labels (archive, star, read) and send replies you approve. It
        never deletes email.
      </CardFooter>
    </Card>
  );
}
