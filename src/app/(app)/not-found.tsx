import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg pt-10">
      <EmptyState
        icon={SearchX}
        title="Not found"
        description="This email or page doesn't exist, or it belongs to another account."
        action={
          <Button asChild size="sm">
            <Link href="/inbox">Back to inbox</Link>
          </Button>
        }
      />
    </div>
  );
}
