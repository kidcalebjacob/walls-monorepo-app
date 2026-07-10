"use client";

import { ChevronRight, Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BusinessTypeOption {
  id: string;
  name: string;
  description: string;
  icon: "user" | "briefcase";
}

const businessTypeOptions: BusinessTypeOption[] = [
  {
    id: "business",
    name: "Business or charity",
    description: "For registered organizations and charities",
    icon: "briefcase"
  },
  {
    id: "personal",
    name: "Personal account",
    description: "For individual creators",
    icon: "user"
  }
];

interface BusinessTypeProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  onTypeSelect?: () => void;
}

export default function BusinessType({
  selectedType,
  onTypeChange,
  onTypeSelect,
}: BusinessTypeProps) {
  const handleTypeClick = (typeId: string) => {
    onTypeChange(typeId);
    if (onTypeSelect) {
      setTimeout(() => {
        onTypeSelect();
      }, 100);
    }
  };

  return (
    <div className="space-y-4 w-full overflow-y-auto flex-1">
      {businessTypeOptions.map((option, index) => (
        <motion.div
          key={option.id}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: index * 0.03,
            ease: [0.4, 0, 0.2, 1]
          }}
        >
          <div
            className={cn(
              "flex items-center justify-between p-4 rounded-lg w-full transition-all cursor-pointer border border-transparent hover:bg-neutral-100 hover:backdrop-blur-md hover:border-neutral-200/50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]",
              selectedType === option.id ? "shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] border-walls-yellow bg-neutral-100 backdrop-blur-md" : ""
            )}
            onClick={() => handleTypeClick(option.id)}
          >
            <div className="flex items-center space-x-4">
              <div className="relative w-10 h-10 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50">
                {option.icon === "user" ? (
                  <User className="h-5 w-5 text-neutral-600" />
                ) : (
                  <Briefcase className="h-5 w-5 text-neutral-600" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg">{option.name}</h3>
                <p className="text-sm text-muted-foreground font-light">{option.description}</p>
              </div>
            </div>
            <motion.div
              variants={{
                initial: { x: -6, scale: 1 },
                hover: { x: 6, scale: 1.1 }
              }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              whileHover="hover"
              initial="initial"
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
