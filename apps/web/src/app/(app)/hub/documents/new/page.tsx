"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc-client";
import {
  ArrowLeft,
  Upload,
  X,
  FileText,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HEALTH_DOCUMENT_CATEGORIES } from "@open-health/shared/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface UploadedFile {
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  preview?: string; // local object URL for preview
}

export default function NewDocumentPage() {
  const { t } = useTranslation(["documents", "common"]);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [category, setCategory] = useState<(typeof HEALTH_DOCUMENT_CATEGORIES)[number]>("checkup");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();
  const createMutation = trpc.healthDocuments.create.useMutation();

  const handleFileUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setUploading(true);

      try {
        const newFiles: UploadedFile[] = [];

        for (const file of Array.from(fileList)) {
          if (file.size > 10 * 1024 * 1024) {
            toast.error(`${file.name} exceeds 10MB limit`);
            continue;
          }

          const formData = new FormData();
          formData.append("file", file);
          formData.append("folder", "documents");

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            toast.error(err.error || "Upload failed");
            continue;
          }

          const data = await res.json();
          const preview = file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined;

          newFiles.push({ ...data, preview });
        }

        setFiles((prev) => [...prev, ...newFiles]);
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload],
  );

  const handleSubmit = () => {
    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        date,
        category,
        note: note.trim() || undefined,
        files: files.map((f, i) => ({
          fileUrl: f.fileUrl,
          fileKey: f.fileKey,
          fileName: f.fileName,
          fileType: f.fileType,
          fileSize: f.fileSize,
          order: i,
        })),
      });

      await utils.healthDocuments.invalidate();
      router.push(`/hub/documents/${result.id}`);
    });
  };

  return (
    <div className="mx-auto max-w-[640px] space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/hub/documents"
          className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-secondary"
          aria-label="Back to reports"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-sm font-semibold text-primary">Private report</p>
          <h1 className="text-3xl font-semibold text-foreground">{t("documents:newDocument")}</h1>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            {t("documents:documentTitle")}
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("documents:documentTitlePlaceholder")}
          />
        </div>

        {/* Date */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            {t("documents:documentDate")}
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            {t("documents:category")}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof HEALTH_DOCUMENT_CATEGORIES)[number])}
            className="flex min-h-12 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-card"
          >
            {HEALTH_DOCUMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`documents:categories.${cat}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            {t("documents:note")}
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("documents:notePlaceholder")}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            {t("documents:attachments")}
          </label>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() =>
              document.getElementById("file-input")?.click()
            }
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-background px-6 py-10 text-center transition-colors",
              "border-border hover:border-primary/40 hover:bg-secondary/40",
              uploading && "pointer-events-none opacity-50",
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">
                  {t("documents:uploading")}
                </span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {t("documents:dragOrClick")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("documents:maxFileSize")}
                </span>
              </>
            )}
          </div>
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          {/* File Previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {files.map((f, i) => (
                <div
                  key={f.fileKey}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-background"
                >
                  {f.preview ? (
                    <img
                      src={f.preview}
                      alt={f.fileName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-background">
                      <FileText className="h-6 w-6 text-primary" />
                      <span className="max-w-[80%] truncate px-1 text-[10px] text-muted-foreground">
                        {f.fileName}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!title.trim() || isPending}
        className="w-full"
      >
        {isPending ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        ) : (
          t("documents:save")
        )}
      </Button>
    </div>
  );
}
