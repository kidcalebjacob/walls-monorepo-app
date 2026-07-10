"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PaymentDetails } from "@/types/payment.types";
import { Briefcase } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface EurBusinessTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function EurBusinessTemplate({
  paymentDetails,
  setPaymentDetails,
}: EurBusinessTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    businessName: paymentDetails.details.businessName || "",
    iban: paymentDetails.details.iban || "",
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
      name: "EUR-business",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="EUR"
      subtitle="Business account"
      flagCode="eu"
      icon={Briefcase}
    >
      <div className="space-y-4">
        <div className="space-y-3">
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
              placeholder="Business Name GmbH"
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              value={formData.iban}
              onChange={(e) => handleInputChange(e, "iban")}
              placeholder="DE89 3704 0044 0532 0130 00"
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </PaymentTemplate>
  );
}
