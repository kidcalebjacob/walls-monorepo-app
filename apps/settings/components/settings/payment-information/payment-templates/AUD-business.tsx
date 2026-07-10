"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PaymentDetails } from "@/types/payment.types";
import { Briefcase } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface AudBusinessTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function AudBusinessTemplate({
  paymentDetails,
  setPaymentDetails,
}: AudBusinessTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    businessName: paymentDetails.details.businessName || "",
    bsbCode: paymentDetails.details.bsbCode || "",
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
      name: "AUD-business",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="AUD"
      subtitle="Business account"
      flagCode="au"
      icon={Briefcase}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange(e, "contactEmail")}
                placeholder="business@example.com"
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="business-name">Name of Business / Organization</Label>
              <Input
                id="business-name"
                value={formData.businessName}
                onChange={(e) => handleInputChange(e, "businessName")}
                placeholder="Business Name, Inc."
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="bsb-code">BSB Code</Label>
              <Input
                id="bsb-code"
                value={formData.bsbCode}
                onChange={(e) => handleInputChange(e, "bsbCode")}
                placeholder="123456"
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account-number">Account Number</Label>
              <Input
                id="account-number"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange(e, "accountNumber")}
                placeholder="123456789"
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>
    </PaymentTemplate>
  );
}
