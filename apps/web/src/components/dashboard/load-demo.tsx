"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, FormError } from "@/components/ui";
import { api } from "@/lib/api";

export function LoadDemoButton({ label = "Load demo data" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="primary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/api/settings/demo", { body: {} });
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't load demo data.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      <FormError message={error} />
    </div>
  );
}
