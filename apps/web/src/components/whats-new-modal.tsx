"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getLatestVersion,
  getUnseenEntries,
  type ChangelogEntry,
} from "@open-health/shared/changelog";

const STORAGE_KEY = "oh-changelog-last-seen";

export function WhatsNewModal() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    const unseen = getUnseenEntries(lastSeen);
    if (unseen.length > 0) {
      setEntries(unseen);
      setOpen(true);
    }
  }, []);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, getLatestVersion());
    setOpen(false);
  }

  const lang = "en";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          {t("whatsNew.title")}
        </DialogTitle>
      </DialogHeader>

      <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.version}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                v{entry.version}
              </span>
              <span className="text-xs text-muted-foreground">
                {entry.date}
              </span>
            </div>
            <h3 className="mb-1.5 text-sm font-semibold">
              {entry.title[lang]}
            </h3>
            <ul className="space-y-1.5">
              {entry.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0">{item.emoji}</span>
                  <span className="text-muted-foreground">
                    {item.text[lang]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button
        onClick={handleClose}
        className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t("whatsNew.gotIt")}
      </button>
    </Dialog>
  );
}
