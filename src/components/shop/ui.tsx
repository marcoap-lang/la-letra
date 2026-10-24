import type { ReactNode } from "react";

export function Mark() {
  return <img src="/favicon.svg" alt="" width="44" height="44" className="size-11 shrink-0" />;
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
    <div className="min-h-dvh bg-band text-ink lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="no-print bg-band px-5 py-6 text-band-fg lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-6">
        <div>
          <p className="font-display text-4xl leading-none tracking-tight">La Letra</p>
          <p className="mt-1 text-sm text-band-fg/60">Imprenta · Tuxtepec</p>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-h-12 rounded-2xl border border-band-fg/15 px-4 text-left text-base text-band-fg/80"
            >
              Volver al mostrador
            </button>
          ) : null}
          {action}
        </div>
      </aside>
      <div className="min-h-dvh rounded-t-3xl bg-paper lg:rounded-none">
        <main className={`mx-auto w-full px-5 py-6 lg:px-8 lg:py-8 ${narrow ? "max-w-3xl" : "max-w-6xl"}`}>
          {children}
        </main>
      </div>
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
  const face = tone === "stamp" ? "bg-stamp text-stamp-fg" : "bg-ink text-band-fg";
  return (
    <button
      type={type}
      onClick={onClick}
      className={`min-h-14 rounded-2xl px-5 text-lg font-medium active:opacity-80 ${face}`}
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
      className="min-h-12 rounded-2xl border border-line bg-card px-4 text-base font-medium text-ink"
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
      <span className="mb-2 block text-base font-medium text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        type={type}
        className="w-full rounded-xl border border-line bg-card px-4 py-3 text-xl text-ink"
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
      className={`min-h-12 rounded-full px-4 text-base font-medium ${selected ? "bg-ink text-band-fg" : "border border-line bg-card text-ink"}`}
    >
      {children}
    </button>
  );
}

export function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Menos"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="size-12 rounded-xl border border-line bg-card text-2xl"
      >
        −
      </button>
      <input
        aria-label="Cantidad"
        value={String(value)}
        inputMode="numeric"
        onChange={(event) => {
          const next = Number(event.target.value.replace(/\D/g, ""));
          onChange(Number.isFinite(next) && next > 0 ? next : 1);
        }}
        className="h-12 w-20 rounded-xl border border-line bg-card text-center text-2xl tabular-nums"
      />
      <button
        type="button"
        aria-label="Más"
        onClick={() => onChange(value + 1)}
        className="size-12 rounded-xl border border-line bg-card text-2xl"
      >
        +
      </button>
    </div>
  );
}

export function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-ink/80 pt-6">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-display text-3xl leading-none text-stamp">{n}</span>
        <div>
          <h2 className="text-2xl font-medium leading-tight">{title}</h2>
          {hint ? <p className="mt-1 text-base text-muted">{hint}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
