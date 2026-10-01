import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)}>
              <ChevronLeft /> Previous
            </Link>
          ) : (
            <span>
              <ChevronLeft /> Previous
            </span>
          )}
        </Button>
        <Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages}>
          {page < pages ? (
            <Link href={hrefFor(page + 1)}>
              Next <ChevronRight />
            </Link>
          ) : (
            <span>
              Next <ChevronRight />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
