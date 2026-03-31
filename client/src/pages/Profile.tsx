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

  const loadProfile = async () => {
    try {
      const data = await userApi.getProfile();
      setProfile(data);
      setUsername(data.username);
      setEmail(data.email);
      if (data.avatar_url) {
        setAvatarPreview(data.avatar_url);
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
      // 刷新用户信息
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
          <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
            <TabsTrigger value="profile">基本信息</TabsTrigger>
            <TabsTrigger value="security">账号安全</TabsTrigger>
          </TabsList>

          {/* 基本信息 */}
          <TabsContent value="profile" className="flex-1 overflow-y-auto mt-0 min-h-0">
            <Card className="mt-4">
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
            <Card className="mt-4">
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
        </Tabs>
      </div>
    </div>
  );
}
