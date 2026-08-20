"use client";

import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc-client";
import { ChevronRight, FileText, Lock, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HEALTH_DOCUMENT_CATEGORIES, type HealthDocumentCategory } from "@open-health/shared/constants";

const CATEGORY_COLORS: Record<HealthDocumentCategory, string> = {
  checkup: "bg-secondary text-primary",
  blood_donation: "bg-red-50 text-[#c94c4c] dark:bg-red-950/30",
  medical_visit: "bg-secondary text-primary",
  prescription: "bg-[#f8ead7] text-[#9a6625]",
  vaccination: "bg-[#f8ead7] text-[#9a6625]",
  lab_report: "bg-[#e8f1fb] text-[#3976b9]",
  other: "bg-muted text-muted-foreground",
};

function DocumentsContent() {
  const { t } = useTranslation(["documents", "common"]);
  const [filterCategory, setFilterCategory] = useState<HealthDocumentCategory | undefined>();

  const { data: documents, isLoading } = trpc.healthDocuments.list.useQuery({ category: filterCategory });

  return (
    <div className="mx-auto max-w-[820px] space-y-6 px-4 py-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-primary">Reports</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">{t("documents:title")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep lab reports and health documents private, organized, and easy to understand.
          </p>
        </div>
        <Link href="/hub/documents/new">
          <Button>
            <Plus className="h-4 w-4" />
            {t("documents:newDocument")}
          </Button>
        </Link>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={!filterCategory} onClick={() => setFilterCategory(undefined)}>
          {t("documents:allCategories")}
        </FilterChip>
        {HEALTH_DOCUMENT_CATEGORIES.map((cat) => (
          <FilterChip key={cat} active={filterCategory === cat} onClick={() => setFilterCategory(filterCategory === cat ? undefined : cat)}>
            {t(`documents:categories.${cat}`)}
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/hub/documents/${doc.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-[0_4px_18px_rgba(20,40,30,0.04)] transition-all duration-200 hover:border-primary/30 dark:bg-card"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <FileText className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-base font-semibold text-foreground">{doc.title}</span>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", CATEGORY_COLORS[doc.category as HealthDocumentCategory] ?? CATEGORY_COLORS.other)}>
                    {t(`documents:categories.${doc.category}`)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{doc.date}</span>
                  {doc.fileCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Paperclip className="h-4 w-4" />
                      {doc.fileCount}
                    </span>
                  )}
                  {doc.note && <span className="truncate">{doc.note}</span>}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-white p-8 text-center dark:bg-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <FileText className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-foreground">{t("documents:noDocuments")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t("documents:noDocumentsHint")}</p>
          <div className="mx-auto mt-5 flex max-w-sm items-start gap-3 rounded-2xl bg-secondary p-4 text-left">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
            <p className="text-sm leading-6 text-muted-foreground">Your reports are private. Upload only what you choose to save.</p>
          </div>
          <Link href="/hub/documents/new" className="mt-6 inline-flex">
            <Button>{t("documents:newDocument")}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "border border-border bg-white text-muted-foreground hover:bg-secondary hover:text-primary dark:bg-card",
      )}
    >
      {children}
    </button>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[820px] space-y-4 px-4 py-6">
          <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          <div className="h-12 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}
