"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/common/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_LABELS, EMAIL_CATEGORIES, URGENCY_LEVELS } from "@/schemas/common";

const VIEWS = [
  { value: "inbox", label: "Inbox" },
  { value: "unread", label: "Unread" },
  { value: "needs_reply", label: "Needs reply" },
  { value: "important", label: "Important" },
  { value: "sent", label: "Sent" },
  { value: "archived", label: "Archived" },
];

/** Filters live in the URL (?view=&category=&urgency=&q=), so views are shareable and the server renders them. */
export function InboxFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <Tabs value={params.get("view") ?? "inbox"} onValueChange={(v) => update("view", v === "inbox" ? null : v)}>
        <TabsList className="flex-wrap">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.value} value={v.value}>
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
        <Select value={params.get("category") ?? "all"} onValueChange={(v) => update("category", v)}>
          <SelectTrigger size="sm" className="w-36" aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EMAIL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get("urgency") ?? "all"} onValueChange={(v) => update("urgency", v)}>
          <SelectTrigger size="sm" className="w-32" aria-label="Urgency">
            <SelectValue placeholder="Urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any urgency</SelectItem>
            {URGENCY_LEVELS.map((u) => (
              <SelectItem key={u} value={u} className="capitalize">
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          key={params.get("q") ?? ""}
          className="w-full sm:w-64"
          placeholder="Keyword search"
          defaultValue={params.get("q") ?? ""}
          onSearch={(q) => update("q", q || null)}
        />
      </div>
    </div>
  );
}
