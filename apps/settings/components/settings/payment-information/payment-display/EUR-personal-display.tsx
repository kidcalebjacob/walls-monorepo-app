"use client";

import { Label } from "@/components/ui/label";
import { PaymentDetails } from "@/types/payment.types";
import PaymentDisplayTemplate from "./payment-display-template";

interface EurPersonalDisplayProps {
  paymentDetails: PaymentDetails;
  onDelete: () => void;
}

export default function EurPersonalDisplay({
  paymentDetails,
  onDelete
}: EurPersonalDisplayProps) {
  const details = paymentDetails.details;

  return (
    <PaymentDisplayTemplate
      paymentDetails={paymentDetails}
      title="EUR"
      subtitle="Personal account"
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
            <Label htmlFor="full-name" className="text-sm font-medium text-foreground">Full name of account holder</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {details.fullName || "Not provided"}
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
