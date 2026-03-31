/*
 * SettingsDialog.tsx - 设置对话框 V3
 * 使用新的 /api/v3/* 端点
 * 三标签页：套餐选择 | 提供商配置 | 系统设置
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Check, X, RefreshCw, Settings, Package, Server } from "lucide-react";

// ============================================================
// 类型定义
// ============================================================

interface Provider {
  id: string;
  name: string;
  provider_type: string;
  description: string;
  base_url: string;
  is_preset: boolean;
  requires_secret: boolean;
  api_key_configured: boolean;
  api_secret_configured: boolean;
  is_active: boolean;
  is_default: boolean;
}

interface Model {
  id: string;
  name: string;
  model_id: string;
  duration?: number;
  ratio?: string;
  quality?: string;
  output_resolution?: string;
  voice?: string;
  speed?: number;
  emotion?: string;
}

interface Package {
  id: string;
  name: string;
  icon: string;
  description: string;
  is_preset: boolean;
  services: {
    llm?: { provider_id: string; model_id?: string };
    video?: { provider_id: string; model_id?: string };
    image?: { provider_id: string; model_id?: string };
    tts?: { provider_id: string; model_id?: string; voice?: string };
  };
}

interface UserConfig {
  package_id: string | null;
  llm: { provider_id: string; model_id: string };
  video: { provider_id: string; model_id: string };
  image: { provider_id: string };
  tts: { provider_id: string; model_id: string };
  runtime_params: {
    duration: number;
    ratio: string;
    quality: string;
    multi_shot: boolean;
  };
}

interface SystemSetting {
  key: string;
  value: unknown;
  category: string;
  description: string;
  is_editable: boolean;
  is_visible: boolean;
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

// ============================================================
// 常量
// ============================================================

const SERVICE_NAMES: Record<string, string> = {
  llm: "文案大脑",
  image: "图片生成",
  video: "视频生成",
  tts: "配音生成",
  memory: "我的风格",
};

const SERVICE_ICONS: Record<string, string> = {
  llm: "📝",
  image: "🖼️",
  video: "🎬",
  tts: "🎤",
  memory: "🧠",
};

const API_BASE = "/api/v3";

// ============================================================
// 主组件
// ============================================================

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  // 数据状态
  const [providers, setProviders] = useState<Provider[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);

  // UI 状态
  const [activeTab, setActiveTab] = useState("packages");
  const [loading, setLoading] = useState(false);
  const [applyingPackage, setApplyingPackage] = useState<string | null>(null);

  // 提供商配置状态
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    api_key: "",
    api_secret: "",
    base_url: "",
  });
  const [saving, setSaving] = useState(false);

  // 测试状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency_ms?: number;
  } | null>(null);

  // ============================================================
  // 数据加载
  // ============================================================

  useEffect(() => {
    if (open) {
      loadAllData();
    }
  }, [open]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProviders(),
        loadPackages(),
        loadUserConfig(),
        loadSystemSettings(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/providers`);
      if (!res.ok) throw new Error("加载服务商失败");
      const data = await res.json();
      setProviders(data);
      // 默认选择第一个
      if (data.length > 0 && !selectedProvider) {
        setSelectedProvider(data[0]);
        loadModels(data[0].id);
      }
    } catch (error) {
      console.error("加载服务商失败:", error);
      toast.error("加载服务商失败");
    }
  };

  const loadPackages = async () => {
    try {
      const res = await fetch(`${API_BASE}/packages`);
      if (!res.ok) throw new Error("加载套餐失败");
      const data = await res.json();
      setPackages(data);
    } catch (error) {
      console.error("加载套餐失败:", error);
      toast.error("加载套餐失败");
    }
  };

  const loadUserConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/user/config`);
      if (!res.ok) throw new Error("加载用户配置失败");
      const data = await res.json();
      setUserConfig(data);
    } catch (error) {
      console.error("加载用户配置失败:", error);
      // 首次使用可能没配置，不报错
    }
  };

  const loadSystemSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/system/settings`);
      if (!res.ok) throw new Error("加载系统设置失败");
      const data = await res.json();
      setSystemSettings(data);
    } catch (error) {
      console.error("加载系统设置失败:", error);
    }
  };

  const loadModels = async (providerId: string) => {
    setLoadingModels(true);
    try {
      const res = await fetch(`${API_BASE}/providers/${providerId}/models`);
      if (!res.ok) throw new Error("加载模型失败");
      const data = await res.json();
      setModels(data);
    } catch (error) {
      console.error("加载模型失败:", error);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  // ============================================================
  // 操作处理
  // ============================================================

  const handleApplyPackage = async (pkg: Package) => {
    setApplyingPackage(pkg.id);
    try {
      const res = await fetch(`${API_BASE}/user/config/apply-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: pkg.id }),
      });
      if (!res.ok) throw new Error("应用套餐失败");
      await loadUserConfig();
      toast.success(`已应用「${pkg.name}」套餐`);
    } catch (error) {
      toast.error("应用套餐失败");
    } finally {
      setApplyingPackage(null);
    }
  };

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    setFormData({
      api_key: "",
      api_secret: "",
      base_url: provider.base_url || "",
    });
    setTestResult(null);
    loadModels(provider.id);
  };

  const handleSaveProviderConfig = async () => {
    if (!selectedProvider) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/providers/${selectedProvider.id}/config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: formData.api_key || undefined,
            api_secret: formData.api_secret || undefined,
            base_url: formData.base_url || undefined,
            is_active: true,
          }),
        }
      );
      if (!res.ok) throw new Error("保存失败");
      toast.success("配置已保存");
      await loadProviders();
    } catch (error) {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTestProvider = async () => {
    if (!selectedProvider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `${API_BASE}/providers/${selectedProvider.id}/test`,
        { method: "POST" }
      );
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(`连接成功 (${data.latency_ms}ms)`);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      setTestResult({ success: false, message: "测试失败" });
      toast.error("测试失败");
    } finally {
      setTesting(false);
    }
  };

  const handleUpdateSystemSetting = async (
    key: string,
    value: unknown
  ) => {
    try {
      const res = await fetch(`${API_BASE}/system/settings/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("更新失败");
      toast.success("设置已更新");
      await loadSystemSettings();
    } catch (error) {
      toast.error("更新失败");
    }
  };

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      <div className="w-56 border-r bg-muted/20 p-4 flex flex-col gap-2">
        <div className="text-sm font-medium text-muted-foreground mb-2">
          设置
        </div>

        <Button
          variant={activeTab === "packages" ? "secondary" : "ghost"}
          className="justify-start gap-2"
          onClick={() => setActiveTab("packages")}
        >
          <Package size={16} />
          套餐选择
        </Button>

        <Button
          variant={activeTab === "providers" ? "secondary" : "ghost"}
          className="justify-start gap-2"
          onClick={() => setActiveTab("providers")}
        >
          <Server size={16} />
          提供商配置
        </Button>

        <Button
          variant={activeTab === "system" ? "secondary" : "ghost"}
          className="justify-start gap-2"
          onClick={() => setActiveTab("system")}
        >
          <Settings size={16} />
          系统设置
        </Button>

        <Separator className="my-2" />

        {/* 当前套餐显示 */}
        <div className="text-xs text-muted-foreground mb-1">当前套餐</div>
        {userConfig?.package_id ? (
          <Badge variant="secondary" className="justify-start">
            {packages.find((p) => p.id === userConfig.package_id)?.icon || "📦"}{" "}
            {packages.find((p) => p.id === userConfig.package_id)?.name ||
              userConfig.package_id}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">未选择套餐</span>
        )}
      </div>

      {/* 工作区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          {/* 套餐选择 */}
          <TabsContent value="packages" className="h-full m-0">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">选择套餐</h2>
                  <p className="text-sm text-muted-foreground">
                    一键配置所有服务的推荐组合
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAllData}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`mr-2 ${loading ? "animate-spin" : ""}`}
                    size={14}
                  />
                  刷新
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <Loader2 className="animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      加载中...
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {packages.map((pkg) => (
                      <Card
                        key={pkg.id}
                        className={`cursor-pointer transition-all ${
                          userConfig?.package_id === pkg.id
                            ? "border-primary ring-1 ring-primary"
                            : "hover:border-primary"
                        }`}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <span className="text-2xl">{pkg.icon}</span>
                            <span>{pkg.name}</span>
                            {userConfig?.package_id === pkg.id && (
                              <Badge variant="default" className="ml-auto">
                                当前
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>{pkg.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 mb-4">
                            {pkg.services.llm && (
                              <ServiceRow
                                icon={SERVICE_ICONS.llm}
                                name={SERVICE_NAMES.llm}
                                provider={pkg.services.llm.provider_id}
                              />
                            )}
                            {pkg.services.video && (
                              <ServiceRow
                                icon={SERVICE_ICONS.video}
                                name={SERVICE_NAMES.video}
                                provider={pkg.services.video.provider_id}
                              />
                            )}
                            {pkg.services.image && (
                              <ServiceRow
                                icon={SERVICE_ICONS.image}
                                name={SERVICE_NAMES.image}
                                provider={pkg.services.image.provider_id}
                              />
                            )}
                            {pkg.services.tts && (
                              <ServiceRow
                                icon={SERVICE_ICONS.tts}
                                name={SERVICE_NAMES.tts}
                                provider={pkg.services.tts.provider_id}
                              />
                            )}
                          </div>
                          <Button
                            className="w-full"
                            variant={
                              userConfig?.package_id === pkg.id
                                ? "secondary"
                                : "default"
                            }
                            disabled={
                              applyingPackage === pkg.id ||
                              userConfig?.package_id === pkg.id
                            }
                            onClick={() => handleApplyPackage(pkg)}
                          >
                            {applyingPackage === pkg.id ? (
                              <>
                                <Loader2 className="mr-2 animate-spin" size={16} />
                                应用中...
                              </>
                            ) : userConfig?.package_id === pkg.id ? (
                              "已应用"
                            ) : (
                              "应用此套餐"
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* 提供商配置 */}
          <TabsContent value="providers" className="h-full m-0">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">配置提供商</h2>
                <p className="text-sm text-muted-foreground">
                  管理 API Key 和自定义服务商
                </p>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* 左侧：提供商列表 */}
                <div className="w-64 border-r p-4 overflow-auto">
                  <div className="space-y-2">
                    {providers.map((provider) => (
                      <Button
                        key={provider.id}
                        variant={
                          selectedProvider?.id === provider.id
                            ? "secondary"
                            : "ghost"
                        }
                        className="w-full justify-start gap-2"
                        onClick={() => handleProviderSelect(provider)}
                      >
                        <div className="flex-1 text-left">
                          <div className="font-medium">{provider.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {SERVICE_NAMES[provider.provider_type] ||
                              provider.provider_type}
                          </div>
                        </div>
                        {provider.api_key_configured && (
                          <Check size={14} className="text-green-500" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 右侧：配置表单 */}
                <ScrollArea className="flex-1 p-4">
                  {selectedProvider ? (
                    <div className="max-w-lg space-y-6">
                      <div>
                        <h3 className="text-lg font-medium">
                          {selectedProvider.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedProvider.description}
                        </p>
                      </div>

                      {/* API Key */}
                      <div className="space-y-2">
                        <Label htmlFor="api_key">API Key</Label>
                        <Input
                          id="api_key"
                          type="password"
                          placeholder={
                            selectedProvider.api_key_configured
                              ? "已配置 (留空保持不变)"
                              : "输入 API Key"
                          }
                          value={formData.api_key}
                          onChange={(e) =>
                            setFormData({ ...formData, api_key: e.target.value })
                          }
                        />
                      </div>

                      {/* API Secret (Kling 等需要) */}
                      {selectedProvider.requires_secret && (
                        <div className="space-y-2">
                          <Label htmlFor="api_secret">API Secret</Label>
                          <Input
                            id="api_secret"
                            type="password"
                            placeholder={
                              selectedProvider.api_secret_configured
                                ? "已配置 (留空保持不变)"
                                : "输入 API Secret"
                            }
                            value={formData.api_secret}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                api_secret: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}

                      {/* Base URL */}
                      <div className="space-y-2">
                        <Label htmlFor="base_url">Base URL (可选)</Label>
                        <Input
                          id="base_url"
                          placeholder={selectedProvider.base_url}
                          value={formData.base_url}
                          onChange={(e) =>
                            setFormData({ ...formData, base_url: e.target.value })
                          }
                        />
                      </div>

                      {/* 模型选择 */}
                      <div className="space-y-2">
                        <Label>可用模型</Label>
                        {loadingModels ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="animate-spin" size={14} />
                            加载中...
                          </div>
                        ) : models.length > 0 ? (
                          <div className="space-y-1">
                            {models.map((model) => (
                              <div
                                key={model.id}
                                className="flex items-center justify-between p-2 rounded bg-muted text-sm"
                              >
                                <span>{model.name}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {model.model_id}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            暂无模型数据
                          </p>
                        )}
                      </div>

                      {/* 测试结果 */}
                      {testResult && (
                        <div
                          className={`p-3 rounded flex items-center gap-2 ${
                            testResult.success
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {testResult.success ? (
                            <Check size={16} />
                          ) : (
                            <X size={16} />
                          )}
                          <span className="text-sm">{testResult.message}</span>
                          {testResult.latency_ms && (
                            <span className="text-xs ml-auto">
                              {testResult.latency_ms}ms
                            </span>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handleTestProvider}
                          disabled={testing}
                        >
                          {testing ? (
                            <Loader2 className="mr-2 animate-spin" size={16} />
                          ) : (
                            <RefreshCw className="mr-2" size={16} />
                          )}
                          测试连接
                        </Button>
                        <Button onClick={handleSaveProviderConfig} disabled={saving}>
                          {saving ? (
                            <Loader2 className="mr-2 animate-spin" size={16} />
                          ) : null}
                          保存配置
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      请选择左侧的提供商进行配置
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          {/* 系统设置 */}
          <TabsContent value="system" className="h-full m-0">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">系统设置</h2>
                <p className="text-sm text-muted-foreground">
                  管理全局配置和高级选项
                </p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="max-w-lg space-y-6">
                  {systemSettings
                    .filter((s) => s.is_visible)
                    .map((setting) => (
                      <Card key={setting.key}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              {setting.description}
                            </CardTitle>
                            <Badge variant="outline">{setting.category}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {typeof setting.value === "boolean" ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={setting.value as boolean}
                                onCheckedChange={(checked) =>
                                  handleUpdateSystemSetting(setting.key, checked)
                                }
                                disabled={!setting.is_editable}
                              />
                              <span className="text-sm text-muted-foreground">
                                {setting.value ? "已启用" : "已禁用"}
                              </span>
                            </div>
                          ) : typeof setting.value === "string" ? (
                            <Input
                              value={setting.value as string}
                              onChange={(e) =>
                                handleUpdateSystemSetting(
                                  setting.key,
                                  e.target.value
                                )
                              }
                              disabled={!setting.is_editable}
                            />
                          ) : (
                            <pre className="text-xs bg-muted p-2 rounded">
                              {JSON.stringify(setting.value, null, 2)}
                            </pre>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                  {systemSettings.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      暂无系统设置数据
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function ServiceRow({
  icon,
  name,
  provider,
}: {
  icon: string;
  name: string;
  provider: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{icon}</span>
      <span className="text-muted-foreground">{name}</span>
      <span className="font-medium">{provider}</span>
    </div>
  );
}
