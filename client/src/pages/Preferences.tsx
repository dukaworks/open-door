/*
 * Preferences.tsx — 用户偏好设置页面
 * 语言、主题等用户偏好设置
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Save,
  Palette,
  Globe,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { userApi, UserPreferences } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";

interface PreferencesProps {
  embedded?: boolean;
}

export default function Preferences({ embedded = false }: PreferencesProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [language, setLanguage] = useState("zh-CN");
  const [themeOption, setThemeOption] = useState<"light" | "dark" | "system">(
    "light"
  );

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await userApi.getPreferences();
      setLanguage(data.language);
      setThemeOption(data.theme as "light" | "dark" | "system");
      // 设置 i18n 语言
      i18n.changeLanguage(data.language);
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await userApi.updatePreferences({ language, theme: themeOption });
      // 应用主题
      setTheme(themeOption);
      // 应用语言
      i18n.changeLanguage(language);
      toast.success(t("success"));
    } catch (error) {
      toast.error(t("error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "min-h-screen bg-background"}>
      {/* Header - hide when embedded */}
      {!embedded && (
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Link to="/studio">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={16} />
                {t("backToStudio")}
              </button>
            </Link>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "var(--primary)" }}
              >
                <Palette size={14} className="text-white" />
              </div>
              <span className="font-semibold text-foreground">
                {t("preferences")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {t("save")}
            </Button>
          </div>
        </header>
      )}

      <div
        className={
          embedded ? "p-4 space-y-4" : "max-w-2xl mx-auto px-6 py-8 space-y-6"
        }
      >
        {/* 主题设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon size={18} />
              {t("theme")}
            </CardTitle>
            <CardDescription>{t("themeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setThemeOption("light")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  themeOption === "light"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-border hover:border-gray-300"
                }`}
              >
                <Sun size={24} className="text-yellow-500" />
                <span className="text-sm font-medium">{t("themeLight")}</span>
              </button>

              <button
                onClick={() => setThemeOption("dark")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  themeOption === "dark"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-border hover:border-gray-300"
                }`}
              >
                <Moon size={24} className="text-indigo-500" />
                <span className="text-sm font-medium">{t("themeDark")}</span>
              </button>

              <button
                onClick={() => setThemeOption("system")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  themeOption === "system"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-border hover:border-gray-300"
                }`}
              >
                <Monitor size={24} className="text-gray-500" />
                <span className="text-sm font-medium">{t("themeSystem")}</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 语言设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={18} />
              {t("language")}
            </CardTitle>
            <CardDescription>{t("languageDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button
                onClick={() => setLanguage("zh-CN")}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  language === "zh-CN"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-border hover:border-gray-300"
                }`}
              >
                <span className="text-lg">🇨🇳</span>
                <span className="font-medium">{t("simplifiedChinese")}</span>
              </button>

              <button
                onClick={() => setLanguage("en-US")}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  language === "en-US"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-border hover:border-gray-300"
                }`}
              >
                <span className="text-lg">🇺🇸</span>
                <span className="font-medium">{t("english")}</span>
              </button>

              <button
                onClick={() => setLanguage("zh-TW")}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  language === "zh-TW"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-border hover:border-gray-300"
                }`}
              >
                <span className="text-lg">🇭🇰</span>
                <span className="font-medium">{t("traditionalChinese")}</span>
              </button>

              <button
                onClick={() => setLanguage("ja")}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  language === "ja"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-border hover:border-gray-300"
                }`}
              >
                <span className="text-lg">🇯🇵</span>
                <span className="font-medium">{t("japanese")}</span>
              </button>

              <button
                onClick={() => setLanguage("ko")}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  language === "ko"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-border hover:border-gray-300"
                }`}
              >
                <span className="text-lg">🇰🇷</span>
                <span className="font-medium">{t("korean")}</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
