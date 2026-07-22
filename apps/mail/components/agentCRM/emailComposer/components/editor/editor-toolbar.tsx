"use client";

import { HyperlinkTool } from './tools/hyperlink';
import { AttachmentsTool } from './tools/attachments';
import { TextFormattingTool } from './tools/textFormatting';
import { AIWriterTool } from './tools/aiWriter';
import { EditorRef } from './editor';
import { SignatureTool } from './tools/signature';
import type { SelectedCreatorSummary } from './tools/pitchTracker';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorToolbarProps {
  editorRef: React.RefObject<EditorRef | null>;
  onChange: (content: string) => void;
  onAttachmentsChange: (files: File[]) => void;
  recipientEmails: string[];
  selectedCreators: SelectedCreatorSummary[];
  onSubjectChange: (subject: string) => void;
  onAIGeneratingChange?: (generating: boolean) => void;
  onAIGenerationComplete?: (result: { subject: string; content: string }) => void;
  isFollowUpTab?: boolean;
  firstEmailContent?: string;
  isTalentOutreach?: boolean;
  outreachPersonId?: string | null;
  outreachRecipientFirstNameFallback?: string | null;
}

export function EditorToolbar({
  editorRef,
  onChange,
  onAttachmentsChange,
  recipientEmails,
  selectedCreators,
  onSubjectChange,
  onAIGeneratingChange,
  onAIGenerationComplete,
  isFollowUpTab = false,
  firstEmailContent = '',
  isTalentOutreach = false,
  outreachPersonId = null,
  outreachRecipientFirstNameFallback = null,
}: EditorToolbarProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center space-x-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <AIWriterTool
                onChange={onChange}
                onSubjectChange={onSubjectChange}
                editorRef={editorRef}
                recipientEmails={recipientEmails}
                selectedCreators={selectedCreators}
                onGeneratingChange={onAIGeneratingChange}
                onAIGenerationComplete={onAIGenerationComplete}
                isFollowUpTab={isFollowUpTab}
                firstEmailContent={firstEmailContent}
                isTalentOutreach={isTalentOutreach}
                outreachPersonId={outreachPersonId}
                outreachRecipientFirstNameFallback={outreachRecipientFirstNameFallback}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>AI Writer</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <TextFormattingTool
                editor={editorRef.current?.getEditor()}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Text Stylizing</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <HyperlinkTool
                editorRef={editorRef}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Link</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <AttachmentsTool
                onAttachmentsChange={onAttachmentsChange}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Attachments</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <SignatureTool editorRef={editorRef} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Signature</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}