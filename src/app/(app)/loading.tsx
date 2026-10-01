import { LoadingState } from "@/components/common/states";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <LoadingState rows={6} />
    </div>
  );
}
