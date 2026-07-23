"use client";

import { useState } from "react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { PaymentDetails } from "@/types/payment.types";
import { User } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface EurPersonalTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function EurPersonalTemplate({
  paymentDetails,
  setPaymentDetails,
}: EurPersonalTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    fullName: paymentDetails.details.fullName || "",
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
      name: "EUR-personal",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="EUR"
      subtitle="Personal account"
      flagCode="eu"
      icon={User}
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
            id="full-name"
            label="Full name of account holder"
            value={formData.fullName}
            onChange={(e) => handleInputChange(e, "fullName")}
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
