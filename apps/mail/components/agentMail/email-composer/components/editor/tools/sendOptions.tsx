// app/components/agent-mail/email-composer/components/editor/tools/sendOptions.tsx
import { ChevronUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MdOutlineScheduleSend } from "react-icons/md";
import { TbTestPipe } from "react-icons/tb";

interface SendOptionsDropdownProps {
  onScheduleClick: () => void;
  onTestSendClick: () => void;
  disabled?: boolean;
}

export function SendOptionsDropdown({ 
  onScheduleClick, 
  onTestSendClick, 
  disabled 
}: SendOptionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="lg"
          className="bg-kenoo-yellow text-black hover:bg-kenoo-yellow/70 hover:text-black/70 px-2"
          disabled={disabled}
        >
          <ChevronUp className="h-4 w-4 text-neutral-600" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="w-[160px] overflow-hidden z-[200] rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl p-1.5">
        <DropdownMenuItem onClick={onScheduleClick} className="cursor-pointer flex justify-between items-center rounded-lg focus:bg-neutral-100 focus:text-foreground hover:bg-neutral-100">
          <MdOutlineScheduleSend className="mr-1 h-5 w-5 text-kenoo-sky" />
          <span className="flex-grow text-right font-light">Schedule Send</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTestSendClick} className="cursor-pointer flex justify-between items-center rounded-lg focus:bg-neutral-100 focus:text-foreground hover:bg-neutral-100">
          <TbTestPipe className="mr-1 h-5 w-5 text-kenoo-sky" />
          <span className="flex-grow text-right font-light">Test Send (Me)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}