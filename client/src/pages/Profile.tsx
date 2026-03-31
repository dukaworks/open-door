/*
 * Profile.tsx — 用户中心页面
 * 用户信息管理、头像修改、密码修改
 */

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, User, Lock, Camera, Loader2, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { userApi, UserProfile } from "@/lib/api";

interface ProfileProps {
  embedded?: boolean;
  onSaved?: () => void;
}

export default function Profile({ embedded = false, onSaved }: ProfileProps) {
  const { user, checkAuth } = useAuth();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 表单状态
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // 密码修改
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

  const loadProfile = async () => {
    try {
      const data = await userApi.getProfile();
      console.log("[Profile] 获取用户信息:", data);
      setProfile(data);
      setUsername(data.username);
      setEmail(data.email);
      if (data.avatar_url) {
        // 拼接完整URL
        const fullUrl = data.avatar_url.startsWith("http") 
          ? data.avatar_url 
          : `${API_BASE}${data.avatar_url}`;
        console.log("[Profile] 设置头像URL:", fullUrl);
        setAvatarPreview(fullUrl);
      } else {
        console.log("[Profile] 无头像URL");
        setAvatarPreview(null);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("加载用户信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 预览
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);

    try {
      setSaving(true);
      const result = await userApi.uploadAvatar(file);
      toast.success("头像上传成功");
      // 刷新用户信息（会更新 avatarPreview）
      await loadProfile();
      await checkAuth();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "头像上传失败");
      // 恢复预览
      setAvatarPreview(profile?.avatar_url || null);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!username.trim() || !email.trim()) {
      toast.error("用户名和邮箱不能为空");
      return;
    }

    try {
      setSaving(true);
      await userApi.updateProfile({ username, email });
      toast.success("用户信息已更新");
      await checkAuth();
      
      // 如果是嵌入式对话框，保存后自动关闭
      if (onSaved) {
        onSaved();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("新密码长度至少为 6 位");
      return;
    }

    try {
      setPasswordLoading(true);
      await userApi.changePassword(oldPassword, newPassword);
      toast.success("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "密码修改失败");
    } finally {
      setPasswordLoading(false);
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
                返回工作台
              </button>
            </Link>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "var(--primary)" }}
              >
                <User size={14} className="text-white" />
              </div>
              <span className="font-semibold text-foreground">用户中心</span>
          </div>
        </div>
        </header>
      )}

      <div className={embedded ? "flex flex-col h-full pt-2 pb-4 px-1" : "max-w-2xl mx-auto px-6 py-8"}>
        <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0">
            <TabsTrigger value="profile">基本信息</TabsTrigger>
            <TabsTrigger value="security">账号安全</TabsTrigger>
            <TabsTrigger value="binding">账号绑定</TabsTrigger>
          </TabsList>

          {/* 基本信息 */}
          <TabsContent value="profile" className="flex-1 overflow-y-auto mt-0 min-h-0">
            <Card className="mt-4 border-0 shadow-none">
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>修改您的用户名、邮箱和头像</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 头像 */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <button
                      onClick={handleAvatarClick}
                      disabled={saving}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-card border-2 border-white shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="font-medium">头像</p>
                    <p className="text-sm text-muted-foreground">点击上传新头像，支持 JPG、PNG、WEBP</p>
                  </div>
                </div>

                {/* 用户名 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">用户名</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="用户名"
                  />
                </div>

                {/* 邮箱 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">邮箱</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="邮箱地址"
                  />
                </div>

                <Button onClick={handleSaveProfile} disabled={saving} className="w-full gap-2 shrink-0">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  保存修改
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 账号安全 */}
          <TabsContent value="security" className="flex-1 overflow-y-auto mt-0 min-h-0">
            <Card className="mt-4 border-0 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock size={18} />
                  修改密码
                </CardTitle>
                <CardDescription>定期修改密码可以保护账号安全</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">当前密码</label>
                  <Input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="请输入当前密码"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">新密码</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="请输入新密码（至少 6 位）"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">确认新密码</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                  />
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={passwordLoading}
                  className="w-full gap-2"
                >
                  {passwordLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  修改密码
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 账号绑定 */}
          <TabsContent value="binding" className="flex-1 overflow-y-auto mt-0 min-h-0">
            <Card className="mt-4 border-0 shadow-none">
              <CardHeader>
                <CardTitle>账号绑定</CardTitle>
                <CardDescription>绑定第三方账号，实现快捷登录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.007-.27-.022-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">微信</p>
                      <p className="text-sm text-muted-foreground">未绑定</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    敬请期待
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white">
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">GitHub</p>
                      <p className="text-sm text-muted-foreground">未绑定</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    敬请期待
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
