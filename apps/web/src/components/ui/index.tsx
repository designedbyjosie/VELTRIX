"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Loader2, X } from "lucide-react";
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------- buttons

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "brand-gradient text-white shadow-[0_8px_24px_-10px_rgba(80,110,255,.8)] hover:brightness-110",
  secondary: "bg-panel-hi text-ink border border-line hover:border-blue/60",
  ghost: "text-ink2 hover:text-ink hover:bg-white/5",
  danger: "bg-neg/10 text-neg border border-neg/40 hover:bg-neg/20",
};
const sizes = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2" };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", loading, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50", variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({ href, variant = "secondary", size = "md", className, children, ...rest }: { href: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={clsx("inline-flex shrink-0 items-center justify-center rounded-[10px] font-medium transition", variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------- surfaces

export function Card({ title, action, children, className, bodyClassName, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={clsx("panel", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      <div className={clsx("p-5", (title || action) && "pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

const badgeTones = {
  neutral: "bg-white/5 text-ink2 border-line",
  pos: "bg-pos/10 text-pos border-pos/30",
  neg: "bg-neg/10 text-neg border-neg/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  info: "bg-blue/10 text-[#8DB6FF] border-blue/30",
  violet: "bg-violet/15 text-[#BBA8FF] border-violet/35",
  demo: "bg-[#FFB547]/10 text-[#FFCF85] border-[#FFB547]/35",
};
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", children, className, title }: { tone?: BadgeTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return (
    <Badge tone="demo" title="Illustrative demonstration data — not your real financial information.">
      {label}
    </Badge>
  );
}

export function Delta({ value, goodWhen = "up", suffix = "%", className }: { value: number | null; goodWhen?: "up" | "down" | "neutral"; suffix?: string; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={clsx("text-ink3", className)}>—</span>;
  const up = value > 0;
  const good = goodWhen === "neutral" ? null : goodWhen === "up" ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx("num inline-flex items-center gap-0.5 font-medium", value === 0 || good === null ? "text-ink2" : good ? "text-pos" : "text-neg", className)}>
      {value !== 0 && <Icon className="size-3.5" aria-hidden />}
      {Math.abs(value).toFixed(1)}
      {suffix}
      <span className="sr-only">{up ? "increase" : "decrease"}</span>
    </span>
  );
}

export function Progress({ value, tone = "brand", className, label }: { value: number; tone?: "brand" | "pos" | "warn" | "neg"; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const fill = { brand: "brand-gradient", pos: "bg-pos", warn: "bg-warn", neg: "bg-neg" }[tone];
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={clsx("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center rounded-[12px] border border-dashed border-line px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-full bg-blue/10 text-cyan">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("size-5 animate-spin text-cyan", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-white/[0.06]", className)} aria-hidden />;
}

export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-line-soft bg-bg2/70 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("rounded-[8px] font-medium transition", size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs", value === o.value ? "bg-blue/20 text-ink shadow-[inset_0_0_0_1px_rgba(40,120,255,.5)]" : "text-ink3 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- forms

export function Field({ label, error, hint, children, htmlFor, className }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; htmlFor: string; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-neg" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink3">{hint}</p>
      ) : null}
    </div>
  );
}

/** Controls are full-width unless the caller sets its own width class. */
const width = (className?: string) => (/(^|\s)(w-|min-w-|max-w-|flex-1)/.test(className ?? "") ? undefined : "w-full");
const control = "h-10 rounded-[10px] border border-line bg-bg2 px-3 text-sm text-ink placeholder:text-ink3 outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25 aria-[invalid=true]:border-neg";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(control, width(className), className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx(control, width(className), "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394A7C5%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_10px_center] bg-no-repeat pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(control, width(className), "h-auto min-h-20 py-2", className)} {...rest} />;
});

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] border border-neg/40 bg-neg/10 px-3 py-2 text-sm text-neg">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------- dialog

export function Modal({ open, onClose, title, description, children, wide }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={clsx("glass m-auto w-[calc(100%-32px)] rounded-[18px] p-0 text-ink shadow-2xl backdrop:bg-[#02060f]/75 backdrop:backdrop-blur-sm", wide ? "max-w-2xl" : "max-w-md")}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-display text-lg font-semibold">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-ink2">{description}</p>}
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-ink3 hover:bg-white/5 hover:text-ink" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmButton({ onConfirm, title, body, confirmLabel = "Delete", children, variant = "ghost", size = "sm", className, ariaLabel }: { onConfirm: () => Promise<void> | void; title: string; body?: ReactNode; confirmLabel?: string; children: ReactNode; variant?: Variant; size?: "sm" | "md"; className?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)} aria-label={ariaLabel}>
        {children}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={body}>
        <FormError message={error} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
                setOpen(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "That didn't work.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- toast

interface Toast {
  id: number;
  message: string;
  tone: "pos" | "neg" | "neutral";
}
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "pos") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={clsx("glass pointer-events-auto animate-rise rounded-[12px] px-4 py-2.5 text-sm shadow-xl", t.tone === "neg" ? "text-neg" : t.tone === "pos" ? "text-ink" : "text-ink2")}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function ProvenanceNote({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-4 text-ink3">{children}</p>;
}
