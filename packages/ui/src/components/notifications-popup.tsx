"use client";

/** Placeholder until notifications are wired in the monorepo. */
export default function NotificationsPopup({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/20"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-md bg-walls-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">Coming soon.</p>
      </aside>
    </div>
  );
}
