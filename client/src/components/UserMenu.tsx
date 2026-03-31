import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Settings,
  LogOut,
  Film,
  UserCircle,
  Palette,
  X,
} from "lucide-react";
import {
  StudioDialogs,
  DialogType,
} from "@/components/StudioDialogs";

interface UserMenuProps {
  collapsed?: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const { user, isAuthenticated, authEnabled, logout } = useAuth();
  console.log("[UserMenu] user:", user);
  const [openDialog, setOpenDialog] = useState<DialogType>(null);

  // 如果认证未启用，不显示用户菜单
  if (!authEnabled) {
    return null;
  }

  // 如果未登录，显示登录按钮
  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={() => setOpenDialog("profile")}
        className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-colors cursor-pointer text-muted-foreground hover:bg-secondary hover:text-foreground w-full"
      >
        <User size={18} className="shrink-0" />
        {!collapsed && (
          <span className="text-sm font-medium truncate">登录</span>
        )}
      </button>
    );
  }

  const handleLogout = () => {
    logout();
  };

  const handleMenuItemClick = (dialogType: DialogType) => {
    setOpenDialog(dialogType);
  };

  // 已登录用户的菜单
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-colors cursor-pointer text-muted-foreground hover:bg-secondary hover:text-foreground">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[oklch(0.55_0.22_270)] to-[oklch(0.60_0.20_190)] flex items-center justify-center text-white text-xs font-medium shrink-0 overflow-hidden">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url.startsWith("http") ? user.avatar_url : `${API_BASE}${user.avatar_url}`}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </div>
            {!collapsed && (
              <span className="text-sm font-medium truncate">
                {user.username}
              </span>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-card border-border/50"
        >
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">
                {user.username}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {user.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem
            onClick={() => handleMenuItemClick("profile")}
            className="cursor-pointer"
          >
            <UserCircle size={14} className="mr-2" />
            用户中心
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleMenuItemClick("settings")}
            className="cursor-pointer"
          >
            <Settings size={14} className="mr-2" />
            设置
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-400 cursor-pointer"
          >
            <LogOut size={14} className="mr-2" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 对话框 */}
      <StudioDialogs open={openDialog} onClose={() => setOpenDialog(null)} />
    </>
  );
}
