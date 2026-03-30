import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { userApi } from "@/lib/api";
import "./i18n";
import Home from "./pages/Home";
import Studio from "./pages/Studio";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Preferences from "./pages/Preferences";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Home} />
      <Route path="/studio">
        <ProtectedRouteComponent component={Studio} path="/studio" />
      </Route>
      <Route path="/studio/:projectId">
        <ProtectedRouteComponent component={Studio} path="/studio/:projectId" />
      </Route>
      <Route path="/settings">
        <ProtectedRouteComponent component={Settings} path="/settings" />
      </Route>
      <Route path="/profile">
        <ProtectedRouteComponent component={Profile} path="/profile" />
      </Route>
      <Route path="/preferences">
        <ProtectedRouteComponent component={Preferences} path="/preferences" />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedRouteComponent({ 
  component: Component, 
  path 
}: { 
  component: React.ComponentType<{ params?: Record<string, string> }>; 
  path: string;
}) {
  const { isAuthenticated, isLoading, authEnabled } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // 如果认证启用且未登录，重定向到登录页
  if (authEnabled && !isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return <Component />;
}

function AppContent() {
  return (
    <>
      <Router />
    </>
  );
}

function App() {
  const [initialTheme, setInitialTheme] = useState<"light" | "dark" | "system">("dark");
  const [themeLoaded, setThemeLoaded] = useState(false);

  // 从后端加载用户偏好设置
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await userApi.getPreferences();
        setInitialTheme(prefs.theme as "light" | "dark" | "system");
      } catch (e) {
        // 如果未登录或获取失败，使用默认主题
        console.log("Using default theme");
      } finally {
        setThemeLoaded(true);
      }
    };
    loadPreferences();
  }, []);

  if (!themeLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme={initialTheme}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="top-right" />
            <AppContent />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
