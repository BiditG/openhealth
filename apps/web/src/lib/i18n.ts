import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultNS, fallbackLng, resources, supportedLngs } from "@open-health/shared/i18n";

i18n
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng,
    defaultNS,
    lng: fallbackLng,
    supportedLngs: [...supportedLngs],
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
