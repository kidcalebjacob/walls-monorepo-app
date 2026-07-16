"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FiUpload } from "react-icons/fi";
import { FileText, Image as ImageIcon, FileSpreadsheet, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2, MoreVertical, X } from "lucide-react";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const fieldWrapperClass = "rounded-2xl bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 px-3 py-1";
const inputInnerClass = "border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full min-w-0 placeholder:text-neutral-400 h-8";

export interface DealDocumentItem {
  id?: string;
  file_name: string;
  file_url: string;
  mime_type: string;
  document_type: string;
  name?: string | null;
}

interface DocumentsProps {
  formData: { dealDocuments?: DealDocumentItem[]; _dealId?: string; dealId?: string; [key: string]: any };
  setFormData: (arg: any) => void;
}

const DOCUMENT_TYPES = [
  { value: "document", label: "Document" },
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "proposal", label: "Proposal" },
  { value: "brief", label: "Brief" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];

const isPdf = (mimeType: string, fileName: string) => {
  return mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
};

const isImage = (mimeType: string, fileName: string) => {
  return (
    mimeType.includes("image") ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
  );
};

const getFileIcon = (mimeType: string, fileName: string) => {
  if (isPdf(mimeType, fileName)) {
    return <FileText className="h-8 w-8 text-red-500" />;
  }
  if (isImage(mimeType, fileName)) {
    return <ImageIcon className="h-8 w-8 text-blue-500" />;
  }
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    fileName.endsWith(".xls") ||
    fileName.endsWith(".xlsx")
  ) {
    return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
  }
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    fileName.endsWith(".doc") ||
    fileName.endsWith(".docx")
  ) {
    return <FileText className="h-8 w-8 text-blue-600" />;
  }
  return <File className="h-8 w-8 text-gray-500" />;
};

export default function Documents({ formData, setFormData }: DocumentsProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState("");

  const documents = formData.dealDocuments || [];
  const dealId = formData._dealId || formData.dealId || null;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      if (!user) {
        wallsToast.error("Error", "You must be logged in to upload documents");
        return;
      }

      setFileError("");

      const supabase = getSupabaseClient();
      let currentDealId = dealId;

      // If we don't have a dealId (create flow), create a minimal deal first
      if (!currentDealId || currentDealId === "unnamed") {
        try {
          // Get deal stage ID if stage is set
          let dealStageId = null;
          if (formData.stage) {
            const { data: stage } = await supabase
              .from('deal_stages')
              .select('id')
              .eq('name', formData.stage)
              .single();
            dealStageId = stage?.id;
          }

          // Create minimal deal record
          const { data: newDeal, error: dealError } = await supabase
            .from('deals')
            .insert({
              deal_name: formData.dealName || 'New Deal',
              source: formData.leadSource || 'inbound-agency-email',
              deal_type: formData.pipeline || null,
              deal_stage_id: dealStageId,
              deal_owner: formData.dealOwner || user.id,
            })
            .select('id')
            .single();

          if (dealError || !newDeal) {
            throw dealError || new Error("Failed to create deal");
          }

          currentDealId = newDeal.id;
          
          // Update formData with the new dealId
          setFormData((prev: any) => ({
            ...prev,
            _dealId: currentDealId,
            dealId: currentDealId,
          }));

          // If company is set, create deal_companies relationship
          if (formData.company) {
            const { data: company } = await supabase
              .from('companies')
              .select('id')
              .eq('name', formData.company)
              .single();
            
            if (company?.id) {
              await supabase.from('deal_companies').insert({
                deal_id: currentDealId,
                company_id: company.id,
                role: 'client',
              });
            }
          }
        } catch (e) {
          console.error("Error creating deal:", e);
          wallsToast.error("Error", "Failed to create deal. Please try again.");
          return;
        }
      }

      const newDocuments: DealDocumentItem[] = [];

      for (const file of acceptedFiles) {
        try {
          setIsUploading(true);
          const uploadFormData = new FormData();
          uploadFormData.append("file", file);
          uploadFormData.append("dealId", currentDealId);

          // Upload to R2 storage
          const response = await fetch("/api/upload-contract/upload-deal-document", {
            method: "POST",
            body: uploadFormData,
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Upload failed");
          }

          const data = await response.json();
          
          // Immediately save to Supabase
          const { data: insertedDoc, error: insertError } = await supabase
            .from('deal_documents')
            .insert({
              deal_id: currentDealId,
              file_name: data.fileName,
              file_url: data.downloadUrl,
              mime_type: data.mimeType || file.type || "application/octet-stream",
              document_type: "document",
              uploaded_by: user.id,
              name: data.fileName, // Initially set name to file_name
            })
            .select('id, name')
            .single();

          if (insertError) {
            console.error("Error saving document to database:", insertError);
            // Still add to formData but show warning
            wallsToast.error("Uploaded but database save failed", "File uploaded to storage but failed to save to database. Please try again.");
          }

          newDocuments.push({
            id: insertedDoc?.id,
            file_name: data.fileName,
            file_url: data.downloadUrl,
            mime_type: data.mimeType || file.type || "application/octet-stream",
            document_type: "document",
            name: insertedDoc?.name || data.fileName,
          });
        } catch (e) {
          console.error(e);
          wallsToast.error("Upload failed", e instanceof Error ? e.message : "Failed to upload");
          break;
        }
      }

      if (newDocuments.length > 0) {
        setFormData((prev: any) => ({
          ...prev,
          dealDocuments: [...(prev.dealDocuments || []), ...newDocuments],
        }));
        wallsToast.success("Success", `${newDocuments.length} file(s) uploaded and saved`);
      }
      setIsUploading(false);
    },
    [dealId, setFormData, user, formData],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
    },
    maxSize: 20 * 1024 * 1024,
    disabled: isUploading,
  });

  const removeDocument = async (index: number) => {
    const document = documents[index];
    
    // If document has an ID, archive it in Supabase (set is_archived = true)
    if (document?.id && dealId && dealId !== "unnamed") {
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from('deal_documents')
          .update({ is_archived: true })
          .eq('id', document.id);

        if (error) {
          console.error("Error archiving document:", error);
          wallsToast.error("Error", "Failed to archive document");
          return;
        }
      } catch (e) {
        console.error("Error archiving document:", e);
        wallsToast.error("Error", "Failed to archive document");
        return;
      }
    }

    // Remove from formData
    setFormData((prev: any) => ({
      ...prev,
      dealDocuments: (prev.dealDocuments || []).filter((_: any, i: number) => i !== index),
    }));
    
    wallsToast.negative("Archived", "Document archived");
  };

  const updateDocumentType = async (index: number, newType: string) => {
    const document = documents[index];
    
    // Update in formData
    setFormData((prev: any) => {
      const updated = [...(prev.dealDocuments || [])];
      updated[index] = { ...updated[index], document_type: newType };
      return { ...prev, dealDocuments: updated };
    });

    // Update in Supabase if document has an ID
    if (document?.id && dealId && dealId !== "unnamed") {
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from('deal_documents')
          .update({ document_type: newType })
          .eq('id', document.id);

        if (error) {
          console.error("Error updating document type:", error);
          wallsToast.error("Error", "Failed to update document type");
          // Revert the change
          setFormData((prev: any) => {
            const reverted = [...(prev.dealDocuments || [])];
            reverted[index] = { ...reverted[index], document_type: document.document_type };
            return { ...prev, dealDocuments: reverted };
          });
        } else {
          wallsToast.success("Updated", "Document type changed");
        }
      } catch (e) {
        console.error("Error updating document type:", e);
        wallsToast.error("Error", "Failed to update document type");
      }
    }
  };

  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  const startRename = (index: number) => {
    const document = documents[index];
    setRenamingIndex(index);
    setRenameValue(document.name || document.file_name || "");
  };

  const cancelRename = () => {
    setRenamingIndex(null);
    setRenameValue("");
  };

  const saveRename = async (index: number) => {
    const document = documents[index];
    const newName = renameValue.trim() || document.file_name;

    // Update in formData
    setFormData((prev: any) => {
      const updated = [...(prev.dealDocuments || [])];
      updated[index] = { ...updated[index], name: newName };
      return { ...prev, dealDocuments: updated };
    });

    // Update in Supabase if document has an ID
    if (document?.id && dealId && dealId !== "unnamed") {
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from('deal_documents')
          .update({ name: newName })
          .eq('id', document.id);

        if (error) {
          console.error("Error renaming document:", error);
          wallsToast.error("Error", "Failed to rename document");
          // Revert the change
          setFormData((prev: any) => {
            const reverted = [...(prev.dealDocuments || [])];
            reverted[index] = { ...reverted[index], name: document.name };
            return { ...prev, dealDocuments: reverted };
          });
        } else {
          wallsToast.success("Renamed", "Document name updated");
        }
      } catch (e) {
        console.error("Error renaming document:", e);
        wallsToast.error("Error", "Failed to rename document");
      }
    }

    setRenamingIndex(null);
    setRenameValue("");
  };

  const openDocument = (url: string) => {
    if (url) window.open(url, "_blank");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-[30px] p-6">
        <div className="flex items-center mb-6">
          <h2 className="text-black font-black text-4xl">DOCUMENTS</h2>
          <div className="flex-1 border-t border-black h-px mx-4" />
        </div>

        <div className="space-y-6">
          <div
            {...getRootProps()}
            className={[
              "rounded-2xl p-8 text-center",
              "group cursor-pointer select-none",
              "bg-transparent border border-dashed border-neutral-300/80",
              "transition-all duration-200 ease-out",
              isUploading ? "opacity-75 cursor-not-allowed" : "",
              isDragActive
                ? "ring-2 ring-[var(--kenoo-sky)]/35 border-[var(--kenoo-sky)]/35 bg-white/55 shadow-[inset_0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-md"
                : "hover:bg-neutral-100/70 hover:backdrop-blur-md hover:border-neutral-300/70 hover:shadow-[inset_0_10px_24px_rgba(0,0,0,0.10)]",
            ].join(" ")}
            aria-disabled={isUploading}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-3">
              {isUploading ? (
                <Loader2 className="h-6 w-6 text-neutral-400 animate-spin" />
              ) : (
                <FiUpload className="h-6 w-6 text-neutral-400" />
              )}
              <p className="text-sm font-light text-neutral-400 tracking-wide">
                {isUploading ? "Uploading..." : "Drag files here or click to upload"}
              </p>
              <p className="text-xs font-light text-neutral-400">Max 20MB per file</p>
            </div>
          </div>

          {fileError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{fileError}</p>
            </div>
          )}

          {documents.length > 0 && (
            <div className="rounded-[20px] border border-neutral-200 overflow-hidden bg-white/80">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-100/80">
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Preview</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Document Type</th>
                    <th className="w-10 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, index) => (
                    <tr
                      key={doc.id || index}
                      className={cn(
                        "group border-b border-neutral-100 last:border-0",
                        "hover:bg-neutral-50/80"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* PDF Preview */}
                          {isPdf(doc.mime_type, doc.file_name) ? (
                            <div className="w-16 h-20 bg-neutral-100 rounded-lg overflow-hidden relative flex-shrink-0 cursor-pointer"
                              onClick={() => openDocument(doc.file_url)}
                            >
                              <iframe
                                src={`${doc.file_url}#view=FitH`}
                                title={doc.file_name}
                                className="w-full h-full pointer-events-none border-0"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
                            </div>
                          ) : isImage(doc.mime_type, doc.file_name) ? (
                            <div className="w-16 h-16 bg-neutral-100 rounded-lg overflow-hidden relative flex-shrink-0 cursor-pointer"
                              onClick={() => openDocument(doc.file_url)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={doc.file_url}
                                alt={doc.file_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const fallback = target.parentElement?.querySelector(".image-fallback");
                                  if (fallback) (fallback as HTMLElement).style.display = "flex";
                                }}
                              />
                              <div
                                className="image-fallback absolute inset-0 hidden items-center justify-center bg-neutral-100"
                                style={{ display: "none" }}
                              >
                                <ImageIcon className="h-6 w-6 text-neutral-400" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                              {getFileIcon(doc.mime_type, doc.file_name)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {renamingIndex === index ? (
                          <div className="flex items-center gap-2">
                            <div className={cn(fieldWrapperClass, "flex-1 max-w-[300px]")}>
                              <BorderlessInput
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    saveRename(index);
                                  } else if (e.key === "Escape") {
                                    cancelRename();
                                  }
                                }}
                                className={inputInnerClass}
                                autoFocus
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => saveRename(index)}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                              onClick={cancelRename}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openDocument(doc.file_url)}
                            className="text-left hover:text-blue-600 transition-colors"
                          >
                            <span className="font-normal text-foreground">{doc.name || doc.file_name}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className={cn(fieldWrapperClass, "max-w-[200px]")}>
                          <Select
                            value={doc.document_type || "document"}
                            onValueChange={(value) => updateDocumentType(index, value)}
                          >
                            <SelectTrigger className="h-8 border-0 bg-transparent shadow-none hover:bg-transparent px-0 py-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DOCUMENT_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-neutral-200"
                              aria-label="Open menu"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[140px]">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => openDocument(doc.file_url)}
                            >
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => startRename(index)}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                              onClick={() => removeDocument(index)}
                            >
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
