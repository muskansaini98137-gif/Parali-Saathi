import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage === "hi" ? "hi" : "en";

  return (
    <label className="language-switcher">
      <span className="language-label">{t("common.language")}</span>
      <select
        value={language}
        aria-label={t("navigation.languageSelector")}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
      >
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
      </select>
    </label>
  );
}