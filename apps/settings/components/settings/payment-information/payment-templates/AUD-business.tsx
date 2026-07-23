"use client";

import { useState } from "react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
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
