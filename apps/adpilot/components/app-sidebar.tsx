import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/creatives", label: "Creatives" },
  { href: "/reports", label: "Reports" },
];

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-card md:flex md:flex-col">
      <div className="border-b border-white/10 px-6 py-5">
        <Link href="/" className="block">
          <span className="text-xs tracking-[0.3em] text-muted">WALLS</span>
          <span className="mt-1 block text-lg font-semibold text-white">
            AdPilot
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="text-xs text-muted">Internal tool · WALLS Entertainment</p>
      </div>
    </aside>
  );
}
