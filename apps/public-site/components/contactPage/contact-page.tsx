"use client";


import { wallsToast } from "@walls/ui/walls-toast";
import { useState } from "react";
import { Button } from "@walls/ui/button";
import { Input } from "@walls/ui/input";
import { Textarea } from "@walls/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@walls/ui/select-contact";
import { CheckCircle } from "lucide-react";
import Image from "next/image";
import { createClient } from "@walls/supabase/client";

interface ContactFormData {
  fullName: string;
  email: string;
  type: string;
  message: string;
}

export function ContactForm() {
  const [formData, setFormData] = useState<ContactFormData>({
    fullName: "",
    email: "",
    type: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Insert into Supabase contact_form table
      const payload = [
        {
          full_name: formData.fullName,
          email: formData.email,
          type: formData.type,
          message: formData.message
        }
      ];
      
      console.log("contact form payload being inserted", payload);
      const { data, error } = await supabase
        .from('contact_form')
        .insert(payload);
      console.log("contact form insert error", error);
      
      if (error) {
        console.error("Error submitting contact form:", error);
        wallsToast.error("Something went wrong", "Please try again or contact us directly.");
        return;
      }
      
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting contact form:", error);
      wallsToast.error("Something went wrong", "Please try again or contact us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-0">
        {/* Information Section - Right on desktop, below on mobile */}
        <div className="order-2 lg:order-2 lg:col-span-1 bg-neutral-200 rounded-t-none rounded-b-3xl lg:rounded-3xl p-8 space-y-16">
          {/* Logo and Company Name */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-3 text-center lg:text-left">
            <div className="w-32 h-32 relative mx-auto lg:mx-0">
              {/* WALLS Logo with inner glow effect */}
              <div className="relative w-full h-full">
                <Image
                  src="/images/WALLSBubbles.svg"
                  alt="WALLS Logo"
                  width={128}
                  height={128}
                  className="w-full h-full opacity-20 animate-pulse-slow"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-12 text-center lg:text-left">
            <div>
              <p className="text-sm text-black/80 font-semibold mb-2">Request roster</p>
              <a 
                href="mailto:info@wallsentertainment.com"
                className="inline-flex items-center text-sm text-gray-900 hover:bg-walls-yellow hover:text-black transition-all duration-300 whitespace-nowrap px-2 py-1 rounded"
              >
                info@wallsentertainment.com
                <svg
                  className="ml-1 h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 11L11 1M11 1H1M11 1V11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>

            <div>
              <p className="text-sm text-black/80 font-semibold mb-2">Call us</p>
              <a 
                href="tel:+13233002283"
                className="inline-flex items-center text-sm text-gray-900 hover:bg-walls-yellow hover:text-black transition-all duration-300 whitespace-nowrap px-2 py-1 rounded"
              >
                +1 (323) 300-2283
                <svg
                  className="ml-1 h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 11L11 1M11 1H1M11 1V11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
            
            <div>
              <p className="text-sm text-black/80 font-semibold mb-2">Join our team</p>
              <a 
                href="/careers"
                className="inline-flex items-center text-sm text-gray-900 hover:bg-walls-yellow hover:text-black transition-all duration-300 whitespace-nowrap px-2 py-1 rounded"
              >
                View open roles
                <svg
                  className="ml-1 h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 11L11 1M11 1H1M11 1V11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Success Overlay - Left on desktop, above on mobile */}
        <div className="order-1 lg:order-1 lg:col-span-3 relative bg-neutral-200 rounded-t-3xl rounded-b-none lg:rounded-3xl overflow-hidden p-8">
          {/* Background Circle Shape */}
          <div className="absolute inset-0 z-0 flex items-end justify-center">
            <div className="w-[800px] h-[800px] bg-walls-yellow rounded-full"></div>
          </div>
          
          {/* Success Content Overlay */}
          <div className="relative z-20 max-w-lg mx-auto text-center flex flex-col items-center justify-center h-full">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-gray-900 mb-8">
              Thanks {formData.fullName.split(' ')[0]}!
            </h2>
              We look forward to getting back to you.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-4 gap-0">
      {/* Information Section - Right on desktop, below on mobile */}
      <div className="order-2 lg:order-2 lg:col-span-1 bg-neutral-200 rounded-t-none rounded-b-3xl lg:rounded-3xl p-8 space-y-16">
        {/* Logo and Company Name */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-3 text-center lg:text-left">
          <div className="w-32 h-32 relative mx-auto lg:mx-0">
            {/* WALLS Logo with inner glow effect */}
            <div className="relative w-full h-full">
              <Image
                src="/images/WALLSBubbles.svg"
                alt="WALLS Logo"
                width={128}
                height={128}
                className="w-full h-full opacity-20 animate-pulse-slow"

              />
            </div>
          </div>
        </div>

          {/* Contact Information */}
          <div className="space-y-12 text-center lg:text-left">
            <div>
              <p className="text-sm text-black/80 font-semibold mb-2">Requesting roster?</p>
              <a 
                href="mailto:info@wallsentertainment.com"
                className="inline-flex items-center text-sm text-gray-900 hover:bg-walls-yellow hover:text-black transition-all duration-300 whitespace-nowrap px-2 py-1 rounded"
              >
                info@wallsentertainment.com
                <svg
                  className="ml-1 h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 11L11 1M11 1H1M11 1V11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>

            <div>
              <p className="text-sm text-black/80 font-semibold mb-2">Call us</p>
              <a 
                href="tel:+13233002283"
                className="inline-flex items-center text-sm text-gray-900 hover:bg-walls-yellow hover:text-black transition-all duration-300 whitespace-nowrap px-2 py-1 rounded"
              >
                +1 (323) 300-2283
                <svg
                  className="ml-1 h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 11L11 1M11 1H1M11 1V11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
            
            <div>
              <p className="text-sm text-black/80 font-semibold mb-2">Join our team?</p>
              <a 
                href="/careers"
                className="inline-flex items-center text-sm text-gray-900 hover:bg-walls-yellow hover:text-black transition-all duration-300 whitespace-nowrap px-2 py-1 rounded"
              >
                View open roles
                <svg
                  className="ml-1 h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 11L11 1M11 1H1M11 1V11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>
      </div>

      {/* Contact Form Section - Left on desktop, above on mobile */}
      <div className="order-1 lg:order-1 lg:col-span-3 relative bg-neutral-200 rounded-t-3xl rounded-b-none lg:rounded-3xl overflow-hidden p-8">
        {/* Background Circle Shape */}
        <div className="absolute inset-0 z-0 flex items-end justify-center">
          <div className="w-[800px] h-[800px] bg-walls-yellow rounded-full"></div>
        </div>
        
        {/* Form Content */}
        <div className="relative z-20 max-w-lg">
          <h2 className="text-4xl font-black text-gray-900 mb-8">
            Contact
          </h2>

          <form onSubmit={handleSubmit} className="space-y-12">
            {/* Name Field */}
            <div className="space-y-2">
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
                required
                className="bg-transparent border-0 border-b-2 border-black rounded-none px-0 py-2 text-gray-900 placeholder:text-neutral-700 shadow-none focus:border-black focus:ring-0 focus:shadow-none"
                placeholder="Your name"
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                className="bg-transparent border-0 border-b-2 border-black rounded-none px-0 py-2 text-gray-900 placeholder:text-neutral-700 shadow-none focus:border-black focus:ring-0 focus:shadow-none"
                placeholder="you@company.com"
              />
            </div>

            {/* User Type Field */}
            <div className="space-y-2">
              <Select
                value={formData.type}
                onValueChange={(value) => handleInputChange("type", value)}
                required
              >
                <SelectTrigger className="bg-transparent border-0 border-b-2 border-black rounded-none px-0 py-2 text-gray-900 placeholder:text-neutral-700 shadow-none focus:border-black focus:ring-0 focus:shadow-none h-auto">
                  <SelectValue placeholder="I am a..." />
                </SelectTrigger>
                <SelectContent className="bg-white/10 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl shadow-black/20 ring-1 ring-white/20">
                  <SelectItem value="brand" className="hover:bg-walls-yellow hover:text-black transition-all duration-200 rounded-lg mx-2 my-1 pl-4">Brand</SelectItem>
                  <SelectItem value="talent" className="hover:bg-walls-yellow hover:text-black transition-all duration-200 rounded-lg mx-2 my-1 pl-4">Talent</SelectItem>
                  <SelectItem value="investor" className="hover:bg-walls-yellow hover:text-black transition-all duration-200 rounded-lg mx-2 my-1 pl-4">Investor</SelectItem>
                  <SelectItem value="fan" className="hover:bg-walls-yellow hover:text-black transition-all duration-200 rounded-lg mx-2 my-1 pl-4">Fan</SelectItem>
                  <SelectItem value="other" className="hover:bg-walls-yellow hover:text-black transition-all duration-200 rounded-lg mx-2 my-1 pl-4">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message Field */}
            <div className="space-y-2">
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => handleInputChange("message", e.target.value)}
                required
                rows={4}
                className="bg-transparent border-0 border-b-2 border-black rounded-none px-0 py-2 text-gray-900 placeholder:text-neutral-700 shadow-none focus:border-black focus:ring-0 focus:shadow-none focus:outline-none resize-none"
                placeholder="Tell us all about it..."
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-black text-neutral-200 px-8 py-4 rounded-full font-medium hover:bg-walls-yellow hover:text-black transition-all duration-500 ease-in-out flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-14"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </div>
              ) : (
                <>
                  <span>Submit</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                  </svg>
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
