import { FaGlobe } from "react-icons/fa";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SubOrganizationsProps {
  formData: any;
}

export default function SubOrganizations({ formData }: SubOrganizationsProps) {
  const [showSuborganizations, setShowSuborganizations] = useState(false);
  const suborganizationsCount = formData.suborganizations?.length || 0;

  return (
    <div className="bg-gray-50 rounded-[30px] p-6">
          <div className="flex items-center">
            <h2 className="text-black font-black text-4xl">SUB-ORGANIZATIONS</h2>
            <div className="flex-1 border-t border-black h-[1px] mx-4" />
            <div className="flex items-center gap-3">
              <p className="text-black font-black text-4xl">{suborganizationsCount}</p>
              {formData.suborganizations && formData.suborganizations.length > 0 && (
                <button
                  onClick={() => setShowSuborganizations(!showSuborganizations)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-200/50 transition-colors cursor-pointer whitespace-nowrap self-end"
                >
                  <span className="text-xs font-light text-foreground">See more</span>
                  {showSuborganizations ? (
                    <ChevronUp className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  )}
                </button>
              )}
            </div>
          </div>
          <AnimatePresence>
            {showSuborganizations && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-6 pt-6">
            {formData.suborganizations?.map((org: any, index: number) => (
              <div key={index} className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">
                  {org.name}
                </h3>
                <div className="flex-1 border-t border-black h-[1px]" />
                {org.website_url && (
                  <a 
                    href={org.website_url.startsWith('http') ? org.website_url : `https://${org.website_url}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xl text-black hover:opacity-80 transition-opacity relative group flex-shrink-0"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaGlobe className="relative z-10" />
                  </a>
                )}
              </div>
            ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
    </div>
  );
} 