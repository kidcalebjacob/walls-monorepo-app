"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentDetails } from "@/types/payment.types";
import { Briefcase } from "lucide-react";
import PaymentTemplate from "./payment-templates";

interface UsdBusinessTemplateProps {
  paymentDetails: PaymentDetails;
  setPaymentDetails: (details: PaymentDetails) => void;
}

export default function UsdBusinessTemplate({
  paymentDetails,
  setPaymentDetails,
}: UsdBusinessTemplateProps) {
  const [formData, setFormData] = useState({
    contactEmail: paymentDetails.details.contactEmail || "",
    businessName: paymentDetails.details.businessName || "",
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
      name: "USD-business",
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
      name: "USD-business",
      details: newData,
    });
  };

  return (
    <PaymentTemplate
      paymentDetails={paymentDetails}
      title="USD"
      subtitle="Business account"
      flagCode="us"
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
                placeholder="Business Name, LLC"
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="routing-number">Routing Number</Label>
              <Input
                id="routing-number"
                value={formData.routingNumber}
                onChange={(e) => handleInputChange(e, "routingNumber")}
                placeholder="123456789"
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account-number">Account Number</Label>
              <Input
                id="account-number"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange(e, "accountNumber")}
                placeholder="987654321"
                className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
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
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleInputChange(e, "country")}
              placeholder="United States"
              disabled
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl cursor-not-allowed opacity-75"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleInputChange(e, "city")}
              placeholder="New York"
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => handleInputChange(e, "state")}
              placeholder="TX (State Abbreviation)"
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address">Recipient Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange(e, "address")}
              placeholder="123 Business Street, Suite 100"
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="post-code">Post Code</Label>
            <Input
              id="post-code"
              value={formData.postCode}
              onChange={(e) => handleInputChange(e, "postCode")}
              placeholder="10001"
              className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </PaymentTemplate>
  );
}
