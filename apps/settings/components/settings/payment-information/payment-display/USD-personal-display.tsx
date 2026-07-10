"use client";

import { Label } from "@/components/ui/label";
import { PaymentDetails } from "@/types/payment.types";
import PaymentDisplayTemplate from "./payment-display-template";

interface UsdPersonalDisplayProps {
  paymentDetails: PaymentDetails;
  onDelete: () => void;
}

export default function UsdPersonalDisplay({
  paymentDetails,
  onDelete
}: UsdPersonalDisplayProps) {
  const details = paymentDetails.details;
  
  // Routing number is stored as 'abartn' in bank_details for USD accounts
  const routingNumber = details.routingNumber || details.abartn || "";
  
  // Address details are now stored flat in address_details column in Supabase
  const address = details.address || "Not provided";
  const city = details.city || "Not provided";
  const state = details.state || "Not provided";
  const postCode = details.postCode || "Not provided";
  const country = details.country || "United States";

  return (
    <PaymentDisplayTemplate
      paymentDetails={paymentDetails}
      title="USD"
      subtitle="Personal account"
      flagCode="us"
      onDelete={onDelete}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="text-sm font-medium text-foreground">Contact Email</Label>
              <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
                {details.contactEmail || details.email || "Not provided"}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="full-name" className="text-sm font-medium text-foreground">Full Legal Name</Label>
              <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
                {details.fullName || "Not provided"}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="routing-number" className="text-sm font-medium text-foreground">Routing Number</Label>
              <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
                {routingNumber ? "•••••" + routingNumber.slice(-4) : "Not provided"}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account-number" className="text-sm font-medium text-foreground">Account Number</Label>
              <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
                {details.accountNumber ? "•••••" + details.accountNumber.slice(-4) : "Not provided"}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="account-type" className="text-sm font-medium text-foreground">Account Type</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center capitalize">
              {details.accountType || "Not provided"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium mb-2">Recipient Address</h3>
          
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="country" className="text-sm font-medium text-foreground">Country</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center cursor-not-allowed opacity-75">
              {country}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="city" className="text-sm font-medium text-foreground">City</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {city}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="state" className="text-sm font-medium text-foreground">State</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {state}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium text-foreground">Recipient Address</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {address}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="post-code" className="text-sm font-medium text-foreground">Post Code</Label>
            <div className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-4 pr-4 h-14 rounded-xl flex items-center">
              {postCode}
            </div>
          </div>
        </div>
      </div>
    </PaymentDisplayTemplate>
  );
}
