import type { ReactNode } from "react";

export function Mark() {
  return <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-stamp-dark text-2xl font-extrabold text-white shadow-[0_4px_12px_rgb(23_105_212/30%)]">L</span>;
}

export function Frame({
  narrow = true,
  onBack,
  action,
  children,
}: {
  narrow?: boolean;
  onBack?: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-card/90 shadow-[0_1px_8px_rgb(19_35_59/5%)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <Mark />
            <div>
              <p className="text-xl font-extrabold leading-none tracking-tight">La Letra</p>
              <p className="mt-1 text-xs font-semibold tracking-[.14em] text-muted">IMPRENTA Y PAPELERÍA</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-12 items-center rounded-xl border border-line bg-card px-4 text-base font-semibold text-ink shadow-sm transition hover:bg-paper"
              >
                <span aria-hidden="true" className="mr-2 text-lg">←</span>
                Inicio
              </button>
            ) : null}
            {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
          </div>
        </div>
      </header>
      <main className={`mx-auto w-full px-4 pb-16 pt-6 sm:px-7 sm:pt-8 lg:px-9 ${narrow ? "max-w-4xl" : "max-w-7xl"}`}>
        {children}
      </main>
      <footer className="no-print px-4 py-6 text-center text-xs text-muted">
        La Letra · Herramientas sencillas para el mostrador
      </footer>
    </div>
  );
}

export function Primary({
  children,
  onClick,
  type = "button",
  tone = "ink",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "ink" | "stamp";
}) {
  const face = tone === "stamp" ? "bg-stamp text-white shadow-[0_6px_16px_rgb(23_105_212/25%)] hover:bg-stamp-dark" : "bg-ink text-white hover:bg-slate-800";
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-base font-bold shadow-sm sm:text-lg ${face}`}
    >
      {children}
    </button>
  );
}

export function Quiet({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-card px-4 py-3 text-base font-semibold text-ink shadow-sm hover:border-stamp/40 hover:bg-tint"
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel";
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-base font-semibold text-ink">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        type={type}
        className="w-full min-h-13 rounded-xl border border-line bg-card px-4 py-3 text-lg text-ink shadow-sm"
      />
    </label>
  );
}

export function Chip({
  selected,
  children,
  onClick,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-4 py-2 text-base font-semibold ${selected ? "border-stamp bg-stamp text-white shadow-sm" : "border-line bg-card text-ink hover:border-stamp/50 hover:bg-tint"}`}
    >
      {children}
    </button>
  );
}

export function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-card p-1">
      <button type="button" aria-label="Restar uno" onClick={() => onChange(Math.max(1, value - 1))} className="size-12 rounded-lg bg-tint text-2xl font-bold text-stamp">−</button>
      <input
        aria-label="Cantidad"
        value={String(value)}
        inputMode="numeric"
        onChange={(event) => {
          const next = Number(event.target.value.replace(/\D/g, ""));
          onChange(Number.isFinite(next) && next > 0 ? next : 1);
        }}
        className="h-12 w-20 rounded-lg border border-line bg-card text-center text-xl font-bold tabular-nums"
      />
      <button type="button" aria-label="Sumar uno" onClick={() => onChange(value + 1)} className="size-12 rounded-lg bg-tint text-2xl font-bold text-stamp">+</button>
    </div>
  );
}

export function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line/80 bg-card p-5 shadow-ticket sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-tint font-extrabold text-stamp">{n}</span>
        <div>
          <h2 className="text-xl font-bold leading-tight text-ink sm:text-2xl">{title}</h2>
          {hint ? <p className="mt-1 text-base text-muted">{hint}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
