"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { Button } from "@/components/ui/button";
import { Signature as SignatureIcon } from "lucide-react";
import { EditorRef } from "../editor";
import { useAuth } from "@/app/auth/AuthContext";
import { useState } from "react";
import { getSupabaseClient } from "@/app/auth/supabaseClient";

interface SignatureToolProps {
  editorRef: React.RefObject<EditorRef | null>;
}

// Helper function to escape HTML special characters
const escapeHtml = (text: string | null): string => {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

// Function to generate signature HTML (matching TemplateReplacer logic)
const generateSignatureHtml = (
  user: { first_name: string | null; last_name: string | null; email: string | null; phone_number: string | null } | null,
  team: { title: string | null; phone_extension: string | null } | null
): string => {
  const signatureParts: string[] = [];
  
  // Name (first_name + last_name)
  const firstName = user?.first_name || '';
  const lastName = user?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  if (fullName) {
    signatureParts.push(`<div><strong>${escapeHtml(fullName)}</strong></div>`);
  }
  
  // Title from team
  const title = team?.title || '';
  if (title) {
    signatureParts.push(`<div>${escapeHtml(title)}</div>`);
  }
  
  // Company name (single line break before it)
  signatureParts.push('<div><br><strong>WALLS Entertainment</strong></div>');
  
  // Website
  signatureParts.push('<div><a target="_blank" rel="noopener noreferrer" href="http://www.wallsentertainment.com" style="color: rgb(37, 99, 235); text-decoration: underline;">www.wallsentertainment.com</a></div>');
  
  // Phone with extension
  // Use company base number "323.300.2283" and append extension if available
  const phoneExtension = team?.phone_extension || '';
  let phoneDisplay = '323.300.2283';
  if (phoneExtension) {
    phoneDisplay += ` ext. ${phoneExtension}`;
  }
  
  signatureParts.push(`<div>C // ${escapeHtml(phoneDisplay)}</div>`);
  
  // Email
  const email = user?.email || '';
  if (email) {
    signatureParts.push(`<div>E // <a target="_blank" rel="noopener noreferrer" href="mailto:${escapeHtml(email)}" style="color: rgb(37, 99, 235); text-decoration: underline;">${escapeHtml(email)}</a></div>`);
  }
  
  // Combine signature parts
  return signatureParts.join('');
};

export function SignatureTool({ editorRef }: SignatureToolProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const insertSignature = async () => {
    const editor = editorRef.current?.getEditor();
    if (!editor) return;

    if (!user?.email) {
      wallsToast.error("Error", "Please log in to insert signature");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();
      
      // Get user ID from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, phone_number')
        .eq('email', user.email)
        .single();

      if (userError || !userData) {
        console.error("Error fetching user data:", userError);
        wallsToast.error("Error", "Failed to fetch user data");
        setIsLoading(false);
        return;
      }

      // Fetch team data
      const { data: teamData, error: teamError } = await supabase
        .from('team')
        .select('title, phone_extension')
        .eq('user_id', userData.id)
        .maybeSingle();

      // Team data is optional, so we continue even if not found
      const team = teamError ? null : teamData;

      // Generate signature HTML
      const signatureHtml = generateSignatureHtml(userData, team);

      // Move cursor to end of document
      editor.commands.setTextSelection(editor.state.doc.content.size);

      // Add two newlines before signature if content exists
      if (editor.state.doc.textContent) {
        editor.commands.enter();
        editor.commands.enter();
      }

      // Insert signature HTML
      editor
        .chain()
        .focus()
        .insertContent(signatureHtml)
        .run();
    } catch (error) {
      console.error("Error inserting signature:", error);
      wallsToast.error("Error", "Failed to insert signature");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
      onClick={insertSignature}
      disabled={isLoading}
      title="Insert signature"
    >
      <div className="relative">
        <div className="relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95">
          <SignatureIcon className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
        </div>
      </div>
    </Button>
  );
} 