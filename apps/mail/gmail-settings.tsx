"use client";

import React from 'react';
import { Settings, LayoutTemplate } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function GmailSettings() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200 focus:outline-none"
        >
          <Settings className="h-5 w-5 text-black/65" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push('/agents/email-templates')}>
          <LayoutTemplate className="mr-2 h-4 w-4" />
          View Templates
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}