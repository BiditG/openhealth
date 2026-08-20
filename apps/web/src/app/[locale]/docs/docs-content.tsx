"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { SiteNav } from "@/components/layout/site-nav";
import { useLocalePath } from "@/hooks/use-locale-path";

function Step({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-6 border-b border-black/[0.06] dark:border-white/[0.06] grid grid-cols-1 md:grid-cols-[50px_180px_1fr] gap-2 md:gap-8 items-baseline">
      <span className="text-xs font-mono text-neutral-300 dark:text-neutral-700">{num}</span>
      <h3 className="text-black dark:text-white font-light text-sm">{title}</h3>
      <p className="text-neutral-500 font-light text-sm leading-relaxed">
        {children}
      </p>
    </div>
  );
}

export function DocsContent() {
  const { t } = useTranslation("docs");
  const lp = useLocalePath();

  return (
    <div className="bg-white dark:bg-black text-black dark:text-white min-h-screen selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      <SiteNav />

      <main className="max-w-4xl mx-auto px-6 pt-28 pb-16 md:pt-32 md:pb-24">
        <p className="text-[10px] tracking-[0.4em] text-neutral-400 dark:text-neutral-600 uppercase mb-4">
          Documentation
        </p>
        <h1 className="text-4xl md:text-5xl font-extralight mb-8">{t("title")}</h1>
        <p className="text-neutral-500 font-light mb-20 max-w-xl text-sm leading-relaxed">
          {t("intro")}
        </p>

        {/* Quick Start */}
        <section className="mb-20">
          <h2 className="text-xl font-light mb-6">{t("quickStart.title")}</h2>
          <div className="border-l border-black/[0.06] dark:border-white/[0.06] pl-6 space-y-6">
            <div>
              <h3 className="text-sm font-light text-black dark:text-white mb-2">
                {t("quickStart.step1Title")}
              </h3>
              <p className="text-neutral-500 font-light text-sm leading-relaxed">
                {t("quickStart.step1Desc", { interpolation: { skipOnVariables: true } })
                  .replace(/<\/?site>/g, "")
                  .split("openhealth.blog")
                  .map((part, i, arr) =>
                    i < arr.length - 1 ? (
                      <span key={i}>
                        {part}
                        <span className="text-black dark:text-white">openhealth.blog</span>
                      </span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-light text-black dark:text-white mb-2">
                {t("quickStart.step2Title")}
              </h3>
              <p className="text-neutral-500 font-light text-sm leading-relaxed">
                {t("quickStart.step2Desc")}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-light text-black dark:text-white mb-2">
                {t("quickStart.step3Title")}
              </h3>
              <p className="text-neutral-500 font-light text-sm leading-relaxed">
                {(() => {
                  const raw = t("quickStart.step3Desc", { interpolation: { skipOnVariables: true } })
                    .replace(/<\/?highlight>/g, "")
                    .replace(/<\/?link>/g, "");
                  const settingsLabel = "Settings → Notifications";
                  const linkLabel = "Enable Notifications";
                  const parts = raw.split(settingsLabel);
                  if (parts.length === 1) return raw;
                  const beforeHighlight = parts[0];
                  const afterHighlight = parts.slice(1).join(settingsLabel);
                  return (
                    <>
                      {beforeHighlight}
                      <span className="text-black dark:text-white">{settingsLabel}</span>
                      {afterHighlight.includes(linkLabel) ? (
                        <>
                          {afterHighlight.split(linkLabel)[0]}
                          <a href="#notifications" className="text-green-600 dark:text-green-400 underline underline-offset-2 ml-1">
                            {t("notifications.title")}
                          </a>
                          {afterHighlight.split(linkLabel).slice(1).join(linkLabel)}
                        </>
                      ) : (
                        afterHighlight
                      )}
                    </>
                  );
                })()}
              </p>
            </div>
          </div>
        </section>

        {/* What is PWA */}
        <section className="mb-20">
          <h2 className="text-xl font-light mb-6">{t("whatIsPwa.title")}</h2>
          <div className="border-l border-black/[0.06] dark:border-white/[0.06] pl-6">
            <p className="text-neutral-500 font-light leading-loose text-sm">
              {t("whatIsPwa.desc")}
            </p>
          </div>
        </section>

        {/* iOS */}
        <section className="mb-20">
          <h2 className="text-xs tracking-[0.3em] text-neutral-500 uppercase mb-10 font-mono">
            iOS / iPadOS
          </h2>
          <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
            <Step num="01" title={t("ios.step01")}>{t("ios.step01Desc")}</Step>
            <Step num="02" title={t("ios.step02")}>{t("ios.step02Desc")}</Step>
            <Step num="03" title={t("ios.step03")}>{t("ios.step03Desc")}</Step>
            <Step num="04" title={t("ios.step04")}>{t("ios.step04Desc")}</Step>
            <Step num="05" title={t("ios.step05")}>{t("ios.step05Desc")}</Step>
          </div>
        </section>

        {/* Android */}
        <section className="mb-20">
          <h2 className="text-xs tracking-[0.3em] text-neutral-500 uppercase mb-10 font-mono">
            Android
          </h2>
          <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
            <Step num="01" title={t("android.step01")}>{t("android.step01Desc")}</Step>
            <Step num="02" title={t("android.step02")}>{t("android.step02Desc")}</Step>
            <Step num="03" title={t("android.step03")}>{t("android.step03Desc")}</Step>
            <Step num="04" title={t("android.step04")}>{t("android.step04Desc")}</Step>
            <Step num="05" title={t("android.step05")}>{t("android.step05Desc")}</Step>
          </div>
        </section>

        {/* Desktop */}
        <section className="mb-20">
          <h2 className="text-xs tracking-[0.3em] text-neutral-500 uppercase mb-10 font-mono">
            Desktop / Chrome
          </h2>
          <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
            <Step num="01" title={t("desktop.step01")}>{t("desktop.step01Desc")}</Step>
            <Step num="02" title={t("desktop.step02")}>{t("desktop.step02Desc")}</Step>
            <Step num="03" title={t("desktop.step03")}>{t("desktop.step03Desc")}</Step>
          </div>
        </section>

        {/* Notifications */}
        <section id="notifications" className="mb-20">
          <h2 className="text-xl font-light mb-6">{t("notifications.title")}</h2>
          <p className="text-neutral-500 font-light text-sm leading-relaxed mb-10">
            {t("notifications.desc")}
          </p>

          <div className="space-y-10">
            {/* iOS notification */}
            <div>
              <h3 className="text-xs tracking-[0.3em] text-neutral-500 uppercase mb-6 font-mono">
                iOS / iPadOS
              </h3>
              <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
                <Step num="01" title={t("notifications.iosStep01")}>{t("notifications.iosStep01Desc")}</Step>
                <Step num="02" title={t("notifications.iosStep02")}>{t("notifications.iosStep02Desc")}</Step>
                <Step num="03" title={t("notifications.iosStep03")}>{t("notifications.iosStep03Desc")}</Step>
                <Step num="04" title={t("notifications.iosStep04")}>{t("notifications.iosStep04Desc")}</Step>
              </div>
            </div>

            {/* Android notification */}
            <div>
              <h3 className="text-xs tracking-[0.3em] text-neutral-500 uppercase mb-6 font-mono">
                Android
              </h3>
              <div className="border-l border-black/[0.06] dark:border-white/[0.06] pl-6">
                <p className="text-neutral-500 font-light text-sm leading-relaxed">
                  {t("notifications.androidDesc")}
                </p>
              </div>
            </div>

            {/* Desktop notification */}
            <div>
              <h3 className="text-xs tracking-[0.3em] text-neutral-500 uppercase mb-6 font-mono">
                Desktop / Chrome
              </h3>
              <div className="border-l border-black/[0.06] dark:border-white/[0.06] pl-6">
                <p className="text-neutral-500 font-light text-sm leading-relaxed">
                  {t("notifications.desktopDesc")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-20">
          <h2 className="text-xl font-light mb-10">{t("faq.title")}</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-light mb-2">{t("faq.q1")}</h3>
              <p className="text-neutral-500 dark:text-neutral-600 font-light text-sm leading-relaxed">
                {t("faq.a1")}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-light mb-2">{t("faq.q2")}</h3>
              <p className="text-neutral-500 dark:text-neutral-600 font-light text-sm leading-relaxed">
                {t("faq.a2")}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-light mb-2">{t("faq.q3")}</h3>
              <p className="text-neutral-500 dark:text-neutral-600 font-light text-sm leading-relaxed">
                {(() => {
                  const raw = t("faq.a3", { interpolation: { skipOnVariables: true } }).replace(/<\/?link>/g, "");
                  const linkLabel = "Enable Notifications";
                  const parts = raw.split(linkLabel);
                  if (parts.length <= 1) return raw;
                  return (
                    <>
                      {parts[0]}
                      <a href="#notifications" className="text-green-600 dark:text-green-400 underline underline-offset-2">
                        {t("notifications.title")}
                      </a>
                      {parts.slice(1).join(linkLabel)}
                    </>
                  );
                })()}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-light mb-2">{t("faq.q4")}</h3>
              <p className="text-neutral-500 dark:text-neutral-600 font-light text-sm leading-relaxed">
                {t("faq.a4")}
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-black/[0.06] dark:border-white/[0.06] pt-8">
          <Link
            href={lp("/")}
            className="text-xs text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white transition-colors duration-300 tracking-wider"
          >
            {t("backToHome")}
          </Link>
        </div>
      </main>
    </div>
  );
}
