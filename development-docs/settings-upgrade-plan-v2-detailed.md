# 设置系统升级方案 v2.0 (详细版)

> 基于 development-docs 目录下的技术文档分析
> 创建日期: 2026-03-31

---

## 一、现状问题总结

### 1.1 核心问题

| 问题           | 现状                                                    | 影响                             |
| -------------- | ------------------------------------------------------- | -------------------------------- |
| **配置写死**   | config.yaml 中 model/base_url/default_provider 全部写死 | 用户无法选择模型、无法自定义参数 |
| **界面不直观** | "大脑层、视觉层、动态层、配音层" 用户看不懂             | 学习成本高                       |
| **存储不安全** | API Key 存储在配置文件（明文）                          | 安全风险                         |
| **无用户隔离** | 所有用户共享同一配置                                    | 无多用户支持                     |
| **层级不清晰** | 无分层（全局 vs 用户 vs 系统推荐）                      | 配置混乱                         |

### 1.2 文档依据

根据 DEV-DOC-003（用户认证管理）和 DEV-DOC-004（统一 API 代理平台），本项目规划了：

- Phase 1: 用户认证系统（已完成）
- Phase 2: 用户独立 API Key 存储（规划中）
- Phase 3: 统一 API 代理层（规划中）

**本方案属于 Phase 2 的前端实现部分**

---

## 二、目标架构

### 2.1 分层配置模型

```
┌─────────────────────────────────────────────────────────────┐
│                     用户层（User Level）                     │
│  用户自定义配置 > 覆盖系统默认值                              │
├─────────────────────────────────────────────────────────────┤
│                    用户组（User Group）                      │
│  团队/部门级配置（可选）                                      │
├─────────────────────────────────────────────────────────────┤
│                     全局层（Global Level）                   │
│  configs/config.yaml - 系统推荐套餐                          │
├─────────────────────────────────────────────────────────────┤
│                     默认层（Default Level）                  │
│  代码中的默认值 - 最保守的兜底配置                           │
└─────────────────────────────────────────────────────────────┘

优先级: 用户自定义 > config.yaml > 代码默认值
```

### 2.2 界面命名重构

| 原名称   | 新名称       | 业务含义                  |
| -------- | ------------ | ------------------------- |
| 大脑层   | 通用推理模型 | 脚本生成、任务处理（LLM） |
| 视觉层   | 图片生成模型 | 关键帧生成（Image Gen）   |
| 动态层   | 视频生成模型 | 片段生成（Video Gen）     |
| 配音层   | 配音生成模型 | TTS 配音                  |
| 记忆系统 | 记忆系统     | 保持不变                  |

---

## 三、后端改动

### 3.1 数据库设计

根据 DEV-DOC-003 第3.2节，增加用户配置表：

```sql
-- 用户自定义配置表（新增）
CREATE TABLE user_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    config_type TEXT NOT NULL,  -- 'llm', 'image_gen', 'video_gen', 'tts', 'memory'
    provider TEXT NOT NULL,     -- 'deepseek', 'kimi', 'kling' 等

    -- 完整配置 JSON（包含所有可配置字段）
    config_json TEXT NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,  -- 是否启用
    is_default BOOLEAN DEFAULT FALSE,  -- 是否为默认选择

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, config_type, provider),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- config_json 字段说明：
{
  "api_key": "sk-xxx",           -- 必填
  "api_secret": "xxx",            -- 可选（如 Kling）
  "model": "deepseek-chat",       -- 可选（留空用系统推荐）
  "base_url": "https://api.xxx",  -- 可选（留空用默认值）
  "custom_params": {              -- 可选（自定义默认参数）
    "default_duration": 10,
    "default_ratio": "16:9",
    "default_quality": "high",
    "default_voice": "female-shaonv",
    "speed": 1.0,
    "emotion": "neutral"
  }
}
```

### 3.2 配置加载逻辑

根据 DEV-DOC-002 第8.1节，支持多 Provider 配置，扩展为用户配置优先：

```python
# core/config.py

def get_effective_config(user_id: str, config_type: str, provider: str = None) -> dict:
    """
    获取有效配置（优先级：用户配置 > config.yaml > 默认值）
    """
    # 1. 尝试获取用户自定义配置
    user_config = db.get_user_config(user_id, config_type, provider)
    if user_config:
        return user_config

    # 2. 回退到 config.yaml
    return load_from_config_yaml(config_type, provider)
```

### 3.3 新增 API 端点

| 端点                    | 方法   | 说明                               |
| ----------------------- | ------ | ---------------------------------- |
| `/api/user/config`      | GET    | 获取用户所有自定义配置             |
| `/api/user/config`      | POST   | 保存/更新配置                      |
| `/api/user/config/{id}` | DELETE | 删除自定义配置                     |
| `/api/user/config/test` | POST   | 测试配置有效性                     |
| `/api/providers/models` | GET    | 获取各提供商支持的模型列表（可选） |

**请求示例：**

```python
# POST /api/user/config
{
  "config_type": "llm",
  "provider": "deepseek",
  "config_json": {
    "api_key": "sk-xxx",
    "model": "deepseek-chat",
    "custom_params": {}
  },
  "is_default": True
}

# GET /api/user/config?config_type=llm
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "provider": "deepseek",
      "config_json": {...},
      "is_default": True,
      "is_active": True
    },
    {
      "id": 2,
      "provider": "kimi",
      "config_json": {...},
      "is_default": False,
      "is_active": True
    }
  ]
}
```

### 3.4 配置测试 API

```python
@app.post("/api/user/config/test")
async def test_config(request: TestConfigRequest):
    """测试配置有效性"""
    try:
        # 根据 config_type 测试不同服务
        if request.config_type == "llm":
            client = AsyncOpenAI(
                api_key=request.api_key,
                base_url=request.base_url or "https://api.deepseek.com/v1"
            )
            await client.chat.completions.create(
                model=request.model or "deepseek-chat",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=5
            )
        elif request.config_type == "image_gen":
            # 测试图像生成 API
            ...
        # ... 其他类型
        return {"success": True, "message": "连接成功"}
    except Exception as e:
        return {"success": False, "message": str(e)}
```

---

## 四、前端改动

### 4.1 整体界面布局

```
┌──────────────────────────────────────────────────────────────┐
│  [返回]  API 连接器配置                    [保存所有修改]   │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐│
│  │ 默认 LLM 提供商:  [DeepSeek ▼]                          ││
│  └────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│  [通用推理模型] [图片生成] [视频生成] [配音生成] [记忆系统]   │ ← 标签导航
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 提供商列表                                              ││
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ [+ 添加]           ││
│  │ │DeepSeek │ │  Kimi   │ │MiniMax  │                     ││
│  │ │  ●默认  │ │         │ │         │                     ││
│  │ └─────────┘ └─────────┘ └─────────┘                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 当前配置: DeepSeek                                     ││
│  │ ┌─────────────────────────────────────────────────────┐││
│  │ │ API Key:  [●●●●●●●●●●●●●●●] 👁                      │││
│  │ │ API Secret: [________________] 👁 (可选)             │││
│  │ └─────────────────────────────────────────────────────┘││
│  │                                                        ││
│  │ 模型选择: [deepseek-chat ▼]  [使用系统推荐]           ││
│  │ Base URL: [https://api.deepseek.com/v1           ]     ││
│  │                                                        ││
│  │ ─ 默认参数（系统推荐套餐） ─                           ││
│  │   时长: [5]秒  比例: [16:9 ▼]  质量: [高 ▼]           ││
│  │                                                        ││
│  │                    [测试连接] [保存此配置]             ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ⚠️ 安全提示：所有 API Key 仅存储在后端...                  │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 核心组件设计

#### 4.2.1 提供商选择卡片

```tsx
interface ProviderCard {
  id: string;
  name: string;
  logo?: string;
  isConfigured: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}
```

#### 4.2.2 配置表单（根据 config_type 动态渲染）

| config_type | 特有字段                                                                            |
| ----------- | ----------------------------------------------------------------------------------- |
| llm         | model (下拉), base_url (输入框)                                                     |
| image_gen   | model (下拉), output_resolution (下拉)                                              |
| video_gen   | model (下拉), default_duration (数字), default_ratio (下拉), default_quality (下拉) |
| tts         | model (下拉), default_voice (下拉), speed (滑块), emotion (下拉)                    |
| memory      | provider (下拉), local_db_path (输入框)                                             |

#### 4.2.3 系统推荐套餐展示

```tsx
interface SystemRecommended {
  model: string;
  base_url: string;
  custom_params: Record<string, any>;
  onApply: () => void; // 一键应用
}
```

### 4.3 状态管理

```typescript
// 前端状态
interface SettingsState {
  // 用户配置
  userConfigs: UserConfig[];

  // 默认提供商（全局）
  defaultLlmProvider: string;

  // 当前激活的标签页
  activeTab: "llm" | "image_gen" | "video_gen" | "tts" | "memory";

  // 各标签页的可用提供商
  availableProviders: Record<string, Provider[]>;

  // 加载/保存状态
  loading: boolean;
  saving: boolean;

  // 测试状态
  testingConfig: string | null; // 当前正在测试的配置 ID
  testResults: Record<string, TestResult>;
}

// 用户配置结构
interface UserConfig {
  id?: number;
  userId: string;
  configType: ConfigType;
  provider: string;
  configJson: {
    apiKey: string;
    apiSecret?: string;
    model?: string;
    baseUrl?: string;
    customParams?: Record<string, any>;
  };
  isActive: boolean;
  isDefault: boolean;
}
```

### 4.4 API 调用

```typescript
// 获取用户配置
const fetchUserConfigs = async () => {
  const response = await fetch("/api/user/config");
  return response.json();
};

// 保存用户配置
const saveUserConfig = async (config: UserConfig) => {
  const response = await fetch("/api/user/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return response.json();
};

// 测试配置
const testConfig = async (config: TestConfigRequest) => {
  const response = await fetch("/api/user/config/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return response.json();
};
```

---

## 五、各层配置详情

### 5.1 通用推理模型 (LLM)

**支持提供商**（根据 config.yaml 和 DEV-DOC-001 第5.2节）:
| 提供商 | 默认模型 | 默认 Base URL | 可选模型 |
|--------|----------|---------------|----------|
| DeepSeek | deepseek-chat | https://api.deepseek.com/v1 | deepseek-chat, deepseek-coder, deepseek-reasoner |
| Kimi | moonshot-v1-32k | https://api.moonshot.cn/v1 | moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k |
| MiniMax | MiniMax-Text-01 | https://api.minimax.chat/v1 | abab6.5s-chat |
| Gemini | gemini-2.0-flash | - | gemini-2.0-flash, gemini-2.5-pro |
| Zhipu | glm-4 | https://open.bigmodel.cn/api/paas/v4 | glm-4, glm-4-flash |
| Ollama | qwen2.5:latest | http://localhost:11434/v1 | (本地模型列表) |
| OpenAI | gpt-4o | https://api.openai.com/v1 | gpt-4o, gpt-4o-mini, gpt-4-turbo |

**配置字段**:

```typescript
interface LLMConfig {
  apiKey: string;
  model: string; // 可选
  baseUrl: string; // 可选
  customParams: {
    // 当前无额外参数，可扩展
  };
}
```

### 5.2 图片生成模型

**支持提供商**:
| 提供商 | 默认模型 | 可选参数 |
|--------|----------|----------|
| Nano Banana (Gemini) | gemini-3-pro-image-preview | output_resolution: 720P/1080P/4K |

**配置字段**:

```typescript
interface ImageGenConfig {
  apiKey: string;
  model: string;
  customParams: {
    output_resolution?: "720P" | "1080P" | "4K";
  };
}
```

### 5.3 视频生成模型

**支持提供商**:
| 提供商 | 默认模型 | 默认 Base URL | 特有字段 |
|--------|----------|---------------|----------|
| Kling 3.0 | kling-v3 | https://api-beijing.klingai.com | api_secret 必填 |
| Seedance 1.5 | doubao-seedance-1-5-pro-250528 | https://ark.cn-beijing.volces.com/api/v3 | - |

**配置字段**:

```typescript
interface VideoGenConfig {
  apiKey: string;
  apiSecret?: string; // Kling 必填
  model: string;
  baseUrl?: string;
  customParams: {
    default_duration?: number; // 5-60秒
    default_ratio?: "16:9" | "9:16" | "1:1";
    default_quality?: "low" | "medium" | "high";
  };
}
```

### 5.4 配音生成模型

**支持提供商**:
| 提供商 | 默认模型 | 默认音色 |
|--------|----------|----------|
| MiniMax Speech | speech-02-hd | female-shaonv |

**配置字段**:

```typescript
interface TTSConfig {
  apiKey: string;
  model: string;
  customParams: {
    default_voice?: string; // 音色 ID
    speed?: number; // 0.5 - 2.0
    emotion?: "neutral" | "happy" | "sad" | "angry";
  };
}
```

**音色列表**（从 API 获取）:

```
female-shaonv, female-xiaoyuan, female-yujie,
male-shaonian, male-zhongnian,
happy, sad, angry, neutral
```

### 5.5 记忆系统

**支持模式**:
| 模式 | 配置字段 |
|------|----------|
| Mem0 Cloud | api_key 必填, user_id 可选 |
| 本地 SQLite | local_db_path 必填 |

**配置字段**:

```typescript
interface MemoryConfig {
  provider: "mem0" | "local";
  apiKey?: string; // Mem0 必填
  customParams: {
    local_db_path?: string; // 本地模式必填
    user_id?: string;
  };
}
```

---

## 六、实施计划

### 6.1 第一阶段：后端基础设施（1-2天）

| 任务         | 描述                       | 预估工时 |
| ------------ | -------------------------- | -------- |
| 数据库迁移   | 创建 user_config 表        | 0.5天    |
| 配置加载逻辑 | 实现用户配置优先逻辑       | 0.5天    |
| CRUD API     | /api/user/config 接口      | 1天      |
| 测试 API     | /api/user/config/test 接口 | 0.5天    |

**交付物**: 后端 API 可用，基本增删改查功能

### 6.2 第二阶段：前端 UI 骨架（2-3天）

| 任务         | 描述                     | 预估工时 |
| ------------ | ------------------------ | -------- |
| 标签导航     | 实现 5 个标签页切换      | 0.5天    |
| 提供商选择器 | 显示已配置的提供商列表   | 0.5天    |
| 通用配置表单 | 基础 API Key 输入 + 保存 | 1天      |
| 状态管理     | React Context/Zustand    | 0.5天    |
| API 调用     | 连接后端接口             | 0.5天    |

**交付物**: 基本的设置界面，可保存/加载配置

### 6.3 第三阶段：各层配置功能（3-4天）

| 任务         | 描述                         | 预估工时 |
| ------------ | ---------------------------- | -------- |
| LLM 配置面板 | 模型选择、Base URL、可选参数 | 1天      |
| 图片生成配置 | 模型、分辨率选择             | 0.5天    |
| 视频生成配置 | 模型、时长/比例/质量选择     | 1天      |
| TTS 配置     | 模型、音色/语速/情感选择     | 0.5天    |
| 记忆系统配置 | Mem0/本地切换                | 0.5天    |

**交付物**: 完整的各层配置面板

### 6.4 第四阶段：高级功能（1-2天）

| 任务         | 描述                   | 预估工时 |
| ------------ | ---------------------- | -------- |
| 配置测试     | 测试 API 连接有效性    | 0.5天    |
| 系统推荐套餐 | 显示并一键应用默认配置 | 0.5天    |
| 导入/导出    | 配置备份功能（可选）   | 0.5天    |
| 样式优化     | 完善 UI 细节           | 0.5天    |

**交付物**: 完整可用的设置系统

---

## 七、技术细节

### 7.1 向后兼容性

根据 DEV-DOC-003 第6节，保持与现有 config.yaml 兼容：

```python
# 配置优先级
def get_config(user_id: str = None):
    # 1. 有用户 ID -> 加载用户配置
    if user_id:
        user_config = load_user_config(user_id)
        if user_config:
            return user_config

    # 2. 无用户/用户无配置 -> 回退到 config.yaml
    return load_config_yaml()

# 迁移：首次启动时，将 config.yaml 中的 Key 迁移到默认用户
def migrate_config_to_user():
    config = load_config_yaml()
    # 迁移 LLM Keys
    for provider in ['deepseek', 'kimi', ...]:
        if config.llm[provider].api_key:
            save_user_config(user_id='default', provider, config.llm[provider])
```

### 7.2 安全考虑

根据 DEV-DOC-003 第7节：

1. **API Key 加密存储**: 后端使用用户 ID 派生密钥加密
2. **不返回明文**: 前端只显示配置状态，不显示真实 Key
3. **测试连接**: 不保存到数据库，仅测试有效性

### 7.3 错误处理

| 场景         | 处理方式                       |
| ------------ | ------------------------------ |
| API Key 无效 | 测试时返回错误，保存时提示用户 |
| 网络超时     | 显示超时提示，可重试           |
| 服务不可用   | 显示具体错误信息（503/429 等） |

---

## 八、待讨论问题

### 8.1 模型列表来源

- **选项 A**: 静态硬编码（简单，快速实现）
- **选项 B**: 从后端 API 动态获取（灵活，需额外开发）

**建议**: 初期使用静态硬编码，后续支持动态获取

### 8.2 配置存储位置

- **选项 A**: 仅存数据库（用户隔离，易于管理）
- **选项 B**: 数据库 + config.yaml 备份（双重保障）

**建议**: 仅存数据库，config.yaml 作为系统默认值参考

### 8.3 UI 风格

- **选项 A**: 保持现有 Shadcn/UI 风格
- **选项 B**: 重新设计更现代的界面

**建议**: 保持现有风格，只改进交互逻辑

### 8.4 是否需要团队/部门级配置？

- 当前只实现用户级配置
- 团队级配置可作为后续扩展

---

## 九、风险评估

| 风险                 | 影响         | 缓解措施           |
| -------------------- | ------------ | ------------------ |
| 数据库迁移失败       | 配置丢失     | 提前备份，灰度发布 |
| API 兼容性问题       | 现有功能异常 | 保持向后兼容       |
| 前端改动影响现有功能 | 页面异常     | 分阶段测试         |
| 性能问题             | 保存/加载慢  | 优化 API 响应      |

---

## 十、下一步

1. **确认方案**: 请确认以上方案是否可行
2. **优先级确认**: 确认实施顺序
3. **开始实现**: 从第一阶段开始

---

_方案版本: 2.0_
_基于文档: DEV-DOC-001~006, settings-update-task.md_
