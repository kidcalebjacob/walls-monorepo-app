"use client";

import { ChevronRight } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface Currency {
  id: string;
  name: string;
  fullName: string;
  countryCode: string; // ISO 3166-1 alpha-2 country code (e.g. 'US', 'GB')
}

interface CurrencyCardProps {
  currency: Currency;
  isSelected: boolean;
  onClick: () => void;
}

export default function CurrencyCard({
  currency,
  isSelected,
  onClick,
}: CurrencyCardProps) {
  return (
    <motion.div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg w-full transition-all cursor-pointer border border-transparent hover:bg-neutral-100 hover:backdrop-blur-md hover:border-neutral-200/50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]",
        isSelected ? "shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-walls-yellow bg-neutral-100 backdrop-blur-md" : ""
      )}
      onClick={onClick}
      whileHover="hover"
      initial="initial"
      variants={{
        initial: {},
        hover: {}
      }}
    >
      <div className="flex items-center space-x-4">
        <div className="relative w-14 h-14 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center">
          <ReactCountryFlag
            countryCode={currency.countryCode}
            svg
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            title={`${currency.name} flag`}
          />
        </div>
        <div>
          <h3 className="font-black text-lg">{currency.id}</h3>
          <p className="text-sm text-muted-foreground font-light">{currency.fullName}</p>
        </div>
      </div>
      <motion.div
        variants={{
          initial: { x: -6, scale: 1 },
          hover: { x: 6, scale: 1.1 }
        }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </motion.div>
    </motion.div>
  );
}
