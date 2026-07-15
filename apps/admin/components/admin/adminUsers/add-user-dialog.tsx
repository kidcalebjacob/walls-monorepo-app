"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type PlatformOption = {
  id: string;
  code: string;
  name: string;
};

type CreatedUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  user_platform_id: string | null;
};

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platforms: PlatformOption[];
  onUserCreated: (user: CreatedUser, platform: PlatformOption | null) => void;
}

export function AddUserDialog({
  open,
  onOpenChange,
  platforms,
  onUserCreated,
}: AddUserDialogProps) {
  /** Talent platform is assigned when adding talent to the roster, not here. */
  const selectablePlatforms = useMemo(
    () => platforms.filter((p) => p.code.toLowerCase() !== "talent"),
    [platforms],
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [platformId, setPlatformId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPassword, setSuccessPassword] = useState<string | null>(null);

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPlatformId("");
    setError(null);
    setSuccessPassword(null);
  }

  function handleOpenChange(next: boolean) {
    if (!isSubmitting) {
      if (!next) reset();
      onOpenChange(next);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const safePlatformId =
        platformId && selectablePlatforms.some((p) => p.id === platformId)
          ? platformId
          : undefined;

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          platformId: safePlatformId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create user");
        return;
      }

      const selectedPlatform = safePlatformId
        ? (selectablePlatforms.find((p) => p.id === safePlatformId) ?? null)
        : null;

      setSuccessPassword(data.tempPassword);
      onUserCreated(data.user, selectedPlatform);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white";

  const labelClass = "block text-xs font-medium text-zinc-500 mb-1";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        overlayClassName="bg-black/20"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-zinc-900">
            Add new user
          </DialogTitle>
        </DialogHeader>

        {successPassword ? (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              <p className="font-semibold mb-1">User created successfully</p>
              <p className="text-emerald-700 text-xs">
                Share this temporary password with the user — they can change it after signing in.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs font-medium text-zinc-500 mb-1">Temporary password</p>
              <p className="font-mono text-sm font-semibold text-zinc-900 select-all">
                {successPassword}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="add-first-name" className={labelClass}>
                  First name <span className="text-red-400">*</span>
                </label>
                <input
                  id="add-first-name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className={inputClass}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="add-last-name" className={labelClass}>
                  Last name
                </label>
                <input
                  id="add-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  className={inputClass}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="add-email" className={labelClass}>
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="add-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className={inputClass}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="add-platform" className={labelClass}>
                Platform
              </label>
              <select
                id="add-platform"
                value={
                  selectablePlatforms.some((p) => p.id === platformId)
                    ? platformId
                    : ""
                }
                onChange={(e) => setPlatformId(e.target.value)}
                className={inputClass}
                disabled={isSubmitting}
              >
                <option value="">— None —</option>
                {selectablePlatforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <DialogFooter className="pt-1 gap-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !firstName.trim() || !email.trim()}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {isSubmitting ? "Creating…" : "Create user"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
