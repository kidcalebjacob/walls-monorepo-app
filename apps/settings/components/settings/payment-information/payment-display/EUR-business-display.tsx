"use client";

import { Label } from "@/components/ui/label";
import { PaymentDetails } from "@/types/payment.types";
import PaymentDisplayTemplate from "./payment-display-template";

interface EurBusinessDisplayProps {
  paymentDetails: PaymentDetails;
  onDelete: () => void;
}

export default function EurBusinessDisplay({
  paymentDetails,
  onDelete
}: EurBusinessDisplayProps) {
  const details = paymentDetails.details;

  return (
    <PaymentDisplayTemplate
      paymentDetails={paymentDetails}
      title="EUR"
      subtitle="Business account"
      flagCode="eu"
      onDelete={onDelete}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="contact-email" className="text-sm font-medium text-foreground">Contact Email</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {details.contactEmail || details.email || "Not provided"}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="business-name" className="text-sm font-medium text-foreground">Name of Business / Organization</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {details.businessName || "Not provided"}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="iban" className="text-sm font-medium text-foreground">IBAN</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {details.iban ? "•••••" + details.iban.slice(-4) : "Not provided"}
            </div>
          </div>
        </div>
      </div>
    </PaymentDisplayTemplate>
  );
}
