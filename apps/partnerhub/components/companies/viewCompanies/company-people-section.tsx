"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardSurfaceClass } from "../shared";
import { PersonCardItem } from "./person-card-item";
import { useCompanyPeople } from "./use-company-people";

export function CompanyPeopleSection({ companyId }: { companyId: string }) {
  const { loading, people } = useCompanyPeople(companyId);

  return (
    <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
      <p className="mb-6 text-xs font-medium uppercase tracking-widest text-neutral-500">
        People
      </p>

      {loading ? (
        <div className="-mx-6 overflow-x-auto overscroll-x-contain scrollbar-hide sm:-mx-8">
          <div className="flex w-max gap-4 px-6 pb-1 sm:px-8">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={cn(cardSurfaceClass, "h-56 w-[240px] shrink-0 animate-pulse bg-neutral-100/80")}
              />
            ))}
          </div>
        </div>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Users className="h-7 w-7 text-neutral-200" />
          <p className="text-xs font-light uppercase tracking-wider text-neutral-400">
            No people on record
          </p>
        </div>
      ) : (
        <div className="-mx-6 overflow-x-auto overscroll-x-contain scrollbar-hide sm:-mx-8">
          <div className="flex w-max gap-4 px-6 pb-1 snap-x snap-mandatory sm:px-8">
            {people.map((person) => (
              <div key={person.id} className="w-[240px] shrink-0 snap-start">
                <PersonCardItem person={person} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
