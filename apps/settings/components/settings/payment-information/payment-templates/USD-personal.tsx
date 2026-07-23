"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentDetails } from "@/types/payment.types";
import { User } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface UsdPersonalTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function UsdPersonalTemplate({
  paymentDetails,
  setPaymentDetails,
}: UsdPersonalTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    fullName: paymentDetails.details.fullName || "",
    routingNumber: paymentDetails.details.routingNumber || "",
    accountNumber: paymentDetails.details.accountNumber || "",
    accountType: paymentDetails.details.accountType || "checking",
    country: paymentDetails.details.country || "United States",
    city: paymentDetails.details.city || "",
    state: paymentDetails.details.state || "",
    address: paymentDetails.details.address || "",
    postCode: paymentDetails.details.postCode || "",
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
      name: "USD-personal",
      details: newData,
    });
  };

  const handleSelectChange = (value: string, field: string) => {
    const newData = {
      ...formData,
      [field]: value,
    };
    
    setFormData(newData);
    
    // Update parent component state
    setPaymentDetails({
      name: "USD-personal",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="USD"
      subtitle="Personal account"
      flagCode="us"
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
          
          <div className="grid grid-cols-2 gap-3">
            <FloatingLabelInput
              id="routing-number"
              label="Routing Number"
              value={formData.routingNumber}
              onChange={(e) => handleInputChange(e, "routingNumber")}
            />
            
            <FloatingLabelInput
              id="account-number"
              label="Account Number"
              value={formData.accountNumber}
              onChange={(e) => handleInputChange(e, "accountNumber")}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="account-type">Account Type</Label>
            <Select
              value={formData.accountType}
              onValueChange={(value) => handleSelectChange(value, "accountType")}
            >
              <SelectTrigger id="account-type" className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-xl h-14 focus-visible:ring-0 text-neutral-600 font-normal">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium mb-2">Recipient Address</h3>
          
        <div className="space-y-3">
          <FloatingLabelInput
            id="country"
            label="Country"
            value={formData.country}
            onChange={(e) => handleInputChange(e, "country")}
            disabled
          />
          
          <FloatingLabelInput
            id="city"
            label="City"
            value={formData.city}
            onChange={(e) => handleInputChange(e, "city")}
          />
          
          <FloatingLabelInput
            id="state"
            label="State"
            value={formData.state}
            onChange={(e) => handleInputChange(e, "state")}
          />
          
          <FloatingLabelInput
            id="address"
            label="Recipient Address"
            value={formData.address}
            onChange={(e) => handleInputChange(e, "address")}
          />
          
          <FloatingLabelInput
            id="post-code"
            label="Post Code"
            value={formData.postCode}
            onChange={(e) => handleInputChange(e, "postCode")}
          />
        </div>
      </div>
    </PaymentTemplate>
  );
}
