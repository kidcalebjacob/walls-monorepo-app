import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const extractDomain = (website: string): string => {
  try {
    return website
      ?.replace(/^https?:\/\//, '')
      ?.replace(/^www\./, '')
      ?.replace(/\/$/, '') || '';
  } catch (error) {
    return '';
  }
};

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};