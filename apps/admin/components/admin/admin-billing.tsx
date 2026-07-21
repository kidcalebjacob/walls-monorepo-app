"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  CreditCard,
  Loader2,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/borderless-input";
import { wallsToast } from "@/components/ui/walls-toast";
import { Toaster } from "@/components/ui/toaster";
import { useActiveAccount } from "@/components/active-account-context";
import type { OrganizationRecord } from "@/lib/organizations-shared";
import { canEditOrganization } from "@/lib/organizations-shared";
import { cn } from "@walls/utils";

const labelClass =
  "mb-1 block text-xs font-medium tracking-wide text-[#5f6368]";
const fieldClass =
  "w-full rounded-lg border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#202124] placeholder:text-[#9aa0a6] focus:border-[#1967d2] focus:outline-none focus:ring-2 focus:ring-[#1967d2]/15";

function BillingPageContent() {
  const searchParams = useSearchParams();
  const focusPayment = searchParams.get("section") === "payment";
  const checkoutStatus = searchParams.get("checkout");
  const { activeAccount, activeAccountId, loading: accountLoading } =
    useActiveAccount();

  const [organization, setOrganization] = useState<OrganizationRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [subscription, setSubscription] = useState<{
    status: string;
    stripePriceId: string | null;
    stripeCustomerId: string | null;
    currentPeriodEnd: string | null;
  } | null>(null);
  const [configuredPlans, setConfiguredPlans] = useState<
    Array<{ id: string; name: string; priceId: string | null }>
  >([]);
  const [form, setForm] = useState({
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    countryCode: "",
  });

  useEffect(() => {
    if (checkoutStatus === "success") {
      wallsToast.success("Checkout completed — subscription will update shortly.");
    } else if (checkoutStatus === "canceled") {
      wallsToast.warning("Checkout canceled.");
    }
  }, [checkoutStatus]);

  useEffect(() => {
    if (!activeAccountId || accountLoading) {
      setLoading(accountLoading);
      return;
    }

    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        const [orgResponse, subResponse] = await Promise.all([
          fetch(`/api/organizations/${activeAccountId}`, { cache: "no-store" }),
          fetch("/api/billing/subscription", { cache: "no-store" }),
        ]);

        if (orgResponse.ok) {
          const payload = (await orgResponse.json()) as {
            organization?: OrganizationRecord;
          };
          if (mounted && payload.organization) {
            const org = payload.organization;
            setOrganization(org);
            setForm({
              email: org.email ?? "",
              phone: org.phone ?? "",
              addressLine1: org.addressLine1 ?? "",
              addressLine2: org.addressLine2 ?? "",
              city: org.city ?? "",
              stateProvince: org.stateProvince ?? "",
              postalCode: org.postalCode ?? "",
              countryCode: org.countryCode ?? "",
            });
          }
        } else if (mounted) {
          setOrganization(null);
          setForm({
            email: "",
            phone: "",
            addressLine1: "",
            addressLine2: "",
            city: "",
            stateProvince: "",
            postalCode: "",
            countryCode: "",
          });
        }

        if (subResponse.ok && mounted) {
          const payload = (await subResponse.json()) as {
            subscription?: {
              status: string;
              stripePriceId: string | null;
              stripeCustomerId: string | null;
              currentPeriodEnd: string | null;
            } | null;
            configuredPlans?: Array<{
              id: string;
              name: string;
              priceId: string | null;
            }>;
          };
          setSubscription(payload.subscription ?? null);
          setConfiguredPlans(payload.configuredPlans ?? []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [activeAccountId, accountLoading]);

  const startCheckout = async (plan = "starter") => {
    setCheckoutLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, accountId: activeAccountId }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Failed to start checkout");
      }
      window.location.href = payload.url;
    } catch (error) {
      wallsToast.error(
        error instanceof Error ? error.message : "Failed to start checkout",
      );
      setCheckoutLoading(false);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeAccountId }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Failed to open billing portal");
      }
      window.location.href = payload.url;
    } catch (error) {
      wallsToast.error(
        error instanceof Error ? error.message : "Failed to open portal",
      );
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    if (!focusPayment || loading) return;
    const el = document.getElementById("billing-payment");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusPayment, loading]);

  const canEdit = organization
    ? canEditOrganization(organization.role)
    : false;
  const isOrganization = activeAccount?.accountType === "organization";

  const isChanged = useMemo(() => {
    if (!organization) return false;
    return (
      form.email !== (organization.email ?? "") ||
      form.phone !== (organization.phone ?? "") ||
      form.addressLine1 !== (organization.addressLine1 ?? "") ||
      form.addressLine2 !== (organization.addressLine2 ?? "") ||
      form.city !== (organization.city ?? "") ||
      form.stateProvince !== (organization.stateProvince ?? "") ||
      form.postalCode !== (organization.postalCode ?? "") ||
      form.countryCode !== (organization.countryCode ?? "")
    );
  }, [form, organization]);

  const saveBilling = async () => {
    if (!activeAccountId || !canEdit || !isChanged) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/organizations/${activeAccountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email || null,
          phone: form.phone || null,
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
          city: form.city || null,
          stateProvince: form.stateProvince || null,
          postalCode: form.postalCode || null,
          countryCode: form.countryCode || null,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Failed to save billing details");
      }
      const payload = (await response.json()) as {
        organization?: OrganizationRecord;
      };
      if (payload.organization) {
        setOrganization(payload.organization);
      }
      wallsToast.success("Billing details updated");
    } catch (error) {
      wallsToast.error(
        error instanceof Error ? error.message : "Failed to save",
      );
    } finally {
      setSaving(false);
    }
  };

  if (accountLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-4 py-2">
        <div className="h-8 w-48 rounded-lg bg-neutral-200/80" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 rounded-2xl bg-white" />
          <div className="h-56 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  if (!activeAccountId || !activeAccount) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-[#e8eaed] bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
        <Building2 className="mx-auto h-10 w-10 text-[#dadce0]" />
        <p className="mt-4 text-sm font-medium text-[#202124]">
          No account selected
        </p>
        <p className="mt-1 text-sm text-[#5f6368]">
          Choose an account from the header to manage billing.
        </p>
      </div>
    );
  }

  const memberEstimate = 1;
  const planLabel =
    configuredPlans.find((plan) => plan.priceId === subscription?.stripePriceId)
      ?.name ??
    (subscription?.status && subscription.status !== "incomplete"
      ? "Kenoo subscription"
      : "Kenoo Starter");
  const isPaid =
    subscription?.status === "active" ||
    subscription?.status === "trialing" ||
    subscription?.status === "past_due";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <Toaster />
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-[#5f6368]">
          <CreditCard className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">
            Billing
          </span>
        </div>
        <h1 className="text-2xl font-normal text-[#202124]">
          Manage subscriptions and billing
        </h1>
        <p className="text-sm text-[#5f6368]">
          Plan details and billing contact for {activeAccount.name}.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-[#202124]">
                Subscription
              </h2>
              <p className="mt-0.5 text-sm text-[#5f6368]">
                Current plan for this workspace
              </p>
            </div>
            <Receipt className="h-5 w-5 text-[#5f6368]" />
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[#f1f3f4] py-2">
              <span className="text-[#5f6368]">Plan</span>
              <span className="font-medium text-[#202124]">{planLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[#f1f3f4] py-2">
              <span className="text-[#5f6368]">Status</span>
              <span className="capitalize text-[#202124]">
                {subscription?.status ?? "none"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[#f1f3f4] py-2">
              <span className="text-[#5f6368]">Licenses</span>
              <span className="text-[#202124]">× {memberEstimate}</span>
            </div>
            {subscription?.currentPeriodEnd && (
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-[#5f6368]">Current period ends</span>
                <span className="text-[#202124]">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-2 border-t border-[#f1f3f4] pt-4">
            <button
              type="button"
              disabled={checkoutLoading || configuredPlans.length === 0}
              className="block text-sm text-[#1967d2] hover:underline disabled:opacity-50"
              onClick={() => void startCheckout(configuredPlans[0]?.id ?? "starter")}
            >
              {checkoutLoading
                ? "Starting checkout…"
                : isPaid
                  ? "Change plan / buy seats"
                  : "Buy or upgrade"}
            </button>
            {configuredPlans.length === 0 && (
              <p className="text-xs text-[#5f6368]">
                Set STRIPE_PRICE_STARTER (or STRIPE_PRICE_ID) in env to enable
                checkout.
              </p>
            )}
            <button
              type="button"
              disabled={portalLoading || !subscription?.stripeCustomerId}
              className="block text-sm text-[#1967d2] hover:underline disabled:opacity-50"
              onClick={() => void openPortal()}
            >
              {portalLoading
                ? "Opening portal…"
                : "View invoices & payment methods"}
            </button>
          </div>
        </section>

        <section
          id="billing-payment"
          className={cn(
            "rounded-2xl border bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)]",
            focusPayment ? "border-[#1967d2]" : "border-[#e8eaed]",
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-[#202124]">
                Payment method
              </h2>
              <p className="mt-0.5 text-sm text-[#5f6368]">
                Managed securely in Stripe
              </p>
            </div>
            <CreditCard className="h-5 w-5 text-[#5f6368]" />
          </div>

          <div className="rounded-xl border border-dashed border-[#dadce0] bg-[#f8f9fa] px-4 py-8 text-center">
            <p className="text-sm text-[#5f6368]">
              {subscription?.stripeCustomerId
                ? "Update cards and invoices in the Stripe customer portal."
                : "No payment method yet — start checkout to add one."}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={
                portalLoading ||
                checkoutLoading ||
                (!subscription?.stripeCustomerId && configuredPlans.length === 0)
              }
              className="mt-4 rounded-full border-[#dadce0] text-[#1967d2] hover:bg-[#e8f0fe]"
              onClick={() =>
                void (subscription?.stripeCustomerId
                  ? openPortal()
                  : startCheckout(configuredPlans[0]?.id ?? "starter"))
              }
            >
              {subscription?.stripeCustomerId
                ? portalLoading
                  ? "Opening…"
                  : "Manage payment method"
                : checkoutLoading
                  ? "Starting…"
                  : "Add payment method"}
            </Button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-[#202124]">
              Billing contact
            </h2>
            <p className="mt-0.5 text-sm text-[#5f6368]">
              Update the email and address used for invoices
            </p>
          </div>
          {canEdit && (
            <Button
              type="button"
              disabled={!isChanged || saving}
              onClick={() => void saveBilling()}
              className="rounded-full bg-[#1967d2] px-5 text-white hover:bg-[#1557b0] disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                "Save changes"
              )}
            </Button>
          )}
        </div>

        {!isOrganization ? (
          <p className="rounded-xl bg-[#f8f9fa] px-4 py-6 text-center text-sm text-[#5f6368]">
            Billing contact details are available for organization accounts.
            Switch accounts in the header to update billing.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Billing email</label>
              <Input
                value={form.email}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className={fieldClass}
                placeholder="billing@company.com"
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <Input
                value={form.phone}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                className={fieldClass}
                placeholder="+1 555 000 0000"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Address line 1</label>
              <Input
                value={form.addressLine1}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    addressLine1: event.target.value,
                  }))
                }
                className={fieldClass}
                placeholder="Street address"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Address line 2</label>
              <Input
                value={form.addressLine2}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    addressLine2: event.target.value,
                  }))
                }
                className={fieldClass}
                placeholder="Suite, unit, etc."
              />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <Input
                value={form.city}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                className={fieldClass}
                placeholder="City"
              />
            </div>
            <div>
              <label className={labelClass}>State / Province</label>
              <Input
                value={form.stateProvince}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    stateProvince: event.target.value,
                  }))
                }
                className={fieldClass}
                placeholder="State or province"
              />
            </div>
            <div>
              <label className={labelClass}>Postal code</label>
              <Input
                value={form.postalCode}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    postalCode: event.target.value,
                  }))
                }
                className={fieldClass}
                placeholder="Postal code"
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <Input
                value={form.countryCode}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    countryCode: event.target.value.toUpperCase(),
                  }))
                }
                className={fieldClass}
                placeholder="US"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminBillingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl animate-pulse space-y-4 py-2">
          <div className="h-8 w-48 rounded-lg bg-neutral-200/80" />
          <div className="h-56 rounded-2xl bg-white" />
        </div>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
