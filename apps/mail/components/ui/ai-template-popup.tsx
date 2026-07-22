"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { wallsToast } from "@/components/ui/walls-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  templateType: string;
  lastModified: string;
}

interface AITemplatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: EmailTemplate) => void;
}

export function AITemplatePopup({ isOpen, onClose, onSelectTemplate }: AITemplatePopupProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: templatesData, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_owner', user?.id || '');
      
      if (error) throw error;

      const templates = (templatesData || []).map((item: any) => ({
        id: item.id,
        name: item.name || '',
        subject: item.subject || '',
        templateType: item.template_type || 'uncategorized',
        lastModified: item.last_modified || item.updated_at || new Date().toISOString(),
      }));

      setTemplates(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      wallsToast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] z-[110]">
        <DialogHeader>
          <DialogTitle>Select Email Template</DialogTitle>
          <DialogDescription>
            Choose a template to use for your email. The template will be personalized with the recipient's information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No templates found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => onSelectTemplate(template)}
                  >
                    <div className="space-y-1">
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">{template.subject}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(template.lastModified).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
