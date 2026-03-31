# 后端 API 设计（阶段一）

> 可独立调试的 API 接口

---

## 1. 数据库表结构

### 1.1 用户配置表 (user_config)

```sql
CREATE TABLE IF NOT EXISTS user_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    config_type TEXT NOT NULL,  -- 'llm', 'image_gen', 'video_gen', 'tts', 'memory'
    provider TEXT NOT NULL,     -- 'deepseek', 'kimi', 'kling', 'openrouter' etc.

    -- 配置内容
    api_key TEXT,               -- 加密存储
    api_secret TEXT,            -- 可选（如 Kling）
    model TEXT,                 -- 可选，留空使用默认
    base_url TEXT,              -- 可选，留空使用默认
    custom_params TEXT,         -- JSON，自定义参数

    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, config_type, provider)
);
```

### 1.2 模型缓存表 (provider_models_cache)

```sql
CREATE TABLE IF NOT EXISTS provider_models_cache (
    provider TEXT PRIMARY KEY,
    models_json TEXT NOT NULL,    -- 模型列表 JSON
    cached_at TEXT NOT NULL        -- 缓存时间
);
```

### 1.3 预设套餐表 (preset_packages)

```sql
CREATE TABLE IF NOT EXISTS preset_packages (
    id TEXT PRIMARY KEY,          -- 'basic', 'pro', 'flagship'
    name TEXT NOT NULL,
    description TEXT,
    services_json TEXT NOT NULL,   -- 服务列表 JSON
    sort_order INTEGER DEFAULT 0
);
```

---

## 2. API 端点

### 2.1 提供商相关

| 端点                                | 方法 | 说明                          |
| ----------------------------------- | ---- | ----------------------------- |
| `/api/providers`                    | GET  | 获取所有支持的提供商列表      |
| `/api/providers/{provider}/models`  | GET  | 获取模型列表（自动获取+缓存） |
| `/api/providers/{provider}/refresh` | POST | 强制刷新模型列表              |

### 2.2 用户配置相关

| 端点                    | 方法 | 说明           |
| ----------------------- | ---- | -------------- |
| `/api/user/config`      | GET  | 获取用户配置   |
| `/api/user/config`      | POST | 保存/更新配置  |
| `/api/user/config/test` | POST | 测试配置有效性 |

### 2.3 套餐相关

| 端点            | 方法 | 说明             |
| --------------- | ---- | ---------------- |
| `/api/packages` | GET  | 获取预设套餐列表 |

---

## 3. 预定义数据

### 3.1 提供商默认 URL

```python
DEFAULT_BASE_URLS = {
    "deepseek": "https://api.deepseek.com/v1",
    "kimi": "https://api.moonshot.cn/v1",
    "minimax": "https://api.minimax.chat/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1",
    "kling": "https://api-beijing.klingai.com",
    "seedance": "https://ark.cn-beijing.volces.com/api/v3",
    "openrouter": "https://openrouter.ai/api/v1",
    "oneapi": "http://localhost:3000/v1",  # OneAPI 本地
    "ollama": "http://localhost:11434/v1",
}
```

### 3.2 预设套餐

| 套餐 ID  | 名称   | 包含服务                                                      |
| -------- | ------ | ------------------------------------------------------------- |
| basic    | 基础版 | deepseek(llm), nano_banana(image), kling(video), minimax(tts) |
| pro      | 专业版 | kimi, minimax, nano_banana, kling, seedance, memory           |
| flagship | 旗舰版 | 全部 + 优先通道                                               |

---

## 4. 调试测试

### 测试用例

```bash
# 1. 获取提供商列表
curl http://localhost:8000/api/providers

# 2. 获取模型列表（会自动获取并缓存）
curl http://localhost:8000/api/providers/deepseek/models

# 3. 刷新模型列表
curl -X POST http://localhost:8000/api/providers/deepseek/refresh

# 4. 获取用户配置
curl http://localhost:8000/api/user/config

# 5. 保存配置
curl -X POST http://localhost:8000/api/user/config \
  -H "Content-Type: application/json" \
  -d '{"config_type":"llm", "provider":"deepseek", "api_key":"sk-xxx", "model":"deepseek-chat"}'

# 6. 测试配置
curl -X POST http://localhost:8000/api/user/config/test \
  -H "Content-Type: application/json" \
  -d '{"config_type":"llm", "provider":"deepseek", "api_key":"sk-xxx"}'

# 7. 获取套餐列表
curl http://localhost:8000/api/packages
```

---

## 5. 实现顺序

1. **数据库初始化** - 创建表结构
2. **预设数据** - 插入套餐数据
3. **提供商 API** - providers, models, refresh
4. **配置 API** - CRUD + test
5. **套餐 API** - packages

---

_先实现这些接口，你就可以开始调试了_
