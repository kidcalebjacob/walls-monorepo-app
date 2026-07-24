import { cardSurfaceClass } from "../shared";
import { cn } from "@/lib/utils";
import { DepartmentBar } from "./department-bar";

export function CompanyTeamTab({
  employeeCount,
  departmentEntries,
  maxDepartmentCount,
}: {
  employeeCount: number | null;
  departmentEntries: [string, number][];
  maxDepartmentCount: number;
}) {
  return (
    <div className="space-y-6">
      <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
        <p className="text-[10px] font-light uppercase tracking-[0.14em] text-neutral-400">
          Total employees
        </p>
        <p className="mt-2 text-4xl font-black tabular-nums text-neutral-900">
          {employeeCount != null ? employeeCount.toLocaleString() : "—"}
        </p>
      </div>

      {departmentEntries.length > 0 ? (
        <div className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
          <p className="mb-6 text-xs font-medium uppercase tracking-widest text-neutral-500">
            By department
          </p>
          <div className="space-y-5">
            {departmentEntries.map(([department, count]) => (
              <DepartmentBar
                key={department}
                department={department}
                count={count}
                max={maxDepartmentCount}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm font-light text-neutral-400">
          No departmental breakdown available.
        </p>
      )}
    </div>
  );
}
