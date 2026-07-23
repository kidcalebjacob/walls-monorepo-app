"use client";

import { useState } from "react";
import CurrencyCard, { Currency } from "./currency-card";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

const currencies: Currency[] = [
  { 
    id: "USD", 
    name: "US Dollar ($)", 
    fullName: "United States Dollar", 
    countryCode: "US" 
  },
  { 
    id: "EUR", 
    name: "Euro (€)", 
    fullName: "Euro",
    countryCode: "EU"
  },
  { 
    id: "GBP", 
    name: "British Pound (£)", 
    fullName: "British Pound Sterling",
    countryCode: "GB" 
  },
  { 
    id: "CAD", 
    name: "Canadian Dollar (C$)", 
    fullName: "Canadian Dollar",
    countryCode: "CA" 
  },
  { 
    id: "AUD", 
    name: "Australian Dollar (A$)", 
    fullName: "Australian Dollar",
    countryCode: "AU" 
  },
];

interface CurrencySelectProps {
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  onCurrencySelect?: () => void;
}

export default function CurrencySelect({
  selectedCurrency,
  onCurrencyChange,
  onCurrencySelect,
}: CurrencySelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const handleCurrencyClick = (currencyId: string) => {
    onCurrencyChange(currencyId);
    if (onCurrencySelect) {
      setTimeout(() => {
        onCurrencySelect();
      }, 100);
    }
  };

  const filteredCurrencies = currencies.filter(currency => 
    currency.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 flex-shrink-0 bg-background pb-2">
        <FloatingLabelInput
          type="text"
          label="Search currency"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startAdornment={<Search className="h-4 w-4 text-neutral-500" aria-hidden />}
        />
      </div>
      
      <div className="w-full flex-1 space-y-4 overflow-y-auto pb-16 pt-2">
        {filteredCurrencies.map((currency, index) => (
          <motion.div
            key={currency.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: index * 0.03,
              ease: [0.4, 0, 0.2, 1]
            }}
          >
            <CurrencyCard
              currency={currency}
              isSelected={selectedCurrency === currency.id}
              onClick={() => handleCurrencyClick(currency.id)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
