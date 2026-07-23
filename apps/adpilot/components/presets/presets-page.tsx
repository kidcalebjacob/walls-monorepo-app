"use client";

import { AdSpendControls } from "@/components/settings/ad-spend-controls";

export function PresetsPage() {
  return (
    <main className="min-h-full w-full bg-kenoo-white px-6 py-8 md:px-10 md:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Presets
          </h1>
          <p className="mt-2 max-w-xl text-sm font-light leading-6 text-neutral-500">
            Workspace-wide spend automation presets, including agentic
            instructions. Enable AdPilot on a campaign or ad set to apply them.
          </p>
        </header>

        <AdSpendControls />
      </div>
    </main>
  );
}
