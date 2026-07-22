// components/agent-mail/email-composer/email-composer.tsx
"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import Editor, { EditorRef, normalizeEmailHtmlForSend } from './components/editor/editor';

// Import sub-components
import { EmailHeader } from './components/EmailHeader';
import { RecipientField } from './components/recipients/recipient-field';
import { EmailFooter } from './components/footer/email-footer';
import { FollowUpTab } from './components/FollowUpTab';
import { AttachmentsList } from './components/editor/tools/attachments';
import type { SelectedCreatorSummary } from './components/editor/tools/pitchTracker';
import { motion, AnimatePresence } from 'framer-motion';
import { ShiningText } from '@/components/ui/shining-text';

// Types
interface EmailTag {
  email: string;
  id: string;
}

interface FollowUpTabData {
  id: string;
  toTags: EmailTag[];
  ccTags: EmailTag[];
  bccTags: EmailTag[];
  subject: string;
  content: string;
  attachments: File[];
  selectedCreators: SelectedCreatorSummary[];
}

/** Optional display fields when opening from agent scouter (DB first name may be empty). */
export interface OutreachRecipientProfile {
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  personId?: string; // Optional person_id for linking recipients
  isTalentOutreach?: boolean; // When true, AI writer uses talent outreach mode (agent-scouter page)
  outreachRecipientProfile?: OutreachRecipientProfile | null;
  /** Pre-fill fields when opening from Wallie email drafts */
  prefill?: {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    bodyHtml?: string;
    draftId?: string;
    threadId?: string | null;
    isReply?: boolean;
  };
  replyTo?: {
    to: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    originalMessage?: string;
    threadId?: string;
    messageId?: string;
    draftId?: string;
    headers?: {
      'References': string;
      'In-Reply-To': string;
      'Message-ID': string;
    };
  };
}

export default function EmailComposer({
  isOpen,
  onClose,
  replyTo,
  prefill,
  personId,
  isTalentOutreach = false,
  outreachRecipientProfile = null,
}: EmailComposerProps) {
  const { user } = useAuth();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [followUpTabs, setFollowUpTabs] = useState<FollowUpTabData[]>([]);
  const [mainTab, setMainTab] = useState<FollowUpTabData | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Core state
  const [toTags, setToTags] = useState<EmailTag[]>(
    replyTo?.to ? [{ email: replyTo.to, id: Math.random().toString(36).substr(2, 9) }] : []
  );
  const [ccTags, setCcTags] = useState<EmailTag[]>(
    replyTo?.cc ? [{ email: replyTo.cc, id: Math.random().toString(36).substr(2, 9) }] : []
  );
  const [bccTags, setBccTags] = useState<EmailTag[]>(
    replyTo?.bcc ? [{ email: replyTo.bcc, id: Math.random().toString(36).substr(2, 9) }] : []
  );
  const [subject, setSubject] = useState(
    replyTo?.subject ? (
      replyTo.subject.trim() 
        ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`)
        : ''
    ) : ''
  );
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const editorRef = useRef<EditorRef>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<SelectedCreatorSummary[]>([]);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const editorPlainText = (content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hasEditorText = editorPlainText.length > 0;
  const showGenerationSkeleton = isAIGenerating && !hasEditorText;
  const showEditIndicator = isAIGenerating && hasEditorText;

  const outreachFirstNameFallback =
    (outreachRecipientProfile?.firstName?.trim() ||
      outreachRecipientProfile?.displayName?.trim().split(/\s+/).filter(Boolean)[0] ||
      '') ||
    null;

  // Clear content when composer closes
  useEffect(() => {
    if (!isOpen) {
      // Clear all fields when composer is closed
      setContent('');
      setSubject('');
      setToTags([]);
      setCcTags([]);
      setBccTags([]);
      setAttachments([]);
      setSelectedCreators([]);
      // Clear all follow-up tab states
      setMainTab(null);
      setFollowUpTabs([]);
      setActiveTabId(null);
      // Clear editor content
      if (editorRef.current?.getEditor()) {
        editorRef.current.getEditor()?.commands.setContent('<p></p>');
      }
    }
  }, [isOpen]);

  // Update recipient fields when replyTo changes or composer opens
  useEffect(() => {
    if (isOpen && replyTo) {
      // Update To field
      if (replyTo.to) {
        setToTags([{ email: replyTo.to, id: Math.random().toString(36).substr(2, 9) }]);
      }
      // Update CC field
      if (replyTo.cc) {
        setCcTags([{ email: replyTo.cc, id: Math.random().toString(36).substr(2, 9) }]);
      } else {
        setCcTags([]);
      }
      // Update BCC field
      if (replyTo.bcc) {
        setBccTags([{ email: replyTo.bcc, id: Math.random().toString(36).substr(2, 9) }]);
      } else {
        setBccTags([]);
      }
      // Update subject
      if (replyTo.subject) {
        const newSubject = replyTo.subject.trim() 
          ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`)
          : '';
        setSubject(newSubject);
      } else {
        setSubject('');
      }
    } else if (isOpen && !replyTo && !prefill) {
      // Reset fields when opening without replyTo or prefill
      setToTags([]);
      setCcTags([]);
      setBccTags([]);
      setSubject('');
      setContent('');
      setAttachments([]);
      setSelectedCreators([]);
    }
  }, [isOpen, replyTo?.to, replyTo?.cc, replyTo?.bcc, replyTo?.subject]);

  // Pre-fill from Wallie (or other callers) when opening with draft data
  useEffect(() => {
    if (!isOpen || !prefill) return;

    const makeTags = (emails: string[] | undefined) =>
      (emails ?? []).map((email) => ({
        email,
        id: Math.random().toString(36).substr(2, 9),
      }));

    if (prefill.to?.length) setToTags(makeTags(prefill.to));
    if (prefill.cc?.length) setCcTags(makeTags(prefill.cc));
    if (prefill.bcc?.length) setBccTags(makeTags(prefill.bcc));

    if (prefill.subject != null) {
      const subjectValue = prefill.subject.trim();
      if (prefill.isReply && subjectValue && !subjectValue.startsWith("Re:")) {
        setSubject(`Re: ${subjectValue}`);
      } else {
        setSubject(subjectValue);
      }
    }

    if (prefill.draftId) setDraftId(prefill.draftId);

    if (prefill.bodyHtml) {
      setContent(prefill.bodyHtml);
      setTimeout(() => {
        editorRef.current?.getEditor()?.commands.setContent(prefill.bodyHtml || "<p></p>");
      }, 0);
    }
  }, [isOpen, prefill]);

  const handleSubjectChange = (newSubject: string) => {
    console.log('EmailComposer: Updating subject to:', newSubject);
    // Don't allow editing subject for follow-up tabs
    if (activeTabId && activeTabId !== 'main') {
      return;
    }
    setSubject(newSubject);
    // Update active tab's subject (only for main tab)
    if (activeTabId === 'main' && mainTab) {
      setMainTab({ ...mainTab, subject: newSubject });
    }
  };

  const handleSubjectPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Don't allow pasting into follow-up tabs
    if (activeTabId && activeTabId !== 'main') {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');

    const normalizedText = text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/\u2013|\u2014/g, '-')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();

    handleSubjectChange(normalizedText);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    // Update active tab's content
    if (activeTabId === 'main' && mainTab) {
      setMainTab({ ...mainTab, content: newContent });
    } else if (activeTabId) {
      setFollowUpTabs(tabs => 
        tabs.map(tab => 
          tab.id === activeTabId ? { ...tab, content: newContent } : tab
        )
      );
    }
  };

  // Refs for AI typing animation (same effect as Wallie chat)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Typing delay: very fast for email composer */
  const getDelay = useCallback((prevChar: string) => {
    let delay = 0;
    if (['.', '!', '?'].includes(prevChar)) delay += 0.8 + Math.random() * 0.5;
    else if ([',', ':', ';'].includes(prevChar)) delay += 0.4 + Math.random() * 0.3;
    else if (prevChar === '\n') delay += 0.4 + Math.random() * 0.3;
    return delay;
  }, []);

  /** When AI generation completes, type out subject then body (same effect as Wallie). On follow-up tab, only type body and leave subject unchanged. */
  const handleAIGenerationComplete = useCallback((result: { subject: string; content: string }) => {
    const fullContent = result.content ?? '';
    const isFollowUpTab = activeTabId != null && activeTabId !== 'main';
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const typeBodyOnly = () => {
      handleContentChange('');
      editorRef.current?.getEditor()?.commands.setContent('<p></p>');
      let bodyIndex = 0;
      const typeBodyChar = () => {
        const prev = bodyIndex > 0 ? fullContent[bodyIndex - 1] : '';
        bodyIndex += 1;
        const partial = fullContent.slice(0, bodyIndex);
        handleContentChange(partial);
        editorRef.current?.getEditor()?.commands.setContent(partial);
        if (bodyIndex <= fullContent.length) {
          typingTimeoutRef.current = setTimeout(typeBodyChar, bodyIndex === 1 ? 2 : getDelay(prev));
        }
      };
      typingTimeoutRef.current = setTimeout(typeBodyChar, 2);
    };

    if (isFollowUpTab) {
      typeBodyOnly();
      return;
    }

    const fullSubject = result.subject ?? '';
    setSubject('');
    handleContentChange('');
    editorRef.current?.getEditor()?.commands.setContent('<p></p>');

    let subIndex = 0;
    const typeSubjectChar = () => {
      const prevChar = subIndex > 0 ? fullSubject[subIndex - 1] : '';
      subIndex += 1;
      if (subIndex > fullSubject.length) {
        handleSubjectChange(fullSubject);
        let bodyIndex = 0;
        const typeBodyChar = () => {
          const prev = bodyIndex > 0 ? fullContent[bodyIndex - 1] : '';
          bodyIndex += 1;
          const partial = fullContent.slice(0, bodyIndex);
          handleContentChange(partial);
          editorRef.current?.getEditor()?.commands.setContent(partial);
          if (bodyIndex <= fullContent.length) {
            typingTimeoutRef.current = setTimeout(typeBodyChar, bodyIndex === 1 ? 2 : getDelay(prev));
          }
        };
        typingTimeoutRef.current = setTimeout(typeBodyChar, 2);
        return;
      }
      handleSubjectChange(fullSubject.slice(0, subIndex));
      typingTimeoutRef.current = setTimeout(typeSubjectChar, subIndex === 1 ? 2 : getDelay(prevChar));
    };
    typingTimeoutRef.current = setTimeout(typeSubjectChar, 2);
  }, [getDelay, handleSubjectChange, handleContentChange, activeTabId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleAttachmentsChange = (files: File[]) => {
    setAttachments(files);
    console.log('Attachments updated:', files);
    // Update active tab's attachments
    if (activeTabId === 'main' && mainTab) {
      setMainTab({ ...mainTab, attachments: files });
    } else if (activeTabId) {
      setFollowUpTabs(tabs => 
        tabs.map(tab => 
          tab.id === activeTabId ? { ...tab, attachments: files } : tab
        )
      );
    }
  };

  const handlePitchChange = (creators: SelectedCreatorSummary[]) => {
    setSelectedCreators(creators);
    console.log('EmailComposer - handlePitchChange called with:', creators);
    // Update active tab's selected creators
    if (activeTabId === 'main' && mainTab) {
      setMainTab({ ...mainTab, selectedCreators: creators });
    } else if (activeTabId) {
      setFollowUpTabs(tabs => 
        tabs.map(tab => 
          tab.id === activeTabId ? { ...tab, selectedCreators: creators } : tab
        )
      );
    }
  };

  // Check if all tabs have content (for sequence validation)
  const allTabsHaveContent = () => {
    const allTabs = [
      ...(mainTab ? [mainTab] : []),
      ...followUpTabs
    ];

    // If no tabs or only one tab, skip this check (regular validation handles it)
    if (allTabs.length <= 1) {
      return true;
    }

    // Get current editor content (HTML) for the active tab
    const currentEditorContent = editorRef.current?.getEditor()?.getHTML() || '';
    const currentEditorText = currentEditorContent.replace(/<[^>]+>/g, '').trim();

    // Check all tabs have content
    for (const tab of allTabs) {
      let tabContent = '';
      
      if (tab.id === 'main' && activeTabId === 'main') {
        // Current main tab - use current editor content
        tabContent = currentEditorText;
      } else if (tab.id === activeTabId) {
        // Current follow-up tab - use current editor content
        tabContent = currentEditorText;
      } else {
        // Other tabs - use stored content (strip HTML tags to check if empty)
        const storedContent = tab.content || '';
        tabContent = storedContent.replace(/<[^>]+>/g, '').trim();
      }

      // Check if content is empty (no meaningful text)
      if (!tabContent || tabContent === '' || tabContent === '<p></p>' || tabContent === '<p><br></p>') {
        return false;
      }
    }

    return true;
  };

  const handleAddFollowUp = () => {
    // Determine the subject to use for the follow-up
    // Always use mainTab's subject if it exists (the original subject), otherwise use current subject
    let sourceSubject = '';
    
    // If this is the first follow-up, save current email as main tab first
    if (!mainTab && followUpTabs.length === 0) {
      // Use current subject as the source
      sourceSubject = subject || '';
      
      const mainTabData: FollowUpTabData = {
        id: 'main',
        toTags: [...toTags],
        ccTags: [...ccTags],
        bccTags: [...bccTags],
        subject: sourceSubject,
        content,
        attachments: [...attachments],
        selectedCreators: [...selectedCreators]
      };
      setMainTab(mainTabData);
    } else {
      // Save current state to active tab
      if (activeTabId === 'main' && mainTab) {
        setMainTab({
          ...mainTab,
          toTags: [...toTags],
          ccTags: [...ccTags],
          bccTags: [...bccTags],
          subject,
          content,
          attachments: [...attachments],
          selectedCreators: [...selectedCreators]
        });
        // Use the updated mainTab subject
        sourceSubject = subject || mainTab.subject || '';
      } else if (activeTabId) {
        // We're on a follow-up tab - save its state but use mainTab's subject for new follow-up
        setFollowUpTabs(tabs => 
          tabs.map(tab => 
            tab.id === activeTabId 
              ? { 
                  ...tab, 
                  toTags: [...toTags],
                  ccTags: [...ccTags],
                  bccTags: [...bccTags],
                  subject,
                  content,
                  attachments: [...attachments],
                  selectedCreators: [...selectedCreators]
                }
              : tab
          )
        );
        // For follow-ups, always use mainTab's original subject
        if (mainTab && mainTab.subject) {
          sourceSubject = mainTab.subject;
        } else {
          // Fallback if mainTab doesn't have subject yet
          sourceSubject = subject || '';
        }
      } else {
        // No active tab - use mainTab's subject if it exists
        if (mainTab && mainTab.subject) {
          sourceSubject = mainTab.subject;
        } else {
          sourceSubject = subject || '';
        }
      }
    }

    // Create new tab with current recipients (for follow-up)
    // Format the subject with RE: prefix if needed
    // Make sure we're using the original subject (strip any existing RE: prefix first)
    let originalSubject = sourceSubject.trim();
    if (originalSubject.startsWith('RE:') || originalSubject.startsWith('Re:')) {
      // Remove existing RE: prefix to avoid double prefixes
      originalSubject = originalSubject.replace(/^RE:\s*/i, '').trim();
    }
    
    const followUpSubject = originalSubject ? `RE: ${originalSubject}` : '';
    
    const newTab: FollowUpTabData = {
      id: Math.random().toString(36).substr(2, 9),
      toTags: toTags.length > 0 ? [...toTags] : [],
      ccTags: [...ccTags],
      bccTags: [...bccTags],
      subject: followUpSubject,
      content: '',
      attachments: [],
      selectedCreators: []
    };
    setFollowUpTabs([...followUpTabs, newTab]);
    setActiveTabId(newTab.id);
    
    // Set the follow-up subject and clear content for the new follow-up
    setSubject(followUpSubject);
    setContent('');
    setAttachments([]);
    setSelectedCreators([]);
    if (editorRef.current?.getEditor()) {
      editorRef.current.getEditor()?.commands.setContent('<p></p>');
    }
  };

  const handleTabClick = (tabId: string) => {
    // Save current state to previously active tab
    if (activeTabId === 'main' && mainTab) {
      setMainTab({
        ...mainTab,
        toTags: [...toTags],
        ccTags: [...ccTags],
        bccTags: [...bccTags],
        subject,
        content,
        attachments: [...attachments],
        selectedCreators: [...selectedCreators]
      });
    } else if (activeTabId) {
      setFollowUpTabs(tabs => 
        tabs.map(tab => 
          tab.id === activeTabId 
            ? { 
                ...tab, 
                toTags: [...toTags],
                ccTags: [...ccTags],
                bccTags: [...bccTags],
                subject,
                content,
                attachments: [...attachments],
                selectedCreators: [...selectedCreators]
              }
            : tab
        )
      );
    }

    // Switch to the clicked tab
    if (tabId === 'main' && mainTab) {
      setActiveTabId('main');
      setToTags([...mainTab.toTags]);
      setCcTags([...mainTab.ccTags]);
      setBccTags([...mainTab.bccTags]);
      setSubject(mainTab.subject);
      setContent(mainTab.content);
      setAttachments([...mainTab.attachments]);
      setSelectedCreators([...mainTab.selectedCreators]);
      if (editorRef.current?.getEditor()) {
        editorRef.current.getEditor()?.commands.setContent(mainTab.content || '<p></p>');
      }
    } else {
      const tab = followUpTabs.find(t => t.id === tabId);
      if (tab) {
        setActiveTabId(tabId);
        setToTags([...tab.toTags]);
        setCcTags([...tab.ccTags]);
        setBccTags([...tab.bccTags]);
        setSubject(tab.subject);
        setContent(tab.content);
        setAttachments([...tab.attachments]);
        setSelectedCreators([...tab.selectedCreators]);
        if (editorRef.current?.getEditor()) {
          editorRef.current.getEditor()?.commands.setContent(tab.content || '<p></p>');
        }
      }
    }
  };

  const handleTabClose = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Don't allow closing the main tab if it's the only tab
    if (tabId === 'main' && followUpTabs.length === 0) {
      return;
    }
    
    // Save current state if closing the active tab
    if (activeTabId === tabId) {
      if (tabId === 'main' && mainTab) {
        setMainTab({
          ...mainTab,
          toTags: [...toTags],
          ccTags: [...ccTags],
          bccTags: [...bccTags],
          subject,
          content,
          attachments: [...attachments],
          selectedCreators: [...selectedCreators]
        });
      } else {
        setFollowUpTabs(tabs => 
          tabs.map(tab => 
            tab.id === tabId 
              ? { 
                  ...tab, 
                  toTags: [...toTags],
                  ccTags: [...ccTags],
                  bccTags: [...bccTags],
                  subject,
                  content,
                  attachments: [...attachments],
                  selectedCreators: [...selectedCreators]
                }
              : tab
          )
        );
      }
    }
    
    if (tabId === 'main') {
      // Closing main tab - switch to first follow-up or clear
      setMainTab(null);
      if (followUpTabs.length > 0) {
        const firstTab = followUpTabs[0];
        setActiveTabId(firstTab.id);
        setToTags([...firstTab.toTags]);
        setCcTags([...firstTab.ccTags]);
        setBccTags([...firstTab.bccTags]);
        setSubject(firstTab.subject);
        setContent(firstTab.content);
        setAttachments([...firstTab.attachments]);
        setSelectedCreators([...firstTab.selectedCreators]);
        if (editorRef.current?.getEditor()) {
          editorRef.current.getEditor()?.commands.setContent(firstTab.content || '<p></p>');
        }
      } else {
        // No follow-ups left, reset to original state
        setActiveTabId(null);
        if (replyTo?.to) {
          setToTags([{ email: replyTo.to, id: Math.random().toString(36).substr(2, 9) }]);
        } else {
          setToTags([]);
        }
        if (replyTo?.cc) {
          setCcTags([{ email: replyTo.cc, id: Math.random().toString(36).substr(2, 9) }]);
        } else {
          setCcTags([]);
        }
        if (replyTo?.bcc) {
          setBccTags([{ email: replyTo.bcc, id: Math.random().toString(36).substr(2, 9) }]);
        } else {
          setBccTags([]);
        }
        setSubject(replyTo?.subject ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : '');
        setContent('');
        setAttachments([]);
        setSelectedCreators([]);
        if (editorRef.current?.getEditor()) {
          editorRef.current.getEditor()?.commands.setContent('<p></p>');
        }
      }
    } else {
      // Closing a follow-up tab
      const updatedTabs = followUpTabs.filter(tab => tab.id !== tabId);
      setFollowUpTabs(updatedTabs);
      
      if (activeTabId === tabId) {
        if (updatedTabs.length > 0) {
          // Switch to the last tab
          const lastTab = updatedTabs[updatedTabs.length - 1];
          setActiveTabId(lastTab.id);
          setToTags([...lastTab.toTags]);
          setCcTags([...lastTab.ccTags]);
          setBccTags([...lastTab.bccTags]);
          setSubject(lastTab.subject);
          setContent(lastTab.content);
          setAttachments([...lastTab.attachments]);
          setSelectedCreators([...lastTab.selectedCreators]);
          if (editorRef.current?.getEditor()) {
            editorRef.current.getEditor()?.commands.setContent(lastTab.content || '<p></p>');
          }
        } else if (mainTab) {
          // Switch to main tab
          setActiveTabId('main');
          setToTags([...mainTab.toTags]);
          setCcTags([...mainTab.ccTags]);
          setBccTags([...mainTab.bccTags]);
          setSubject(mainTab.subject);
          setContent(mainTab.content);
          setAttachments([...mainTab.attachments]);
          setSelectedCreators([...mainTab.selectedCreators]);
          if (editorRef.current?.getEditor()) {
            editorRef.current.getEditor()?.commands.setContent(mainTab.content || '<p></p>');
          }
        } else {
          // No tabs left, reset
          setActiveTabId(null);
          if (replyTo?.to) {
            setToTags([{ email: replyTo.to, id: Math.random().toString(36).substr(2, 9) }]);
          } else {
            setToTags([]);
          }
          if (replyTo?.cc) {
            setCcTags([{ email: replyTo.cc, id: Math.random().toString(36).substr(2, 9) }]);
          } else {
            setCcTags([]);
          }
          if (replyTo?.bcc) {
            setBccTags([{ email: replyTo.bcc, id: Math.random().toString(36).substr(2, 9) }]);
          } else {
            setBccTags([]);
          }
          setSubject(replyTo?.subject ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : '');
          setContent('');
          setAttachments([]);
          setSelectedCreators([]);
          if (editorRef.current?.getEditor()) {
            editorRef.current.getEditor()?.commands.setContent('<p></p>');
          }
        }
      }
    }
  };


  const handleSend = async () => {
    if (sending) return;

    const toEmails = toTags.map(tag => tag.email).join(', ');

    if (!toEmails || !subject || !content.trim()) {
      wallsToast.error("Missing Information", "Please fill in all required fields before sending.");
      return;
    }

    try {
      setSending(true);

      // Check if we have multiple tabs (sequence)
      const allTabs = [
        ...(mainTab ? [mainTab] : []),
        ...followUpTabs
      ];

      // If we have multiple tabs, use sequence endpoint
      if (allTabs.length > 1) {
        // Save current state to active tab before collecting all emails
        if (activeTabId === 'main' && mainTab) {
          setMainTab({
            ...mainTab,
            toTags: [...toTags],
            ccTags: [...ccTags],
            bccTags: [...bccTags],
            subject,
            content,
            attachments: [...attachments],
            selectedCreators: [...selectedCreators]
          });
        } else if (activeTabId) {
          setFollowUpTabs(tabs => 
            tabs.map(tab => 
              tab.id === activeTabId 
                ? { 
                    ...tab, 
                    toTags: [...toTags],
                    ccTags: [...ccTags],
                    bccTags: [...bccTags],
                    subject,
                    content,
                    attachments: [...attachments],
                    selectedCreators: [...selectedCreators]
                  }
                : tab
            )
          );
        }

        // Collect all emails from tabs
        // For the active tab, get content from editor; for others, use stored content
        const emails = allTabs.map((tab) => {
          const tabToEmails = tab.toTags.map(tag => tag.email).join(', ');
          const tabCcEmails = tab.ccTags.length ? tab.ccTags.map(tag => tag.email).join(', ') : undefined;
          const tabBccEmails = tab.bccTags.length ? tab.bccTags.map(tag => tag.email).join(', ') : undefined;
          
          // If this is the active tab, get HTML from editor; otherwise use stored content
          let htmlContent = tab.content;
          if ((activeTabId === 'main' && tab.id === 'main') || (activeTabId === tab.id)) {
            // This is the currently active tab - get content from editor
            if (editorRef.current?.getEditor()) {
              htmlContent = editorRef.current.getEditor()?.getHTML() || tab.content;
            }
          }
          htmlContent = normalizeEmailHtmlForSend(htmlContent);

          return {
            to: tabToEmails,
            cc: tabCcEmails,
            bcc: tabBccEmails,
            subject: tab.subject,
            message: htmlContent,
            content: htmlContent,
            attachments: tab.attachments || []
          };
        });

        // Collect selected creators from all tabs (use main tab's creators as they should be the same)
        const allSelectedCreators = mainTab?.selectedCreators || selectedCreators || [];

        // Send to sequence endpoint
        const response = await fetch('/api/gmail/send/sequence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails,
            subject: mainTab?.subject || subject,
            personId: personId, // Pass person_id if available
            selectedCreators: allSelectedCreators // Pass selected creators
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create email sequence');
        }

        const result = await response.json();

        if (draftId) {
          await fetch(`/api/gmail/drafts/${draftId}?email=${encodeURIComponent(user?.email || '')}`, {
            method: 'DELETE',
          });
        }

        wallsToast.success("Email Sequence Created", `Sequence "${result.sequenceName}" with ${result.stepsCreated} steps has been created.`);

        // Reset form
        setContent('');
        setSubject('');
        setToTags([]);
        setCcTags([]);
        setBccTags([]);
        setAttachments([]);
        setSelectedCreators([]);
        setMainTab(null);
        setFollowUpTabs([]);
        setActiveTabId(null);
        onClose();
      } else {
        // Single email - use regular send endpoint
        const newMessageId = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
        const headers = {
          'Message-ID': `<${newMessageId}@mail.gmail.com>`,
          ...(replyTo?.headers && {
            'References': replyTo.headers['References'],
            'In-Reply-To': replyTo.headers['Message-ID'],
          }),
        };

        const attachmentData = await Promise.all(
          attachments.map(async (file) => {
            const data = await file.arrayBuffer();
            return {
              name: file.name,
              type: file.type || 'application/octet-stream',
              data: Array.from(new Uint8Array(data)),
            };
          })
        );

        const emailData = {
          to: toEmails,
          cc: ccTags.length ? ccTags.map(tag => tag.email).join(', ') : undefined,
          bcc: bccTags.length ? bccTags.map(tag => tag.email).join(', ') : undefined,
          subject,
          message: normalizeEmailHtmlForSend(content),
          threadId: replyTo?.threadId,
          headers,
          attachments: attachmentData,
          selectedCreators
        };

        console.log('Sending email with attachments:', attachmentData.length);

        console.log('=== Email Content Debug ===');
        console.log('Raw content:', content);
        console.log('HTML structure:', editorRef.current?.getEditor()?.getHTML());

        const response = await fetch('/api/gmail/send/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send email');
        }

        if (draftId) {
          await fetch(`/api/gmail/drafts/${draftId}?email=${encodeURIComponent(user?.email || '')}`, {
            method: 'DELETE',
          });
        }

        wallsToast.success("Email Sent", "Your email has been sent successfully.");

        // Reset form
        setContent('');
        setSubject('');
        setToTags([]);
        setCcTags([]);
        setBccTags([]);
        setAttachments([]);
        setSelectedCreators([]);
        onClose();
      }
    } catch (error) {
      console.error('Error sending email:', error);
      wallsToast.error("Error", error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  // Only show tabs if there are follow-up tabs (not just the main tab)
  const allTabs = [
    ...(mainTab ? [mainTab] : []),
    ...followUpTabs
  ];
  const shouldShowTabs = followUpTabs.length > 0;
  const tabBarHeight = shouldShowTabs ? 40 : 0;

  return (
    <div 
      className="fixed z-[150] pointer-events-auto"
      style={{
        bottom: '0',
        right: '16px',
        width: isMinimized ? '320px' : '600px',
        height: isMinimized ? 'auto' : '600px',
        maxHeight: isMinimized ? 'auto' : 'calc(100vh)',
      }}
    >
      {/* Follow-up Tabs - Absolutely positioned above composer */}
      <AnimatePresence initial={false}>
        {shouldShowTabs && (
          <motion.div
            key="follow-up-tab-bar"
            className="absolute flex items-end gap-0 bg-gray-100 overflow-hidden"
            style={{ 
              bottom: '100%',
              left: '0',
              right: '0',
              paddingTop: '2px',
              marginBottom: '-1px'
            }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: tabBarHeight, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {allTabs.map((tab, index) => {
              const followUpIndex = followUpTabs.findIndex(t => t.id === tab.id);
              return (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, delay: index * 0.05, ease: 'easeOut' }}
                  className="flex items-end"
                >
                  <FollowUpTab
                    id={tab.id}
                    label={tab.id === 'main' 
                      ? (tab.subject || 'Original Email')
                      : `Follow-up ${followUpIndex + 1}`
                    }
                    isActive={activeTabId === tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    onClose={(e) => handleTabClose(tab.id, e)}
                    index={index}
                    totalTabs={allTabs.length}
                    isMainTab={tab.id === 'main'}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <div 
        className={cn(
          "w-full",
          isMinimized ? "h-auto" : "h-full",
          "flex flex-col relative",
          "overflow-hidden",
          "font-[Arial]",
          "transition-all duration-300 ease-out",
          "bg-white",
          "border border-gray-200",
          "shadow-[0_4px_16px_rgba(0,0,0,0.15)]",
          "rounded-t-2xl",
          "flex flex-col"
        )}
      >
        {/* Content container with proper z-index */}
        <div className="relative z-10 flex flex-col h-full">
          <EmailHeader 
            subject={subject}
            isReply={!!replyTo}
            onClose={onClose}
            fromEmail={user?.email}
            onSubjectChange={handleSubjectChange}
            isMinimized={isMinimized}
            onMinimize={() => setIsMinimized(!isMinimized)}
            toEmails={toTags.map(tag => tag.email)}
            onAddFollowUp={handleAddFollowUp}
          />

          {!isMinimized && (
            <div className="flex flex-col flex-1 overflow-hidden bg-white">
              <div
                className={cn(
                  "transition-all duration-300 ease-out flex flex-col flex-1 min-h-0",
                  isAIGenerating &&
                    "rounded-2xl ring-2 ring-blue-200/70 ring-offset-2 ring-offset-white bg-blue-50/25 mx-2 mt-1 mb-1 px-1 pt-1 pb-1 animate-ai-glow"
                )}
              >
              <div className={cn("border-b border-gray-200", isAIGenerating && "border-blue-100")}>
              <RecipientField
                toTags={toTags}
                ccTags={ccTags}
                bccTags={bccTags}
                onToTagsChange={(tags) => {
                  setToTags(tags);
                  if (activeTabId === 'main' && mainTab) {
                    setMainTab({ ...mainTab, toTags: tags });
                  } else if (activeTabId) {
                    setFollowUpTabs(tabs => 
                      tabs.map(tab => 
                        tab.id === activeTabId ? { ...tab, toTags: tags } : tab
                      )
                    );
                  }
                }}
                onCcTagsChange={(tags) => {
                  setCcTags(tags);
                  if (activeTabId === 'main' && mainTab) {
                    setMainTab({ ...mainTab, ccTags: tags });
                  } else if (activeTabId) {
                    setFollowUpTabs(tabs => 
                      tabs.map(tab => 
                        tab.id === activeTabId ? { ...tab, ccTags: tags } : tab
                      )
                    );
                  }
                }}
                onBccTagsChange={(tags) => {
                  setBccTags(tags);
                  if (activeTabId === 'main' && mainTab) {
                    setMainTab({ ...mainTab, bccTags: tags });
                  } else if (activeTabId) {
                    setFollowUpTabs(tabs => 
                      tabs.map(tab => 
                        tab.id === activeTabId ? { ...tab, bccTags: tags } : tab
                      )
                    );
                  }
                }}
                replyTo={replyTo}
              />

              <div className="relative px-4 py-1.5">
                {showGenerationSkeleton && (
                  <div
                    className="ai-skeleton-bar absolute left-4 top-1/2 -translate-y-1/2 h-3 w-[65%] max-w-[280px]"
                    aria-hidden
                  />
                )}
                <Input
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  onPaste={handleSubjectPaste}
                  readOnly={activeTabId !== null && activeTabId !== 'main'}
                  className={cn(
                    "border-0 shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none bg-transparent px-0 py-0 text-sm font-normal placeholder:text-gray-400 w-full",
                    activeTabId !== null && activeTabId !== 'main' && "cursor-default",
                    showGenerationSkeleton && "opacity-0 pointer-events-none"
                  )}
                  style={{ 
                    color: activeTabId !== null && activeTabId !== 'main' ? '#9CA3AF' : '#202124' 
                  }}
                />
              </div>
            </div>

              {showEditIndicator && (
                <div className="flex items-center gap-2 border-b border-blue-100/80 bg-blue-50/40 px-4 py-2">
                  <span
                    className="h-2 w-2 rounded-full bg-kenoo-yellow animate-pulse flex-shrink-0"
                    aria-hidden
                  />
                  <ShiningText text="Wallie is editing your draft..." className="text-xs" />
                </div>
              )}

              <div className={cn("relative flex-1 overflow-y-auto cursor-text bg-white px-2 min-h-0", isAIGenerating && "rounded-b-xl")}>
                {showGenerationSkeleton && (
                  <div
                    className="absolute inset-0 z-10 flex flex-col gap-3 justify-start pt-4 px-4 pb-4"
                    aria-hidden
                  >
                    <div className="ai-skeleton-bar h-3 w-full max-w-[95%]" />
                    <div className="ai-skeleton-bar h-3 w-[88%]" />
                    <div className="ai-skeleton-bar h-3 w-[92%]" />
                    <div className="ai-skeleton-bar h-3 w-[70%]" />
                    <div className="ai-skeleton-bar h-3 w-[85%]" />
                    <div className="ai-skeleton-bar h-3 w-[60%]" />
                  </div>
                )}
              <Editor
                content={content}
                onChange={handleContentChange}
                placeholder="Write your message..."
                ref={editorRef}
              />
            </div>
            </div>

            <AttachmentsList
              attachments={attachments}
              onAttachmentsChange={handleAttachmentsChange}
            />

            <EmailFooter
              onSend={handleSend}
              sending={sending}
              disabled={
                !toTags.length || 
                !subject || 
                !content.trim() || 
                !allTabsHaveContent()
              }
              editorRef={editorRef}
              onChange={handleContentChange}
              onAttachmentsChange={handleAttachmentsChange}
              attachments={attachments}
              onPitchChange={handlePitchChange}
              recipientEmails={toTags.map(tag => tag.email)}
              selectedCreators={selectedCreators}
              onSubjectChange={handleSubjectChange}
              subject={subject}
              onAIGeneratingChange={setIsAIGenerating}
              onAIGenerationComplete={handleAIGenerationComplete}
              isFollowUpTab={activeTabId != null && activeTabId !== 'main'}
              firstEmailContent={mainTab?.content ?? ''}
              isTalentOutreach={isTalentOutreach}
              outreachPersonId={personId ?? null}
              outreachRecipientFirstNameFallback={outreachFirstNameFallback}
            />
          </div>
          )}
        </div>
      </div>
    </div>
  );
}