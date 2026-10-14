"use client";

import { Button } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel mx-auto max-w-lg p-8 text-center">
      <h1 className="font-display text-xl font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm text-ink2">Something went wrong while loading your data. Your records are safe. Try again, or come back in a moment.</p>
      <Button className="mt-5" variant="primary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
