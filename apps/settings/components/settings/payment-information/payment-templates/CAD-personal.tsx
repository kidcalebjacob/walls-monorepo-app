"use client";

import { useState } from "react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { PaymentDetails } from "@/types/payment.types";
import { User } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface CadPersonalTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function CadPersonalTemplate({
  paymentDetails,
  setPaymentDetails,
}: CadPersonalTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    fullName: paymentDetails.details.fullName || "",
    institutionNumber: paymentDetails.details.institutionNumber || "",
    transitNumber: paymentDetails.details.transitNumber || "",
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
      name: "CAD-personal",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="CAD"
      subtitle="Personal account"
      flagCode="ca"
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
              id="institution-number"
              label="Institution Number"
              value={formData.institutionNumber}
              onChange={(e) => handleInputChange(e, "institutionNumber")}
            />
            
            <FloatingLabelInput
              id="transit-number"
              label="Transit Number"
              value={formData.transitNumber}
              onChange={(e) => handleInputChange(e, "transitNumber")}
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
