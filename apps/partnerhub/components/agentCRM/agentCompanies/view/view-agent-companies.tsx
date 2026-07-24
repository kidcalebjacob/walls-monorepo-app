"use client";

/**
 * Stub — full CRM company editor is not bundled into PartnerHub.
 * Deal board company clicks still open a lightweight panel so the app stays usable.
 */
export default function EditAgentCompanies({
  companyId,
  isOpen,
  onClose,
  initialData,
}: {
  analyticsData?: unknown;
  companyId: string;
  initialData?: { name?: string | null; logo_url?: string | null } | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  if (!isOpen) return null;

  const crmOrigin =
    process.env.NEXT_PUBLIC_CRM_URL?.replace(/\/$/, "") ||
    "https://crm.kenoo.io";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Company details"
      >
        <h2 className="text-lg font-medium text-neutral-900">
          {initialData?.name?.trim() || "Company"}
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          Full company editing lives in CRM. You can open this company there or
          browse PartnerHub companies for partnership context.
        </p>
        <p className="mt-1 text-xs text-neutral-400">ID: {companyId}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`${crmOrigin}/agents/crm/companies`}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Open CRM companies
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
