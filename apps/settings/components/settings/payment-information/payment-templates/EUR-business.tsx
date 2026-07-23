"use client";

import { useState } from "react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
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
          <FloatingLabelInput
            id="contact-email"
            type="email"
            label="Contact Email"
            value={formData.contactEmail}
            onChange={(e) => handleInputChange(e, "contactEmail")}
          />
          
          <FloatingLabelInput
            id="business-name"
            label="Name of Business / Organization"
            value={formData.businessName}
            onChange={(e) => handleInputChange(e, "businessName")}
          />
          
          <FloatingLabelInput
            id="iban"
            label="IBAN"
            value={formData.iban}
            onChange={(e) => handleInputChange(e, "iban")}
          />
        </div>
      </div>
    </PaymentTemplate>
  );
}
