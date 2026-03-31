/*
 * Home.tsx — 芝麻开门 产品首页
 * Design: AI Product inspired — purple/blue gradient, Hollywood cinematic feel
 */

import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { ParticleNetwork } from "@/components/ParticleNetwork";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Globe,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import {
  Zap,
  ArrowRight,
  Sparkles,
  Image,
  Volume2,
  Video,
  Scissors,
  Brain,
  CheckCircle2,
  Film,
  Settings,
  ScanSearch,
  Layers,
  User,
  Wand2,
  Download,
  MessageSquare,
} from "lucide-react";

// Features 数据在组件内动态生成

const WORKFLOW_STEPS = [
  {
    step: "01",
    label: "输入创意",
    desc: "一句话描述你的想法，或上传参考视频让 AI 分析风格",
    icon: Wand2,
  },
  {
    step: "02",
    label: "AI 策划",
    desc: "AI 自动生成完整分镜脚本，你可以审核和调整每个细节",
    icon: MessageSquare,
  },
  {
    step: "03",
    label: "一键生成",
    desc: "并行生成首帧图像、配音、视频，自动拼接成片",
    icon: Video,
  },
  {
    step: "04",
    label: "下载成片",
    desc: "获取 MP4 视频 + 剪映草稿，精细调整后导出",
    icon: Download,
  },
];

export default function Home() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, authEnabled } = useAuth();
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();

  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node))
        setLangOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node))
        setThemeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const languages = [
    { code: "zh-CN", name: "简体中文", key: "simplifiedChinese" },
    { code: "en-US", name: "English", key: "english" },
    { code: "zh-TW", name: "繁体中文", key: "traditionalChinese" },
    { code: "ja", name: "日本語", key: "japanese" },
    { code: "ko", name: "한국어", key: "korean" },
  ];

  const themes = [
    { value: "light", icon: Sun, key: "themeLight" },
    { value: "dark", icon: Moon, key: "themeDark" },
    { value: "system", icon: Monitor, key: "themeSystem" },
  ];
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    // Hero 动画延迟触发
    setTimeout(() => setHeroVisible(true), 100);
  }, []);

  // 已登录用户访问主页时，自动跳转到工作台
  useEffect(() => {
    if (isAuthenticated && authEnabled) {
      setLocation("/studio");
    }
  }, [isAuthenticated, authEnabled, setLocation]);

  // 如果已登录且启用了认证，显示空白（等待跳转）
  if (isAuthenticated && authEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // 动态生成 Features 数据
  const features = [
    { icon: Brain, title: t("feature1Title"), desc: t("feature1Desc") },
    { icon: ScanSearch, title: t("feature2Title"), desc: t("feature2Desc") },
    { icon: User, title: t("feature3Title"), desc: t("feature3Desc") },
    { icon: Layers, title: t("feature4Title"), desc: t("feature4Desc") },
    { icon: Volume2, title: t("feature5Title"), desc: t("feature5Desc") },
    { icon: Scissors, title: t("feature6Title"), desc: t("feature6Desc") },
    { icon: Image, title: t("feature7Title"), desc: t("feature7Desc") },
    { icon: Sparkles, title: t("feature8Title"), desc: t("feature8Desc") },
  ];

  // 动态生成 Workflow Steps 数据
  const workflowSteps = [
    { step: "01", label: t("step1Label"), desc: t("step1Desc"), icon: Wand2 },
    {
      step: "02",
      label: t("step2Label"),
      desc: t("step2Desc"),
      icon: MessageSquare,
    },
    { step: "03", label: t("step3Label"), desc: t("step3Desc"), icon: Video },
    {
      step: "04",
      label: t("step4Label"),
      desc: t("step4Desc"),
      icon: Download,
    },
  ];

  // 动态生成对比表数据
  const vsTable = [
    {
      dim: t("compareRow1Dim"),
      libtv: t("libtv1"),
      huobao: t("huobao1"),
      ours: t("compareRow1"),
    },
    {
      dim: t("compareRow2Dim"),
      libtv: t("libtv2"),
      huobao: t("huobao2"),
      ours: t("compareRow2"),
    },
    {
      dim: t("compareRow3Dim"),
      libtv: t("libtv3"),
      huobao: t("huobao3"),
      ours: t("compareRow3"),
    },
    {
      dim: t("compareRow4Dim"),
      libtv: t("libtv4"),
      huobao: t("huobao4"),
      ours: t("compareRow4"),
    },
    {
      dim: t("compareRow5Dim"),
      libtv: t("libtv5"),
      huobao: t("huobao5"),
      ours: t("compareRow5"),
    },
    {
      dim: t("compareRow6Dim"),
      libtv: t("libtv6"),
      huobao: t("huobao6"),
      ours: t("compareRow6"),
    },
    {
      dim: t("compareRow7Dim"),
      libtv: t("libtv7"),
      huobao: t("huobao7"),
      ours: t("compareRow7"),
    },
    {
      dim: t("compareRow8Dim"),
      libtv: t("libtv8"),
      huobao: t("huobao8"),
      ours: t("compareRow8"),
    },
  ];

  // 处理需要认证的操作
  const handleProtectedAction = (target: string) => {
    if (authEnabled && !isAuthenticated) {
      setLocation("/login");
    } else {
      setLocation(target);
    }
  };

  // 是否显示用户菜单（登录后）
  const showUserMenu = authEnabled && isAuthenticated;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img src="/images/logo.png" alt="Logo" className="w-8 h-8" />
            <span className="text-lg font-bold bg-gradient-to-r from-[oklch(0.55_0.22_270)] to-[oklch(0.60_0.20_190)] bg-clip-text text-transparent">
              芝麻开门
              <span className="text-xs text-muted-foreground/80 ml-2">
                Open-Door
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            {/* 语言选择器 */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                title={t("language")}
              >
                <Globe size={18} />
              </button>
              {langOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 py-1 w-36 rounded-xl bg-card border border-border/50 shadow-lg z-50">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        setLangOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-secondary/50 transition-colors ${
                        i18n.language === lang.code
                          ? "text-[oklch(0.55_0.22_270)] font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {t(lang.key as any)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 主题选择器 */}
            <div className="relative" ref={themeRef}>
              <button
                onClick={() => setThemeOpen(!themeOpen)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                title={t("theme")}
              >
                {theme === "light" ? (
                  <Sun size={18} />
                ) : theme === "dark" ? (
                  <Moon size={18} />
                ) : (
                  <Monitor size={18} />
                )}
              </button>
              {themeOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 py-1 w-32 rounded-xl bg-card border border-border/50 shadow-lg z-50">
                  {themes.map(th => (
                    <button
                      key={th.value}
                      onClick={() => {
                        setTheme(th.value as "light" | "dark" | "system");
                        setThemeOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-secondary/50 transition-colors ${
                        theme === th.value
                          ? "text-[oklch(0.55_0.22_270)] font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      <th.icon size={14} />
                      {t(th.key as any)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 登录/注册按钮 */}
            {showUserMenu ? (
              <UserMenu />
            ) : authEnabled ? (
              <button
                onClick={() => setLocation("/login")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <UserIcon size={15} />
                {t("loginRegister")}
              </button>
            ) : (
              <button
                onClick={() => handleProtectedAction("/settings")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <Settings size={15} />
                {t("configApi")}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero - 好莱坞感 */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 动态背景 */}
        <div className="absolute inset-0 hero-background" />

        {/* 光束效果 */}
        <div className="hero-beam" />
        <div className="hero-beam" />
        <div className="hero-beam" />
        <div className="hero-beam" />

        {/* 动态粒子网络 */}
        <ParticleNetwork particleCount={20} connectionDistance={180} />

        {/* 中心内容 */}
        <div
          className={`relative z-10 max-w-5xl mx-auto px-6 text-center transition-all duration-1000 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          {/* 主标题 */}
          <h1
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-5xl md:text-7xl font-bold text-foreground mb-8 leading-tight title-glow"
          >
            {t("heroTitle")}
            <br />
            <span className="bg-gradient-to-r from-[oklch(0.55_0.22_270)] to-[oklch(0.60_0.20_190)] bg-clip-text text-transparent">
              {t("heroSubtitle2")}
            </span>
          </h1>

          {/* 副标题 */}
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            {t("heroSubtitle")}
          </p>

          {/* CTA 按钮组 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleProtectedAction("/studio")}
              className="btn-primary text-lg px-8 py-4 flex items-center gap-3"
            >
              <Wand2 size={20} />
              {t("startCreating")}
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => handleProtectedAction("/settings")}
              className="btn-secondary text-lg px-8 py-4 flex items-center gap-3"
            >
              <Settings size={20} />
              {t("configApi")}
            </button>
          </div>

          {/* 底部提示 */}
          <p className="text-sm text-muted-foreground/60 mt-8">
            {t("supportedModels")}
          </p>
        </div>

        {/* 滚动提示 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ArrowRight
            size={20}
            className="text-muted-foreground/50 rotate-90"
          />
        </div>
      </section>

      {/* Workflow steps - 时间轴 */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-4xl font-bold text-foreground mb-4"
          >
            {t("workflowTitle")}
          </h2>
          <p className="text-muted-foreground">{t("workflowDesc")}</p>
        </div>

        <div className="timeline">
          {workflowSteps.map((s, i) => (
            <div
              key={s.step}
              className="timeline-item"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="timeline-icon">
                <s.icon size={22} className="text-white" />
              </div>
              <div className="timeline-content">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-mono text-[oklch(0.60_0.20_190)]">
                    {s.step}
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    {s.label}
                  </span>
                </div>
                <p className="text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-4xl font-bold text-foreground mb-4"
          >
            {t("featuresTitle")}
          </h2>
          <p className="text-muted-foreground">{t("featuresDesc")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="card-modern p-6"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-[oklch(0.55_0.22_270)/0.2] to-[oklch(0.60_0.20_190)/0.1] border border-[oklch(0.55_0.22_270)/0.2]">
                <f.icon size={22} className="text-[oklch(0.60_0.20_190)]" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-4xl font-bold text-foreground mb-4"
          >
            {t("comparisonTitle")}
          </h2>
          <p className="text-muted-foreground">{t("comparisonDesc")}</p>
        </div>
        <div className="card-modern overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-6 py-5 text-muted-foreground font-medium w-1/4">
                  {t("compareDim")}
                </th>
                <th className="text-left px-6 py-5 text-muted-foreground font-medium">
                  {t("compareLibTV")}
                </th>
                <th className="text-left px-6 py-5 text-muted-foreground font-medium">
                  {t("compareHuobao")}
                </th>
                <th className="text-left px-6 py-5 font-semibold bg-gradient-to-r from-[oklch(0.55_0.22_270)/0.1] to-[oklch(0.60_0.20_190)/0.1]">
                  <span className="bg-gradient-to-r from-[oklch(0.55_0.22_270)] to-[oklch(0.60_0.20_190)] bg-clip-text text-transparent">
                    {t("compareOurs")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vsTable.map((row, i) => (
                <tr
                  key={row.dim}
                  className="border-b border-border/30 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-foreground">
                    {row.dim}
                  </td>
                  <td className="px-6 py-4 text-left text-muted-foreground">
                    {row.libtv}
                  </td>
                  <td className="px-6 py-4 text-left text-muted-foreground">
                    {row.huobao}
                  </td>
                  <td className="px-6 py-4 text-left">
                    <span className="inline-flex items-center gap-1.5 text-[oklch(0.60_0.20_190)]">
                      <CheckCircle2 size={14} />
                      {row.ours}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="card-modern p-12 text-center relative overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.55_0.22_270)/0.1] via-transparent to-[oklch(0.60_0.20_190)/0.1]" />

          <div className="relative z-10">
            <h2
              style={{ fontFamily: "'Playfair Display', serif" }}
              className="text-3xl md:text-4xl font-bold text-foreground mb-4"
            >
              {t("ctaTitle")}
            </h2>
            <p className="text-muted-foreground mb-8 text-lg max-w-lg mx-auto">
              {t("ctaDesc")}
            </p>
            <button
              onClick={() => handleProtectedAction("/studio")}
              className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-3"
            >
              <Wand2 size={20} />
              {t("ctaButton")}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 text-center">
        <p className="text-sm text-muted-foreground/60">{t("footer")}</p>
      </footer>
    </div>
  );
}
