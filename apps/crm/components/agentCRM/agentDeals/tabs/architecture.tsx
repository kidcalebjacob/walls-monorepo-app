"use client";

import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { Button } from "@/components/ui/button";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { ContactSearch } from "@/components/ui/searches/contactSearch/contact-search";
import { CreatorSearch } from "@/components/agentCRM/agentDeals/custom-ui/creator-search";
import { CompanySearch } from "@/components/ui/searches/companySearch/company-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, MoreVertical, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { ManagerSearch, ManagerSearchAdd, type ManagerRecord } from "@/components/ui/searches/manager-search";

const fieldWrapperClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-0 bg-transparent transition-colors focus-within:border-b-[var(--kenoo-sky)]";
const inputInnerClass =
  "border-0 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full min-w-0 placeholder:text-neutral-400 h-10";
/** Hide browser number steppers (Chrome / Firefox / Safari). */
const numberInputNoSpinnerClass =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
const addFieldWrapperClass = "rounded-full bg-transparent hover:bg-transparent px-4 py-2";
const tableHeaderClass =
  "text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50";
const selectTriggerClass =
  "w-full border-0 rounded-none px-0 py-2 font-light bg-transparent shadow-none min-h-10 h-10 flex items-center justify-between focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 hover:bg-transparent";
const ITEMS_PER_PAGE = 5;

function formatRoleLabel(value: string): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const FALLBACK_IMAGE_URL = FALLBACK_ICON_URL;

function getTotalPages(totalCount: number) {
  return Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
}

function pageRows<T>(rows: T[], currentPage: number) {
  const safePage = Math.min(currentPage, getTotalPages(rows.length));
  return rows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
}

function matchesSearch(searchTerm: string, values: Array<string | number | null | undefined>) {
  const search = searchTerm.trim().toLowerCase();
  if (!search) return true;
  return values.join(" ").toLowerCase().includes(search);
}

function TableToolbar({
  searchTerm,
  setSearchTerm,
  currentPage,
  setCurrentPage,
  totalCount,
  placeholder,
}: {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  totalCount: number;
  placeholder: string;
}) {
  const totalPages = getTotalPages(totalCount);
  const safePage = Math.min(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5 flex-shrink-0">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="relative flex-1 max-w-sm min-w-0">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={cn(
              "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
              searchTerm ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
              "focus:border-b-[var(--kenoo-sky)]"
            )}
          />
        </div>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-neutral-400 font-light whitespace-nowrap tabular-nums min-w-[7.5rem] text-center">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Next page"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export interface DealContactRow {
  id?: string;
  person_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  role?: string | null;
  photo_url?: string | null;
}

export interface DealCommissionRow {
  id?: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  avatar_url?: string | null;
  commission_bps: number;
  role?: string | null;
}

interface ArchitectureProps {
  formData: { dealContacts?: DealContactRow[]; dealTalent?: any[]; dealCompanies?: any[]; dealCommissions?: DealCommissionRow[]; [key: string]: any };
  setFormData: (arg: any) => void;
}

export default function Architecture({ formData, setFormData }: ArchitectureProps) {
  const dealContacts = formData.dealContacts || [];
  const dealTalent = formData.dealTalent || [];
  const dealCompanies = formData.dealCompanies ?? [];
  const dealCommissions = formData.dealCommissions ?? [];
  const normalizedPipeline = String(formData.pipeline ?? "").trim().toLowerCase();
  const showTalentSection =
    normalizedPipeline === "marketplace" || normalizedPipeline === "partnership";
  const [companyRoles, setCompanyRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [talentSearch, setTalentSearch] = useState("");
  const [talentPage, setTalentPage] = useState(1);
  const [companySearch, setCompanySearch] = useState("");
  const [companyPage, setCompanyPage] = useState(1);
  const [commissionSearch, setCommissionSearch] = useState("");
  const [commissionPage, setCommissionPage] = useState(1);
  const [contactSearch, setContactSearch] = useState("");
  const [contactPage, setContactPage] = useState(1);

  const displayName = (row: DealContactRow) =>
    [row.first_name, row.last_name].filter(Boolean).join(" ") || "—";

  const filteredTalent = useMemo(
    () =>
      dealTalent
        .map((row: any, index: number) => ({ row, index }))
        .filter(({ row: t }: { row: any }) =>
          matchesSearch(talentSearch, [
            t.talent_name,
            t.role,
            t.revenue_share_bps != null ? Number(t.revenue_share_bps) / 100 : null,
          ])
        ),
    [dealTalent, talentSearch]
  );
  const filteredCompanies = useMemo(
    () =>
      dealCompanies
        .map((row: any, index: number) => ({ row, index }))
        .filter(({ row: dc }: { row: any }) =>
          matchesSearch(companySearch, [dc.company_name, formatRoleLabel(dc.role)])
        ),
    [dealCompanies, companySearch]
  );
  const filteredCommissions = useMemo(
    () =>
      dealCommissions
        .map((row: DealCommissionRow, index: number) => ({ row, index }))
        .filter(({ row }: { row: DealCommissionRow }) =>
          matchesSearch(commissionSearch, [
            row.first_name,
            row.last_name,
            row.email,
            row.role,
            row.commission_bps != null ? Number(row.commission_bps) / 100 : null,
          ])
        ),
    [dealCommissions, commissionSearch]
  );
  const filteredContacts = useMemo(
    () =>
      dealContacts
        .map((row: DealContactRow, index: number) => ({ row, index }))
        .filter(({ row }: { row: DealContactRow }) =>
          matchesSearch(contactSearch, [displayName(row), row.email, row.role])
        ),
    [dealContacts, contactSearch]
  );
  const paginatedTalent = pageRows(filteredTalent, talentPage);
  const paginatedCompanies = pageRows(filteredCompanies, companyPage);
  const paginatedCommissions = pageRows(filteredCommissions, commissionPage);
  const paginatedContacts = pageRows(filteredContacts, contactPage);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.rpc("get_deal_company_roles");
        if (error) {
          console.warn("Failed to fetch deal company roles:", error.message);
          setCompanyRoles([]);
          return;
        }
        if (Array.isArray(data)) {
          setCompanyRoles(data.map((row: { value: string }) => row.value));
        } else {
          setCompanyRoles([]);
        }
      } catch (e) {
        console.warn("Error fetching deal company roles:", e);
        setCompanyRoles([]);
      } finally {
        setLoadingRoles(false);
      }
    };
    fetchRoles();
  }, []);

  const addContact = (contact: { id: string; firstName: string; lastName: string; fullName: string; email?: string; photoUrl?: string | null }) => {
    if (dealContacts.some((c: DealContactRow) => c.person_id === contact.id)) return;
    setFormData((prev: any) => ({
      ...prev,
      dealContacts: [
        ...(prev.dealContacts || []),
        {
          person_id: contact.id,
          first_name: contact.firstName,
          last_name: contact.lastName,
          email: contact.email ?? null,
          role: null,
          photo_url: contact.photoUrl ?? null,
        },
      ],
    }));
  };

  const removeContact = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      dealContacts: (prev.dealContacts || []).filter((_: any, i: number) => i !== index),
    }));
  };

  const updateRole = (index: number, role: string | null) => {
    setFormData((prev: any) => {
      const next = [...(prev.dealContacts || [])];
      if (!next[index]) return prev;
      next[index] = { ...next[index], role: role || null };
      return { ...prev, dealContacts: next };
    });
  };

  // Talent management functions
  const addTalent = async (talentId: string, talentName: string, avatarUrl?: string) => {
    if (dealTalent.some((t: any) => t.talent_id === talentId)) return;

    let defaultRevenueShareBps: number | null = null;
    let talentCountry: string | null = null;
    let talentTaxRegion: string | null = null;
    try {
      const supabase = getSupabaseClient();
      const { data: talentRow } = await supabase
        .from("talent")
        .select("user_id, country, users(tax_region)")
        .eq("id", talentId)
        .maybeSingle();

      talentCountry = talentRow?.country ?? null;
      const linkedUser = talentRow?.users
        ? Array.isArray(talentRow.users)
          ? talentRow.users[0]
          : talentRow.users
        : null;
      talentTaxRegion = linkedUser?.tax_region ?? null;

      const talentUserId = talentRow?.user_id;
      if (talentUserId) {
        const { data: commissionDefaultRow } = await supabase
          .from("user_commission_defaults")
          .select("commission_bps")
          .eq("user_id", talentUserId)
          .maybeSingle();
        if (commissionDefaultRow?.commission_bps != null) {
          defaultRevenueShareBps = Number(commissionDefaultRow.commission_bps);
        }
      }
    } catch (error) {
      console.warn("Failed to fetch talent default commission:", error);
    }

    const next = [
      ...dealTalent,
      {
        talent_id: talentId,
        talent_name: talentName,
        avatar_url: avatarUrl,
        role: null,
        revenue_share_bps: defaultRevenueShareBps,
        talent_country: talentCountry,
        talent_tax_region: talentTaxRegion,
      },
    ];
    setFormData((prev: any) => ({
      ...prev,
      dealTalent: next,
      creator: next[0]?.talent_name ?? prev.creator,
      creatorProfilePicture: next[0]?.avatar_url ?? prev.creatorProfilePicture,
    }));
  };

  const removeTalent = (index: number) => {
    const next = dealTalent.filter((_: any, i: number) => i !== index);
    setFormData((prev: any) => ({
      ...prev,
      dealTalent: next,
      creator: next[0]?.talent_name ?? "",
      creatorProfilePicture: next[0]?.avatar_url ?? "",
    }));
  };

  const updateTalent = (index: number, field: "role" | "revenue_share_bps", value: string | number | null) => {
    setFormData((prev: any) => {
      const next = [...(prev.dealTalent || [])];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return { ...prev, dealTalent: next };
    });
  };

  const addCompany = (company: { id: string; name: string; logo_url?: string | null }) => {
    const hasClient = dealCompanies.some((dc: any) => dc.role === "client");
    const defaultRole = hasClient
      ? (companyRoles[0] ?? "partner")
      : (companyRoles.includes("client") ? "client" : (companyRoles[0] ?? "client"));
    setFormData((prev: any) => {
      const next = [
        ...(prev.dealCompanies || []),
        { company_id: company.id, company_name: company.name, role: defaultRole, logo_url: company.logo_url ?? null },
      ];
      const firstClient = next.find((r: any) => r.role === "client");
      return { ...prev, dealCompanies: next, company: firstClient?.company_name ?? prev.company };
    });
  };

  const removeCompany = (index: number) => {
    setFormData((prev: any) => {
      const next = (prev.dealCompanies || []).filter((_: any, i: number) => i !== index);
      const firstClient = next.find((r: any) => r.role === "client");
      return { ...prev, dealCompanies: next, company: firstClient?.company_name ?? "" };
    });
  };

  const addCommission = (user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null }) => {
    if (dealCommissions.some((c: DealCommissionRow) => c.user_id === user.id)) return;
    setFormData((prev: any) => ({
      ...prev,
      dealCommissions: [
        ...(prev.dealCommissions || []),
        {
          user_id: user.id,
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email ?? null,
          avatar_url: user.avatarUrl ?? null,
          commission_bps: 0,
          role: null,
        },
      ],
    }));
  };

  const removeCommission = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      dealCommissions: (prev.dealCommissions || []).filter((_: any, i: number) => i !== index),
    }));
  };

  const updateCommission = (index: number, field: "commission_bps" | "role", value: number | string | null) => {
    setFormData((prev: any) => {
      const next = [...(prev.dealCommissions || [])];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return { ...prev, dealCommissions: next };
    });
  };

  const updateCommissionOwner = (index: number, manager: ManagerRecord) => {
    setFormData((prev: any) => {
      const next = [...(prev.dealCommissions || [])];
      if (!next[index]) return prev;
      if (next.some((row: DealCommissionRow, rowIndex: number) => rowIndex !== index && row.user_id === manager.id)) {
        return prev;
      }
      next[index] = {
        ...next[index],
        user_id: manager.id,
        first_name: manager.first_name,
        last_name: manager.last_name,
        email: manager.email,
        avatar_url: manager.photoURL || null,
      };
      return { ...prev, dealCommissions: next };
    });
  };

  const updateCompanyRole = (index: number, role: string) => {
    setFormData((prev: any) => {
      const next = [...(prev.dealCompanies || [])];
      const row = next[index];
      if (!row) return prev;
      if (role === "client") {
        next.forEach((r: any, i: number) => {
          if (r.role === "client") next[i] = { ...r, role: "partner" };
        });
      }
      next[index] = { ...row, role };
      const firstClient = next.find((r: any) => r.role === "client");
      return { ...prev, dealCompanies: next, company: firstClient?.company_name ?? prev.company };
    });
  };

  return (
    <div className="space-y-10 px-4 sm:px-6">
      {showTalentSection && (
        <div>
          <div className="flex items-center gap-4 mb-5">
            <h2 className="text-black font-black text-4xl shrink-0">TALENT</h2>
            <div className="flex-1 border-t border-black h-[1px]" />
            <div className={cn("shrink-0", addFieldWrapperClass)}>
              <CreatorSearch
                value=""
                onChange={() => {}}
                onChangeWithId={(talentId, name, avatarUrl) => addTalent(talentId, name, avatarUrl)}
                placeholder="Add talent"
                triggerIcon="plus"
                className="bg-transparent border-0 shadow-none min-w-0 w-full"
              />
            </div>
          </div>

          <div className="px-2 sm:px-4">
            <TableToolbar
              searchTerm={talentSearch}
              setSearchTerm={setTalentSearch}
              currentPage={talentPage}
              setCurrentPage={setTalentPage}
              totalCount={filteredTalent.length}
              placeholder="Search talent..."
            />
            <div className="overflow-x-auto pb-8">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
                <tr>
                  <th className={tableHeaderClass}>Name</th>
                  <th className={tableHeaderClass}>Role</th>
                  <th className={tableHeaderClass}>Commission %</th>
                  <th className="w-10 pb-3 bg-gray-50" />
                </tr>
              </thead>
              <tbody>
                {paginatedTalent.map(({ row: t, index }: { row: any; index: number }) => (
                  <tr
                    key={t.talent_id + String(index)}
                    className="border-b border-neutral-50"
                  >
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-2">
                        <Image
                          src={t.avatar_url || FALLBACK_IMAGE_URL}
                          alt=""
                          width={24}
                          height={24}
                          className="rounded-full object-cover aspect-square w-6 h-6 shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = FALLBACK_IMAGE_URL;
                          }}
                        />
                        <span className="text-neutral-700 font-light text-xs">{t.talent_name || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className={cn(fieldWrapperClass, "max-w-[200px]")}>
                        <BorderlessInput
                          value={t.role ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateTalent(index, "role", v.trim() === "" ? null : v);
                          }}
                          placeholder="e.g. Lead talent"
                          className={inputInnerClass}
                        />
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className={cn(fieldWrapperClass, "max-w-[150px]")}>
                        <BorderlessInput
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={
                            t.revenue_share_bps != null &&
                            !Number.isNaN(Number(t.revenue_share_bps))
                              ? Number(t.revenue_share_bps) / 100
                              : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            updateTalent(
                              index,
                              "revenue_share_bps",
                              v === "" ? null : Math.round(Number(v) * 100),
                            );
                          }}
                          placeholder="e.g. 15"
                          className={cn(inputInnerClass, numberInputNoSpinnerClass)}
                        />
                      </div>
                    </td>
                    <td className="py-4 pr-2 w-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-neutral-300 hover:text-neutral-500 hover:bg-transparent"
                            aria-label="Open menu"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[140px]">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                            onClick={() => removeTalent(index)}
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Companies Section */}
      <div>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-black font-black text-4xl shrink-0">COMPANIES</h2>
          <div className="flex-1 border-t border-black h-[1px]" />
          <div className={cn("shrink-0", addFieldWrapperClass)}>
            <CompanySearch
              value=""
              onChange={() => {}}
              placeholder="Add company"
              triggerIcon="plus"
              onSelectCompany={(company) => {
                if (dealCompanies.some((dc: any) => dc.company_id === company.id)) return;
                addCompany(company);
              }}
              className="h-7 min-h-7 py-0 bg-transparent border-0 shadow-none min-w-0 text-sm w-full"
            />
          </div>
        </div>

        <div className="px-2 sm:px-4">
          <TableToolbar
            searchTerm={companySearch}
            setSearchTerm={setCompanySearch}
            currentPage={companyPage}
            setCurrentPage={setCompanyPage}
            totalCount={filteredCompanies.length}
            placeholder="Search companies..."
          />
          <div className="overflow-x-auto pb-8">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
              <tr>
                <th className={tableHeaderClass}>Company</th>
                <th className={tableHeaderClass}>Role</th>
                <th className="w-10 pb-3 bg-gray-50" />
              </tr>
            </thead>
            <tbody>
              {paginatedCompanies.map(({ row: dc, index }: { row: any; index: number }) => (
                <tr
                  key={`${dc.company_id}-${dc.role}-${index}`}
                  className="border-b border-neutral-50"
                >
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <Image
                        src={dc.logo_url || FALLBACK_IMAGE_URL}
                        alt=""
                        width={24}
                        height={24}
                        className={dc.logo_url ? "rounded-full object-contain aspect-square w-6 h-6 shrink-0 bg-white" : "rounded-full object-cover aspect-square w-6 h-6 shrink-0"}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = FALLBACK_IMAGE_URL;
                        }}
                      />
                      <span className="text-neutral-700 font-light text-xs">{dc.company_name || "—"}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <div className={cn(fieldWrapperClass, "max-w-[160px]")}>
                      <Select
                        value={dc.role || companyRoles[0] || ""}
                        onValueChange={(v) => updateCompanyRole(index, v)}
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue placeholder={loadingRoles ? "Loading…" : "Role"} />
                        </SelectTrigger>
                        <SelectContent>
                          {companyRoles.map((value) => (
                            <SelectItem key={value} value={value}>
                              {formatRoleLabel(value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  <td className="py-4 pr-2 w-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-neutral-300 hover:text-neutral-500 hover:bg-transparent"
                          aria-label="Open menu"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[140px]">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                          onClick={() => removeCompany(index)}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Commission Splits Section */}
      <div>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-black font-black text-4xl shrink-0">COMMISSION SPLITS</h2>
          <div className="flex-1 border-t border-black h-[1px]" />
          <div className={cn("shrink-0", addFieldWrapperClass)}>
            <ManagerSearchAdd
              placeholder="Add manager"
              triggerIcon="plus"
              onSelectManager={(m) =>
                addCommission({
                  id: m.id,
                  firstName: m.first_name,
                  lastName: m.last_name,
                  email: m.email,
                  avatarUrl: m.photoURL || null,
                })
              }
              className="h-7 min-h-7 py-0 bg-transparent border-0 shadow-none min-w-0 text-sm w-full"
            />
          </div>
        </div>

        <div className="px-2 sm:px-4">
          <TableToolbar
            searchTerm={commissionSearch}
            setSearchTerm={setCommissionSearch}
            currentPage={commissionPage}
            setCurrentPage={setCommissionPage}
            totalCount={filteredCommissions.length}
            placeholder="Search commission splits..."
          />
          <div className="overflow-x-auto pb-8">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
              <tr>
                <th className={tableHeaderClass}>Name</th>
                <th className={tableHeaderClass}>Role</th>
                <th className={tableHeaderClass}>Commission %</th>
                <th className="w-10 pb-3 bg-gray-50" />
              </tr>
            </thead>
            <tbody>
              {paginatedCommissions.map(({ row, index }: { row: DealCommissionRow; index: number }) => (
                <tr
                  key={row.user_id + (row.id ?? "")}
                  className="border-b border-neutral-50"
                >
                  <td className="py-4 pr-4">
                    <div className={cn(fieldWrapperClass, "max-w-[240px]")}>
                      <ManagerSearch
                        value={row.user_id}
                        onValueChange={() => {}}
                        onSelectManager={(manager) => updateCommissionOwner(index, manager)}
                        className={selectTriggerClass}
                      />
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <div className={cn(fieldWrapperClass, "max-w-[200px]")}>
                      <BorderlessInput
                        value={row.role ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateCommission(index, "role", v.trim() === "" ? null : v);
                        }}
                        placeholder="e.g. Agent"
                        className={inputInnerClass}
                      />
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <div className={cn(fieldWrapperClass, "max-w-[150px]")}>
                      <BorderlessInput
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={
                          row.commission_bps != null &&
                          !Number.isNaN(Number(row.commission_bps))
                            ? Number(row.commission_bps) / 100
                            : ""
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          updateCommission(
                            index,
                            "commission_bps",
                            v === "" ? 0 : Math.round(Number(v) * 100),
                          );
                        }}
                        placeholder="0"
                        className={cn(inputInnerClass, numberInputNoSpinnerClass)}
                      />
                    </div>
                  </td>
                  <td className="py-4 pr-2 w-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-neutral-300 hover:text-neutral-500 hover:bg-transparent"
                          aria-label="Open menu"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[140px]">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                          onClick={() => removeCommission(index)}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Contacts Section */}
      <div>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-black font-black text-4xl shrink-0">CONTACTS</h2>
          <div className="flex-1 border-t border-black h-[1px]" />
          <div className={cn("shrink-0", addFieldWrapperClass)}>
            <ContactSearch
              value=""
              onChange={() => {}}
              placeholder="Add person"
              triggerIcon="plus"
              onSelectContact={addContact}
              className="h-7 min-h-7 py-0 bg-transparent border-0 shadow-none min-w-0 text-sm w-full"
            />
          </div>
        </div>

        <div className="px-2 sm:px-4">
          <TableToolbar
            searchTerm={contactSearch}
            setSearchTerm={setContactSearch}
            currentPage={contactPage}
            setCurrentPage={setContactPage}
            totalCount={filteredContacts.length}
            placeholder="Search contacts..."
          />
          <div className="overflow-x-auto pb-8">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
              <tr>
                <th className={tableHeaderClass}>Name</th>
                <th className={tableHeaderClass}>Email</th>
                <th className={tableHeaderClass}>Role</th>
                <th className="w-10 pb-3 bg-gray-50" />
              </tr>
            </thead>
            <tbody>
              {paginatedContacts.map(({ row, index }: { row: DealContactRow; index: number }) => (
                <tr
                  key={row.person_id + (row.id ?? "")}
                  className="border-b border-neutral-50"
                >
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <Image
                        src={row.photo_url || FALLBACK_IMAGE_URL}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full object-cover aspect-square w-6 h-6 shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = FALLBACK_IMAGE_URL;
                        }}
                      />
                      <span className="text-neutral-700 font-light text-xs">{displayName(row)}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-neutral-400 text-xs font-light">
                    {row.email ?? <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="py-4 pr-4">
                    <div className={cn(fieldWrapperClass, "max-w-[200px]")}>
                      <BorderlessInput
                        value={row.role ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateRole(index, v.trim() === "" ? null : v);
                        }}
                        placeholder="e.g. Point of contact"
                        className={inputInnerClass}
                      />
                    </div>
                  </td>
                  <td className="py-4 pr-2 w-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-neutral-300 hover:text-neutral-500 hover:bg-transparent"
                          aria-label="Open menu"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[140px]">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                          onClick={() => removeContact(index)}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
