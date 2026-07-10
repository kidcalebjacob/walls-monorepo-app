"use client";

import { wallsToast } from "@/components/ui/walls-toast";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useCallback } from "react";
import { PaymentDetails } from "@/types/payment.types";
import { useIsPaymentDetailsEmpty } from "@/hooks/usePaymentDetailsEmpty";
import { getSupabaseClient } from "@/lib/auth";
import { Toaster } from "@/components/ui/toaster";
import CurrencySelect from "./currency-select";
import BusinessType from "./business-type";
import UsdBusinessTemplate from "./payment-templates/USD-business";
import UsdPersonalTemplate from "./payment-templates/USD-personal";
import EurBusinessTemplate from "./payment-templates/EUR-business";
import EurPersonalTemplate from "./payment-templates/EUR-personal";
import CadPersonalTemplate from "./payment-templates/CAD-personal";
import CadBusinessTemplate from "./payment-templates/CAD-business";
import AudPersonalTemplate from "./payment-templates/AUD-personal";
import AudBusinessTemplate from "./payment-templates/AUD-business";
import GbpPersonalTemplate from "./payment-templates/GBP-personal";
import GbpBusinessTemplate from "./payment-templates/GBP-business";
import PaymentStagesHeader from "./payment-stages-header";
import PaymentFooter from "./payment-footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import PaymentDisplay from "./payment-display";
import { motion, AnimatePresence } from "framer-motion";

type PaymentStage = "currency" | "business-type" | "bank-details";

const PaymentInformationPage = () => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState("");
  const [recipientType, setRecipientType] = useState("");
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    name: "",
    details: {},
  });
  
  // Stage management
  const [currentStage, setCurrentStage] = useState<PaymentStage>("currency");
  const [completedStages, setCompletedStages] = useState<PaymentStage[]>([]);
  
  const [existingPayment, setExistingPayment] = useState<PaymentDetails | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHoveringSave, setIsHoveringSave] = useState(false);
  const isPaymentDetailsEmpty = useIsPaymentDetailsEmpty(paymentDetails);
  const savable = !isPaymentDetailsEmpty && !isSaving;

  // Handle stage completion
  const updateCompletedStages = (stage: PaymentStage) => {
    if (!completedStages.includes(stage)) {
      setCompletedStages(prev => [...prev, stage]);
    }
  };

  // Move to next stage
  const moveToNextStage = () => {
    if (currentStage === "currency") {
      updateCompletedStages("currency");
      setCurrentStage("business-type");
    } else if (currentStage === "business-type") {
      updateCompletedStages("business-type");
      setCurrentStage("bank-details");
    }
  };

  // Move to previous stage
  const moveToPreviousStage = () => {
    if (currentStage === "bank-details") {
      setCurrentStage("business-type");
    } else if (currentStage === "business-type") {
      setCurrentStage("currency");
    }
  };

  useEffect(() => {
    const fetchUserPayment = async () => {
      if (!user?.id) return;
      
      try {
        // First, try to fetch from wise_recipients table (Supabase)
        const supabase = getSupabaseClient();
        const { data: wiseDetails, error: wiseError } = await supabase
          .from('wise_recipients')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (wiseDetails && !wiseError) {
          // Use data from wise_recipients
          const currencyFromWise = wiseDetails.payout_currency?.toUpperCase() || '';
          const legalType = wiseDetails.legal_type?.toLowerCase() || '';
          const recipientTypeFromWise = legalType === 'business' ? 'business' : 'personal';
          
          // Merge bank_details with address_details for display
          const bankDetails = wiseDetails.bank_details || {};
          const addressDetails = wiseDetails.address_details || {};
          
          // Remove nested address object from bank_details if it exists
          const { address: nestedAddress, ...bankDetailsWithoutAddress } = bankDetails;
          
          // If address_details exists, use it; otherwise try to extract from nested address object
          let flatAddressDetails = addressDetails;
          if (!addressDetails || Object.keys(addressDetails).length === 0) {
            // Fallback: extract from nested address object if address_details is missing
            if (nestedAddress && typeof nestedAddress === 'object') {
              flatAddressDetails = {
                address: nestedAddress.firstLine || '',
                city: nestedAddress.city || '',
                state: nestedAddress.state || '',
                postCode: nestedAddress.postCode || '',
                country: nestedAddress.countryCode === 'US' ? 'United States' : (nestedAddress.countryCode || ''),
              };
            }
          }
          
          // Construct payment details from wise_details
          const paymentFromWise: PaymentDetails = {
            name: `${currencyFromWise}-${recipientTypeFromWise}`,
            details: {
              ...bankDetailsWithoutAddress,
              ...flatAddressDetails, // Address details (flat) will override any nested address
              // Add contact_email and recipient_name from Supabase columns
              contactEmail: wiseDetails.contact_email || bankDetailsWithoutAddress.contactEmail || bankDetailsWithoutAddress.email || '',
              fullName: recipientTypeFromWise === 'personal' ? (wiseDetails.recipient_name || bankDetailsWithoutAddress.fullName || '') : '',
              businessName: recipientTypeFromWise === 'business' ? (wiseDetails.recipient_name || bankDetailsWithoutAddress.businessName || '') : '',
            },
          };

          setExistingPayment(paymentFromWise);
          setCurrency(currencyFromWise);
          setRecipientType(recipientTypeFromWise);
          setCompletedStages(["currency", "business-type", "bank-details"]);
          setCurrentStage("bank-details");
          setPaymentDetails(paymentFromWise);
        }
      } catch (error) {
        console.error("Error fetching user payment:", error);
      }
    };
    fetchUserPayment();
  }, [user?.id]);

  // Update the payment template name when currency or recipient type changes
  useEffect(() => {
    if (currency && recipientType) {
      setPaymentDetails(prev => ({
        ...prev,
        name: `${currency}-${recipientType}`
      }));
    }
  }, [currency, recipientType]);

  // Helper function to map payment details to Wise API format
  const mapPaymentDetailsToWise = useCallback((details: PaymentDetails, currency: string, recipientType: string) => {
    const wiseDetails = { ...details.details };
    
    // Validate recipient type
    if (!recipientType || (recipientType !== "business" && recipientType !== "personal")) {
      throw new Error(`Invalid recipient type: ${recipientType}. Must be "business" or "personal"`);
    }
    
    // Map account holder name based on recipient type
    let accountHolderName = "";
    if (recipientType === "business") {
      accountHolderName = wiseDetails.businessName || "";
    } else {
      accountHolderName = wiseDetails.fullName || "";
    }

    if (!accountHolderName) {
      throw new Error("Account holder name is required");
    }

    // Map legal type (PRIVATE for personal, BUSINESS for business) - ensure uppercase
    const legalType = recipientType.toLowerCase() === "business" ? "BUSINESS" : "PRIVATE";
    
    // Validate currency
    if (!currency) {
      throw new Error("Currency is required");
    }

    // Map country - keep full name as API may handle conversion
    let country = wiseDetails.country || "";
    
    // Determine Wise payout type based on currency
    // The API route will handle the mapping, but we pass the currency code
    // For USD, the API route will convert to "ABA"
    let wiseType = currency.toLowerCase();
    
    // For specific currencies, use their standard Wise type names
    if (currency === "USD") {
      wiseType = "usd"; // API route will convert this to "ABA"
    } else if (currency === "EUR") {
      wiseType = "eur";
    } else if (currency === "CAD") {
      wiseType = "canadian";
    } else if (currency === "GBP") {
      wiseType = "gbp";
    } else if (currency === "AUD") {
      wiseType = "australian";
    }

    return {
      accountHolderName,
      currency: currency.toUpperCase(),
      type: wiseType,
      legalType,
      country,
      details: wiseDetails,
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (isPaymentDetailsEmpty || isSaving) return;

    setIsSaving(true);
    
    try {
      // Validate required fields before proceeding
      if (!currency || !recipientType) {
        throw new Error("Please select both currency and account type");
      }

      // Map payment details to Wise API format
      const wisePayload = mapPaymentDetailsToWise(paymentDetails, currency, recipientType);
      
      console.log("Wise API Payload:", {
        currency: wisePayload.currency,
        legalType: wisePayload.legalType,
        type: wisePayload.type,
        accountHolderName: wisePayload.accountHolderName,
      });

      // Call Wise API to create recipient
      const wiseResponse = await fetch("/api/wise/create-recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wisePayload),
      });

      if (!wiseResponse.ok) {
        const errorData = await wiseResponse.json();
        throw new Error(errorData.error || "Failed to create Wise recipient");
      }

      const wiseData = await wiseResponse.json();
      
      // Add Wise recipient ID to payment details
      const paymentWithWise = {
        ...paymentDetails,
        details: {
          ...paymentDetails.details,
          wiseRecipientId: wiseData.wiseAccountId,
          wisePaymentType: wiseData.payment_type,
        },
      };
      
      updateCompletedStages("bank-details");
      setExistingPayment(paymentWithWise);
      setEditMode(false);

      wallsToast.success("Payment details saved", "Your payment information has been connected to Wise");
    } catch (error: any) {
      console.error("Error saving payment details:", error);
      wallsToast.error("Failed to save payment details", error.message || "Please try again");
    } finally {
      setIsSaving(false);
    }
  }, [paymentDetails, currency, recipientType, isPaymentDetailsEmpty, isSaving, mapPaymentDetailsToWise]);

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
  };

  const handleCurrencySelect = () => {
    updateCompletedStages("currency");
    setCurrentStage("business-type");
  };

  const handleTypeChange = (newType: string) => {
    setRecipientType(newType);
  };

  const handleTypeSelect = () => {
    updateCompletedStages("business-type");
    setCurrentStage("bank-details");
  };

  const handleStageChange = (stage: PaymentStage) => {
    setCurrentStage(stage);
  };

  const handleDelete = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Delete from Wise API and Supabase
      const response = await fetch('/api/wise/delete-recipient', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete payment information');
      }

      // Reset local state
      setExistingPayment(null);
      setPaymentDetails({
        name: "",
        details: {},
      });
      setCurrency("");
      setRecipientType("");
      setCurrentStage("currency");
      setCompletedStages([]);
      setEditMode(false);

      wallsToast.negative("Payment details deleted", "Your payment information has been removed");
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      wallsToast.error("Failed to delete payment details", error.message || "Please try again");
    }
  }, [user?.id]);

  // Render the appropriate payment template based on currency and recipient type
  const renderBankDetailsTemplate = () => {
    const templateKey = `${currency}-${recipientType}`;
    
    switch (templateKey) {
      case "USD-business":
        return (
          <UsdBusinessTemplate 
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "USD-personal":
        return (
          <UsdPersonalTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "EUR-business":
        return (
          <EurBusinessTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "EUR-personal":
        return (
          <EurPersonalTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "CAD-personal":
        return (
          <CadPersonalTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "CAD-business":
        return (
          <CadBusinessTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "AUD-personal":
        return (
          <AudPersonalTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "AUD-business":
        return (
          <AudBusinessTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "GBP-personal":
        return (
          <GbpPersonalTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      case "GBP-business":
        return (
          <GbpBusinessTemplate
            paymentDetails={paymentDetails}
            setPaymentDetails={setPaymentDetails}
          />
        );
      // Add additional templates as they're created
      default:
        return (
          <div className="text-center p-6 bg-muted rounded-md">
            <p className="text-lg">Please select both a currency and business type to continue.</p>
          </div>
        );
    }
  };

  // Render current stage content
  const renderStageContent = () => {
    switch (currentStage) {
      case "currency":
        return (
          <div className="w-full max-w-lg mx-auto flex flex-col h-full">
            <div className="flex items-center justify-center mb-6 relative flex-shrink-0">
              <AnimatePresence mode="wait">
                <motion.h2
                  key="currency"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                  className="text-3xl font-bold text-center"
                >
                  Select your currency
                </motion.h2>
              </AnimatePresence>
              
              {currency && (
                <button 
                  onClick={handleCurrencySelect}
                  className="absolute right-0 flex items-center justify-center w-10 h-10 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-full transition-all duration-300 ease-in-out hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] hover:border-neutral-200"
                >
                  <ArrowRight className="h-5 w-5 text-foreground" />
                </button>
              )}
            </div>
            <CurrencySelect 
              selectedCurrency={currency}
              onCurrencyChange={handleCurrencyChange}
              onCurrencySelect={handleCurrencySelect}
            />
          </div>
        );
      case "business-type":
        return (
          <div className="w-full max-w-lg mx-auto flex flex-col h-full">
            <div className="flex items-center justify-center mb-6 relative flex-shrink-0">
              <motion.div
                layout
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-0"
              >
                <button 
                  onClick={moveToPreviousStage}
                  className="flex items-center justify-center w-10 h-10 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-full transition-all duration-300 ease-in-out hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] hover:border-neutral-200"
                >
                  <ArrowLeft className="h-5 w-5 text-foreground" />
                </button>
              </motion.div>
              
              <AnimatePresence mode="wait">
                <motion.h2
                  key="business-type"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                  className="text-3xl font-bold text-center"
                >
                  Select your business type
                </motion.h2>
              </AnimatePresence>
              
              {recipientType && (
                <button 
                  onClick={handleTypeSelect}
                  className="absolute right-0 flex items-center justify-center w-10 h-10 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-full transition-all duration-300 ease-in-out hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] hover:border-neutral-200"
                >
                  <ArrowRight className="h-5 w-5 text-foreground" />
                </button>
              )}
            </div>
            
            <BusinessType
              selectedType={recipientType}
              onTypeChange={handleTypeChange}
              onTypeSelect={handleTypeSelect}
            />
          </div>
        );
      case "bank-details":
        return (
          <div className="w-full max-w-xl mx-auto flex flex-col h-full">
            <div className="flex items-center justify-center mb-6 relative flex-shrink-0">
              <motion.div
                layout
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-0"
              >
                <button 
                  onClick={moveToPreviousStage}
                  className="flex items-center justify-center w-10 h-10 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-full transition-all duration-300 ease-in-out hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] hover:border-neutral-200"
                >
                  <ArrowLeft className="h-5 w-5 text-foreground" />
                </button>
              </motion.div>
              
              <AnimatePresence mode="wait">
                <motion.h2
                  key="bank-details"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                  className="text-3xl font-bold text-center"
                >
                  Enter your bank account details
                </motion.h2>
              </AnimatePresence>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto">
              {renderBankDetailsTemplate()}
              
              <div className="flex justify-center pt-8 pb-20">
                <Button
                  onClick={handleSave}
                  disabled={!savable}
                  variant="ghost"
                  onMouseEnter={() => setIsHoveringSave(true)}
                  onMouseLeave={() => setIsHoveringSave(false)}
                  className="relative bg-background backdrop-blur-md border border-neutral-200/50 text-foreground font-normal px-8 py-6 rounded-none hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                >
                  <AnimatePresence>
                    {isHoveringSave && (
                      <motion.div
                        initial={{ opacity: 0, x: -10, scale: 0.8 }}
                        animate={{ 
                          opacity: 1, 
                          x: 0,
                          scale: 1,
                          transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
                        }}
                        exit={{ 
                          opacity: 0, 
                          x: -10,
                          scale: 0.8,
                          transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
                        }}
                        className="absolute left-4 flex items-center pointer-events-none"
                      >
                        <Check className="h-4 w-4 text-walls-yellow" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.span 
                    className="inline-block"
                    animate={{
                      x: isHoveringSave ? 8 : 0,
                      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
                    }}
                  >
                    {isSaving ? "Saving..." : "Save account"}
                  </motion.span>
                </Button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // If user has payment details and not in edit mode, show payment display
  if (existingPayment && !editMode) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-gray-50">
        <div className="flex-1 w-full max-w-[90%] mx-auto min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="w-full p-8 pb-16">
              <PaymentDisplay paymentDetails={existingPayment} onDelete={handleDelete} />
            </div>
          </div>
        </div>
        <PaymentFooter />
        <Toaster />
      </div>
    );
  }

  // Otherwise show form flow
  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <div className="flex-1 w-full max-w-[90%] mx-auto overflow-hidden min-h-0">
        <div className="max-w-4xl mx-auto h-full flex flex-col min-h-0">
          <div className="w-full px-8 flex-shrink-0">
            <PaymentStagesHeader 
              currentStage={currentStage}
              onStageChange={handleStageChange}
              completedStages={completedStages}
            />
          </div>
          
          <div className="w-full px-8 flex-1 min-h-0 overflow-hidden pt-2">
            {renderStageContent()}
          </div>
        </div>
      </div>
      <PaymentFooter />
      <Toaster />
    </div>
  );
};

export default PaymentInformationPage;
