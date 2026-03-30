import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Zap, AlertTriangle } from "lucide-react";

// OAuth 图标组件
const OAuthIcon = ({ provider }: { provider: string }) => {
  switch (provider) {
    case "github":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
      );
    case "google":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      );
    case "weixin":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path fill="#07C160" d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786 1.88 1.491 2.95 4.235 2.688 6.436-3.513.255-6.71 2.011-8.545 4.318a.306.306 0 01-.157.051h-.004a.296.296 0 01-.275-.196l-1.878-1.003-.119.534c-.19.854-.29 1.74-.29 2.627 0 .189.015.375.045.558a10.728 10.728 0 005.398-1.277.49.49 0 01.384-.038l1.717.982a.242.242 0 00.137-.019.241.241 0 00.078-.064l.39-1.49a.44.44 0 01.16-.196c1.467-1.003 2.433-2.618 2.714-4.467.47-3.223-.731-6.443-3.931-7.312z"/>
        </svg>
      );
    case "douyin":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path fill="#000000" d="M12.525 2.5c-1.375 0-2.65.375-3.775 1.025a5.43 5.43 0 00-2.45 2.713 8.17 8.17 0 00-.65 3.575c.375 1.275 1.125 2.4 2.15 3.225-.55.075-1.1.175-1.65.3.7-.95 1.575-1.75 2.625-2.325.275.525.65 1.025 1.1 1.475-.975.525-2.025.95-3.025 1.3 1.025 1 2.275 1.75 3.7 2.15-.675.35-1.4.6-2.175.725C8.1 15.3 7.025 15 6 14.675c-.65 1.25-1 2.625-1 4.1 0 .125.025.25.025.375 2.125-1.625 4.675-2.575 7.475-2.7-.525-.925-.8-2-.8-3.175 0-2.225 1.75-4.025 3.9-4.025.875 0 1.7.3 2.375.8a6.52 6.52 0 01-3.225 3.625c.275-.05.55-.1.825-.175-.8-.875-1.45-1.9-1.875-3z"/>
        </svg>
      );
    default:
      return null;
  }
};

// OAuth 提供商配置 - 使用品牌图标
const OAUTH_PROVIDERS = [
  { 
    id: "github", 
    name: "GitHub", 
    icon: "github",
    color: "#333333",
    bg: "bg-white/10 hover:bg-white/20",
    available: false 
  },
  { 
    id: "google", 
    name: "Google", 
    icon: "google",
    color: "#4285F4",
    bg: "bg-white/10 hover:bg-white/20",
    available: false 
  },
  { 
    id: "weixin", 
    name: "微信", 
    icon: "weixin",
    color: "#07C160",
    bg: "bg-white/10 hover:bg-white/20",
    available: false 
  },
  { 
    id: "douyin", 
    name: "抖音", 
    icon: "douyin",
    color: "#000000",
    bg: "bg-white/10 hover:bg-white/20",
    available: false 
  },
];

export default function Login() {
  const { t } = useTranslation();
  const { login, register, authEnabled, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoading(true);
    
    try {
      await login(loginUsername, loginPassword);
      setLocation("/studio");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : t("loginError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");
    
    if (registerPassword !== confirmPassword) {
      setRegisterError(t("registerError1"));
      return;
    }
    
    if (registerPassword.length < 6) {
      setRegisterError(t("registerError2"));
      return;
    }
    
    setIsLoading(true);
    
    try {
      await register(registerUsername, registerEmail, registerPassword);
      setLocation("/studio");
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : t("registerError3"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthClick = (provider: typeof OAUTH_PROVIDERS[0]) => {
    if (!provider.available) {
      alert(t("oauthComingSoon"));
    }
  };

  // 如果认证未启用，重定向到首页
  if (!authEnabled) {
    setLocation("/");
    return null;
  }

  // 如果已登录，重定向到工作台
  if (isAuthenticated) {
    setLocation("/studio");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 hero-background" />
      <div className="hero-beam" />
      <div className="hero-beam" />
      
      {/* 调试提示框 - 仅开发环境显示 */}
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed top-4 left-4 z-50">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 backdrop-blur-sm">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs text-amber-200">{t("oauthDebugMode")}</span>
          </div>
        </div>
      )}
      
      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-[420px] px-4 py-8">
        <div className="card-modern p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[oklch(0.55_0.22_270)] to-[oklch(0.65_0.20_290)] shadow-lg mb-4">
              <Zap size={28} className="text-white" />
            </div>
            <h1 
              style={{ fontFamily: "'Playfair Display', serif" }} 
              className="text-2xl font-bold text-foreground"
            >
              芝麻开门
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("loginSubtitle")}</p>
          </div>

          {/* 邮箱登录/注册表单 */}
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
              <TabsTrigger 
                value="login" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[oklch(0.55_0.22_270)] data-[state=active]:to-[oklch(0.65_0.20_290)] data-[state=active]:text-white"
              >
                登录
              </TabsTrigger>
              <TabsTrigger 
                value="register"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[oklch(0.55_0.22_270)] data-[state=active]:to-[oklch(0.65_0.20_290)] data-[state=active]:text-white"
              >
                注册
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder={t("username")}
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="input-modern"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder={t("password")}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="input-modern"
                    required
                  />
                </div>
                {loginError && (
                  <p className="text-sm text-red-400">{loginError}</p>
                )}
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="btn-primary w-full py-3"
                >
                  {isLoading ? t("loginLoading") : t("login")}
                </button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder={t("username")}
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    className="input-modern"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder={t("email")}
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="input-modern"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder={t("passwordHint")}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="input-modern"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder={t("confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-modern"
                    required
                  />
                </div>
                {registerError && (
                  <p className="text-sm text-red-400">{registerError}</p>
                )}
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="btn-primary w-full py-3"
                >
                  {isLoading ? t("registerLoading") : t("register")}
                </button>
              </form>
            </TabsContent>
          </Tabs>

          {/* OAuth 第三方登录 - 图标按钮 */}
          <div className="mt-6">
            <p className="text-center text-xs text-muted-foreground/50 mb-4">{t("otherLoginMethods")}</p>
            <div className="flex items-center justify-center gap-4">
              {OAUTH_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleOAuthClick(provider)}
                  disabled={!provider.available}
                  title={provider.name}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${provider.bg} ${!provider.available ? 'opacity-40 cursor-not-allowed' : 'hover:scale-110 active:scale-95 hover:bg-white/20'}`}
                  style={{ color: provider.color }}
                >
                  <OAuthIcon provider={provider.icon} />
                </button>
              ))}
            </div>
          </div>
          
          {/* 底部提示 */}
          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            {t("agreeTerms")}
          </p>
        </div>
      </div>
    </div>
  );
}
