type PageLoaderProps = {
  label?: string;
  variant?: "app" | "marketing";
};

export function PageLoader({ label = "Loading", variant = "app" }: PageLoaderProps) {
  const isMarketing = variant === "marketing";

  return (
    <div className={isMarketing ? "min-h-[70vh] bg-background px-4 py-10" : "px-4 py-6 sm:px-6 lg:py-10"}>
      <div className={isMarketing ? "mx-auto max-w-[1080px]" : "mx-auto max-w-[1080px] space-y-6"}>
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-primary" />
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_24px_rgba(20,50,40,0.04)] dark:bg-card">
            <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
            <div className="mt-5 h-12 w-48 animate-pulse rounded-xl bg-muted" />
            <div className="mt-5 h-2 w-full animate-pulse rounded-full bg-muted" />
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-3xl border border-border bg-white p-5 dark:bg-card">
                <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
                <div className="mt-5 h-12 animate-pulse rounded-xl bg-muted" />
                <div className="mt-3 h-12 animate-pulse rounded-xl bg-muted" />
                <div className="mt-3 h-12 animate-pulse rounded-xl bg-muted" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl border border-border bg-white dark:bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
