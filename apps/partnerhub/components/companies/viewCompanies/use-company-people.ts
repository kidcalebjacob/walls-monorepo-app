"use client";

import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanyPerson } from "./types";

// Module-level in-memory cache — persists across tab navigation, cleared on page refresh
const inMemoryCompanyPeopleCache = new Map<string, CompanyPerson[]>();

type PersonDepartmentRow = {
  name: string | null;
  apollo_name: string | null;
};

type PersonQueryRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  country: string | null;
  departments: PersonDepartmentRow | PersonDepartmentRow[] | null;
};

function formatDepartment(departments: PersonDepartmentRow | PersonDepartmentRow[] | null) {
  const deptList = Array.isArray(departments)
    ? departments
    : departments
      ? [departments]
      : [];
  const dept = deptList[0];
  if (!dept) return null;
  if (dept.name) return dept.name;
  if (!dept.apollo_name) return null;
  return dept.apollo_name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function mapPersonRow(person: PersonQueryRow): CompanyPerson {
  const name =
    person.first_name && person.last_name
      ? `${person.first_name} ${person.last_name}`
      : person.first_name || person.last_name || "Unknown";

  return {
    id: person.id,
    name,
    email: person.email || null,
    phone: person.phone || null,
    title: person.title || null,
    department: formatDepartment(person.departments),
    photoUrl: person.photo_url || null,
    linkedinUrl: person.linkedin_url || null,
    country: person.country || null,
  };
}

export function useCompanyPeople(companyId: string | null | undefined) {
  const { user } = useAuth();
  const cached = companyId ? inMemoryCompanyPeopleCache.get(companyId) : undefined;

  const [loading, setLoading] = useState(() => !cached);
  const [people, setPeople] = useState<CompanyPerson[]>(() => cached ?? []);
  const fetchedKeyRef = useRef<string | null>(cached && companyId ? companyId : null);

  const fetchPeople = useCallback(async () => {
    if (!user || !companyId) {
      setPeople([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("people")
        .select(`
          id, first_name, last_name, email, phone, title, photo_url, linkedin_url, country,
          departments:people_departments!people_departments_person_id_fkey(name, apollo_name)
        `)
        .eq("company_id", companyId)
        .order("last_name", { ascending: true });

      if (error) throw error;

      const list = (data as PersonQueryRow[] | null)?.map(mapPersonRow) ?? [];
      setPeople(list);
      inMemoryCompanyPeopleCache.set(companyId, list);
    } catch (err) {
      console.error("PartnerHub company people error:", err);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [user, companyId]);

  // Initial load only — skip if cached data was hydrated synchronously on mount,
  // and don't refetch when navigating back to a previously viewed company
  useEffect(() => {
    if (!companyId) {
      setPeople([]);
      setLoading(false);
      return;
    }
    if (fetchedKeyRef.current === companyId) return;

    const cachedPeople = inMemoryCompanyPeopleCache.get(companyId);
    if (cachedPeople) {
      setPeople(cachedPeople);
      setLoading(false);
      fetchedKeyRef.current = companyId;
      return;
    }

    if (!user) return;

    fetchedKeyRef.current = companyId;
    setLoading(true);
    fetchPeople();
  }, [user, companyId, fetchPeople]);

  return { loading, people };
}
