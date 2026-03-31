# 设置系统升级方案

## 一、现状分析

### 1.1 数据来源

- 配置文件: `configs/config.yaml`
- 结构: 分层配置（LLM、Image Gen、Video Gen、TTS、Memory）

### 1.2 当前限制

| 层级          | 可配置字段          | 写死字段                                                          |
| ------------- | ------------------- | ----------------------------------------------------------------- |
| 大脑层 (LLM)  | api_key             | model, base_url, default_provider                                 |
| 视觉层 (生图) | api_key             | model, provider, output_resolution                                |
| 动态层 (视频) | api_key, api_secret | model, base_url, default_duration, default_ratio, default_quality |
| 配音层 (TTS)  | api_key             | model, default_voice, speed, emotion                              |
| 记忆系统      | api_key             | provider, local_db_path, user_id                                  |

### 1.3 界面问题

- 层级名称不直观（大脑层、视觉层、动态层...）
- 无法选择模型
- 无法调整默认参数

---

## 二、改造目标

### 2.1 界面命名重构

| 原名称   | 新名称       | 说明               |
| -------- | ------------ | ------------------ |
| 大脑层   | 通用推理模型 | 脚本生成、任务处理 |
| 视觉层   | 图片生成模型 | 关键帧生成         |
| 动态层   | 视频生成模型 | 片段生成           |
| 配音层   | 配音生成模型 | TTS                |
| 记忆系统 | 记忆系统     | 保持不变           |

### 2.2 配置灵活性

- **套餐模式**: 保留写死的默认值为"系统推荐套餐"
- **自定义模式**: 用户可自由配置所有字段

---

## 三、详细方案

### 3.1 后端改动

#### 3.1.1 配置加载策略

```
优先级（从高到低）:
1. 用户数据库配置（最高优先级）
2. 环境变量覆盖
3. config.yaml 文件
4. 默认值（系统推荐套餐）
```

#### 3.1.2 新增数据库表

```sql
-- 用户自定义配置表
CREATE TABLE user_config (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    config_type TEXT NOT NULL,  -- 'llm', 'image_gen', 'video_gen', 'tts', 'memory'
    provider TEXT NOT NULL,    -- 'deepseek', 'kimi', 'kling' etc.
    config_json TEXT NOT NULL, -- 完整配置 JSON
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(user_id, config_type, provider)
);

-- 配置字段说明:
-- config_json 包含:
-- {
--   "api_key": "sk-xxx",
--   "api_secret": "xxx",  -- 可选
--   "model": "deepseek-chat",
--   "base_url": "https://api.deepseek.com/v1",
--   "custom_params": {    -- 自定义默认参数
--     "default_duration": 10,
--     "default_ratio": "16:9",
--     "default_quality": "high"
--   }
-- }
```

#### 3.1.3 后端 API 设计

```python
# 用户配置 API
GET    /api/user/config          # 获取用户所有自定义配置
POST   /api/user/config          # 保存/更新配置
DELETE /api/user/config/{id}     # 删除自定义配置

# 配置校验 API
POST   /api/user/config/test    # 测试配置有效性

# 模型列表 API（可选）
GET    /api/providers/models     # 获取各提供商支持的模型列表
```

#### 3.1.4 配置合并逻辑

```python
def get_effective_config(user_id: str, config_type: str):
    # 1. 尝试获取用户自定义配置
    user_config = db.get_user_config(user_id, config_type)
    if user_config:
        return user_config

    # 2. 回退到 config.yaml
    return load_from_config_yaml(config_type)
```

---

### 3.2 前端改动

#### 3.2.1 界面布局重构

```
┌─────────────────────────────────────────────────────────────┐
│  设置标题 + 副标题                                           │
├─────────────────────────────────────────────────────────────┤
│  [通用推理模型] [图片生成] [视频生成] [配音生成] [记忆系统]   │ ← 标签导航
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 提供商选择器 (下拉菜单)                                  │  │
│  │ ┌─────────────┐                                        │  │
│  │ │ DeepSeek ▼ │  [+ 添加自定义提供商]                   │  │
│  │ └─────────────┘                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ API 配置卡片                                            │  │
│  │ ┌─────────────────────────────────────────────────┐   │  │
│  │ │ API Key:  [________________________] 👁          │   │  │
│  │ │ API Secret: [________________________] 👁 (可选)│   │  │
│  │ └─────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │ ┌─────────────────────────────────────────────────┐   │  │
│  │ │ 模型选择:  [deepseek-chat ▼]                     │   │  │
│  │ │ Base URL: [https://api.deepseek.com/v1    ]   │   │  │
│  │ └─────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │ ┌─────────────────────────────────────────────────┐   │  │
│  │ │ 默认参数 (系统推荐套餐)                           │   │  │
│  │ │ [使用系统推荐] ○  自定义 ○                         │   │  │
│  │ │                                                    │   │  │
│  │ │ 时长: [5] 秒    比例: [16:9 ▼]   质量: [高 ▼]   │   │  │
│  │ └─────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │ [测试连接]  [保存此配置]  [删除配置]                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [保存所有修改]                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2.2 核心组件设计

**1. 提供商选择器**

- 显示已配置的提供商
- 支持添加新的自定义提供商
- 支持删除（需确认）

**2. 配置表单**

- API Key: 密码输入框 + 显示/隐藏切换
- API Secret: 可选，用于 Kling 等需要双 Key 的服务
- 模型选择: 下拉菜单 + 支持搜索
- Base URL: 输入框 + 可选（留空使用默认）
- 自定义参数: 根据类型显示不同字段

**3. 系统推荐套餐区**

- 折叠面板
- 显示当前 config.yaml 中的默认配置
- 用户可一键"应用系统推荐"

#### 3.2.3 状态管理

```typescript
interface UserConfig {
  id?: number;
  configType: "llm" | "image_gen" | "video_gen" | "tts" | "memory";
  provider: string;
  apiKey: string;
  apiSecret?: string;
  model: string;
  baseUrl?: string;
  customParams: Record<string, any>;
  isActive: boolean;
}

interface SettingsState {
  configs: UserConfig[];
  activeTab: "llm" | "image_gen" | "video_gen" | "tts" | "memory";
  loading: boolean;
  saving: boolean;
}
```

---

### 3.3 各层级详细配置

#### 3.3.1 通用推理模型 (LLM)

| 字段       | 类型 | 必填 | 说明                     |
| ---------- | ---- | ---- | ------------------------ |
| API Key    | 密码 | 是   | 提供商的 API Key         |
| 模型选择   | 下拉 | 是   | 从支持的模型列表选择     |
| Base URL   | 文本 | 否   | 留空使用默认值，支持代理 |
| 自定义参数 | 折叠 | 否   | 系统推荐套餐参数         |

**支持提供商:**

- DeepSeek (默认)
- Kimi (Moonshot)
- MiniMax
- Gemini
- Zhipu (智谱)
- Ollama (本地)
- OpenAI (可选)
- Anthropic (可选)

**模型列表示例:**

```
DeepSeek: deepseek-chat, deepseek-coder, deepseek-reasoner
Kimi: moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k
MiniMax: MiniMax-Text-01, abab6.5s-chat
Gemini: gemini-2.0-flash, gemini-2.5-pro
Zhipu: glm-4, glm-4-flash
Ollama: (本地模型列表)
```

#### 3.3.2 图片生成模型 (Image Gen)

| 字段       | 类型 | 必填 | 说明             |
| ---------- | ---- | ---- | ---------------- |
| API Key    | 密码 | 是   | 提供商的 API Key |
| 模型选择   | 下拉 | 是   | 图像生成模型     |
| Base URL   | 文本 | 否   | 留空使用默认值   |
| 输出分辨率 | 下拉 | 否   | 720P, 1080P, 4K  |

**支持提供商:**

- Nano Banana (Gemini 3 Pro)
- DALL-E 3 (OpenAI)
- Midjourney (可选)

#### 3.3.3 视频生成模型 (Video Gen)

| 字段       | 类型 | 必填 | 说明              |
| ---------- | ---- | ---- | ----------------- |
| API Key    | 密码 | 是   | 提供商的 API Key  |
| API Secret | 密码 | 是   | Kling 需要双 Key  |
| 模型选择   | 下拉 | 是   | 视频生成模型      |
| Base URL   | 文本 | 否   | 留空使用默认值    |
| 默认时长   | 数字 | 否   | 5-60 秒           |
| 默认比例   | 下拉 | 否   | 16:9, 9:16, 1:1   |
| 默认质量   | 下拉 | 否   | low, medium, high |

**支持提供商:**

- Kling 3.0 (默认)
- Seedance 1.5 (字节火山引擎)

#### 3.3.4 配音生成模型 (TTS)

| 字段     | 类型 | 必填 | 说明                       |
| -------- | ---- | ---- | -------------------------- |
| API Key  | 密码 | 是   | 提供商的 API Key           |
| 模型选择 | 下拉 | 是   | TTS 模型                   |
| 默认音色 | 下拉 | 否   | 音色选择                   |
| 语速     | 滑块 | 否   | 0.5 - 2.0                  |
| 情感     | 下拉 | 否   | neutral, happy, sad, angry |

**支持提供商:**

- MiniMax Speech 2.8 HD (默认)
- ElevenLabs (可选)
- Cosine AI (可选)

#### 3.3.5 记忆系统

| 字段       | 类型 | 必填      | 说明                     |
| ---------- | ---- | --------- | ------------------------ |
| 提供商选择 | 下拉 | 是        | Mem0 Cloud / 本地 SQLite |
| API Key    | 密码 | 是 (云端) | Mem0 云端 Key            |
| 用户 ID    | 文本 | 否        | 区分不同用户             |
| 本地路径   | 文本 | 否        | SQLite 数据库路径        |

---

## 四、实施计划

### 4.1 阶段一：基础设施 (后端)

- [ ] 创建用户配置数据库表
- [ ] 实现配置 CRUD API
- [ ] 实现配置合并逻辑（用户配置 > config.yaml > 默认值）
- [ ] 添加配置测试 API

### 4.2 阶段二：前端基础 (UI骨架)

- [ ] 重构 Settings 页面布局
- [ ] 实现标签导航
- [ ] 实现提供商选择器
- [ ] 实现通用配置表单

### 4.3 阶段三：各层配置 (功能实现)

- [ ] 通用推理模型配置面板
- [ ] 图片生成模型配置面板
- [ ] 视频生成模型配置面板
- [ ] 配音生成模型配置面板
- [ ] 记忆系统配置面板

### 4.4 阶段四：高级功能

- [ ] 模型列表动态获取（可选）
- [ ] 配置导入/导出
- [ ] 配置备份/恢复

---

## 五、技术细节

### 5.1 API 请求示例

**保存用户配置:**

```json
POST /api/user/config
{
  "config_type": "llm",
  "provider": "deepseek",
  "config_json": {
    "api_key": "sk-xxx",
    "model": "deepseek-chat",
    "base_url": "https://api.deepseek.com/v1"
  }
}
```

**获取用户配置:**

```json
GET /api/user/config?config_type=llm
```

**响应:**

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "provider": "deepseek",
      "config_json": {
        "api_key": "sk-xxx",
        "model": "deepseek-chat"
      },
      "is_active": true
    }
  ]
}
```

### 5.2 前端状态管理

- 使用 React Context 或 Zustand
- 配置变更自动保存到后端
- 乐观更新 + 错误回滚

---

## 六、风险与考虑

### 6.1 安全考虑

- API Key 加密存储（后端）
- 敏感信息脱敏显示（前端子）
- 定期轮换提醒

### 6.2 兼容性

- 保持与现有 config.yaml 兼容
- 旧用户数据迁移路径

### 6.3 性能

- 配置按需加载
- 批量更新 API

---

## 七、待讨论问题

1. **模型列表来源**: 静态硬编码还是动态从 API 获取？
2. **配置存储位置**: 数据库 vs YAML 文件 vs 两者混合？
3. **多用户隔离**: 是否需要用户级别的配置隔离？
4. **UI 风格**: 保持现有风格还是重新设计？

---

_方案版本: 1.0_
_创建日期: 2026-03-31_
