"use client";

import { useState } from "react";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { PaymentDetails } from "@/types/payment.types";
import { Briefcase } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface GbpBusinessTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function GbpBusinessTemplate({
  paymentDetails,
  setPaymentDetails,
}: GbpBusinessTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    businessName: paymentDetails.details.businessName || "",
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
      name: "GBP-business",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="GBP"
      subtitle="Business account"
      flagCode="gb"
      icon={Briefcase}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <FloatingLabelInput
              id="contact-email"
              type="email"
              label="Email"
              value={formData.contactEmail}
              onChange={(e) => handleInputChange(e, "contactEmail")}
            />
            
            <FloatingLabelInput
              id="business-name"
              label="Name of the Business / Organisation"
              value={formData.businessName}
              onChange={(e) => handleInputChange(e, "businessName")}
            />
          </div>
          
          <FloatingLabelInput
            id="sort-code"
            label="UK Sort Code"
            value={formData.sortCode}
            onChange={(e) => handleInputChange(e, "sortCode")}
          />
          
          <FloatingLabelInput
            id="account-number"
            label="Account Number"
            value={formData.accountNumber}
            onChange={(e) => handleInputChange(e, "accountNumber")}
          />
        </div>
      </div>
    </PaymentTemplate>
  );
}
