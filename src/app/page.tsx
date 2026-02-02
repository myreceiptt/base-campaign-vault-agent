export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Base Campaign Vault Agent
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            AI campaign builder + USDC escrow onchain. Fokus: Base App
            creators/brands.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Campaign objective</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="e.g., Drive 1,000 signups for Base App"
                name="objective"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Budget (USDC)</span>
              <input
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none ring-offset-2 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-50/10"
                placeholder="e.g., 500"
                name="budget"
                inputMode="decimal"
              />
            </label>
          </div>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Demo scaffold only — fields are placeholders (no wallet, no escrow,
            no AI).
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <FlowCard
            step="01"
            title="Create Campaign"
            description="Define objective, audience, and success metrics."
            cta="Create"
          />
          <FlowCard
            step="02"
            title="Deposit"
            description="Lock the campaign budget into an escrow vault."
            cta="Deposit"
          />
          <FlowCard
            step="03"
            title="Generate Content"
            description="Draft campaign assets and copy for review."
            cta="Generate"
          />
          <FlowCard
            step="04"
            title="Release"
            description="Publish and release funds based on milestones."
            cta="Release"
          />
        </section>

        <footer className="pt-6 text-sm text-zinc-500 dark:text-zinc-500">
          v0 scaffold — next: wallet connect, escrow contract, AI route.
        </footer>
      </main>
    </div>
  );
}

function FlowCard(props: {
  step: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
            {props.step}
          </div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {props.description}
          </p>
        </div>
        <button
          type="button"
          className="h-10 shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white dark:focus:ring-zinc-50/20"
        >
          {props.cta}
        </button>
      </div>
    </div>
  );
}
