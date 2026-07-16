"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/auth";
import { SequenceSwitch } from "@/components/ui/sequence-switch";
import { AddUserDialog } from "@/components/admin/adminUsers/add-user-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UserStatus = "active" | "suspended" | "deactivated";

type User = {
  id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  is_admin: boolean;
  status: UserStatus;
  user_platform_id: string | null;
  platform: { name: string; code: string } | null;
};

type PlatformOption = {
  id: string;
  code: string;
  name: string;
};

const ITEMS_PER_PAGE = 15;

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingPlatformId, setUpdatingPlatformId] = useState<string | null>(null);
  const [openPlatformDropdownId, setOpenPlatformDropdownId] = useState<string | null>(null);
  const [platformDropdownUp, setPlatformDropdownUp] = useState(false);
  const [menuDropdownUp, setMenuDropdownUp] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [platformFilterOpen, setPlatformFilterOpen] = useState(false);
  const platformFilterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const platformDropdownRef = useRef<HTMLDivElement>(null);
  const platformTriggerRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const DROPDOWN_SPACE_THRESHOLD = 220;

  useEffect(() => {
    if (openMenuId === null) return;
    const spaceBelow = typeof window !== "undefined" && menuTriggerRef.current
      ? window.innerHeight - menuTriggerRef.current.getBoundingClientRect().bottom
      : Infinity;
    setMenuDropdownUp(spaceBelow < DROPDOWN_SPACE_THRESHOLD);
  }, [openMenuId]);

  useEffect(() => {
    if (openMenuId === null) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    if (openPlatformDropdownId === null) return;
    const spaceBelow = typeof window !== "undefined" && platformTriggerRef.current
      ? window.innerHeight - platformTriggerRef.current.getBoundingClientRect().bottom
      : Infinity;
    setPlatformDropdownUp(spaceBelow < DROPDOWN_SPACE_THRESHOLD);
  }, [openPlatformDropdownId]);

  useEffect(() => {
    if (openPlatformDropdownId === null) return;
    function handleClickOutside(event: MouseEvent) {
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(event.target as Node)) {
        setOpenPlatformDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPlatformDropdownId]);

  useEffect(() => {
    if (!platformFilterOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (platformFilterRef.current && !platformFilterRef.current.contains(event.target as Node)) {
        setPlatformFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [platformFilterOpen]);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [{ data: platformsData }, { data: usersData, error: usersError }] = await Promise.all([
          supabase.from("user_platform").select("id, code, name").order("name", { ascending: true }),
          supabase
            .from("users")
            .select("id, created_at, first_name, last_name, email, status, user_platform_id, is_admin, user_platform(name, code)")
            .order("created_at", { ascending: false }),
        ]);

        if (!isMounted) return;
        if (platformsData) setPlatforms(platformsData as PlatformOption[]);
        if (usersError) {
          setError(usersError.message);
          setUsers([]);
          return;
        }

        const merged: User[] = (usersData ?? []).map((u) => {
          const raw = (u as { user_platform?: { name: string; code: string } | { name: string; code: string }[] | null }).user_platform;
          let platform: User["platform"] = null;
          if (raw && typeof raw === "object") {
            const single = Array.isArray(raw) ? raw[0] : raw;
            if (single && "name" in single && "code" in single) {
              platform = { name: single.name, code: single.code };
            }
          }
          return {
            id: u.id,
            created_at: u.created_at ?? "",
            first_name: u.first_name ?? null,
            last_name: u.last_name ?? null,
            email: u.email ?? null,
            is_admin: u.is_admin === true,
            status: (u.status as UserStatus) ?? "active",
            user_platform_id: u.user_platform_id ?? null,
            platform,
          };
        });

        setUsers(merged);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load users");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  function displayName(user: User) {
    const first = user.first_name?.trim() ?? "";
    const last = user.last_name?.trim() ?? "";
    const name = [first, last].filter(Boolean).join(" ");
    return name || "—";
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  async function setUserAdmin(userId: string, isAdmin: boolean) {
    setTogglingId(userId);
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ is_admin: isAdmin })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: isAdmin } : u)),
      );
      setError(null);
    }
    setTogglingId(null);
  }

  const searchLower = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (searchLower) {
      const name = displayName(user).toLowerCase();
      const email = (user.email ?? "").toLowerCase();
      if (!name.includes(searchLower) && !email.includes(searchLower)) return false;
    }
    if (platformFilter !== "all") {
      if (user.user_platform_id !== platformFilter) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const effectivePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (effectivePage - 1) * ITEMS_PER_PAGE,
    effectivePage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, platformFilter]);

  async function updateUserPlatform(userId: string, platformId: string | null) {
    setUpdatingPlatformId(userId);
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ user_platform_id: platformId })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
    } else {
      const updatedPlatform =
        platformId === null
          ? null
          : platforms.find((p) => p.id === platformId) ?? null;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                user_platform_id: platformId,
                platform:
                  updatedPlatform === null
                    ? null
                    : { name: updatedPlatform.name, code: updatedPlatform.code },
              }
            : u,
        ),
      );
      setError(null);
    }
    setUpdatingPlatformId(null);
  }

  const STATUS_ERROR_LABEL: Record<UserStatus, string> = {
    active: "activate",
    suspended: "suspend",
    deactivated: "deactivate",
  };

  async function updateUserStatus(user: User, status: UserStatus) {
    setUpdatingStatusId(user.id);
    setOpenMenuId(null);
    const userName = displayName(user);
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ status })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      wallsToast.error(`Failed to ${STATUS_ERROR_LABEL[status]} agent`);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status } : u)),
      );
      setError(null);
      const statusLabel: Record<string, string> = { active: "Agent activated", suspended: "Agent suspended", deactivated: "Agent deactivated" };
      wallsToast.success(statusLabel[status] ?? "Status updated", userName !== "—" ? userName : undefined);
    }
    setUpdatingStatusId(null);
  }

  const [addUserOpen, setAddUserOpen] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function handleUserCreated(
    newUser: { id: string; email: string; first_name: string; last_name: string | null; user_platform_id: string | null },
    platform: { id: string; code: string; name: string } | null,
  ) {
    const created: User = {
      id: newUser.id,
      created_at: new Date().toISOString(),
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      email: newUser.email,
      is_admin: false,
      status: "active",
      user_platform_id: newUser.user_platform_id,
      platform: platform ? { name: platform.name, code: platform.code } : null,
    };
    setUsers((prev) => [created, ...prev]);
  }

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  return (
    <>
      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        platforms={platforms}
        onUserCreated={handleUserCreated}
      />

      {headerEl &&
        createPortal(
          <div className="flex items-center gap-x-1.5">
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Admin</span>
            <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Users</span>
          </div>,
          headerEl
        )}

      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-5 mt-2 flex-shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button
              type="button"
              variant="ghost"
              className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
              onClick={() => setAddUserOpen(true)}
              aria-label="Add user"
            >
              <div className="relative">
                <div
                  className={cn(
                    "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
                    "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
                  )}
                >
                  <Plus className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                </div>
              </div>
            </Button>

            <div className="relative flex-1 max-w-sm min-w-0">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name or email…"
                className={cn(
                  "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                  search.trim()
                    ? "border-b-[var(--kenoo-sky)]"
                    : "border-neutral-200",
                  "focus:border-b-[var(--kenoo-sky)]",
                )}
                aria-label="Search users by name or email"
              />
            </div>

            {platforms.length > 0 && (
              <div className="relative flex-shrink-0" ref={platformFilterRef}>
                <button
                  type="button"
                  onClick={() => setPlatformFilterOpen((o) => !o)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-none border-0 bg-transparent p-0 shadow-none",
                    "text-xs font-light uppercase tracking-wider",
                    platformFilter === "all" ? "text-neutral-500" : "text-neutral-800",
                    "hover:text-neutral-900 transition-colors",
                    "focus-visible:outline-none",
                  )}
                >
                  <span className="whitespace-nowrap">
                    {platformFilter === "all"
                      ? "All platforms"
                      : platforms.find((p) => p.id === platformFilter)?.name ?? "All platforms"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 text-neutral-500 transition-transform duration-200",
                      platformFilterOpen && "rotate-180",
                    )}
                    strokeWidth={1.8}
                  />
                </button>

                {platformFilterOpen && (
                  <div className="absolute top-full left-0 mt-1.5 min-w-[160px] bg-white border border-neutral-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setPlatformFilter("all"); setPlatformFilterOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors",
                        platformFilter === "all"
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-50",
                      )}
                    >
                      All platforms
                    </button>
                    {platforms.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setPlatformFilter(p.id); setPlatformFilterOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs transition-colors",
                          platformFilter === p.id
                            ? "bg-neutral-100 text-neutral-900"
                            : "text-neutral-700 hover:bg-neutral-50",
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isLoading && filteredUsers.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={effectivePage === 1}
                aria-label="Previous page"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-neutral-400 font-light whitespace-nowrap tabular-nums min-w-[7.5rem] text-center">
                Page {effectivePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={effectivePage >= totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto overscroll-none pb-8">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
              <tr>
                {["Name", "Email", "Platform", "Created", "Admin", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50"
                  >
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-4 pr-4">
                        <div className="h-4 rounded bg-neutral-100 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-xs text-red-400 font-light">
                    {error}
                  </td>
                </tr>
              )}
              {!isLoading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-neutral-400 font-light">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-7 w-7 text-neutral-300" />
                      <span>No users yet.</span>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && !error && users.length > 0 && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-neutral-400 font-light">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-7 w-7 text-neutral-300" />
                      <span>No users match your search.</span>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50/60 transition-colors"
                  >
                    <td className="py-4 pr-4">
                      <p className="text-xs font-medium text-neutral-700">
                        {displayName(user)}
                      </p>
                      <p className="text-[11px] font-mono lowercase text-neutral-400 break-all">
                        {user.id}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-xs text-neutral-600 font-light">
                      {user.email ?? <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="py-4 pr-4 text-xs text-neutral-600 font-light whitespace-nowrap min-w-[180px]">
                      <div
                        ref={openPlatformDropdownId === user.id ? platformDropdownRef : undefined}
                        className="relative inline-block"
                      >
                        <button
                          ref={openPlatformDropdownId === user.id ? platformTriggerRef : undefined}
                          type="button"
                          onClick={() =>
                            setOpenPlatformDropdownId(
                              openPlatformDropdownId === user.id ? null : user.id,
                            )
                          }
                          disabled={updatingPlatformId === user.id}
                          aria-label={`Platform for ${displayName(user)}`}
                          aria-expanded={openPlatformDropdownId === user.id}
                          className="inline-flex items-center gap-1 cursor-pointer text-left text-xs text-neutral-600 font-light outline-none transition-colors hover:text-neutral-900 focus:outline-none disabled:opacity-60"
                        >
                          <span>{user.platform?.name ?? <span className="text-neutral-300">—</span>}</span>
                          <span className="flex flex-col -space-y-2">
                            <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
                            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                          </span>
                        </button>
                        {openPlatformDropdownId === user.id && (
                          <div
                            className={`absolute left-0 z-20 min-w-[160px] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg ${
                              platformDropdownUp ? "bottom-full mb-1" : "top-full mt-1"
                            }`}
                            role="menu"
                          >
                            {platforms.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  updateUserPlatform(user.id, p.id);
                                  setOpenPlatformDropdownId(null);
                                }}
                                className="block w-full px-3 py-2 text-left text-xs text-neutral-700 font-light transition-colors hover:bg-neutral-50"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-xs text-neutral-400 font-light whitespace-nowrap">
                      {user.created_at ? formatDate(user.created_at) : <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="py-4 pr-4">
                      <SequenceSwitch
                        checked={user.is_admin}
                        onCheckedChange={(checked) => setUserAdmin(user.id, checked)}
                        disabled={togglingId === user.id}
                        aria-label={user.is_admin ? "Revoke admin" : "Grant admin"}
                      />
                    </td>
                    <td className="py-4 pr-2 text-right w-8">
                      <div
                        ref={openMenuId === user.id ? menuRef : undefined}
                        className="relative inline-block"
                      >
                        <button
                          ref={openMenuId === user.id ? menuTriggerRef : undefined}
                          type="button"
                          onClick={() =>
                            setOpenMenuId(openMenuId === user.id ? null : user.id)
                          }
                          aria-label="Open actions menu"
                          aria-expanded={openMenuId === user.id}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none"
                        >
                          <svg
                            aria-hidden
                            className="h-4 w-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <circle cx="12" cy="6" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="18" r="1.5" />
                          </svg>
                        </button>
                        {openMenuId === user.id && (
                          <div
                            className={`absolute right-0 z-20 min-w-[180px] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg ${
                              menuDropdownUp ? "bottom-full mb-1" : "top-full mt-1"
                            }`}
                            role="menu"
                          >
                            <Link
                              href={`/users/${user.id}`}
                              onClick={() => setOpenMenuId(null)}
                              className="block w-full px-3 py-2 text-left text-xs text-neutral-700 font-light transition-colors hover:bg-neutral-50"
                              role="menuitem"
                            >
                              View user
                            </Link>
                            {user.status === "active" ? (
                              <>
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={updatingStatusId === user.id}
                                  onClick={() => updateUserStatus(user, "suspended")}
                                  className="block w-full px-3 py-2 text-left text-xs text-amber-600 font-light transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {updatingStatusId === user.id ? "Updating…" : "Suspend"}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={updatingStatusId === user.id}
                                  onClick={() => updateUserStatus(user, "deactivated")}
                                  className="block w-full px-3 py-2 text-left text-xs text-red-400 font-light transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {updatingStatusId === user.id ? "Updating…" : "Deactivate"}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                disabled={updatingStatusId === user.id}
                                onClick={() => updateUserStatus(user, "active")}
                                className="block w-full px-3 py-2 text-left text-xs text-emerald-600 font-light transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {updatingStatusId === user.id ? "Activating…" : "Activate"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
