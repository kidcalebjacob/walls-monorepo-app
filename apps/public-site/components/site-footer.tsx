export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
        <p className="tracking-[0.25em] text-zinc-300">WALLS ENTERTAINMENT</p>
        <p>© {new Date().getFullYear()} WALLS Entertainment. All rights reserved.</p>
      </div>
    </footer>
  );
}
