# Pilipili-AutoVideo OpenRouter 统一 API 代理支持方案

## 一、OpenRouter 概述

### 1.1 什么是 OpenRouter？

**OpenRouter** 是一个统一的 AI API 代理平台，提供以下核心功能：

1. **统一接口**: 一个 API Key 访问所有主流 LLM
2. **智能路由**: 自动选择最优模型和提供商
3. **成本优化**: 自动选择性价比最高的方案
4. **透明定价**: 所有模型价格公开透明
5. **无供应商锁定**: 随时切换模型和提供商

### 1.2 支持的模型

OpenRouter 支持 100+ 模型，包括：

| 类别 | 模型示例 |
|------|----------|
| **LLM** | GPT-4, Claude 3, Gemini 1.5, Llama 3, Mixtral, Qwen 2.5 |
| **图像生成** | DALL-E 3, Stable Diffusion XL, Midjourney (部分) |
| **视频生成** | Runway Gen-2, Pika, Sora (部分) |
| **音频生成** | ElevenLabs, OpenAI TTS |

### 1.3 核心优势

1. **一个 Key 走天下**: 不需要为每个模型单独申请 API Key
2. **自动故障转移**: 某个提供商故障时自动切换
3. **成本透明**: 实时查询模型价格，避免超支
4. **灵活切换**: 代码无需修改，配置文件切换模型

---

## 二、改造目标

### 2.1 当前架构问题

#### 现有架构的痛点

1. **API Key 管理复杂**
   ```yaml
   # 需要为每个服务商单独申请 Key
   llm:
     deepseek:
       api_key: "sk-xxxxx"
     kimi:
       api_key: "xxxxx"
     minimax:
       api_key: "xxxxx"

   image_gen:
     api_key: "AIzaSy-xxxxx"  # Gemini

   video_gen:
     kling:
       api_key: "xxxxx"
       api_secret: "xxxxx"
     seedance:
       api_key: "xxxxx"

   tts:
     api_key: "xxxxx"
   ```

2. **单一供应商依赖**
   - DeepSeek 故障 → 无法生成脚本
   - Kling 故障 → 无法生成视频
   - MiniMax 故障 → 无法生成配音

3. **成本不可控**
   - 无法实时查询模型价格
   - 无法设置预算上限
   - 无法按使用量计费

4. **模型切换困难**
   - 需要修改代码或配置文件
   - 需要重新测试
   - 需要重新申请 API Key

---

### 2.2 改造目标

#### 核心目标

1. **统一 API 接口**: 支持 OpenRouter 统一调用
2. **混合模式**: 支持直接调用和 OpenRouter 代理两种模式
3. **智能路由**: 自动选择最优模型和提供商
4. **成本优化**: 实时查询价格，避免超支
5. **无代码修改**: 仅修改配置文件即可切换

---

## 三、技术方案设计

### 3.1 OpenRouter API 规范

#### 3.1.1 基本调用格式

OpenRouter 完全兼容 OpenAI API 规范：

```bash
# LLM 调用
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-chat",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# 图像生成调用
curl https://openrouter.ai/api/v1/images/generations \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/dall-e-3",
    "prompt": "A cat"
  }'
```

#### 3.1.2 模型命名规范

OpenRouter 使用 `provider/model` 格式：

```
deepseek/deepseek-chat
anthropic/claude-3-opus
google/gemini-1.5-pro
meta-llama/llama-3-70b
openai/gpt-4
```

---

### 3.2 配置文件改造

#### 3.2.1 新增 OpenRouter 配置

```yaml
# configs/config.yaml
# 新增 OpenRouter 配置
openrouter:
  enabled: true  # 是否启用 OpenRouter
  api_key: "sk-or-xxxxx"  # OpenRouter API Key
  base_url: "https://openrouter.ai/api/v1"

  # 智能路由配置
  routing:
    llm:
      enabled: true
      strategy: "cost"  # cost / speed / quality
      fallback_models:
        - "deepseek/deepseek-chat"
        - "anthropic/claude-3-sonnet"
        - "meta-llama/llama-3-70b"

    image_gen:
      enabled: true
      strategy: "quality"  # quality / cost
      fallback_models:
        - "openai/dall-e-3"
        - "stabilityai/stable-diffusion-xl"

    video_gen:
      enabled: false  # OpenRouter 暂不支持视频生成，使用原生 API
      strategy: "quality"

  # 成本控制
  cost_control:
    enabled: true
    monthly_budget: 100.0  # 美元
    warning_threshold: 80.0  # 达到 80% 时告警
    block_on_exceed: true  # 超限时是否阻断

# 保留原生配置（混合模式）
llm:
  default_provider: "openrouter"  # 新增 "openrouter" 选项
  deepseek:
    api_key: "sk-xxxxx"
    model: "deepseek-chat"
  # ... 其他提供商

image_gen:
  provider: "openrouter"  # 新增 "openrouter" 选项
  api_key: "xxxxx"  # 原生 Key（fallback）
  model: "gemini-2.0-flash-preview-image-generation"

video_gen:
  default_provider: "kling"  # OpenRouter 不支持视频，保持原生
  kling:
    api_key: "xxxxx"
    api_secret: "xxxxx"

tts:
  provider: "minimax"  # OpenRouter TTS 支持有限，保持原生
  api_key: "xxxxx"
```

---

### 3.3 核心代码改造

#### 3.3.1 新增 OpenRouter 客户端

```python
# modules/openrouter/client.py
"""
OpenRouter 统一 API 客户端

支持:
- LLM 调用 (chat completions)
- 图像生成 (images/generations)
- 模型列表查询 (models)
- 价格查询 (auth/key)
- 用量统计 (credits)
"""

import httpx
import json
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from core.config import PilipiliConfig, get_config


@dataclass
class OpenRouterModel:
    """OpenRouter 模型信息"""
    id: str
    name: str
    description: str
    context_length: int
    pricing: Dict[str, float]  # {"prompt": 0.0001, "completion": 0.0002}


@dataclass
class OpenRouterUsage:
    """OpenRouter 使用量统计"""
    total_credits: float
    used_credits: float
    remaining_credits: float


class OpenRouterClient:
    """OpenRouter API 客户端"""

    def __init__(self, config: Optional[PilipiliConfig] = None):
        self.config = config or get_config()
        self.api_key = self.config.openrouter.api_key
        self.base_url = self.config.openrouter.base_url or "https://openrouter.ai/api/v1"
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://pilipili.autovideo",
                "X-Title": "Pilipili-AutoVideo",
            },
            timeout=60.0
        )

    async def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        **kwargs
    ) -> Dict[str, Any]:
        """调用 LLM Chat Completion API"""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }

        if max_tokens:
            payload["max_tokens"] = max_tokens

        payload.update(kwargs)

        response = await self.client.post("/chat/completions", json=payload)
        response.raise_for_status()

        return response.json()

    async def image_generation(
        self,
        model: str,
        prompt: str,
        size: str = "1024x1024",
        n: int = 1,
        **kwargs
    ) -> Dict[str, Any]:
        """调用图像生成 API"""
        payload = {
            "model": model,
            "prompt": prompt,
            "size": size,
            "n": n,
        }

        payload.update(kwargs)

        response = await self.client.post("/images/generations", json=payload)
        response.raise_for_status()

        return response.json()

    async def list_models(self) -> List[OpenRouterModel]:
        """查询可用模型列表"""
        response = await self.client.get("/models")
        response.raise_for_status()

        data = response.json()
        models = []

        for item in data.get("data", []):
            models.append(OpenRouterModel(
                id=item["id"],
                name=item["name"],
                description=item.get("description", ""),
                context_length=item.get("context_length", 0),
                pricing=item.get("pricing", {})
            ))

        return models

    async def get_usage(self) -> OpenRouterUsage:
        """查询使用量统计"""
        response = await self.client.get("/auth/key")
        response.raise_for_status()

        data = response.json()
        return OpenRouterUsage(
            total_credits=data.get("data", {}).get("limit", 0),
            used_credits=data.get("data", {}).get("usage", 0),
            remaining_credits=data.get("data", {}).get("remaining", 0)
        )

    async def estimate_cost(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> float:
        """估算调用成本（美元）"""
        models = await self.list_models()

        for m in models:
            if m.id == model:
                prompt_cost = m.pricing.get("prompt", 0) * prompt_tokens / 1000000
                completion_cost = m.pricing.get("completion", 0) * completion_tokens / 1000000
                return prompt_cost + completion_cost

        return 0.0

    async def close(self):
        """关闭客户端"""
        await self.client.aclose()


# 单例模式
_openrouter_client: Optional[OpenRouterClient] = None

def get_openrouter_client() -> OpenRouterClient:
    """获取 OpenRouter 客户端单例"""
    global _openrouter_client

    if _openrouter_client is None:
        config = get_config()
        if not config.openrouter.enabled:
            raise ValueError("OpenRouter 未启用")

        _openrouter_client = OpenRouterClient(config)

    return _openrouter_client
```

---

#### 3.3.2 修改 LLM 模块

```python
# modules/llm.py (修改)

import asyncio
from typing import Optional
from openai import AsyncOpenAI

from core.config import PilipiliConfig, get_config, get_active_llm_config
from modules.openrouter.client import get_openrouter_client, OpenRouterClient


# 原有函数保持不变
def _get_openai_client(config: PilipiliConfig, provider: str) -> AsyncOpenAI:
    """获取原生 OpenAI 客户端"""
    provider_cfg = get_active_llm_config(config)

    if provider == "gemini":
        return AsyncOpenAI(
            api_key=provider_cfg.api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
    else:
        return AsyncOpenAI(
            api_key=provider_cfg.api_key,
            base_url=provider_cfg.base_url or "https://api.openai.com/v1"
        )


# 新增 OpenRouter 调用函数
async def _call_openrouter(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    verbose: bool = False,
) -> str:
    """调用 OpenRouter LLM API"""
    config = get_config()

    if not config.openrouter.enabled:
        raise ValueError("OpenRouter 未启用")

    client = get_openrouter_client()

    # 智能路由：选择最优模型
    if model is None:
        model = await _select_best_model(
            config.openrouter.routing.llm.strategy,
            config.openrouter.routing.llm.fallback_models
        )

    if verbose:
        print(f"[LLM] 使用 OpenRouter 模型: {model}")

    # 成本检查
    if config.openrouter.cost_control.enabled:
        usage = await client.get_usage()
        budget_ratio = usage.used_credits / usage.total_credits if usage.total_credits > 0 else 0

        if budget_ratio >= (config.openrouter.cost_control.warning_threshold / 100):
            print(f"[LLM] ⚠️  预算使用已达 {budget_ratio*100:.1f}%")

        if config.openrouter.cost_control.block_on_exceed and usage.remaining_credits <= 0:
            raise RuntimeError("OpenRouter 预算已用尽，请充值或调整预算上限")

    # 调用 API
    response = await client.chat_completion(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )

    # 提取响应
    content = response["choices"][0]["message"]["content"]

    # 成本统计
    if verbose and "usage" in response:
        usage = response["usage"]
        print(f"[LLM] Token 使用: {usage['prompt_tokens']} + {usage['completion_tokens']}")

    return content


async def _select_best_model(
    strategy: str,
    fallback_models: list[str]
) -> str:
    """根据策略选择最优模型"""
    client = get_openrouter_client()

    if strategy == "cost":
        # 选择最便宜的模型
        models = await client.list_models()
        cost_models = [
            m for m in models
            if m.id in fallback_models and m.pricing.get("prompt", 0) > 0
        ]

        if cost_models:
            return min(cost_models, key=lambda m: m.pricing["prompt"]).id

    elif strategy == "speed":
        # 选择最快的模型（基于上下文长度）
        models = await client.list_models()
        speed_models = [
            m for m in models
            if m.id in fallback_models and m.context_length > 0
        ]

        if speed_models:
            return min(speed_models, key=lambda m: m.context_length).id

    elif strategy == "quality":
        # 选择质量最好的模型（基于用户排序）
        return fallback_models[0]

    # 默认返回第一个
    return fallback_models[0]


# 修改现有 generate_script_sync 函数
async def generate_script_sync(
    topic: str,
    style: Optional[str] = None,
    duration_hint: int = 60,
    memory_context: str = "",
    config: Optional[PilipiliConfig] = None,
    verbose: bool = False,
) -> VideoScript:
    """生成视频脚本（支持 OpenRouter）"""
    if config is None:
        config = get_config()

    provider = config.llm.default_provider

    # 使用 OpenRouter
    if provider == "openrouter":
        messages = [
            {
                "role": "system",
                "content": SCRIPT_SYSTEM_PROMPT.format(style_guidance=style or "无特定风格")
            },
            {
                "role": "user",
                "content": f"主题: {topic}\n"
                          f"时长: {duration_hint} 秒\n"
                          f"记忆上下文: {memory_context}\n"
                          f"风格: {style or '自动'}"
            }
        ]

        response = await _call_openrouter(
            messages=messages,
            temperature=0.7,
            max_tokens=4000,
            verbose=verbose,
        )

        return _parse_script_response(response)

    # 使用原生 API（原有逻辑）
    else:
        client = _get_openai_client(config, provider)
        response = await client.chat.completions.create(
            model=get_active_llm_config(config).model,
            messages=[
                {
                    "role": "system",
                    "content": SCRIPT_SYSTEM_PROMPT.format(style_guidance=style or "无特定风格")
                },
                {
                    "role": "user",
                    "content": f"主题: {topic}\n"
                              f"时长: {duration_hint} 秒\n"
                              f"记忆上下文: {memory_context}\n"
                              f"风格: {style or '自动'}"
                }
            ],
            temperature=0.7,
            max_tokens=4000,
        )

        return _parse_script_response(response.choices[0].message.content)
```

---

#### 3.3.3 修改图像生成模块

```python
# modules/image_gen.py (修改)

from modules.openrouter.client import get_openrouter_client


# 新增 OpenRouter 图像生成函数
async def generate_keyframe_openrouter(
    scene: Scene,
    output_dir: str,
    config: Optional[PilipiliConfig] = None,
    verbose: bool = False,
) -> str:
    """使用 OpenRouter 生成关键帧"""
    if config is None:
        config = get_config()

    if not config.openrouter.enabled:
        raise ValueError("OpenRouter 未启用")

    client = get_openrouter_client()

    # 选择模型
    model = config.openrouter.routing.image_gen.fallback_models[0]

    # 构建提示词
    style_str = ", ".join(scene.style_tags) if scene.style_tags else ""
    full_prompt = (
        f"{scene.image_prompt}, "
        f"style: {style_str}, "
        f"ultra high quality, 1080P resolution, "
        f"cinematic composition, sharp focus"
    )

    # 调用 API
    response = await client.image_generation(
        model=model,
        prompt=full_prompt,
        size="1024x1024",
        n=1,
    )

    # 保存图片
    image_url = response["data"][0]["url"]
    output_path = os.path.join(output_dir, f"scene_{scene.scene_id:03d}_keyframe.png")

    # 下载图片
    async with httpx.AsyncClient() as http_client:
        img_response = await http_client.get(image_url)
        with open(output_path, "wb") as f:
            f.write(img_response.content)

    if verbose:
        print(f"[ImageGen] OpenRouter 生成完成: {output_path}")

    return output_path


# 修改 generate_all_keyframes_sync 函数
async def generate_all_keyframes_sync(
    scenes: list[Scene],
    output_dir: str,
    reference_images: Optional[list[str]] = None,
    config: Optional[PilipiliConfig] = None,
    verbose: bool = False,
) -> dict[int, str]:
    """批量生成关键帧（支持 OpenRouter 混合模式）"""
    if config is None:
        config = get_config()

    os.makedirs(output_dir, exist_ok=True)
    keyframe_paths = {}

    provider = config.image_gen.provider

    # 使用 OpenRouter
    if provider == "openrouter":
        for scene in scenes:
            output_path = os.path.join(output_dir, f"scene_{scene.scene_id:03d}_keyframe.png")

            # 断点续传
            if os.path.exists(output_path):
                if verbose:
                    print(f"[ImageGen] Scene {scene.scene_id} 已存在，跳过")
                keyframe_paths[scene.scene_id] = output_path
                continue

            # 生成
            try:
                path = await generate_keyframe_openrouter(scene, output_dir, config, verbose)
                keyframe_paths[scene.scene_id] = path
            except Exception as e:
                print(f"[ImageGen] Scene {scene.scene_id} 生成失败: {e}")
                raise

    # 使用原生 API（原有逻辑）
    else:
        # ... 原有代码不变 ...
        pass

    return keyframe_paths
```

---

#### 3.3.4 新增成本管理模块

```python
# modules/openrouter/cost.py
"""OpenRouter 成本管理和监控"""

import json
import os
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Dict, List

from core.config import get_config
from modules.openrouter.client import get_openrouter_client


@dataclass
class CostRecord:
    """成本记录"""
    timestamp: str
    model: str
    tokens_used: int
    cost_usd: float
    project_id: str


class CostManager:
    """成本管理器"""

    def __init__(self):
        self.config = get_config()
        self.data_dir = "./data/cost"
        os.makedirs(self.data_dir, exist_ok=True)
        self.cost_file = os.path.join(self.data_dir, "openrouter_costs.json")

    def record_cost(self, record: CostRecord):
        """记录成本"""
        costs = self._load_costs()
        costs.append(asdict(record))
        self._save_costs(costs)

    def get_total_cost(self, month: Optional[int] = None, year: Optional[int] = None) -> float:
        """查询总成本"""
        costs = self._load_costs()

        total = 0.0
        for cost in costs:
            timestamp = datetime.fromisoformat(cost["timestamp"])

            if month and timestamp.month != month:
                continue
            if year and timestamp.year != year:
                continue

            total += cost["cost_usd"]

        return total

    def get_cost_by_model(self) -> Dict[str, float]:
        """按模型统计成本"""
        costs = self._load_costs()

        model_costs = {}
        for cost in costs:
            model = cost["model"]
            if model not in model_costs:
                model_costs[model] = 0.0
            model_costs[model] += cost["cost_usd"]

        return model_costs

    def get_cost_by_day(self, days: int = 30) -> Dict[str, float]:
        """按天统计成本"""
        costs = self._load_costs()
        daily_costs = {}

        from datetime import timedelta
        cutoff = datetime.now() - timedelta(days=days)

        for cost in costs:
            timestamp = datetime.fromisoformat(cost["timestamp"])

            if timestamp < cutoff:
                continue

            day = timestamp.strftime("%Y-%m-%d")
            if day not in daily_costs:
                daily_costs[day] = 0.0
            daily_costs[day] += cost["cost_usd"]

        return daily_costs

    async def check_budget(self) -> bool:
        """检查预算是否超限"""
        if not self.config.openrouter.cost_control.enabled:
            return True

        client = get_openrouter_client()
        usage = await client.get_usage()

        total_cost = self.get_total_cost()
        budget = self.config.openrouter.cost_control.monthly_budget

        if total_cost >= budget:
            return False

        # 检查 OpenRouter 侧限额
        if usage.remaining_credits <= 0:
            return False

        return True

    async def send_warning(self) -> bool:
        """发送预算告警"""
        if not self.config.openrouter.cost_control.enabled:
            return False

        client = get_openrouter_client()
        usage = await client.get_usage()

        total_cost = self.get_total_cost()
        budget = self.config.openrouter.cost_control.monthly_budget
        threshold = self.config.openrouter.cost_control.warning_threshold

        ratio = (total_cost / budget * 100) if budget > 0 else 0

        if ratio >= threshold:
            print(f"[CostManager] ⚠️  预算使用已达 {ratio:.1f}% (${total_cost:.2f} / ${budget:.2f})")
            return True

        return False

    def _load_costs(self) -> List[dict]:
        """加载成本记录"""
        if not os.path.exists(self.cost_file):
            return []

        with open(self.cost_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_costs(self, costs: List[dict]):
        """保存成本记录"""
        with open(self.cost_file, "w", encoding="utf-8") as f:
            json.dump(costs, f, ensure_ascii=False, indent=2)


# 单例
_cost_manager: Optional[CostManager] = None

def get_cost_manager() -> CostManager:
    """获取成本管理器单例"""
    global _cost_manager

    if _cost_manager is None:
        _cost_manager = CostManager()

    return _cost_manager
```

---

#### 3.3.5 新增 API 端点

```python
# api/server.py (新增)

from modules.openrouter.client import get_openrouter_client
from modules.openrouter.cost import get_cost_manager


@app.get("/api/openrouter/models")
async def list_openrouter_models():
    """查询 OpenRouter 可用模型列表"""
    try:
        client = get_openrouter_client()
        models = await client.list_models()

        return {
            "models": [
                {
                    "id": m.id,
                    "name": m.name,
                    "description": m.description,
                    "context_length": m.context_length,
                    "pricing": m.pricing,
                }
                for m in models
            ]
        }
    except Exception as e:
        raise HTTPException(500, f"查询失败: {str(e)}")


@app.get("/api/openrouter/usage")
async def get_openrouter_usage():
    """查询 OpenRouter 使用量"""
    try:
        client = get_openrouter_client()
        usage = await client.get_usage()

        cost_manager = get_cost_manager()
        local_cost = cost_manager.get_total_cost()

        return {
            "openrouter": {
                "total_credits": usage.total_credits,
                "used_credits": usage.used_credits,
                "remaining_credits": usage.remaining_credits,
            },
            "local": {
                "total_cost_usd": local_cost,
            }
        }
    except Exception as e:
        raise HTTPException(500, f"查询失败: {str(e)}")


@app.get("/api/openrouter/cost")
async def get_cost_breakdown(days: int = 30):
    """查询成本明细"""
    cost_manager = get_cost_manager()

    return {
        "total_cost": cost_manager.get_total_cost(),
        "by_model": cost_manager.get_cost_by_model(),
        "by_day": cost_manager.get_cost_by_day(days),
    }
```

---

## 四、实施计划

### 4.1 阶段划分

#### 阶段 1: OpenRouter 客户端开发 (1 周)

**任务**:
1. 实现 `OpenRouterClient` 类
2. 实现 LLM、图像生成、模型查询、用量查询 API
3. 编写单元测试

**交付物**:
- `modules/openrouter/client.py`
- `tests/test_openrouter_client.py`

---

#### 阶段 2: LLM 模块集成 (1 周)

**任务**:
1. 修改 `modules/llm.py`，支持 OpenRouter
2. 实现智能路由逻辑
3. 实现成本检查逻辑

**交付物**:
- 更新后的 `modules/llm.py`
- 集成测试

---

#### 阶段 3: 图像生成模块集成 (1 周)

**任务**:
1. 修改 `modules/image_gen.py`，支持 OpenRouter
2. 实现模型选择逻辑
3. 测试图像生成质量

**交付物**:
- 更新后的 `modules/image_gen.py`
- 图像质量测试报告

---

#### 阶段 4: 成本管理系统 (1 周)

**任务**:
1. 实现 `CostManager` 类
2. 实现成本统计和预算检查
3. 实现告警机制

**交付物**:
- `modules/openrouter/cost.py`
- 成本监控 API 端点

---

#### 阶段 5: 前端集成 (1 周)

**任务**:
1. 实现 OpenRouter 设置页面
2. 实现成本统计可视化
3. 实现模型选择界面

**交付物**:
- 前端 OpenRouter 设置组件
- 成本统计图表

---

#### 阶段 6: 测试和文档 (1 周)

**任务**:
1. 完整的 E2E 测试
2. 性能测试（对比原生 API）
3. 编写用户文档

**交付物**:
- `tests/test_e2e_openrouter.py`
- `docs/OPENROUTER_GUIDE.md`

---

### 4.2 时间估算

| 阶段 | 工作量 | 依赖 |
|------|--------|------|
| 阶段 1: 客户端开发 | 1 周 | 无 |
| 阶段 2: LLM 集成 | 1 周 | 阶段 1 |
| 阶段 3: 图像生成集成 | 1 周 | 阶段 1 |
| 阶段 4: 成本管理 | 1 周 | 阶段 1 |
| 阶段 5: 前端集成 | 1 周 | 阶段 2-4 |
| 阶段 6: 测试和文档 | 1 周 | 所有阶段 |
| **总计** | **6 周** | |

---

## 五、风险和挑战

### 5.1 技术风险

1. **OpenRouter 限制**:
   - 不支持视频生成 → 需要混合模式
   - TTS 支持有限 → 需要保留原生 API
   - **缓解**: 文档明确说明限制，提供混合模式配置

2. **性能延迟**:
   - OpenRouter 额外一层代理 → 可能增加延迟
   - **缓解**: 缓存模型列表，成本统计异步化

3. **模型质量**:
   - 某些模型可能不如原生 API 质量好
   - **缓解**: 提供质量对比测试，用户自主选择

### 5.2 成本风险

1. **价格波动**:
   - OpenRouter 价格可能调整
   - **缓解**: 实时查询价格，提供预算上限

2. **汇率转换**:
   - OpenRouter 使用美元结算
   - **缓解**: 在配置中显示本币价格

### 5.3 用户体验风险

1. **学习成本**:
   - 用户需要了解 OpenRouter 概念
   - **缓解**: 提供详细文档和引导教程

2. **信任问题**:
   - 用户可能不信任代理平台
   - **缓解**: 提供混合模式，可随时切换回原生 API

---

## 六、总结

### 6.1 改造后的优势

1. **简化配置**: 一个 API Key 替代多个 Key
2. **成本透明**: 实时查询价格，避免超支
3. **智能路由**: 自动选择最优模型
4. **混合模式**: 灵活切换 OpenRouter 和原生 API
5. **成本管理**: 预算控制和使用统计

### 6.2 适用场景

1. **个人开发者**: 简化 API Key 管理
2. **小团队**: 统一计费，成本透明
3. **MVP 快速开发**: 无需申请多个 Key
4. **成本敏感**: 实时查询价格，优化成本

### 6.3 后续扩展

1. **支持更多 OpenRouter 功能**:
   - 视频生成（一旦支持）
   - 音频生成（TTS）
   - Function Calling

2. **高级路由策略**:
   - 基于历史成功率
   - 基于用户反馈评分
   - 基于任务类型自动选择

3. **成本优化建议**:
   - 分析用户使用模式
   - 推荐最优模型组合
   - 提供成本优化报告
