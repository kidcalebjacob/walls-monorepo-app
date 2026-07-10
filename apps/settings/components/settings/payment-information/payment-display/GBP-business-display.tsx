"use client";

import { Label } from "@/components/ui/label";
import { PaymentDetails } from "@/types/payment.types";
import PaymentDisplayTemplate from "./payment-display-template";

interface GbpBusinessDisplayProps {
  paymentDetails: PaymentDetails;
  onDelete: () => void;
}

export default function GbpBusinessDisplay({
  paymentDetails,
  onDelete
}: GbpBusinessDisplayProps) {
  const details = paymentDetails.details;

  return (
    <PaymentDisplayTemplate
      paymentDetails={paymentDetails}
      title="GBP"
      subtitle="Business account"
      flagCode="gb"
      onDelete={onDelete}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="contact-email" className="text-sm font-medium text-foreground">Email</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {details.contactEmail || details.email || "Not provided"}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="business-name" className="text-sm font-medium text-foreground">Name of the Business / Organisation</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {details.businessName || "Not provided"}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sort-code" className="text-sm font-medium text-foreground">UK Sort Code</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {details.sortCode ? "••-••-" + details.sortCode.slice(-2) : "Not provided"}
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
    </PaymentDisplayTemplate>
  );
}
