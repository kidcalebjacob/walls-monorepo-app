"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PaymentDetails } from "@/types/payment.types";
import { User } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface GbpPersonalTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function GbpPersonalTemplate({
  paymentDetails,
  setPaymentDetails,
}: GbpPersonalTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    fullName: paymentDetails.details.fullName || "",
    sortCode: paymentDetails.details.sortCode || "",
    accountNumber: paymentDetails.details.accountNumber || "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    const newData = {
      ...formData,
      [field]: e.target.value,
    };
    
    setFormData(newData);
    
    // Update parent component state
    setPaymentDetails({
      name: "GBP-personal",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="GBP"
      subtitle="Personal account"
      flagCode="gb"
      icon={User}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange(e, "contactEmail")}
                placeholder="your@email.com"
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name of the Account Holder</Label>
              <Input
                id="full-name"
                value={formData.fullName}
                onChange={(e) => handleInputChange(e, "fullName")}
                placeholder="John Smith"
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sort-code">UK Sort Code</Label>
            <Input
              id="sort-code"
              value={formData.sortCode}
              onChange={(e) => handleInputChange(e, "sortCode")}
              placeholder="12-34-56"
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="account-number">Account Number</Label>
            <Input
              id="account-number"
              value={formData.accountNumber}
              onChange={(e) => handleInputChange(e, "accountNumber")}
              placeholder="12345678"
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </PaymentTemplate>
  );
}
