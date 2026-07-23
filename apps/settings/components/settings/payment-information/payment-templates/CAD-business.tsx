"use client";

import { useState } from "react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { PaymentDetails } from "@/types/payment.types";
import { Briefcase } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface CadBusinessTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function CadBusinessTemplate({
  paymentDetails,
  setPaymentDetails,
}: CadBusinessTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    businessName: paymentDetails.details.businessName || "",
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
      name: "CAD-business",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="CAD"
      subtitle="Business account"
      flagCode="ca"
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
