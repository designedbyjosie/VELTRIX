"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button, Field, FormError, Select, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { Account } from "./transactions-view";

interface Preview {
  rowCount: number;
  importable: number;
  duplicates: number;
  errorCount: number;
  errors: { line: number; message: string }[];
  preview: { date: string; merchant: string; amountCents: number; category: string | null }[];
  imported?: number;
}

export function CsvImport({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [accountId, setAccountId] = useState("");
  const [invert, setInvert] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function run(dryRun: boolean, content = file?.content, name = file?.name) {
    if (!content) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<Preview>("/api/transactions/import", { body: { filename: name, content, accountId: accountId || null, invertSign: invert, dryRun } });
      if (dryRun) setPreview(r);
      else {
        toast(`Imported ${r.imported} transaction${r.imported === 1 ? "" : "s"}${r.duplicates ? `, skipped ${r.duplicates} duplicate${r.duplicates === 1 ? "" : "s"}` : ""}`);
        onDone();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Import failed.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[12px] border border-dashed border-line px-4 py-6 text-center hover:border-blue/60">
        <Upload className="size-5 text-cyan" aria-hidden />
        <span className="text-ink">{file ? file.name : "Choose a .csv file"}</span>
        <span className="text-xs text-ink3">Up to 2 MB, 5,000 rows. Processed on VELTRIX servers; the file itself isn&apos;t stored.</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 2_000_000) {
              setError("That file is larger than 2 MB.");
              return;
            }
            const content = await f.text();
            setFile({ name: f.name, content });
            await run(true, content, f.name);
          }}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Assign to account" htmlFor="imp-acc">
          <Select id="imp-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">No account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-end gap-2 pb-2 text-ink2">
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="accent-[#2878FF]" />
          My bank lists spending as positive numbers
        </label>
      </div>
      <FormError message={error} />
      {preview && (
        <div className="panel-inner space-y-3 p-4">
          <p>
            <span className="font-medium text-ink">{preview.importable}</span> new · <span className="text-ink2">{preview.duplicates} already imported</span> · <span className={preview.errorCount ? "text-warn" : "text-ink2"}>{preview.errorCount} rows with problems</span>
          </p>
          {preview.preview.length > 0 && (
            <table className="w-full text-xs">
              <tbody>
                {preview.preview.map((r, i) => (
                  <tr key={i} className="border-b border-line-soft/60">
                    <td className="num py-1 text-ink3">{r.date}</td>
                    <td className="py-1">{r.merchant}</td>
                    <td className="py-1 text-ink3">{r.category ?? "—"}</td>
                    <td className="num py-1 text-right">{money(r.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview.errors.length > 0 && (
            <details className="text-xs text-ink2">
              <summary className="cursor-pointer text-warn">Show problems</summary>
              <ul className="mt-2 space-y-0.5">
                {preview.errors.slice(0, 20).map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {file && (
          <Button onClick={() => run(true)} loading={busy && !preview}>
            Refresh preview
          </Button>
        )}
        <Button variant="primary" disabled={!preview || preview.importable === 0} loading={busy && !!preview} onClick={() => run(false)}>
          Import {preview?.importable ?? ""} transactions
        </Button>
      </div>
    </div>
  );
}
