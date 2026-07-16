import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { ContactSearch } from "@/components/ui/searches/contactSearch/contact-search";

const vendorFieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] bg-transparent w-full placeholder:text-neutral-300";
const labelClass = "text-xs font-normal text-neutral-400 tracking-wide block mb-1";

interface VendorInformationProps {
  formData: any;
  handleInputChange: (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleContactChange: (value: string) => void;
}

export default function VendorInformation({ 
  formData, 
  handleInputChange,
  handleContactChange
}: VendorInformationProps) {
  return (
    <div className="space-y-6">
      {/* Vendor Information Container */}
      <div className="bg-gray-50 rounded-[30px] p-6">
        <div className="flex items-center mb-6">
          <h2 className="text-black font-black text-4xl">VENDOR INFORMATION</h2>
          <div className="flex-1 border-t border-black h-[1px] mx-4" />
        </div>
        <div className="grid grid-cols-2 gap-4 items-start">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Legal Name</label>
              <BorderlessInput
                value={formData.vendorCompanyName || ''}
                onChange={handleInputChange("vendorCompanyName")}
                className={vendorFieldClass}
                placeholder="Legal Name"
              />
            </div>

            <div>
              <label className={labelClass}>Country</label>
              <BorderlessInput
                value={formData.vendorCountry || ''}
                onChange={handleInputChange("vendorCountry")}
                className={vendorFieldClass}
                placeholder="Country"
              />
            </div>

            <div>
              <label className={labelClass}>State</label>
              <BorderlessInput
                value={formData.vendorState || ''}
                onChange={handleInputChange("vendorState")}
                className={vendorFieldClass}
                placeholder="State"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className={labelClass}>City</label>
              <BorderlessInput
                value={formData.vendorCity || ''}
                onChange={handleInputChange("vendorCity")}
                className={vendorFieldClass}
                placeholder="City"
              />
            </div>

            <div>
              <label className={labelClass}>Street Address</label>
              <BorderlessInput
                value={formData.vendorStreetAddress || ''}
                onChange={handleInputChange("vendorStreetAddress")}
                className={vendorFieldClass}
                placeholder="Street Address"
              />
            </div>

            <div>
              <label className={labelClass}>ZIP/Postal Code</label>
              <BorderlessInput
                value={formData.vendorZipCode || ''}
                onChange={handleInputChange("vendorZipCode")}
                className={vendorFieldClass}
                placeholder="ZIP/Postal Code"
              />
            </div>

            <div>
              <label className={labelClass}>Contact</label>
              <ContactSearch
                value={formData.vendorContact}
                onChange={handleContactChange}
                className="border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 bg-transparent w-full text-foreground text-sm justify-between placeholder:text-neutral-300"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 