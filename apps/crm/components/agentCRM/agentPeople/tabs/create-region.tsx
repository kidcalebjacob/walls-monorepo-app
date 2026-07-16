import { Card, CardContent } from "@/components/ui/card";
import { LeadOperatingCountrySelect } from "@/components/ui/searches/leads-operating-country-search";
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
    )
  }
);

interface RegionProps {
  formData: any;
  handleSelectChange: (field: string) => (value: string | string[]) => void;
}

export default function Region({ formData, handleSelectChange }: RegionProps) {
  return (
    <div className="-mt-36 relative">
      {/* Background Map Container */}
      <div className="absolute inset-0 w-full pointer-events-none" style={{ zIndex: -1 }}>
        <Card className="bg-card border-0 h-full pointer-events-none">
          <CardContent className="p-4 h-full pointer-events-none">
            <OperatingCountriesMap 
              selectedCountries={formData.operatingCountries || []}
              className="pointer-events-none"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 