import { useEffect, useState } from "react";

import { I18nProvider, type Language } from "./i18n";
import MedicineDashboard from "./pages/MedicineDashboard";

export type ThemeMode = "light" | "dark";

function readStoredLanguage(): Language {
  return window.localStorage.getItem("medshelf-language") === "zh" ? "zh" : "en";
}

function readStoredTheme(): ThemeMode {
  return window.localStorage.getItem("medshelf-theme") === "dark"
    ? "dark"
    : "light";
}

function App() {
  const [language, setLanguage] = useState<Language>(readStoredLanguage);
  const [themeMode, setThemeMode] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("medshelf-language", language);
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("medshelf-theme", themeMode);
  }, [themeMode]);

  return (
    <I18nProvider language={language}>
      <MedicineDashboard
        language={language}
        themeMode={themeMode}
        onLanguageChange={setLanguage}
        onThemeModeChange={setThemeMode}
      />
    </I18nProvider>
  );
}

export default App;
