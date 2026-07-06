const stats = [
  { label: "Active campaigns", value: "—" },
  { label: "Spend (MTD)", value: "—" },
  { label: "CTR", value: "—" },
  { label: "Conversions", value: "—" },
];

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-white/10 px-6 py-6 md:px-8">
        <p className="text-sm text-muted">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Dashboard</h1>
      </header>

      <div className="flex flex-1 flex-col gap-8 p-6 md:p-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-xl border border-white/10 bg-card p-5"
            >
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {stat.value}
              </p>
            </article>
          ))}
        </section>

        <section className="flex flex-1 flex-col rounded-xl border border-dashed border-white/15 bg-card/50 p-8">
          <h2 className="text-lg font-medium text-white">Ready to build</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            AdPilot is wired into the WALLS monorepo with Supabase and root{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-200">
              .env
            </code>
            . Paste flows from your live app here — campaigns, creatives, and
            reporting will slot into this shell.
          </p>
        </section>
      </div>
    </main>
  );
}
