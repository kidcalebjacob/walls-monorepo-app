
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TechnologyProps {
  formData: any;
}

export default function Technologies({ formData }: TechnologyProps) {
  const [showTechnologies, setShowTechnologies] = useState(false);
  const technologiesCount = formData.current_technologies?.length || 0;

  return (
    <div className="bg-gray-50 rounded-[30px] p-6">
          <div className="flex items-center">
            <h2 className="text-black font-black text-4xl">TECHNOLOGIES</h2>
            <div className="flex-1 border-t border-black h-[1px] mx-4" />
            <div className="flex items-center gap-3">
              <p className="text-black font-black text-4xl">{technologiesCount}</p>
              {formData.current_technologies && formData.current_technologies.length > 0 && (
                <button
                  onClick={() => setShowTechnologies(!showTechnologies)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-200/50 transition-colors cursor-pointer whitespace-nowrap self-end"
                >
                  <span className="text-xs font-light text-foreground">See more</span>
                  {showTechnologies ? (
                    <ChevronUp className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  )}
                </button>
              )}
            </div>
          </div>
          <AnimatePresence>
            {showTechnologies && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-6 pt-6">
            {formData.current_technologies?.map((tech: any, index: number) => (
              <div key={index} className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">
                  {tech.name}
                </h3>
                <div className="flex-1 border-t border-black h-[1px]" />
                {tech.category && (
                  <p className="text-sm text-muted-foreground flex-shrink-0">
                    {tech.category}
                  </p>
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