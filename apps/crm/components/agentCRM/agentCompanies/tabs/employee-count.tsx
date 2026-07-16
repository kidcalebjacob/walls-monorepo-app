"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const formatEmployees = (value: number | string): string => {
  if (!value) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('en-US');
};

interface FormattedNumberInputProps {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatValue: (value: number | string) => string;
  placeholder: string;
}

function FormattedNumberInput({ label, value, onChange, formatValue, placeholder }: FormattedNumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);
  const [textWidth, setTextWidth] = useState(0);

  const formattedValue = formatValue(value || '');

  useEffect(() => {
    if (textRef.current) {
      const width = textRef.current.getBoundingClientRect().width;
      setTextWidth(width);
    }
  }, [formattedValue]);

  return (
    <div className="min-h-[48px] flex items-center">
      <div className="border-0 rounded-full bg-transparent hover:bg-gray-100 px-4 py-2 w-full">
        <div className="flex items-center">
          <span className="text-2xl font-black text-black bg-kenoo-yellow/70 px-2 py-1 rounded">{label}</span>
          <div className="relative flex-1">
            <input
              type="number"
              value={value || ''}
              onChange={onChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              className={cn(
                "flex h-9 w-full rounded-md bg-transparent px-3 py-1 text-sm transition-colors",
                "border-0 focus-visible:ring-0 focus:ring-0",
                "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0"
              )}
            />
            <div className="absolute inset-0 flex items-center pointer-events-none px-3">
              <span ref={textRef} className="inline-block text-2xl font-black">
                {formattedValue || placeholder}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmployeeCountProps {
  formData: any;
  handleInputChange: (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const departments = [
  { name: "Accounting", key: "accounting" },
  { name: "Administrative", key: "administrative" },
  { name: "Arts & Design", key: "arts_and_design" },
  { name: "Business Development", key: "business_development" },
  { name: "Consulting", key: "consulting" },
  { name: "Data Science", key: "data_science" },
  { name: "Education", key: "education" },
  { name: "Engineering", key: "engineering" },
  { name: "Entrepreneurship", key: "entrepreneurship" },
  { name: "Finance", key: "finance" },
  { name: "Human Resources", key: "human_resources" }
];

export default function EmployeeCount({ formData, handleInputChange }: EmployeeCountProps) {
  const [showHeadcount, setShowHeadcount] = useState(false);
  const totalEmployees = formData.employeeCount ? formatEmployees(formData.employeeCount) : "0";
  
  // Calculate total department count
  const totalDepartmentCount = departments.reduce((sum, dept) => {
    const count = parseInt(formData.departmentalHeadCount?.[dept.key] || "0", 10);
    return sum + count;
  }, 0);
  
  // Calculate percentage for each department
  const getDepartmentPercentage = (deptKey: string) => {
    const deptCount = parseInt(formData.departmentalHeadCount?.[deptKey] || "0", 10);
    if (totalDepartmentCount === 0) return "0%";
    const percentage = (deptCount / totalDepartmentCount) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  return (
    <div className="bg-gray-50 rounded-[30px] p-6">
      <div className="flex items-center">
        <h2 className="text-black font-black text-4xl">EMPLOYEES</h2>
        <div className="flex-1 border-t border-black h-[1px] mx-4" />
        <div className="flex items-center gap-3">
          <p className="text-black font-black text-4xl">{totalEmployees}</p>
          <button
            onClick={() => setShowHeadcount(!showHeadcount)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-200/50 transition-colors cursor-pointer whitespace-nowrap self-end"
          >
            <span className="text-xs font-light text-foreground">See more</span>
            {showHeadcount ? (
              <ChevronUp className="w-3 h-3 flex-shrink-0 text-neutral-500" />
            ) : (
              <ChevronDown className="w-3 h-3 flex-shrink-0 text-neutral-500" />
            )}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {showHeadcount && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-6 pt-6">
              {departments.map((dept, index) => (
                <div key={index} className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">
                    {dept.name}
                  </h3>
                  <div className="flex-1 border-t border-black h-[1px]" />
                  <p className="text-sm text-muted-foreground flex-shrink-0">
                    {getDepartmentPercentage(dept.key)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
