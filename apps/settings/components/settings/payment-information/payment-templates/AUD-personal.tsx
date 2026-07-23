"use client";

import { useState } from "react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { PaymentDetails } from "@/types/payment.types";
import { User } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface AudPersonalTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function AudPersonalTemplate({
  paymentDetails,
  setPaymentDetails,
}: AudPersonalTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    fullName: paymentDetails.details.fullName || "",
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
      name: "AUD-personal",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="AUD"
      subtitle="Personal account"
      flagCode="au"
      icon={User}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <FloatingLabelInput
              id="contact-email"
              type="email"
              label="Contact Email"
              value={formData.contactEmail}
              onChange={(e) => handleInputChange(e, "contactEmail")}
            />
            
            <FloatingLabelInput
              id="full-name"
              label="Full Legal Name"
              value={formData.fullName}
              onChange={(e) => handleInputChange(e, "fullName")}
            />
          </div>
          
          <div className="space-y-3">
            <FloatingLabelInput
              id="bsb-code"
              label="BSB Code"
              value={formData.bsbCode}
              onChange={(e) => handleInputChange(e, "bsbCode")}
            />
            
            <FloatingLabelInput
              id="account-number"
              label="Account Number"
              value={formData.accountNumber}
              onChange={(e) => handleInputChange(e, "accountNumber")}
            />
          </div>
        </div>
      </div>
    </PaymentTemplate>
  );
}
