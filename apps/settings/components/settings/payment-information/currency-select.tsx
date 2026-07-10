"use client";

import { useState } from "react";
import CurrencyCard, { Currency } from "./currency-card";
import { Input } from "@/components/ui/input";
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
    <div className="w-full flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="relative flex-shrink-0 sticky top-0 z-10 bg-background">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center gap-3 pointer-events-none z-10">
          <Search className="h-5 w-5 text-neutral-500" />
          <div className="h-6 w-px bg-neutral-300" />
        </div>
        <Input
          type="text"
          placeholder="Search currency"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal pl-16 pr-4 h-14 rounded-xl focus:outline-none focus:ring-0 focus:border-neutral-200/50"
        />
      </div>
      
      <div className="space-y-4 w-full overflow-y-auto flex-1 pt-4 pb-16">
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
        
        {filteredCurrencies.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No currencies found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
