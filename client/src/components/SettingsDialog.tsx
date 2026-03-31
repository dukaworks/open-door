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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Check, X, RefreshCw, RotateCcw, Settings, Package, Server, Plus, Trash2, AlertCircle, ArrowRight, Eye, EyeOff, ChevronDown } from "lucide-react";

// ============================================================
// 类型定义
// ============================================================

interface Provider {
  id: string;
  name: string;
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
  model_type: string;
  provider_id: string;
  provider_name?: string;
  duration?: number;
  ratio?: string;
  quality?: string;
  output_resolution?: string;
  voice?: string;
  speed?: number;
  emotion?: string;
  is_preset?: boolean;
}

interface ModelFormData {
  id: string;
  name: string;
  model_id: string;
  model_type: string;
  duration: string;
  ratio: string;
  quality: string;
  output_resolution: string;
  voice: string;
  speed: string;
  emotion: string;
}

interface Package {
  id: string;
  name: string;
  icon: string;
  description: string;
  is_preset: boolean;
  created_by?: string;
  services: {
    llm?: { provider_id: string; model_id?: string };
    video?: { provider_id: string; model_id?: string };
    image?: { provider_id: string; model_id?: string };
    tts?: { provider_id: string; model_id?: string; voice?: string };
  };
}

interface PackageConfigStatus {
  package_id: string;
  package_name: string;
  services: Package["services"];
  config_status: Record<string, boolean>; // provider_id -> is_configured
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

// API 基础 URL（与 api.ts 保持一致）
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// 获取认证头
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

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

  // 套餐配置状态
  const [packageConfigStatus, setPackageConfigStatus] = useState<Record<string, PackageConfigStatus>>({});

  // 套餐右侧面板状态
  const [rightPanelMode, setRightPanelMode] = useState<"none" | "detail" | "create" | "edit">("none");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  // 创建/编辑套餐表单
  const [packageForm, setPackageForm] = useState({
    id: "",
    name: "",
    icon: "📦",
    description: "",
    llm_provider: "",
    llm_model: "",
    video_provider: "",
    video_model: "",
    image_provider: "",
    image_model: "",
    tts_provider: "",
    tts_model: "",
  });
  const [savingPackage, setSavingPackage] = useState(false);

  // 提供商右侧面板状态
  const [providerPanelMode, setProviderPanelMode] = useState<"none" | "detail" | "create" | "edit">("none");

  // 创建提供商表单（不含 provider_type）
  const [providerForm, setProviderForm] = useState({
    id: "",
    name: "",
    description: "",
    base_url: "",
    requires_secret: false,
    api_key: "",
    api_secret: "",
  });
  const [savingProvider, setSavingProvider] = useState(false);

  // 提供商配置状态
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // 所有模型（用于套餐编辑）
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [loadingAllModels, setLoadingAllModels] = useState(false);

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

  // 密码显示/隐藏状态
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  // 模型管理状态
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [modelDialogMode, setModelDialogMode] = useState<"create" | "edit">("create");
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [modelForm, setModelForm] = useState<ModelFormData>({
    id: "",
    name: "",
    model_id: "",
    model_type: "llm",
    duration: "5",
    ratio: "16:9",
    quality: "high",
    output_resolution: "1024x1024",
    voice: "female-shaonv",
    speed: "1.0",
    emotion: "neutral",
  });
  const [savingModel, setSavingModel] = useState(false);
  // 从API获取的模型列表
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // ============================================================
  // 数据加载
  // ============================================================

  useEffect(() => {
    if (open) {
      loadAllData();
    }
  }, [open]);

  // 调试：监控 userConfig 和 packages 的变化
  useEffect(() => {
    console.log('[SettingsDialog] userConfig:', userConfig);
    console.log('[SettingsDialog] packages:', packages);
    if (userConfig?.package_id) {
      const currentPackage = packages.find((p) => p.id === userConfig.package_id);
      console.log('[SettingsDialog] currentPackage:', currentPackage);
    }
  }, [userConfig, packages]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProviders(),
        loadPackages(),
        loadUserConfig(),
        loadSystemSettings(),
        loadAllModels(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v3/providers`, {
        headers: getAuthHeaders(),
      });
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

  const loadAllModels = async () => {
    setLoadingAllModels(true);
    try {
      const res = await fetch(`${API_BASE}/api/v3/models`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("加载模型失败");
      const data = await res.json();
      setAllModels(data);
    } catch (error) {
      console.error("加载模型失败:", error);
      toast.error("加载模型失败");
    } finally {
      setLoadingAllModels(false);
    }
  };

  const loadPackages = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v3/packages`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("加载套餐失败");
      const data = await res.json();
      setPackages(data);
      // 加载每个套餐的配置状态
      data.forEach((pkg: Package) => {
        loadPackageConfigStatus(pkg.id);
      });
    } catch (error) {
      console.error("加载套餐失败:", error);
      toast.error("加载套餐失败");
    }
  };

  const loadPackageConfigStatus = async (packageId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v3/packages/${packageId}/config-status`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("加载配置状态失败");
      const data = await res.json();
      setPackageConfigStatus((prev) => ({ ...prev, [packageId]: data }));
    } catch (error) {
      console.error(`加载套餐 ${packageId} 配置状态失败:`, error);
    }
  };

  const loadUserConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v3/user/config`, {
        headers: getAuthHeaders(),
      });
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
      const res = await fetch(`${API_BASE}/api/v3/system/settings`, {
        headers: getAuthHeaders(),
      });
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
      const res = await fetch(`${API_BASE}/api/v3/providers/${providerId}/models`, {
        headers: getAuthHeaders(),
      });
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

  // 查看套餐详情
  const handleViewPackage = (pkg: Package) => {
    setSelectedPackage(pkg);
    setRightPanelMode("detail");
  };

  // 开始创建套餐
  const handleStartCreate = () => {
    setPackageForm({
      id: "",
      name: "",
      icon: "📦",
      description: "",
      llm_provider: "",
      llm_model: "",
      video_provider: "",
      video_model: "",
      image_provider: "",
      tts_provider: "",
      tts_model: "",
    });
    setRightPanelMode("create");
  };

  // 开始编辑套餐
  const handleStartEdit = () => {
    if (!selectedPackage) return;
    setPackageForm({
      id: selectedPackage.id,
      name: selectedPackage.name,
      icon: selectedPackage.icon,
      description: selectedPackage.description,
      llm_provider: selectedPackage.services.llm?.provider_id || "",
      llm_model: selectedPackage.services.llm?.model_id || "",
      video_provider: selectedPackage.services.video?.provider_id || "",
      video_model: selectedPackage.services.video?.model_id || "",
      image_provider: selectedPackage.services.image?.provider_id || "",
      image_model: selectedPackage.services.image?.model_id || "",
      tts_provider: selectedPackage.services.tts?.provider_id || "",
      tts_model: selectedPackage.services.tts?.model_id || "",
    });
    setRightPanelMode("edit");
  };

  // 应用套餐
  const handleApplyPackage = async (pkg: Package) => {
    setApplyingPackage(pkg.id);
    try {
      const res = await fetch(`${API_BASE}/api/v3/user/config/apply-package`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ package_id: pkg.id }),
      });
      if (!res.ok) throw new Error("应用套餐失败");
      await loadUserConfig();
      toast.success(`已应用「${pkg.name}」套餐`);
      
      // 检查配置状态，如果有未配置的服务商，提示用户
      const status = packageConfigStatus[pkg.id];
      if (status) {
        const unconfiguredProviders = Object.entries(status.config_status)
          .filter(([_, configured]) => !configured)
          .map(([providerId]) => providerId);
        
        if (unconfiguredProviders.length > 0) {
          const providerNames = unconfiguredProviders
            .map(id => providers.find(p => p.id === id)?.name || id)
            .join("、");
          toast.warning(
            `${providerNames} 尚未配置API Key，请前往"提供商配置"标签页进行配置`,
            { duration: 5000 }
          );
        }
      }
    } catch (error) {
      toast.error("应用套餐失败");
    } finally {
      setApplyingPackage(null);
    }
  };

  // 删除套餐
  const handleDeletePackage = async (pkg: Package) => {
    if (pkg.is_preset) {
      toast.error("预设套餐不能删除");
      return;
    }
    if (!confirm(`确定要删除套餐「${pkg.name}」吗？`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v3/packages/${pkg.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("删除失败");
      await loadPackages();
      setRightPanelMode("none");
      setSelectedPackage(null);
      toast.success("套餐已删除");
    } catch (error) {
      toast.error("删除套餐失败");
    }
  };

  // 创建/保存套餐
  const handleSavePackage = async () => {
    if (!packageForm.id || !packageForm.name) {
      toast.error("请输入套餐ID和名称");
      return;
    }
    
    setSavingPackage(true);
    try {
      const services: Record<string, { provider_id: string; model_id?: string }> = {};
      if (packageForm.llm_model) {
        services.llm = {
          provider_id: packageForm.llm_provider || "",
          model_id: packageForm.llm_model
        };
      }
      if (packageForm.video_model) {
        services.video = {
          provider_id: packageForm.video_provider || "",
          model_id: packageForm.video_model
        };
      }
      if (packageForm.image_model) {
        services.image = {
          provider_id: packageForm.image_provider || "",
          model_id: packageForm.image_model
        };
      }
      if (packageForm.tts_model) {
        services.tts = {
          provider_id: packageForm.tts_provider || "",
          model_id: packageForm.tts_model
        };
      }

      const isEdit = rightPanelMode === "edit";
      const url = isEdit ? `${API_BASE}/api/v3/packages/${packageForm.id}` : `${API_BASE}/api/v3/packages`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: packageForm.id,
          name: packageForm.name,
          icon: packageForm.icon,
          description: packageForm.description,
          services,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || (isEdit ? "更新失败" : "创建失败"));
      }
      
      await loadPackages();
      setRightPanelMode("none");
      toast.success(rightPanelMode === "create" ? "套餐创建成功" : "套餐已更新");
    } catch (error: any) {
      toast.error(error.message || "保存套餐失败");
    } finally {
      setSavingPackage(false);
    }
  };

  // 关闭右侧面板
  const handleClosePanel = () => {
    setRightPanelMode("none");
    setSelectedPackage(null);
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

  // 加载提供商配置详情（含解密后的 API Key）
  const loadProviderConfig = async (providerId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v3/providers/${providerId}/config`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("加载配置失败");
      const data = await res.json();
      setFormData({
        api_key: data.api_key || "",
        api_secret: data.api_secret || "",
        base_url: data.base_url || "",
      });
    } catch (error) {
      console.error("加载配置详情失败:", error);
      setFormData({ api_key: "", api_secret: "", base_url: "" });
    }
  };

  // 查看提供商详情
  const handleViewProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setTestResult(null);
    setShowApiKey(false);
    setShowApiSecret(false);
    loadModels(provider.id);
    loadProviderConfig(provider.id);
    setProviderPanelMode("detail");
  };

  // 开始编辑提供商（不含 provider_type）
  const handleStartEditProvider = () => {
    if (!selectedProvider) return;
    setProviderForm({
      id: selectedProvider.id,
      name: selectedProvider.name,
      description: selectedProvider.description,
      base_url: selectedProvider.base_url,
      requires_secret: selectedProvider.requires_secret,
      api_key: "",
      api_secret: "",
    });
    setProviderPanelMode("edit");
  };

  // 保存编辑的提供商
  const handleSaveProviderEdit = async () => {
    if (!selectedProvider || !providerForm.name) {
      toast.error("请输入提供商名称");
      return;
    }

    setSavingProvider(true);
    try {
      const res = await fetch(`${API_BASE}/api/v3/providers/${selectedProvider.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(providerForm),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "更新失败");
      }

      await loadProviders();
      setProviderPanelMode("detail");
      toast.success("提供商已更新");
    } catch (error: any) {
      toast.error(error.message || "更新提供商失败");
    } finally {
      setSavingProvider(false);
    }
  };

  // 开始创建提供商（不含 provider_type）
  const handleStartCreateProvider = () => {
    setProviderForm({
      id: "",
      name: "",
      description: "",
      base_url: "",
      requires_secret: false,
      api_key: "",
      api_secret: "",
    });
    setProviderPanelMode("create");
  };

  // 关闭提供商面板
  const handleCloseProviderPanel = () => {
    setProviderPanelMode("none");
    setSelectedProvider(null);
    setShowApiKey(false);
    setShowApiSecret(false);
    // 重置 providerForm
    setProviderForm({
      id: "",
      name: "",
      description: "",
      base_url: "",
      requires_secret: false,
      api_key: "",
      api_secret: "",
    });
  };

  // 保存新提供商
  const handleSaveNewProvider = async () => {
    if (!providerForm.id || !providerForm.name) {
      toast.error("请输入提供商ID和名称");
      return;
    }

    setSavingProvider(true);
    try {
      const res = await fetch(`${API_BASE}/api/v3/providers`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(providerForm),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "创建失败");
      }

      await loadProviders();
      setProviderPanelMode("none");
      // 重置表单
      setProviderForm({
        id: "",
        name: "",
        description: "",
        base_url: "",
        requires_secret: false,
        api_key: "",
        api_secret: "",
      });
      toast.success("提供商创建成功");
    } catch (error: any) {
      toast.error(error.message || "创建提供商失败");
    } finally {
      setSavingProvider(false);
    }
  };

  // 删除提供商
  const handleDeleteProvider = async () => {
    if (!selectedProvider) return;
    if (selectedProvider.is_preset) {
      toast.error("预设提供商不能删除");
      return;
    }
    if (!confirm(`确定要删除提供商「${selectedProvider.name}」吗？`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v3/providers/${selectedProvider.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("删除失败");

      await loadProviders();
      setProviderPanelMode("none");
      setSelectedProvider(null);
      toast.success("提供商已删除");
    } catch (error) {
      toast.error("删除提供商失败");
    }
  };

  // 从提供商API获取模型列表
  const loadAvailableModels = async (refresh = false) => {
    if (!selectedProvider) return;
    
    setLoadingModels(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v3/providers/${selectedProvider.id}/models-from-api${refresh ? '?refresh=true' : ''}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        console.log(`[模型列表] 提供商: ${selectedProvider.id}, 获取到 ${data.models?.length || 0} 个模型, 来源: ${data.source}`);
        setAvailableModels(data.models || []);
      } else {
        const error = await res.text();
        console.error("[模型列表] API 调用失败:", error);
      }
    } catch (error) {
      console.error("[模型列表] 加载失败:", error);
    } finally {
      setLoadingModels(false);
    }
  };

  // 模型管理
  const handleStartCreateModel = () => {
    if (!selectedProvider) return;
    setModelForm({
      id: "",
      name: "",
      model_id: "",
      model_type: "llm",
      duration: "5",
      ratio: "16:9",
      quality: "high",
      output_resolution: "1024x1024",
      voice: "female-shaonv",
      speed: "1.0",
      emotion: "neutral",
    });
    setModelDialogMode("create");
    setEditingModel(null);
    setModelSearchQuery("");
    setModelDialogOpen(true);
    // 打开弹窗时加载可用模型
    loadAvailableModels();
  };

  const handleStartEditModel = (model: Model) => {
    setModelForm({
      id: model.id,
      name: model.name,
      model_id: model.model_id,
      model_type: model.model_type,
      duration: model.duration?.toString() || "5",
      ratio: model.ratio || "16:9",
      quality: model.quality || "high",
      output_resolution: model.output_resolution || "1024x1024",
      voice: model.voice || "female-shaonv",
      speed: model.speed?.toString() || "1.0",
      emotion: model.emotion || "neutral",
    });
    setModelDialogMode("edit");
    setEditingModel(model);
    setModelDialogOpen(true);
  };

  const handleSaveModel = async () => {
    if (!selectedProvider) return;
    if (!modelForm.model_id || !modelForm.name) {
      toast.error("请填写模型ID和显示名称");
      return;
    }

    setSavingModel(true);
    try {
      // 创建时，id 等于 model_id
      const body = {
        ...modelForm,
        id: modelDialogMode === "create" ? modelForm.model_id : modelForm.id,
        provider_id: selectedProvider.id,
        duration: modelForm.duration ? parseInt(modelForm.duration) : null,
        speed: modelForm.speed ? parseFloat(modelForm.speed) : null,
      };

      if (modelDialogMode === "create") {
        const res = await fetch(`${API_BASE}/api/v3/models`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.detail || "创建失败");
        }
        toast.success("模型创建成功");
      } else {
        const res = await fetch(`${API_BASE}/api/v3/models/${editingModel?.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.detail || "更新失败");
        }
        toast.success("模型已更新");
      }

      setModelDialogOpen(false);
      await loadModels(selectedProvider.id);
    } catch (error: any) {
      toast.error(error.message || "保存失败");
    } finally {
      setSavingModel(false);
    }
  };

  const handleDeleteModel = async (model: Model) => {
    if (model.is_preset) {
      toast.error("预设模型不能删除");
      return;
    }
    if (!confirm(`确定要删除模型「${model.name}」吗？`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v3/models/${model.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("删除失败");

      toast.success("模型已删除");
      if (selectedProvider) {
        await loadModels(selectedProvider.id);
      }
    } catch (error) {
      toast.error("删除模型失败");
    }
  };

  const handleSaveProviderConfig = async () => {
    if (!selectedProvider) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v3/providers/${selectedProvider.id}/config`,
        {
          method: "POST",
          headers: getAuthHeaders(),
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
        `${API_BASE}/api/v3/providers/${selectedProvider.id}/test`,
        { 
          method: "POST",
          headers: getAuthHeaders(),
        }
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
      const res = await fetch(`${API_BASE}/api/v3/system/settings/${key}`, {
        method: "POST",
        headers: getAuthHeaders(),
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
        {!userConfig ? (
          <span className="text-xs text-muted-foreground italic">加载中...</span>
        ) : !userConfig.package_id ? (
          <span className="text-xs text-muted-foreground">未选择套餐</span>
        ) : (() => {
          const currentPackage = packages.find((p) => p.id === userConfig.package_id);
          if (currentPackage) {
            return (
              <Badge variant="secondary" className="justify-start">
                {currentPackage.icon} {currentPackage.name}
              </Badge>
            );
          } else {
            // 套餐ID存在但在列表中找不到（可能是被删除或数据不一致）
            return (
              <Badge variant="outline" className="justify-start text-orange-600 border-orange-200">
                ⚠️ 套餐未找到
              </Badge>
            );
          }
        })()}
      </div>

      {/* 工作区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          {/* 套餐选择 */}
          <TabsContent value="packages" className="h-full m-0">
            <div className="flex flex-col h-full">
              {/* 顶部工具栏 */}
              <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/20">
                <div>
                  <h2 className="text-lg font-semibold">选择套餐</h2>
                  <p className="text-sm text-muted-foreground">
                    一键配置所有服务的推荐组合，共 {packages.length} 个套餐
                  </p>
                </div>
                <div className="flex gap-2 pr-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartCreate}
                    title="创建自定义套餐"
                  >
                    <Plus className="mr-2" size={16} />
                    新建套餐
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadAllData}
                    disabled={loading}
                    title="刷新列表"
                  >
                    <RefreshCw
                      className={loading ? "animate-spin" : ""}
                      size={16}
                    />
                  </Button>
                </div>
              </div>

              {/* 主体：左右分栏 */}
              <div className="flex-1 flex overflow-hidden">
                {/* 左侧：套餐卡片列表 */}
                <div className={`${rightPanelMode !== "none" ? "flex-1" : "w-full"} p-4 overflow-auto transition-all`}>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                      <Loader2 className="animate-spin" />
                      <span className="text-sm text-muted-foreground">加载中...</span>
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${rightPanelMode !== "none" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"}`}>
                      {packages.map((pkg) => {
                        const status = packageConfigStatus[pkg.id];
                        const unconfiguredCount = status
                          ? Object.values(status.config_status).filter(v => !v).length
                          : 0;
                        const isSelected = selectedPackage?.id === pkg.id;
                        const isCurrent = userConfig?.package_id === pkg.id;
                        
                        return (
                          <Card
                            key={pkg.id}
                            onClick={() => handleViewPackage(pkg)}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              isCurrent
                                ? "border-primary ring-1 ring-primary"
                                : isSelected
                                ? "border-blue-400 ring-1 ring-blue-400"
                                : "hover:border-primary/50"
                            }`}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{pkg.icon}</span>
                                  <div>
                                    <CardTitle className="text-base">{pkg.name}</CardTitle>
                                    <CardDescription className="text-xs line-clamp-1">
                                      {pkg.description}
                                    </CardDescription>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {isCurrent && (
                                    <Badge variant="default" className="text-xs">当前</Badge>
                                  )}
                                  {!pkg.is_preset && (
                                    <Badge variant="outline" className="text-xs">自定义</Badge>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-1.5 mb-3">
                                {pkg.services.llm && (
                                  <ServiceRow
                                    icon={SERVICE_ICONS.llm}
                                    name={SERVICE_NAMES.llm}
                                    modelId={pkg.services.llm.model_id}
                                    allModels={allModels}
                                    configured={status?.config_status?.[pkg.services.llm.provider_id]}
                                  />
                                )}
                                {pkg.services.video && (
                                  <ServiceRow
                                    icon={SERVICE_ICONS.video}
                                    name={SERVICE_NAMES.video}
                                    modelId={pkg.services.video.model_id}
                                    allModels={allModels}
                                    configured={status?.config_status?.[pkg.services.video.provider_id]}
                                  />
                                )}
                                {pkg.services.image && (
                                  <ServiceRow
                                    icon={SERVICE_ICONS.image}
                                    name={SERVICE_NAMES.image}
                                    modelId={pkg.services.image.model_id}
                                    allModels={allModels}
                                    configured={status?.config_status?.[pkg.services.image.provider_id]}
                                  />
                                )}
                                {pkg.services.tts && (
                                  <ServiceRow
                                    icon={SERVICE_ICONS.tts}
                                    name={SERVICE_NAMES.tts}
                                    modelId={pkg.services.tts.model_id}
                                    allModels={allModels}
                                    configured={status?.config_status?.[pkg.services.tts.provider_id]}
                                  />
                                )}
                              </div>
                              
                              {/* 配置状态提示 */}
                              {unconfiguredCount > 0 && (
                                <div className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 p-1.5 rounded mb-2">
                                  <AlertCircle size={12} />
                                  <span>{unconfiguredCount} 个服务未配置API</span>
                                </div>
                              )}
                              
                              {/* 点击展开详情提示 */}
                              <div className="text-xs text-muted-foreground text-center py-1">
                                点击查看详情
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 右侧：详情/编辑面板 */}
                {rightPanelMode !== "none" && (
                  <div className="w-80 border-l bg-muted/10 overflow-auto">
                    {/* 详情模式 */}
                    {rightPanelMode === "detail" && selectedPackage && (
                      <div className="h-full flex flex-col">
                        <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
                          <h3 className="font-semibold text-sm">套餐详情</h3>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClosePanel}>
                            <X size={16} />
                          </Button>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-4">
                          <div className="text-center mb-4">
                            <div className="text-4xl mb-2">{selectedPackage.icon}</div>
                            <h4 className="font-semibold">{selectedPackage.name}</h4>
                            <p className="text-sm text-muted-foreground">{selectedPackage.description}</p>
                            {!selectedPackage.is_preset && (
                              <Badge variant="outline" className="mt-2">自定义套餐</Badge>
                            )}
                          </div>

                          <Separator className="my-4" />

                          {/* 服务配置 */}
                          <div className="space-y-3">
                            <h5 className="text-sm font-medium text-muted-foreground">服务配置</h5>
                            {selectedPackage.services.llm && (
                              <div className="bg-card p-2 rounded border">
                                <div className="flex items-center gap-2 text-sm">
                                  <span>{SERVICE_ICONS.llm}</span>
                                  <span className="text-muted-foreground">{SERVICE_NAMES.llm}</span>
                                </div>
                                <div className="text-sm font-medium ml-6">{selectedPackage.services.llm.provider_id}</div>
                                {selectedPackage.services.llm.model_id && (
                                  <div className="text-xs text-muted-foreground ml-6">{selectedPackage.services.llm.model_id}</div>
                                )}
                              </div>
                            )}
                            {selectedPackage.services.video && (
                              <div className="bg-card p-2 rounded border">
                                <div className="flex items-center gap-2 text-sm">
                                  <span>{SERVICE_ICONS.video}</span>
                                  <span className="text-muted-foreground">{SERVICE_NAMES.video}</span>
                                </div>
                                <div className="text-sm font-medium ml-6">{selectedPackage.services.video.provider_id}</div>
                                {selectedPackage.services.video.model_id && (
                                  <div className="text-xs text-muted-foreground ml-6">{selectedPackage.services.video.model_id}</div>
                                )}
                              </div>
                            )}
                            {selectedPackage.services.image && (
                              <div className="bg-card p-2 rounded border">
                                <div className="flex items-center gap-2 text-sm">
                                  <span>{SERVICE_ICONS.image}</span>
                                  <span className="text-muted-foreground">{SERVICE_NAMES.image}</span>
                                </div>
                                <div className="text-sm font-medium ml-6">{selectedPackage.services.image.provider_id}</div>
                              </div>
                            )}
                            {selectedPackage.services.tts && (
                              <div className="bg-card p-2 rounded border">
                                <div className="flex items-center gap-2 text-sm">
                                  <span>{SERVICE_ICONS.tts}</span>
                                  <span className="text-muted-foreground">{SERVICE_NAMES.tts}</span>
                                </div>
                                <div className="text-sm font-medium ml-6">{selectedPackage.services.tts.provider_id}</div>
                                {selectedPackage.services.tts.model_id && (
                                  <div className="text-xs text-muted-foreground ml-6">{selectedPackage.services.tts.model_id}</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 操作按钮 - 固定在底部 */}
                        <div className="p-4 border-t bg-muted/20 shrink-0 space-y-2">
                          <Button
                            className="w-full"
                            variant={userConfig?.package_id === selectedPackage.id ? "secondary" : "default"}
                            disabled={applyingPackage === selectedPackage.id || userConfig?.package_id === selectedPackage.id}
                            onClick={() => handleApplyPackage(selectedPackage)}
                          >
                            {applyingPackage === selectedPackage.id ? (
                              <>
                                <Loader2 className="mr-2 animate-spin" size={16} />
                                应用中...
                              </>
                            ) : userConfig?.package_id === selectedPackage.id ? (
                              "已应用"
                            ) : (
                              "应用此套餐"
                            )}
                          </Button>
                          
                          {!selectedPackage.is_preset && (
                            <>
                              <Button variant="outline" className="w-full" onClick={handleStartEdit}>
                                编辑套餐
                              </Button>
                              <Button 
                                variant="outline" 
                                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" 
                                onClick={() => handleDeletePackage(selectedPackage)}
                              >
                                <Trash2 size={16} className="mr-2" />
                                删除套餐
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 创建/编辑模式 */}
                    {(rightPanelMode === "create" || rightPanelMode === "edit") && (
                      <div className="h-full flex flex-col">
                        <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
                          <h3 className="font-semibold text-sm">
                            {rightPanelMode === "create" ? "新建套餐" : "编辑套餐"}
                          </h3>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClosePanel}>
                            <X size={16} />
                          </Button>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-4">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">套餐ID</Label>
                              <Input
                                size={1}
                                placeholder="如：my-package"
                                value={packageForm.id}
                                disabled={rightPanelMode === "edit"}
                                onChange={(e) => setPackageForm({ ...packageForm, id: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">套餐名称</Label>
                              <Input
                                placeholder="如：我的套餐"
                                value={packageForm.name}
                                onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">图标</Label>
                                <Input
                                  value={packageForm.icon}
                                  onChange={(e) => setPackageForm({ ...packageForm, icon: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">描述</Label>
                              <Input
                                placeholder="套餐描述"
                                value={packageForm.description}
                                onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                              />
                            </div>

                            <Separator className="my-2" />

                            {/* 文案大脑 - LLM */}
                            <div className="space-y-1">
                              <Label className="text-xs">文案大脑</Label>
                              <Select
                                value={packageForm.llm_model}
                                onValueChange={(v) => {
                                  const model = allModels.find(m => m.model_id === v);
                                  setPackageForm({
                                    ...packageForm,
                                    llm_provider: model?.provider_id || "",
                                    llm_model: v
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allModels
                                    .filter(m => m.model_type === "llm")
                                    .map(m => (
                                      <SelectItem key={m.id} value={m.model_id} className="text-xs">
                                        {m.provider_name} / {m.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 视频生成 */}
                            <div className="space-y-1">
                              <Label className="text-xs">视频生成</Label>
                              <Select
                                value={packageForm.video_model}
                                onValueChange={(v) => {
                                  const model = allModels.find(m => m.model_id === v);
                                  setPackageForm({
                                    ...packageForm,
                                    video_provider: model?.provider_id || "",
                                    video_model: v
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allModels
                                    .filter(m => m.model_type === "video")
                                    .map(m => (
                                      <SelectItem key={m.id} value={m.model_id} className="text-xs">
                                        {m.provider_name} / {m.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 图片生成 */}
                            <div className="space-y-1">
                              <Label className="text-xs">图片生成</Label>
                              <Select
                                value={packageForm.image_model}
                                onValueChange={(v) => {
                                  const model = allModels.find(m => m.model_id === v);
                                  setPackageForm({
                                    ...packageForm,
                                    image_provider: model?.provider_id || "",
                                    image_model: v
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allModels
                                    .filter(m => m.model_type === "image")
                                    .map(m => (
                                      <SelectItem key={m.id} value={m.model_id} className="text-xs">
                                        {m.provider_name} / {m.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 配音生成 */}
                            <div className="space-y-1">
                              <Label className="text-xs">配音生成</Label>
                              <Select
                                value={packageForm.tts_model}
                                onValueChange={(v) => {
                                  const model = allModels.find(m => m.model_id === v);
                                  setPackageForm({
                                    ...packageForm,
                                    tts_provider: model?.provider_id || "",
                                    tts_model: v
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="选择模型" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allModels
                                    .filter(m => m.model_type === "tts")
                                    .map(m => (
                                      <SelectItem key={m.id} value={m.model_id} className="text-xs">
                                        {m.provider_name} / {m.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* 底部固定按钮 */}
                        <div className="p-4 border-t bg-muted/20 shrink-0">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={handleClosePanel}
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={handleSavePackage}
                              disabled={savingPackage}
                            >
                              {savingPackage && <Loader2 className="mr-2 animate-spin" size={14} />}
                              保存
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 提供商配置 */}
          <TabsContent value="providers" className="h-full m-0">
            <div className="flex flex-col h-full">
              {/* 顶部工具栏 */}
              <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/20">
                <div>
                  <h2 className="text-lg font-semibold">配置提供商</h2>
                  <p className="text-sm text-muted-foreground">
                    管理 API Key 和自定义服务商，共 {providers.length} 个
                  </p>
                </div>
                <div className="flex gap-2 pr-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartCreateProvider}
                    title="创建新的 API 提供商"
                  >
                    <Plus className="mr-2" size={16} />
                    新建提供商
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadProviders}
                    disabled={loading}
                    title="刷新列表"
                  >
                    <RefreshCw
                      className={loading ? "animate-spin" : ""}
                      size={16}
                    />
                  </Button>
                </div>
              </div>

              {/* 主体：左右分栏 */}
              <div className="flex-1 flex overflow-hidden">
                {/* 左侧：提供商列表 */}
                <div className={`${providerPanelMode !== "none" ? "flex-1" : "w-full"} p-4 overflow-auto transition-all`}>
                  <div className={`grid gap-4 ${providerPanelMode !== "none" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"}`}>
                    {providers.map((provider) => {
                      const isSelected = selectedProvider?.id === provider.id;
                      return (
                        <Card
                          key={provider.id}
                          onClick={() => handleViewProvider(provider)}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            isSelected
                              ? "border-blue-400 ring-1 ring-blue-400"
                              : "hover:border-primary/50"
                          }`}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">{provider.name}</CardTitle>
                                <CardDescription className="text-xs line-clamp-1">
                                  {provider.description || "暂无描述"}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-1">
                                {provider.api_key_configured && (
                                  <span title="已配置 API Key">
                                    <Check size={14} className="text-green-600 dark:text-green-400" />
                                  </span>
                                )}
                                {provider.is_preset ? (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" title="系统预设提供商">系统预设</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs" title="用户自定义提供商">自定义</Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {provider.description}
                            </p>
                            <div className="text-xs text-muted-foreground">
                              Base URL: {provider.base_url || "默认"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              需要Secret: {provider.requires_secret ? "是" : "否"}
                            </div>
                            <div className="text-xs text-muted-foreground text-center mt-2">
                              点击查看详情
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* 右侧：详情/编辑/创建面板 */}
                {providerPanelMode !== "none" && (
                  <div className="w-80 border-l bg-muted/10 overflow-auto">
                    {/* 详情/编辑模式 */}
                    {(providerPanelMode === "detail" || providerPanelMode === "edit") && selectedProvider && (
                      <div className="h-full flex flex-col">
                        <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
                          <h3 className="font-semibold text-sm">
                            {providerPanelMode === "edit" ? "编辑提供商" : "提供商详情"}
                          </h3>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCloseProviderPanel}>
                            <X size={16} />
                          </Button>
                        </div>

                        <div className="flex-1 overflow-auto p-4">
                          {/* 基本信息（仅查看） */}
                          {providerPanelMode === "detail" && (
                            <div className="space-y-3 mb-4">
                              <div className="text-center">
                                <h4 className="font-semibold">{selectedProvider.name}</h4>
                                <div className="flex gap-1 justify-center mt-2">
                                  {selectedProvider.is_preset ? (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">系统预设</Badge>
                                  ) : (
                                    <Badge variant="outline">自定义提供商</Badge>
                                  )}
                                </div>
                              </div>
                              
                              <Separator />
                              
                              {/* 描述 */}
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">描述</Label>
                                <p className="text-sm">{selectedProvider.description || "-"}</p>
                              </div>
                              
                              {!selectedProvider.is_preset && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-2"
                                  onClick={handleStartEditProvider}
                                >
                                  编辑基本信息
                                </Button>
                              )}
                              
                              <Separator />
                            </div>
                          )}

                          {/* 编辑模式：基本信息表单 */}
                          {providerPanelMode === "edit" && (
                            <div className="space-y-3 mb-4">
                              <div className="space-y-1">
                                <Label className="text-xs">显示名称</Label>
                                <Input
                                  value={providerForm.name}
                                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">描述</Label>
                                <Input
                                  value={providerForm.description}
                                  onChange={(e) => setProviderForm({ ...providerForm, description: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Base URL</Label>
                                <Input
                                  value={providerForm.base_url}
                                  onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={providerForm.requires_secret}
                                  onCheckedChange={(checked) => setProviderForm({ ...providerForm, requires_secret: checked })}
                                />
                                <Label className="text-xs">需要 API Secret</Label>
                              </div>
                              
                              {/* 编辑模式下也显示 API Key/Secret 输入 */}
                              <div className="space-y-1 pt-2">
                                <Label className="text-xs">API Key（可选）</Label>
                                <Input
                                  type="password"
                                  placeholder="输入 API Key（留空保持不变）"
                                  value={providerForm.api_key}
                                  onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                                  data-1p-ignore
                                  data-bw-ignore
                                  data-lpignore="true"
                                />
                              </div>
                              {providerForm.requires_secret && (
                                <div className="space-y-1">
                                  <Label className="text-xs">API Secret（可选）</Label>
                                  <Input
                                    type="password"
                                    placeholder="输入 API Secret（留空保持不变）"
                                    value={providerForm.api_secret}
                                    onChange={(e) => setProviderForm({ ...providerForm, api_secret: e.target.value })}
                                    data-1p-ignore
                                    data-bw-ignore
                                    data-lpignore="true"
                                  />
                                </div>
                              )}
                              <Separator className="my-2" />
                            </div>
                          )}

                          {/* 配置表单 */}
                          <div className="space-y-4">
                            {providerPanelMode === "detail" && <Separator />}
                            
                            {/* API Key */}
                            <div className="space-y-2">
                              <Label className="text-xs">API Key</Label>
                              <div className="flex gap-2">
                                {showApiKey ? (
                                  <Input
                                    type="text"
                                    placeholder={selectedProvider.api_key_configured ? "已配置，留空保持不变" : "输入 API Key"}
                                    value={formData.api_key}
                                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                    data-1p-ignore
                                    data-bw-ignore
                                    data-lpignore="true"
                                    autoComplete="off"
                                  />
                                ) : (
                                  <Input
                                    type="password"
                                    placeholder={selectedProvider.api_key_configured ? "•••••••• (已配置)" : "输入 API Key"}
                                    value={formData.api_key}
                                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                    data-1p-ignore
                                    data-bw-ignore
                                    data-lpignore="true"
                                    autoComplete="off"
                                  />
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="shrink-0"
                                  title={showApiKey ? "隐藏密码" : "显示密码"}
                                  onClick={() => setShowApiKey(!showApiKey)}
                                >
                                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="shrink-0"
                                  title="测试连接"
                                  onClick={handleTestProvider}
                                  disabled={testing}
                                >
                                  {testing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                                </Button>
                              </div>
                              {selectedProvider.api_key_configured && (
                                <p className="text-xs text-muted-foreground">已配置，留空保持不变</p>
                              )}
                            </div>

                            {/* API Secret */}
                            {selectedProvider.requires_secret && (
                              <div className="space-y-2">
                                <Label className="text-xs">API Secret</Label>
                                <div className="flex gap-2">
                                  {showApiSecret ? (
                                    <Input
                                      type="text"
                                      placeholder={selectedProvider.api_secret_configured ? "请输入新的 API Secret（已配置）" : "输入 API Secret"}
                                      value={formData.api_secret}
                                      onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                                      data-1p-ignore
                                      data-bw-ignore
                                      data-lpignore="true"
                                      autoComplete="off"
                                    />
                                  ) : (
                                    <Input
                                      type="password"
                                      placeholder={selectedProvider.api_secret_configured ? "已配置（点击眼睛查看）" : "输入 API Secret"}
                                      value={formData.api_secret}
                                      onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                                      data-1p-ignore
                                      data-bw-ignore
                                      data-lpignore="true"
                                      autoComplete="off"
                                    />
                                  )}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    title={showApiSecret ? "隐藏密码" : "显示密码"}
                                    onClick={() => setShowApiSecret(!showApiSecret)}
                                  >
                                    {showApiSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </Button>
                                </div>
                                {selectedProvider.api_secret_configured && (
                                  <p className="text-xs text-muted-foreground">已配置，留空保持不变</p>
                                )}
                              </div>
                            )}

                            {/* Base URL - 只在详情模式下显示，编辑模式在上面已显示 */}
                            {providerPanelMode !== "edit" && (
                              <div className="space-y-2">
                                <Label className="text-xs">Base URL</Label>
                                <div className="text-sm px-3 py-2 bg-muted/50 rounded border text-muted-foreground">
                                  {selectedProvider.base_url || "使用系统默认值"}
                                </div>
                              </div>
                            )}

                            {/* 模型列表 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">可用模型</Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={handleStartCreateModel}
                                  title="添加自定义模型"
                                >
                                  <Plus size={12} className="mr-1" />
                                  新增
                                </Button>
                              </div>
                              {loadingModels ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="animate-spin" size={14} />
                                  加载中...
                                </div>
                              ) : models.length > 0 ? (
                                <div className="space-y-1">
                                  {models.map((model) => (
                                    <div key={model.id} className="flex items-center justify-between p-2 rounded bg-muted text-xs group">
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] font-medium">{model.name}</span>
                                          <span className="text-[10px] text-muted-foreground">({model.model_id})</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1" title="模型类型">
                                          {SERVICE_NAMES[model.model_type] || model.model_type}
                                        </Badge>
                                        {model.is_preset ? (
                                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-200" title="系统预设模型">预设</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] h-4 px-1" title="自定义模型">自定义</Badge>
                                        )}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {!model.is_preset && (
                                            <>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                title="编辑模型"
                                                onClick={() => handleStartEditModel(model)}
                                              >
                                                <Settings size={12} />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                title="删除模型"
                                                onClick={() => handleDeleteModel(model)}
                                              >
                                                <Trash2 size={12} />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">暂无模型数据</p>
                              )}
                            </div>

                            {/* 测试结果 */}
                            {testResult && (
                              <div className={`p-2 rounded flex items-center gap-2 border text-xs ${
                                testResult.success
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                              }`}>
                                {testResult.success ? <Check size={14} /> : <X size={14} />}
                                <span>{testResult.message}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 底部按钮 */}
                        <div className="p-4 border-t bg-muted/20 shrink-0 space-y-2">
                          {providerPanelMode === "edit" ? (
                            /* 编辑模式按钮 */
                            <>
                              <Button
                                className="w-full"
                                onClick={handleSaveProviderEdit}
                                disabled={savingProvider}
                              >
                                {savingProvider && <Loader2 className="mr-2 animate-spin" size={16} />}
                                保存修改
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setProviderPanelMode("detail")}
                              >
                                取消
                              </Button>
                            </>
                          ) : (
                            /* 详情模式按钮 */
                            <>
                              <Button
                                className="w-full"
                                onClick={handleSaveProviderConfig}
                                disabled={saving}
                              >
                                {saving && <Loader2 className="mr-2 animate-spin" size={16} />}
                                保存配置
                              </Button>
                              {!selectedProvider.is_preset && (
                                <Button
                                  variant="outline"
                                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={handleDeleteProvider}
                                >
                                  <Trash2 size={16} className="mr-2" />
                                  删除提供商
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 创建模式 */}
                    {providerPanelMode === "create" && (
                      <div className="h-full flex flex-col">
                        <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
                          <h3 className="font-semibold text-sm">新建提供商</h3>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCloseProviderPanel}>
                            <X size={16} />
                          </Button>
                        </div>

                        <div className="flex-1 overflow-auto p-4">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs">提供商ID</Label>
                              <Input
                                size={1}
                                placeholder="如：my-provider"
                                value={providerForm.id}
                                onChange={(e) => setProviderForm({ ...providerForm, id: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">显示名称</Label>
                              <Input
                                size={1}
                                placeholder="如：我的提供商"
                                value={providerForm.name}
                                onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">描述</Label>
                              <Input
                                size={1}
                                placeholder="提供商描述"
                                value={providerForm.description}
                                onChange={(e) => setProviderForm({ ...providerForm, description: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Base URL</Label>
                              <Input
                                size={1}
                                placeholder="https://api.example.com/v1"
                                value={providerForm.base_url}
                                onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={providerForm.requires_secret}
                                onCheckedChange={(checked) => setProviderForm({ ...providerForm, requires_secret: checked })}
                              />
                              <Label className="text-xs">需要 API Secret</Label>
                            </div>

                            {/* API Key */}
                            <div className="space-y-1">
                              <Label className="text-xs">API Key</Label>
                              <Input
                                size={1}
                                type="password"
                                placeholder="输入 API Key（可选）"
                                value={providerForm.api_key}
                                onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                                data-1p-ignore
                                data-bw-ignore
                                data-lpignore="true"
                              />
                            </div>

                            {/* API Secret（仅在需要时显示） */}
                            {providerForm.requires_secret && (
                              <div className="space-y-1">
                                <Label className="text-xs">API Secret</Label>
                                <Input
                                  size={1}
                                  type="password"
                                  placeholder="输入 API Secret（可选）"
                                  value={providerForm.api_secret}
                                  onChange={(e) => setProviderForm({ ...providerForm, api_secret: e.target.value })}
                                  data-1p-ignore
                                  data-bw-ignore
                                  data-lpignore="true"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 底部按钮 */}
                        <div className="p-4 border-t bg-muted/20 shrink-0">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={handleCloseProviderPanel}
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={handleSaveNewProvider}
                              disabled={savingProvider}
                            >
                              {savingProvider && <Loader2 className="mr-2 animate-spin" size={14} />}
                              创建
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

      {/* 模型创建/编辑弹窗 */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={() => setModelDropdownOpen(false)}>
          <DialogHeader>
            <DialogTitle className="text-base">
              {modelDialogMode === "create" ? "添加模型" : "编辑模型"}
            </DialogTitle>
            <DialogDescription>
              {modelDialogMode === "create" 
                ? "从API获取的模型列表中选择，或手动输入模型ID" 
                : "修改模型的显示名称和参数配置"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* 模型ID - 支持下拉选择和手动输入 */}
            <div className="space-y-1 relative">
              <div className="flex items-center justify-between">
                <Label className="text-xs">模型ID</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-[10px] text-muted-foreground"
                  onClick={() => loadAvailableModels(true)}
                  disabled={loadingModels}
                >
                  {loadingModels ? <Loader2 className="animate-spin" size={10} /> : <RefreshCw size={10} />}
                  <span className="ml-1">{availableModels.length > 0 ? "刷新" : "获取列表"}</span>
                </Button>
              </div>
              
              {modelDialogMode === "edit" ? (
                // 编辑模式只显示
                <div className="relative">
                  <Input
                    size={1}
                    value={modelForm.model_id}
                    disabled
                    className="pr-8"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <ChevronDown size={14} />
                  </div>
                </div>
              ) : (
                // 创建模式下拉选择 + 手动输入
                <div className="relative">
                  <Input
                    size={1}
                    placeholder={loadingModels ? "加载中..." : (availableModels.length > 0 ? "选择或输入模型ID" : "如：gpt-4-turbo")}
                    value={modelForm.model_id}
                    onChange={(e) => {
                      setModelForm({ ...modelForm, model_id: e.target.value });
                      setModelSearchQuery(e.target.value);
                    }}
                    onFocus={() => setModelDropdownOpen(true)}
                    disabled={loadingModels}
                    className="pr-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-8"
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    disabled={loadingModels}
                  >
                    {loadingModels ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <ChevronDown size={14} className={modelDropdownOpen ? "rotate-180" : ""} />
                    )}
                  </Button>
                  
                  {/* 下拉选项 */}
                  {modelDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                      {availableModels.length > 0 ? (
                        // 有数据时显示列表
                        availableModels
                          .filter(m => !modelSearchQuery || m.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                          .map((model) => (
                            <button
                              key={model}
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                              onClick={() => {
                                setModelForm({ ...modelForm, model_id: model });
                                setModelDropdownOpen(false);
                                setModelSearchQuery("");
                              }}
                            >
                              {model}
                            </button>
                          ))
                      ) : (
                        // 无数据时显示提示
                        <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                          {loadingModels ? "正在加载..." : "暂无可用模型，可直接输入"}
                        </div>
                      )}
                      {availableModels.length > 0 && availableModels.filter(m => !modelSearchQuery || m.toLowerCase().includes(modelSearchQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                          无匹配模型，可直接输入
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <p className="text-[10px] text-muted-foreground">
                {loadingModels 
                  ? "正在从API获取模型列表..." 
                  : availableModels.length > 0 
                    ? `从API获取到 ${availableModels.length} 个模型，支持选择或手动输入` 
                    : "调用API时使用的model参数，创建后不可修改（需先配置API Key才能自动获取模型列表）"
                }
              </p>
            </div>

            {/* 显示名称 */}
            <div className="space-y-1">
              <Label className="text-xs">显示名称</Label>
              <Input
                size={1}
                placeholder="如：GPT-4 Turbo"
                value={modelForm.name}
                onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
              />
            </div>

            <Separator className="my-2" />

            {/* 模型类型选择 */}
            <div className="space-y-1">
              <Label className="text-xs">模型类型</Label>
              <Select
                value={modelForm.model_type}
                onValueChange={(v) => setModelForm({ ...modelForm, model_type: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择模型类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llm" className="text-xs">文案大脑 (LLM)</SelectItem>
                  <SelectItem value="video" className="text-xs">视频生成</SelectItem>
                  <SelectItem value="image" className="text-xs">图片生成</SelectItem>
                  <SelectItem value="tts" className="text-xs">配音生成 (TTS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 类型特定参数 */}
            {modelForm.model_type === "video" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">时长（秒）</Label>
                  <Select
                    value={modelForm.duration}
                    onValueChange={(v) => setModelForm({ ...modelForm, duration: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="选择时长" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5" className="text-xs">5秒</SelectItem>
                      <SelectItem value="10" className="text-xs">10秒</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">比例</Label>
                  <Select
                    value={modelForm.ratio}
                    onValueChange={(v) => setModelForm({ ...modelForm, ratio: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="选择比例" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9" className="text-xs">16:9 (横屏)</SelectItem>
                      <SelectItem value="9:16" className="text-xs">9:16 (竖屏)</SelectItem>
                      <SelectItem value="1:1" className="text-xs">1:1 (方屏)</SelectItem>
                      <SelectItem value="4:3" className="text-xs">4:3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">质量</Label>
                  <Select
                    value={modelForm.quality}
                    onValueChange={(v) => setModelForm({ ...modelForm, quality: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="选择质量" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high" className="text-xs">高清</SelectItem>
                      <SelectItem value="medium" className="text-xs">标准</SelectItem>
                      <SelectItem value="low" className="text-xs">快速</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {modelForm.model_type === "image" && (
              <div className="space-y-1">
                <Label className="text-xs">输出分辨率</Label>
                <Select
                  value={modelForm.output_resolution}
                  onValueChange={(v) => setModelForm({ ...modelForm, output_resolution: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="选择分辨率" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1024x1024" className="text-xs">1024x1024</SelectItem>
                    <SelectItem value="1920x1080" className="text-xs">1920x1080</SelectItem>
                    <SelectItem value="2K" className="text-xs">2K</SelectItem>
                    <SelectItem value="4K" className="text-xs">4K</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {modelForm.model_type === "tts" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">声音</Label>
                  <Select
                    value={modelForm.voice}
                    onValueChange={(v) => setModelForm({ ...modelForm, voice: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="选择声音" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female-shaonv" className="text-xs">少女音</SelectItem>
                      <SelectItem value="female-chengshu" className="text-xs">成熟女声</SelectItem>
                      <SelectItem value="male-qingnian" className="text-xs">青年男声</SelectItem>
                      <SelectItem value="male-chenwen" className="text-xs">沉稳男声</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">语速</Label>
                  <Select
                    value={modelForm.speed}
                    onValueChange={(v) => setModelForm({ ...modelForm, speed: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="选择语速" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.8" className="text-xs">慢速 (0.8x)</SelectItem>
                      <SelectItem value="1.0" className="text-xs">正常 (1.0x)</SelectItem>
                      <SelectItem value="1.2" className="text-xs">快速 (1.2x)</SelectItem>
                      <SelectItem value="1.5" className="text-xs">超快 (1.5x)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">情绪</Label>
                  <Select
                    value={modelForm.emotion}
                    onValueChange={(v) => setModelForm({ ...modelForm, emotion: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="选择情绪" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neutral" className="text-xs">平静</SelectItem>
                      <SelectItem value="happy" className="text-xs">欢快</SelectItem>
                      <SelectItem value="sad" className="text-xs">悲伤</SelectItem>
                      <SelectItem value="angry" className="text-xs">愤怒</SelectItem>
                      <SelectItem value="excited" className="text-xs">兴奋</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {modelForm.model_type === "llm" && (
              <p className="text-xs text-muted-foreground">LLM模型无需额外参数</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModelDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSaveModel}
              disabled={savingModel}
            >
              {savingModel && <Loader2 className="mr-2 animate-spin" size={14} />}
              {modelDialogMode === "create" ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function ServiceRow({
  icon,
  name,
  modelId,
  allModels,
  configured,
}: {
  icon: string;
  name: string;
  modelId: string;
  allModels: Array<{ model_id: string; provider_name?: string; name?: string }>;
  configured?: boolean;
}) {
  const model = allModels.find(m => m.model_id === modelId);
  const modelDisplay = model ? `${model.provider_name || ''} / ${model.name || ''}` : modelId;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{icon}</span>
      <span className="text-muted-foreground">{name}</span>
      <span className="font-medium truncate flex-1" title={modelDisplay}>{modelDisplay}</span>
      {configured !== undefined && (
        configured ? (
          <span title="已配置 API Key" className="flex-shrink-0"><Check size={14} className="text-green-600 dark:text-green-400" /></span>
        ) : (
          <span title="未配置 API Key" className="flex-shrink-0"><AlertCircle size={14} className="text-yellow-600 dark:text-yellow-400" /></span>
        )
      )}
    </div>
  );
}
