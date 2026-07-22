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
          className="bg-transparent text-neutral-500 border border-transparent border-l-[0.5px] border-l-neutral-300/80 hover:bg-gray-50 hover:text-neutral-500 hover:border-neutral-200 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out px-2 shadow-none"
          disabled={disabled}
        >
          <ChevronUp className="h-4 w-4 text-neutral-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-[160px] overflow-hidden z-[200] rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl p-1.5">
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