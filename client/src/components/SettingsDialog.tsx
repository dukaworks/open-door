/*
 * SettingsDialog.tsx - 独立设置对话框组件
 * 侧边栏 + 工作区布局，支持套餐选择和提供商配置
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  X,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";

// 类型定义
interface Provider {
  id: string;
  name: string;
  type: string;
  description: string;
  requires_secret: boolean;
  default_url: string;
}

interface Package {
  id: string;
  name: string;
  icon: string;
  description: string;
  services: { type: string; provider: string }[];
}

interface UserConfig {
  id: number;
  config_type: string;
  provider: string;
  provider_name: string;
  api_key_configured: boolean;
  api_secret_configured: boolean;
  model: string;
  base_url: string;
  custom_params: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  updated_at: string;
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

// 服务类型映射（用户能看懂的名称）
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

// 预设套餐
const DEFAULT_PACKAGES = [
  { id: "basic", name: "基础版", icon: "🌟", description: "免费体验推荐" },
  { id: "pro", name: "专业版", icon: "🚀", description: "全功能解锁" },
  { id: "flagship", name: "旗舰版", icon: "👑", description: "无限可能" },
];

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("packages");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [userConfigs, setUserConfigs] = useState<UserConfig[]>([]);
  const [loading, setLoading] = useState(false);

  // 选择的服务类型
  const [selectedServiceType, setSelectedServiceType] = useState<string>("llm");
  // 当前配置的提供商
  const [selectedProvider, setSelectedProvider] = useState<string>("deepseek");
  // 表单数据
  const [formData, setFormData] = useState({
    api_key: "",
    api_secret: "",
    model: "",
    base_url: "",
  });
  // 测试状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  // 模型列表
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // 加载数据
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // 加载提供商和模型
  useEffect(() => {
    if (selectedProvider) {
      loadModels(selectedProvider);
    }
  }, [selectedProvider]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [providersRes, packagesRes, configsRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/packages"),
        fetch("/api/user/config"),
      ]);

      const providersData = await providersRes.json();
      const packagesData = await packagesRes.json();
      const configsData = await configsRes.json();

      setProviders(providersData);
      setPackages(packagesData);
      setUserConfigs(configsData);
    } catch (error) {
      console.error("加载数据失败:", error);
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async (provider: string) => {
    setLoadingModels(true);
    try {
      const response = await fetch(`/api/providers/${provider}/models`);
      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      console.error("加载模型失败:", error);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const testConfig = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/user/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config_type: selectedServiceType,
          provider: selectedProvider,
          api_key: formData.api_key,
          api_secret: formData.api_secret,
          base_url: formData.base_url || undefined,
          model: formData.model || undefined,
        }),
      });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: "测试失败" });
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    try {
      const response = await fetch("/api/user/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config_type: selectedServiceType,
          provider: selectedProvider,
          api_key: formData.api_key || undefined,
          api_secret: formData.api_secret || undefined,
          model: formData.model || undefined,
          base_url: formData.base_url || undefined,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("配置已保存");
        loadData();
      } else {
        toast.error(result.message || "保存失败");
      }
    } catch (error) {
      toast.error("保存失败");
    }
  };

  // 获取当前服务类型的可用提供商
  const getProvidersForService = (serviceType: string) => {
    const typeMap: Record<string, string[]> = {
      llm: ["deepseek", "kimi", "minimax", "gemini", "openrouter", "ollama"],
      image: ["nano_banana"],
      video: ["kling", "seedance"],
      tts: ["minimax"],
      memory: ["local", "mem0"],
    };
    return providers.filter(p => typeMap[serviceType]?.includes(p.id));
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="max-w-[1400px] h-[90vh] bg-card p-0">
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
              <span>📦</span> 套餐选择
            </Button>

            <Button
              variant={activeTab === "providers" ? "secondary" : "ghost"}
              className="justify-start gap-2"
              onClick={() => setActiveTab("providers")}
            >
              <span>⚙️</span> 提供商配置
            </Button>

            <Separator className="my-2" />

            {/* 套餐快捷选择 */}
            <div className="text-xs text-muted-foreground mb-1">快捷套餐</div>
            {DEFAULT_PACKAGES.map(pkg => (
              <Button
                key={pkg.id}
                variant="ghost"
                className="justify-start gap-2 text-sm"
                onClick={() => setActiveTab("packages")}
              >
                <span>{pkg.icon}</span> {pkg.name}
              </Button>
            ))}
          </div>

          {/* 工作区 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>
                {activeTab === "packages" ? "选择套餐" : "配置提供商"}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 p-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="animate-spin" />
                </div>
              ) : activeTab === "packages" ? (
                /* 套餐选择视图 */
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    选择一个套餐，或自定义配置各服务
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    {packages.map(pkg => (
                      <Card
                        key={pkg.id}
                        className="cursor-pointer hover:border-primary"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2">
                            <span>{pkg.icon}</span> {pkg.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {pkg.description}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1">
                            {pkg.services.map((svc, idx) => (
                              <div
                                key={idx}
                                className="text-sm flex items-center gap-2"
                              >
                                <span>{SERVICE_ICONS[svc.type]}</span>
                                <span>{SERVICE_NAMES[svc.type]}</span>
                                <span className="text-muted-foreground">
                                  - {svc.provider}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                /* 提供商配置视图 */
                <div className="space-y-6">
                  {/* 服务类型选择 */}
                  <div className="flex gap-2">
                    {Object.entries(SERVICE_NAMES).map(([type, name]) => (
                      <Button
                        key={type}
                        variant={
                          selectedServiceType === type ? "default" : "outline"
                        }
                        onClick={() => {
                          setSelectedServiceType(type);
                          const firstProvider = getProvidersForService(type)[0];
                          if (firstProvider) {
                            setSelectedProvider(firstProvider.id);
                          }
                        }}
                      >
                        {SERVICE_ICONS[type]} {name}
                      </Button>
                    ))}
                  </div>

                  <Separator />

                  {/* 提供商选择 */}
                  <div className="space-y-2">
                    <Label>选择提供商</Label>
                    <Select
                      value={selectedProvider}
                      onValueChange={setSelectedProvider}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getProvidersForService(selectedServiceType).map(
                          provider => (
                            <SelectItem key={provider.id} value={provider.id}>
                              {provider.name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* API Key 配置 */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={formData.api_key}
                        onChange={e =>
                          setFormData({ ...formData, api_key: e.target.value })
                        }
                        placeholder="输入 API Key"
                      />
                    </div>

                    {getProvidersForService(selectedServiceType).find(
                      p => p.id === selectedProvider
                    )?.requires_secret && (
                      <div className="space-y-2">
                        <Label>API Secret</Label>
                        <Input
                          type="password"
                          value={formData.api_secret}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              api_secret: e.target.value,
                            })
                          }
                          placeholder="输入 API Secret (如 Kling)"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>模型</Label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.model}
                          onValueChange={value =>
                            setFormData({ ...formData, model: value })
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue
                              placeholder={
                                loadingModels ? "加载中..." : "选择模型"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {models.map(model => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => loadModels(selectedProvider)}
                          title="刷新模型列表"
                        >
                          <RefreshCw
                            className={loadingModels ? "animate-spin" : ""}
                            size={16}
                          />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Base URL (留空使用默认)</Label>
                      <Input
                        value={formData.base_url}
                        onChange={e =>
                          setFormData({ ...formData, base_url: e.target.value })
                        }
                        placeholder={
                          providers.find(p => p.id === selectedProvider)
                            ?.default_url || ""
                        }
                      />
                    </div>

                    {/* 测试结果 */}
                    {testResult && (
                      <div
                        className={`p-3 rounded-lg ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                      >
                        {testResult.success ? (
                          <Check className="inline mr-2" />
                        ) : (
                          <X className="inline mr-2" />
                        )}
                        {testResult.message}
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={testConfig}
                        disabled={testing || !formData.api_key}
                      >
                        {testing ? (
                          <Loader2 className="mr-2 animate-spin" size={16} />
                        ) : null}
                        测试连接
                      </Button>
                      <Button onClick={saveConfig} disabled={!formData.api_key}>
                        <Check className="mr-2" size={16} />
                        保存配置
                      </Button>
                    </div>
                  </div>

                  {/* 已保存的配置列表 */}
                  <div className="space-y-2">
                    <Label>已保存的配置</Label>
                    <div className="space-y-2">
                      {userConfigs
                        .filter(c => c.config_type === selectedServiceType)
                        .map(config => (
                          <Card key={config.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">
                                  {config.provider_name}
                                </span>
                                {config.model && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    - {config.model}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    config.is_active ? "default" : "secondary"
                                  }
                                >
                                  {config.is_active ? "已启用" : "已禁用"}
                                </Badge>
                                {config.api_key_configured && (
                                  <Badge variant="outline">已配置</Badge>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      {userConfigs.filter(
                        c => c.config_type === selectedServiceType
                      ).length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          暂无已保存的配置
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
