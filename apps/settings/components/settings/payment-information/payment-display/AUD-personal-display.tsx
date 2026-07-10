"use client";

import { Label } from "@/components/ui/label";
import { PaymentDetails } from "@/types/payment.types";
import PaymentDisplayTemplate from "./payment-display-template";

interface AudPersonalDisplayProps {
  paymentDetails: PaymentDetails;
  onDelete: () => void;
}

export default function AudPersonalDisplay({
  paymentDetails,
  onDelete
}: AudPersonalDisplayProps) {
  const details = paymentDetails.details;

  return (
    <PaymentDisplayTemplate
      paymentDetails={paymentDetails}
      title="AUD"
      subtitle="Personal account"
      flagCode="au"
      onDelete={onDelete}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="text-sm font-medium text-foreground">Contact Email</Label>
              <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
                {details.contactEmail || details.email || "Not provided"}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-sm font-medium text-foreground">Full Legal Name</Label>
              <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
                {details.fullName || "Not provided"}
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="bsb-code" className="text-sm font-medium text-foreground">BSB Code</Label>
              <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
                {details.bsbCode ? "•••" + details.bsbCode.slice(-3) : "Not provided"}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account-number" className="text-sm font-medium text-foreground">Account Number</Label>
              <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
                {details.accountNumber ? "•••••" + details.accountNumber.slice(-4) : "Not provided"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PaymentDisplayTemplate>
  );
}
