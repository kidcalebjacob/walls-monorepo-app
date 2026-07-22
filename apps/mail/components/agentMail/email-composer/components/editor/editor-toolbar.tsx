"use client";

import { HyperlinkTool } from './tools/hyperlink';
import { AttachmentsTool } from './tools/attachments';
import { TextFormattingTool } from './tools/textFormatting';
import { PitchTracker } from './tools/pitchTracker';
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
  onPitchChange?: (creators: SelectedCreatorSummary[]) => void;
  recipientEmails: string[];
  selectedCreators: SelectedCreatorSummary[];
  onSubjectChange: (subject: string) => void;
  onAIGeneratingChange?: (generating: boolean) => void;
  onAIGenerationComplete?: (result: { subject: string; content: string }) => void;
  isFollowUpTab?: boolean;
  firstEmailContent?: string;
}

export function EditorToolbar({
  editorRef,
  onChange,
  onAttachmentsChange,
  onPitchChange = () => {},
  recipientEmails,
  selectedCreators,
  onSubjectChange,
  onAIGeneratingChange,
  onAIGenerationComplete,
  isFollowUpTab = false,
  firstEmailContent = '',
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

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <PitchTracker
                onPitchChange={onPitchChange}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Creator Tagger</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}