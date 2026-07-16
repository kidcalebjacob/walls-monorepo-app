import { format } from "date-fns";
import { FaGlobe } from "react-icons/fa";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FundingProps {
  formData: any;
}

export default function Funding({ formData }: FundingProps) {
  const [showFundingEvents, setShowFundingEvents] = useState(false);
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (error) {
      return dateString;
    }
  };

  const formatAmount = (amount: string | null, currency: string | null) => {
    if (!amount) return "UNDISCLOSED";
    const currencySymbol = currency || "$";
    return `${currencySymbol}${amount}`;
  };

  // Calculate total funding from all events
  const calculateTotalFunding = () => {
    if (!formData.funding_events || formData.funding_events.length === 0) {
      return "$0";
    }

    let total = 0;
    formData.funding_events.forEach((event: any) => {
      if (event.amount) {
        const amountStr = event.amount.toString().toUpperCase();
        let value = 0;

        if (amountStr.includes('K')) {
          value = parseFloat(amountStr.replace('K', '')) * 1000;
        } else if (amountStr.includes('M')) {
          value = parseFloat(amountStr.replace('M', '')) * 1000000;
        } else if (amountStr.includes('B')) {
          value = parseFloat(amountStr.replace('B', '')) * 1000000000;
        } else {
          value = parseFloat(amountStr) || 0;
        }

        total += value;
      }
    });

    // Format the total back to readable format
    if (total >= 1000000000) {
      return `$${(total / 1000000000).toFixed(2)}B`;
    } else if (total >= 1000000) {
      return `$${(total / 1000000).toFixed(2)}M`;
    } else if (total >= 1000) {
      return `$${(total / 1000).toFixed(2)}K`;
    } else {
      return `$${total.toLocaleString()}`;
    }
  };

  const totalFunding = calculateTotalFunding();

  return (
    <div className="bg-gray-50 rounded-[30px] p-6">
          <div className="flex items-center">
            <h2 className="text-black font-black text-4xl">FUNDING</h2>
            <div className="flex-1 border-t border-black h-[1px] mx-4" />
            <div className="flex items-center gap-3">
              <p className="text-black font-black text-4xl">{totalFunding}</p>
              {formData.funding_events && formData.funding_events.length > 0 && (
                <button
                  onClick={() => setShowFundingEvents(!showFundingEvents)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-200/50 transition-colors cursor-pointer whitespace-nowrap self-end"
                >
                  <span className="text-xs font-light text-foreground">See more</span>
                  {showFundingEvents ? (
                    <ChevronUp className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  )}
                </button>
              )}
            </div>
          </div>
          <AnimatePresence>
            {showFundingEvents && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-6 pt-6">
            {formData.funding_events?.map((event: any, index: number) => (
              <div key={event.id || index} className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">
                  {formatAmount(event.amount, event.currency)}
                </h3>
                <div className="flex-1 border-t border-black h-[1px]" />
                <div className="flex-shrink-0 flex items-center gap-3">
                  {event.news_url && (
                    <a 
                      href={event.news_url.startsWith('http') ? event.news_url : `https://${event.news_url}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xl text-black hover:opacity-80 transition-opacity relative group flex-shrink-0"
                    >
                      <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                      <FaGlobe className="relative z-10" />
                    </a>
                  )}
                  {event.type && (
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-muted-foreground">
                        {event.type}
                      </p>
                      <TooltipProvider delayDuration={500}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              {formatDate(event.date) && (
                                <p className="text-xs">Date: {formatDate(event.date)}</p>
                              )}
                              {event.investors && (
                                <p className="text-xs">Investors: {event.investors}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
              </div>
            ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
    </div>
  );
} 