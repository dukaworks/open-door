# 噼哩噼哩 Pilipili-AutoVideo 统一 API 代理平台支持

## 文档信息

- **文档编号**: DEV-DOC-004
- **版本**: 1.0
- **创建日期**: 2026-03-26
- **项目**: Pilipili-AutoVideo
- **类型**: 架构升级文档

---

## 1. 背景与动机

### 1.1 当前问题

当前版本中，各 API 服务直接调用：

```python
# LLM 直接调用
# modules/llm.py
client = AsyncOpenAI(
    api_key=config.llm.deepseek.api_key,
    base_url="https://api.deepseek.com/v1"
)

# 图像生成直接调用
# modules/image_gen.py
client = genai.Client(api_key=config.image_gen.api_key)

# 视频生成直接调用
# modules/video_gen.py
token = _generate_kling_jwt(api_key, api_secret)
```

**问题**：
- **API 密钥分散**：每个服务需要单独配置 API Key
- **缺乏统一计费**：无法统计整体 API 消费
- **无备份机制**：某个 API 不可用时无法自动切换
- **缺乏请求控制**：无法统一限流、监控
- **部署复杂**：需要为不同服务配置不同的网络策略

### 1.2 解决方案：统一 API 代理层

引入统一 API 代理层（类似 OpenRouter 的模式），将所有外部 API 调用通过统一的代理服务：

```
用户请求 → 代理层 → 目标 API
         ← 返回响应 ←
```

**优势**：
- **统一入口**：只需配置代理 API Key
- **自动路由**：根据模型名称自动转发到目标服务
- **故障转移**：主服务不可用时自动切换备份
- **统一计费**：所有请求统一统计
- **请求控制**：统一限流、监控、日志

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Pilipili-AutoVideo                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │ LLM 模块        │  │ ImageGen 模块   │  │ VideoGen 模块  │   │
│  │ modules/llm.py  │  │image_gen.py     │  │ video_gen.py   │   │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘   │
│           │                   │                   │             │
│           ▼                   ▼                   ▼             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                   API Proxy 客户端层                         │  │
│  │                   modules/proxy/client.py                   │  │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐    │  │
│  │  │ LLM Proxy      │ │ Image Proxy   │ │ Video Proxy   │    │  │
│  │  │ (OpenAI兼容)   │ │ (多Provider)  │ │ (多Provider)  │    │  │
│  │  └───────────────┘ └───────────────┘ └───────────────┘    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                │                                    │
│                                ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                   Proxy 路由层                               │  │
│  │                   modules/proxy/router.py                   │  │
│  │  - 路由决策（根据 model name）                                 │  │
│  │  - 故障转移（自动切换）                                       │  │
│  │  - 限流控制                                                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                │                                    │
│                                ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                   统一 API 网关                              │  │
│  │  (OpenRouter / 自建网关 / 云厂商 API 网关)                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                │                                    │
│                                ▼                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ DeepSeek │ │  Gemini  │ │  Kling   │ │MiniMax   │            │
│  │   API    │ │   API    │ │   API    │ │   API    │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块结构

```
modules/proxy/
├── __init__.py
├── client.py          # 统一客户端接口
├── router.py          # 路由决策逻辑
├── fallback.py        # 故障转移机制
├── limiter.py         # 限流控制
├── registry.py        # 服务/模型注册表
└── types.py           # 数据类型定义
```

---

## 3. 核心实现

### 3.1 类型定义

```python
# modules/proxy/types.py

from dataclasses import dataclass, field
from typing import Optional, Literal
from enum import Enum

class ServiceType(str, Enum):
    LLM = "llm"
    IMAGE = "image"
    VIDEO = "video"
    TTS = "tts"

@dataclass
class ProviderConfig:
    """服务提供商配置"""
    name: str
    service_type: ServiceType
    base_url: str
    api_key: str
    api_secret: Optional[str] = None
    model_mapping: dict[str, str] = field(default_factory=dict)  # 内部模型名 → API 模型名
    is_default: bool = False

@dataclass
class ProxyConfig:
    """代理层配置"""
    enabled: bool = False
    provider: str = "openrouter"  # openrouter | custom | direct
    
    # OpenRouter 配置
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_extra_headers: dict = field(default_factory=dict)
    
    # 自建网关配置
    custom_gateway_url: str = ""
    custom_gateway_auth_header: str = "Authorization"
    
    # 直接调用配置（fallback）
    direct_providers: list[ProviderConfig] = field(default_factory=list)

@dataclass
class ProxyRequest:
    """代理请求"""
    service_type: ServiceType
    model: str                    # 内部模型名
    messages: Optional[list] = None
    prompt: Optional[str] = None
    image_data: Optional[str] = None
    extra_params: dict = field(default_factory=dict)

@dataclass
class ProxyResponse:
    """代理响应"""
    success: bool
    data: Any = None
    error: str = ""
    provider: str = ""             # 实际调用的 provider
    model: str = ""               # 实际使用的模型
    usage: Optional[dict] = None  # token 使用统计
```

### 3.2 服务注册表

```python
# modules/proxy/registry.py

class ModelRegistry:
    """模型注册表 - 维护内部模型名到实际 API 的映射"""
    
    # 内置模型映射
    MODEL_MAPPING = {
        # LLM
        "deepseek-chat": {
            "provider": "deepseek",
            "model": "deepseek-chat",
            "service": ServiceType.LLM,
            "supports_streaming": True,
        },
        "deepseek-coder": {
            "provider": "deepseek",
            "model": "deepseek-coder",
            "service": ServiceType.LLM,
        },
        "kimi-k32k": {
            "provider": "kimi",
            "model": "moonshot-v1-32k",
            "service": ServiceType.LLM,
        },
        "gpt-4o": {
            "provider": "openai",
            "model": "gpt-4o",
            "service": ServiceType.LLM,
            "route_through_proxy": True,  # 通过代理
        },
        "gemini-pro": {
            "provider": "google",
            "model": "gemini-pro",
            "service": ServiceType.LLM,
        },
        
        # 图像生成
        "gemini-image": {
            "provider": "google",
            "model": "gemini-2.5-flash-image",
            "service": ServiceType.IMAGE,
        },
        "dall-e-3": {
            "provider": "openai",
            "model": "dall-e-3",
            "service": ServiceType.IMAGE,
            "route_through_proxy": True,
        },
        
        # 视频生成
        "kling-v3": {
            "provider": "kling",
            "model": "kling-v3",
            "service": ServiceType.VIDEO,
        },
        "seedance-1.5": {
            "provider": "volcengine",
            "model": "doubao-seedance-1-5-pro-250528",
            "service": ServiceType.VIDEO,
        },
        
        # TTS
        "minimax-tts": {
            "provider": "minimax",
            "model": "speech-02-hd",
            "service": ServiceType.TTS,
        },
    }
    
    @classmethod
    def resolve(cls, internal_model: str) -> dict:
        """解析内部模型名到实际配置"""
        return cls.MODEL_MAPPING.get(internal_model, {
            "provider": "unknown",
            "model": internal_model,
        })
    
    @classmethod
    def get_all_models(cls, service_type: ServiceType = None) -> list[str]:
        """获取所有可用模型"""
        if service_type:
            return [
                name for name, cfg in cls.MODEL_MAPPING.items()
                if cfg.get("service") == service_type
            ]
        return list(cls.MODEL_MAPPING.keys())
```

### 3.3 代理路由器

```python
# modules/proxy/router.py

from typing import Optional
from modules.proxy.types import ServiceType, ProxyConfig, ProxyRequest
from modules.proxy.registry import ModelRegistry
from modules.proxy.fallback import FallbackManager
from modules.proxy.limiter import RateLimiter

class ProxyRouter:
    """API 代理路由器"""
    
    def __init__(self, config: ProxyConfig, limiter: RateLimiter):
        self.config = config
        self.limiter = limiter
        self.fallback_manager = FallbackManager()
    
    async def route(self, request: ProxyRequest) -> ProxyResponse:
        """
        路由决策流程：
        1. 解析模型配置
        2. 检查限流
        3. 选择调用策略（直接/代理/fallback）
        4. 执行请求
        """
        
        # 1. 解析模型配置
        model_config = ModelRegistry.resolve(request.model)
        
        # 2. 检查限流
        if not await self.limiter.check_limit(request.service_type, model_config["provider"]):
            return ProxyResponse(
                success=False,
                error="Rate limit exceeded"
            )
        
        # 3. 决定调用策略
        if self.config.enabled and model_config.get("route_through_proxy"):
            return await self._route_via_proxy(request, model_config)
        else:
            return await self._route_direct(request, model_config)
    
    async def _route_via_proxy(self, request: ProxyRequest, model_config: dict) -> ProxyResponse:
        """通过代理层路由"""
        
        if self.config.provider == "openrouter":
            return await self._route_openrouter(request, model_config)
        elif self.config.provider == "custom":
            return await self._route_custom_gateway(request, model_config)
        else:
            # 配置错误，回退到直接调用
            return await self._route_direct(request, model_config)
    
    async def _route_openrouter(self, request: ProxyRequest, model_config: dict) -> ProxyResponse:
        """通过 OpenRouter 路由"""
        
        import aiohttp
        
        # OpenRouter 使用 OpenAI 兼容接口
        url = f"{self.config.openrouter_base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.config.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://pilipili.video",
            "X-Title": "Pilipili-AutoVideo",
            **self.config.openrouter_extra_headers,
        }
        
        # 映射模型名
        target_model = model_config["model"]
        # OpenRouter 模型名格式：provider/model
        openrouter_model = f"{model_config['provider']}/{target_model}"
        
        payload = {
            "model": openrouter_model,
            "messages": request.messages,
            **request.extra_params,
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    return ProxyResponse(
                        success=True,
                        data=result,
                        provider="openrouter",
                        model=openrouter_model,
                        usage=result.get("usage"),
                    )
                else:
                    error = await resp.text()
                    # 触发 fallback
                    return await self.fallback_manager.fallback(
                        request, model_config, error
                    )
    
    async def _route_direct(self, request: ProxyRequest, model_config: dict) -> ProxyResponse:
        """直接调用目标 API（作为 fallback）"""
        
        provider = model_config["provider"]
        
        if provider == "deepseek":
            return await self._call_deepseek(request, model_config)
        elif provider == "google":
            return await self._call_google(request, model_config)
        elif provider == "kling":
            return await self._call_kling(request, model_config)
        elif provider == "minimax":
            return await self._call_minimax(request, model_config)
        else:
            return ProxyResponse(
                success=False,
                error=f"Unknown provider: {provider}"
            )
```

### 3.4 故障转移管理器

```python
# modules/proxy/fallback.py

class FallbackManager:
    """故障转移管理器"""
    
    # 故障转移优先级
    FALLBACK_CHAIN = {
        "gpt-4o": ["claude-3-opus", "gemini-pro", "deepseek-chat"],
        "gemini-pro": ["gpt-4o", "claude-3-opus"],
        "kling-v3": ["seedance-1.5", "runway-gen2"],
        "dall-e-3": ["midjourney", "stable-diffusion"],
    }
    
    async def fallback(
        self, 
        request: ProxyRequest, 
        model_config: dict, 
        error: str
    ) -> ProxyResponse:
        """故障转移：尝试备用模型"""
        
        current_model = request.model
        fallback_models = self.FALLBACK_CHAIN.get(current_model, [])
        
        if not fallback_models:
            return ProxyResponse(
                success=False,
                error=f"All providers failed. Last error: {error}"
            )
        
        # 尝试 fallback
        for fallback_model in fallback_models:
            fallback_config = ModelRegistry.resolve(fallback_model)
            fallback_config["route_through_proxy"] = False  # 跳过代理
            
            # 递归尝试（但限制深度）
            try:
                # 调用 fallback
                result = await self._attempt_request(request, fallback_config)
                return result
            except Exception as e:
                # 继续下一个 fallback
                continue
        
        return ProxyResponse(
            success=False,
            error="All fallback models failed"
        )
    
    async def _attempt_request(
        self, 
        request: ProxyRequest, 
        config: dict
    ) -> ProxyResponse:
        """尝试单个请求"""
        # 实现实际的 API 调用
        ...
```

### 3.5 限流器

```python
# modules/proxy/limiter.py

import time
from collections import defaultdict
from dataclasses import dataclass

@dataclass
class RateLimit:
    requests_per_minute: int = 60
    requests_per_day: int = 10000

class RateLimiter:
    """速率限制器"""
    
    # 默认限制
    DEFAULT_LIMITS = {
        "llm": RateLimit(requests_per_minute=60, requests_per_day=10000),
        "image": RateLimit(requests_per_minute=30, requests_per_day=1000),
        "video": RateLimit(requests_per_minute=10, requests_per_day=100),
        "tts": RateLimit(requests_per_minute=60, requests_per_day=5000),
    }
    
    def __init__(self, custom_limits: dict = None):
        self.limits = {**self.DEFAULT_LIMITS}
        if custom_limits:
            self.limits.update(custom_limits)
        
        # 计数器
        self.minute_counters: dict[str, list[float]] = defaultdict(list)
        self.day_counters: dict[str, list[float]] = defaultdict(list)
    
    async def check_limit(self, service_type: str, provider: str) -> bool:
        """检查是否超过限制"""
        key = f"{service_type}:{provider}"
        limit = self.limits.get(service_type, RateLimit())
        
        now = time.time()
        
        # 清理过期计数
        self.minute_counters[key] = [
            t for t in self.minute_counters[key] 
            if now - t < 60
        ]
        self.day_counters[key] = [
            t for t in self.day_counters[key] 
            if now - t < 86400
        ]
        
        # 检查限制
        if len(self.minute_counters[key]) >= limit.requests_per_minute:
            return False
        if len(self.day_counters[key]) >= limit.requests_per_day:
            return False
        
        # 记录请求
        self.minute_counters[key].append(now)
        self.day_counters[key].append(now)
        
        return True
    
    def get_usage(self, service_type: str, provider: str) -> dict:
        """获取当前使用量"""
        key = f"{service_type}:{provider}"
        limit = self.limits.get(service_type, RateLimit())
        
        return {
            "minute_requests": len(self.minute_counters[key]),
            "minute_limit": limit.requests_per_minute,
            "day_requests": len(self.day_counters[key]),
            "day_limit": limit.requests_per_day,
        }
```

### 3.6 统一客户端

```python
# modules/proxy/client.py

from modules.proxy.types import (
    ProxyConfig, ServiceType, ProxyRequest, ProxyResponse
)
from modules.proxy.router import ProxyRouter
from modules.proxy.limiter import RateLimiter

class UnifiedAPIClient:
    """统一 API 客户端 - 所有外部调用的入口"""
    
    def __init__(self, config: ProxyConfig):
        self.config = config
        self.limiter = RateLimiter()
        self.router = ProxyRouter(config, self.limiter)
    
    async def chat_completion(
        self,
        model: str,
        messages: list,
        **kwargs
    ) -> ProxyResponse:
        """LLM Chat Completion"""
        
        request = ProxyRequest(
            service_type=ServiceType.LLM,
            model=model,
            messages=messages,
            extra_params=kwargs,
        )
        
        return await self.router.route(request)
    
    async def generate_image(
        self,
        model: str,
        prompt: str,
        **kwargs
    ) -> ProxyResponse:
        """图像生成"""
        
        request = ProxyRequest(
            service_type=ServiceType.IMAGE,
            model=model,
            prompt=prompt,
            extra_params=kwargs,
        )
        
        return await self.router.route(request)
    
    async def generate_video(
        self,
        model: str,
        prompt: str,
        image_data: str = None,
        **kwargs
    ) -> ProxyResponse:
        """视频生成"""
        
        request = ProxyRequest(
            service_type=ServiceType.VIDEO,
            model=model,
            prompt=prompt,
            image_data=image_data,
            extra_params=kwargs,
        )
        
        return await self.router.route(request)
    
    async def text_to_speech(
        self,
        model: str,
        text: str,
        **kwargs
    ) -> ProxyResponse:
        """TTS"""
        
        request = ProxyRequest(
            service_type=ServiceType.TTS,
            model=model,
            prompt=text,  # 文本内容
            extra_params=kwargs,
        )
        
        return await self.router.route(request)
```

---

## 4. 配置更新

### 4.1 新增配置项

```yaml
# configs/config.yaml

# ============================================================
# 统一 API 代理配置 (新增)
# ============================================================
proxy:
  enabled: false  # 是否启用代理
  
  # 代理类型：openrouter / custom / direct
  provider: "openrouter"
  
  # OpenRouter 配置
  openrouter:
    api_key: "YOUR_OPENROUTER_API_KEY"
    base_url: "https://openrouter.ai/api/v1"
    # 额外 headers
    extra_headers:
      HTTP-Referer: "https://pilipili.video"
      X-Title: "Pilipili-AutoVideo"
  
  # 自建网关配置
  custom_gateway:
    url: "https://api-gateway.yourcompany.com/v1"
    auth_header: "Authorization"  # 或 "X-API-Key"
    auth_value: "Bearer YOUR_GATEWAY_KEY"
  
  # 直接调用配置（fallback 模式）
  direct_providers:
    - name: "deepseek"
      base_url: "https://api.deepseek.com/v1"
      api_key: "YOUR_DEEPSEEK_KEY"
    
    - name: "google"
      base_url: "https://generativelanguage.googleapis.com/v1beta"
      api_key: "YOUR_GEMINI_KEY"
    
    - name: "kling"
      base_url: "https://api.klingai.com"
      api_key: "YOUR_KLING_KEY"
      api_secret: "YOUR_KLING_SECRET"
    
    - name: "minimax"
      base_url: "https://api.minimax.chat/v1"
      api_key: "YOUR_MINIMAX_KEY"

# 限流配置
rate_limits:
  llm:
    requests_per_minute: 60
    requests_per_day: 10000
  image:
    requests_per_minute: 30
    requests_per_day: 1000
  video:
    requests_per_minute: 10
    requests_per_day: 100
  tts:
    requests_per_minute: 60
    requests_per_day: 5000
```

### 4.2 配置类

```python
# core/config.py

@dataclass
class ProxyProviderConfig:
    name: str = ""
    base_url: str = ""
    api_key: str = ""
    api_secret: str = ""

@dataclass
class ProxyConfig:
    enabled: bool = False
    provider: str = "openrouter"  # openrouter / custom / direct
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_extra_headers: dict = field(default_factory=dict)
    custom_gateway_url: str = ""
    custom_gateway_auth_value: str = ""
    direct_providers: list[ProxyProviderConfig] = field(default_factory=list)

@dataclass
class RateLimitConfig:
    requests_per_minute: int = 60
    requests_per_day: int = 10000

# 更新主配置
@dataclass
class PilipiliConfig:
    # ... 现有字段
    proxy: ProxyConfig = field(default_factory=ProxyConfig)
    rate_limits: dict[str, RateLimitConfig] = field(default_factory=dict)
```

---

## 5. 模块集成

### 5.1 LLM 模块集成

```python
# modules/llm.py - 修改

from modules.proxy.client import UnifiedAPIClient

async def generate_script(
    topic: str,
    style: Optional[str] = None,
    config: PilipiliConfig = None,
    verbose: bool = False,
) -> VideoScript:
    
    if config is None:
        config = get_config()
    
    # 使用统一客户端
    client = UnifiedAPIClient(config.proxy) if config.proxy.enabled else None
    
    if client:
        # 通过代理调用
        response = await client.chat_completion(
            model=config.llm.default_provider,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
        )
        
        if not response.success:
            raise RuntimeError(f"LLM 调用失败: {response.error}")
        
        raw_script = response.data["choices"][0]["message"]["content"]
    else:
        # 直接调用（向后兼容）
        client, model = _build_openai_client(config)
        response = await client.chat.completions.create(...)
        raw_script = response.choices[0].message.content
    
    # ... 后续处理不变
```

### 5.2 图像生成模块集成

```python
# modules/image_gen.py - 修改

from modules.proxy.client import UnifiedAPIClient

async def generate_keyframe(scene, output_dir, config, verbose):
    
    if config.proxy.enabled:
        client = UnifiedAPIClient(config.proxy)
        
        # 通过代理生成图像
        response = await client.generate_image(
            model="gemini-image",  # 内部模型名
            prompt=full_prompt,
            reference_images=reference_images,
        )
        
        if response.success:
            # 处理返回的图像
            img_data = response.data["images"][0]["b64_json"]
            ...
        else:
            raise RuntimeError(f"图像生成失败: {response.error}")
    
    # 保留原有直接调用逻辑作为 fallback
    ...
```

---

## 6. OpenRouter 集成详解

### 6.1 支持的模型

OpenRouter 支持的模型映射到 Pilipili：

```python
# modules/proxy/openrouter_models.py

OPENROUTER_MODELS = {
    # LLM
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-4-turbo": "openai/gpt-4-turbo",
    "claude-3-opus": "anthropic/claude-3-opus",
    "claude-3-sonnet": "anthropic/claude-3-sonnet",
    "claude-3-haiku": "anthropic/claude-3-haiku",
    "gemini-pro": "google/gemini-pro",
    "llama-3-70b": "meta-llama/llama-3-70b",
    "llama-3-8b": "meta-llama/llama-3-8b",
    "mixtral-8x7b": "mistralai/mixtral-8x7b",
    
    # 图像生成
    "dall-e-3": "openai/dall-e-3",
    "stable-diffusion": "stabilityai/stable-diffusion-3",
    
    # 语音
    "tts-1": "openai/tts-1",
}
```

### 6.2 请求示例

```python
# 请求 OpenRouter

import aiohttp

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": "Bearer YOUR_OPENROUTER_KEY",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://pilipili.video",
    "X-Title": "Pilipili-AutoVideo",
}
payload = {
    "model": "openai/gpt-4o",
    "messages": [
        {"role": "user", "content": "写一个关于赛博朋克的短视频脚本"}
    ],
    "temperature": 0.7,
}

async with aiohttp.ClientSession() as session:
    async with session.post(url, json=payload, headers=headers) as resp:
        result = await resp.json()
        print(result)
```

### 6.3 响应格式

```json
{
  "id": "gen-xxxxx",
  "provider": "OpenAI",
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "这里是生成的脚本..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

---

## 7. 自建网关支持

### 7.1 场景

如果用户有自己的 API 网关（自建或使用云厂商 API 网关），可以直接配置：

```yaml
proxy:
  enabled: true
  provider: "custom"
  custom_gateway:
    url: "https://api-gateway.internal.company.com/v1"
    auth_header: "X-API-Key"
    auth_value: "your-secret-key"
```

### 7.2 实现

```python
async def _route_custom_gateway(self, request: ProxyRequest, model_config: dict) -> ProxyResponse:
    """通过自定义网关路由"""
    
    import aiohttp
    
    url = f"{self.config.custom_gateway_url}/{request.service_type.value}/completions"
    
    headers = {
        self.config.custom_gateway_auth_header: self.config.custom_gateway_auth_value,
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": model_config["model"],
        "messages": request.messages,
        **request.extra_params,
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status == 200:
                result = await resp.json()
                return ProxyResponse(
                    success=True,
                    data=result,
                    provider="custom_gateway",
                    model=model_config["model"],
                )
            else:
                error = await resp.text()
                return ProxyResponse(
                    success=False,
                    error=f"Gateway error: {error}"
                )
```

---

## 8. 监控与统计

### 8.1 使用统计

```python
# modules/proxy/stats.py

from dataclasses import dataclass
from datetime import datetime

@dataclass
class UsageStats:
    """使用统计"""
    date: str  # YYYY-MM-DD
    provider: str
    model: str
    service_type: str
    requests_count: int = 0
    total_tokens: int = 0
    total_cost_usd: float = 0.0

class UsageTracker:
    """使用量追踪器"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    async def record_usage(self, response: ProxyResponse):
        """记录单次使用"""
        
        if not response.success:
            return
        
        usage_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "provider": response.provider,
            "model": response.model,
            "service_type": self._get_service_type(response.model),
            "requests_count": 1,
            "total_tokens": response.usage.get("total_tokens", 0) if response.usage else 0,
        }
        
        # 写入 SQLite
        ...
    
    def get_daily_summary(self, date: str, user_id: str = None) -> dict:
        """获取每日汇总"""
        ...
    
    def get_monthly_cost(self, year: int, month: int) -> float:
        """获取月度费用"""
        ...
```

### 8.2 API 端点

```python
# api/stats.py

@app.get("/api/stats/usage")
async def get_usage_stats(
    start_date: str,
    end_date: str,
    current_user: TokenData = Depends(get_current_user)
):
    """获取使用统计"""
    
    tracker = UsageTracker(config.proxy.db_path)
    
    return await tracker.get_summary(
        start_date=start_date,
        end_date=end_date,
        user_id=current_user.user_id
    )


@app.get("/api/stats/cost")
async def get_cost_summary(
    period: str = "month",  # day / month / year
    current_user: TokenData = Depends(get_current_user)
):
    """获取费用汇总"""
    
    tracker = UsageTracker(config.proxy.db_path)
    
    if period == "day":
        return {"daily_cost": tracker.get_daily_cost(datetime.now().date())}
    elif period == "month":
        return {"monthly_cost": tracker.get_monthly_cost(2026, 3)}
    else:
        return {"yearly_cost": tracker.get_yearly_cost(2026)}
```

---

## 9. 安全考虑

### 9.1 API Key 安全

- **加密存储**：用户 API Key 加密存储
- **不记录日志**：请求日志中不记录 Key
- **定期轮换**：支持 API Key 更新

### 9.2 网络安全

- **HTTPS**：强制使用 HTTPS
- **IP 白名单**：支持配置 IP 白名单
- **请求来源验证**：通过 HTTP-Referer 验证

### 9.3 限流保护

- **多层次限流**：每服务、每用户、整体
- **智能限流**：根据账户等级动态调整

---

## 10. 使用示例

### 10.1 配置 OpenRouter

```yaml
# configs/config.yaml

proxy:
  enabled: true
  provider: "openrouter"
  openrouter:
    api_key: "sk-or-v1-xxxxx"
```

### 10.2 配置自建网关

```yaml
proxy:
  enabled: true
  provider: "custom"
  custom_gateway:
    url: "https://api.yourcompany.com/v1"
    auth_header: "X-API-Key"
    auth_value: "your-key"
  direct_providers:
    - name: "kling"
      base_url: "https://api.klingai.com"
      api_key: "kling-key"
      api_secret: "kling-secret"
```

### 10.3 直接模式（不启用代理）

```yaml
proxy:
  enabled: false
  direct_providers:
    - name: "deepseek"
      api_key: "sk-xxx"
    - name: "google"
      api_key: "AIza-xxx"
```

---

## 11. 向后兼容性

### 11.1 渐进式迁移

1. **Phase 1**：添加配置项，默认不启用
2. **Phase 2**：实现代理层，但保持原有直接调用
3. **Phase 3**：用户可选择启用代理
4. **Phase 4**：默认使用代理，失败时回退到直接调用

### 11.2 平滑切换

```python
# 切换策略
if config.proxy.enabled:
    # 使用代理
    client = UnifiedAPIClient(config.proxy)
    result = await client.chat_completion(...)
    
    if not result.success:
        # 代理失败，回退到直接调用
        logger.warning(f"代理调用失败，回退到直接调用: {result.error}")
        result = await _call_direct_llm(...)
else:
    # 不启用代理，直接调用
    result = await _call_direct_llm(...)
```

---

## 12. 总结

统一 API 代理层为 Pilipili-AutoVideo 带来了：

| 特性 | 价值 |
|------|------|
| **统一入口** | 只配一个 API Key |
| **自动路由** | 根据模型名自动转发 |
| **故障转移** | 主服务不可用时自动切换 |
| **统一计费** | 所有请求统一统计 |
| **限流保护** | 防止 API 滥用 |
| **灵活部署** | 支持 OpenRouter / 自建网关 / 直接调用 |

**实现要点**：

1. **ModelRegistry**：维护内部模型名到实际 API 的映射
2. **ProxyRouter**：根据配置和模型决定调用路径
3. **FallbackManager**：故障时自动切换备用模型
4. **RateLimiter**：多层次限流保护
5. **UnifiedAPIClient**：统一的 API 调用入口

---

*文档版本: 1.0 | 最后更新: 2026-03-26*