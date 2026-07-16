import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const OperatingCountriesMap = dynamic(
  () => import("@/components/ui/maps/operating-countries-map"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[2/1] bg-transparent rounded-xl flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-kenoo-yellow" />
      </div>
    ),
  }
);

const fieldRowClass = "border-0 rounded-full bg-transparent hover:bg-gray-100 px-4 py-2 transition-colors";
const fieldLabelClass = "text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500";
const inputInnerClass =
  "border-0 bg-transparent px-0 text-[15px] font-light text-neutral-900 placeholder:text-neutral-300 focus-visible:ring-0 focus:ring-0 w-full min-w-0";

interface RegionProps {
  formData: any;
  handleInputChange: (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectChange: (field: string) => (value: string | string[]) => void;
}

export default function Region({ formData, handleInputChange }: RegionProps) {
  const selectedCountries = formData.region ? [formData.region] : [];

  return (
    <div className="relative pointer-events-none">
      <div className="relative z-10 -mt-1 mb-2 grid grid-cols-3 gap-4 pointer-events-auto">
        <div className={fieldRowClass}>
          <div className="flex flex-col gap-1 min-w-0">
            <span className={fieldLabelClass}>City</span>
            <BorderlessInput
              placeholder="City"
              value={formData.city || ""}
              onChange={handleInputChange("city")}
              className={inputInnerClass}
            />
          </div>
        </div>

        <div className={fieldRowClass}>
          <div className="flex flex-col gap-1 min-w-0">
            <span className={fieldLabelClass}>State</span>
            <BorderlessInput
              placeholder="State"
              value={formData.state || ""}
              onChange={handleInputChange("state")}
              className={inputInnerClass}
            />
          </div>
        </div>

        <div className={fieldRowClass}>
          <div className="flex flex-col gap-1 min-w-0">
            <span className={fieldLabelClass}>Country</span>
            <BorderlessInput
              placeholder="Country"
              value={formData.region || ""}
              onChange={handleInputChange("region")}
              className={inputInnerClass}
            />
          </div>
        </div>
      </div>

      <div className="relative -mt-20 w-full aspect-[2/1] pointer-events-none">
        <OperatingCountriesMap
          selectedCountries={selectedCountries}
          className="pointer-events-none h-full w-full"
        />
      </div>
    </div>
  );
}
