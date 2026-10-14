"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { api } from "@/lib/api";

export function WatchButton({ symbol, watching }: { symbol: string; watching: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  if (watching)
    return (
      <Button size="sm" disabled>
        <Star className="size-4 fill-current text-warn" /> On watchlist
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="primary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/watchlist", { body: { symbol } });
          toast(`${symbol} added to watchlist`);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <Star className="size-4" /> Add to watchlist
    </Button>
  );
}
