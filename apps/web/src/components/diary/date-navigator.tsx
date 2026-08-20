"use client";

import { useRef, type ChangeEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, isToday, parseISO, subDays } from "date-fns";
import { enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface DateNavigatorProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

export function DateNavigator({ date, onDateChange }: DateNavigatorProps) {
  const { t } = useTranslation("common");
  const inputRef = useRef<HTMLInputElement>(null);

  const label = isToday(date) ? t("time.today") : format(date, "MMM d, EEEE", { locale: enUS });
  const today = isToday(date);

  const handleDateLabelClick = () => {
    if (inputRef.current?.showPicker) inputRef.current.showPicker();
    else inputRef.current?.click();
  };

  const handleNativeDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) onDateChange(parseISO(e.target.value));
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-card">
      <button
        onClick={() => onDateChange(subDays(date, 1))}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
      </button>

      <div className="relative flex flex-1 flex-col items-center">
        <button
          onClick={handleDateLabelClick}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <CalendarDays className="h-4 w-4 text-primary" strokeWidth={1.8} />
          {label}
        </button>
        <input
          ref={inputRef}
          type="date"
          value={format(date, "yyyy-MM-dd")}
          onChange={handleNativeDateChange}
          className="pointer-events-none absolute inset-0 opacity-0"
          tabIndex={-1}
        />
        {!today && (
          <button onClick={() => onDateChange(new Date())} className="text-xs font-semibold text-primary">
            {t("time.backToToday")}
          </button>
        )}
      </div>

      <button
        onClick={() => onDateChange(addDays(date, 1))}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
      </button>
    </div>
  );
}
