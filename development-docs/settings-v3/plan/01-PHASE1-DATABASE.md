# 阶段一：数据库层改造详细步骤

## 目标
创建新的配置数据表，建立数据访问层，完成基础数据结构搭建。

## 预计时间
2-3 天

## 详细步骤

### 步骤 1.1：备份当前状态（必须）

**执行命令**：
```bash
# 创建 Git 备份标签
git tag -a v2.0-settings-phase1-start -m "阶段一：数据库改造起始点"

# 备份当前数据库
cp data/auth.db development-docs/settings-v3/backup/auth-$(date +%Y%m%d).db
cp data/config/user_config.db development-docs/settings-v3/backup/user_config-$(date +%Y%m%d).db 2>/dev/null || true
```

**完成检查**：
- [ ] 标签已创建
- [ ] 数据库备份文件存在

---

### 步骤 1.2：创建新数据库模块文件

**创建文件**：`api/config_db_v3.py`

**内容要求**：
1. 定义所有新表结构
2. 实现初始化函数 `init_config_db_v3()`
3. 实现数据访问函数
4. 插入预设数据

**关键函数清单**：
- `init_config_db_v3()` - 初始化数据库
- `migrate_from_yaml()` - 从 config.yaml 迁移数据
- `get_providers(user_id)` - 获取用户的服务商列表
- `save_provider_config(user_id, provider_id, api_key, ...)` - 保存配置
- `get_models(provider_id)` - 获取模型列表
- `get_packages()` - 获取套餐列表
- `get_user_config(user_id)` - 获取用户运行时配置
- `save_user_config(user_id, config)` - 保存用户配置

**完成检查**：
- [ ] 文件创建成功
- [ ] 无语法错误
- [ ] 函数签名正确

---

### 步骤 1.3：实现 Providers 表操作

**数据库表结构**：
```sql
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL,  -- 'llm', 'image', 'video', 'tts'
    description TEXT,
    base_url TEXT,
    is_preset INTEGER DEFAULT 1,
    requires_secret INTEGER DEFAULT 0,
    created_by TEXT DEFAULT 'system',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**实现函数**：
- `get_all_providers()` - 获取所有预设服务商
- `add_custom_provider(user_id, provider_data)` - 用户添加自定义服务商

**预设数据**：
- deepseek, kimi, minimax, gemini (llm)
- nano_banana (image)
- kling, seedance (video)
- minimax_tts (tts)

**完成检查**：
- [ ] 表创建成功
- [ ] 预设数据插入成功
- [ ] 查询测试通过

---

### 步骤 1.4：实现 UserProviderConfigs 表操作

**数据库表结构**：
```sql
CREATE TABLE IF NOT EXISTS user_provider_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    api_key TEXT,
    api_secret TEXT,
    base_url TEXT,
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider_id)
);
```

**实现函数**：
- `get_user_provider_configs(user_id)` - 获取用户的所有配置
- `save_user_provider_config(user_id, provider_id, config)` - 保存配置
- `delete_user_provider_config(user_id, provider_id)` - 删除配置
- `get_active_provider_config(user_id, provider_type)` - 获取默认启用的配置

**完成检查**：
- [ ] 表创建成功
- [ ] CRUD 操作测试通过
- [ ] 多用户隔离测试通过

---

### 步骤 1.5：实现 Models 表操作

**数据库表结构**：
```sql
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model_id TEXT NOT NULL,  -- 厂商API用的ID
    provider_id TEXT NOT NULL,
    
    -- 视频模型专用
    duration INTEGER,
    ratio TEXT,
    quality TEXT,
    
    -- 图片模型专用
    output_resolution TEXT,
    
    -- 配音模型专用
    voice TEXT,
    speed REAL,
    emotion TEXT,
    
    is_preset INTEGER DEFAULT 1,
    cached_at TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);
```

**实现函数**：
- `get_models_by_provider(provider_id)` - 获取服务商的模型列表
- `refresh_models_from_provider(provider_id, api_key)` - 从厂商API刷新模型列表
- `save_model(model_data)` - 保存模型信息

**硬编码预设模型**（作为 fallback）：
- deepseek: deepseek-chat, deepseek-coder
- kling: kling-v3, kling-v3-omni
- seedance: doubao-seedance-1-5-pro
- minimax: abab6.5s-chat

**完成检查**：
- [ ] 表创建成功
- [ ] 预设模型数据插入成功
- [ ] 查询测试通过

---

### 步骤 1.6：实现 Packages 表操作

**数据库表结构**：
```sql
CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    is_preset INTEGER DEFAULT 1,
    services_json TEXT NOT NULL,
    created_by TEXT DEFAULT 'system'
);
```

**services_json 格式示例**：
```json
{
  "llm": {"provider_id": "deepseek", "model_id": "deepseek-chat"},
  "video": {"provider_id": "kling", "model_id": "kling-v3"},
  "image": {"provider_id": "nano_banana"},
  "tts": {"provider_id": "minimax", "model_id": "speech-02-hd", "voice": "female-shaonv"}
}
```

**实现函数**：
- `get_all_packages()` - 获取所有套餐
- `create_custom_package(user_id, package_data)` - 创建自定义套餐
- `delete_package(package_id, user_id)` - 删除套餐（只能删除自己创建的）

**预设套餐**：
1. basic（基础版）- 免费体验推荐
2. pro（专业版）- 全功能解锁
3. flagship（旗舰版）- 无限可能

**完成检查**：
- [ ] 表创建成功
- [ ] 3个预设套餐插入成功
- [ ] JSON 解析测试通过

---

### 步骤 1.7：实现 UserConfigs 表操作

**数据库表结构**：
```sql
CREATE TABLE IF NOT EXISTS user_configs (
    id INTEGER PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    package_id TEXT,
    
    -- 当前选择的提供商和模型
    llm_provider_id TEXT,
    llm_model_id TEXT,
    video_provider_id TEXT,
    video_model_id TEXT,
    image_provider_id TEXT,
    tts_provider_id TEXT,
    tts_model_id TEXT,
    
    -- 运行时参数
    video_duration INTEGER DEFAULT 5,
    video_ratio TEXT DEFAULT '16:9',
    video_quality TEXT DEFAULT 'high',
    multi_shot INTEGER DEFAULT 0,
    
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**实现函数**：
- `get_user_config(user_id)` - 获取用户配置
- `save_user_config(user_id, config)` - 保存用户配置
- `apply_package(user_id, package_id)` - 应用套餐到用户配置

**完成检查**：
- [ ] 表创建成功
- [ ] 新用户自动创建默认配置
- [ ] 套餐应用逻辑测试通过

---

### 步骤 1.8：实现 SystemSettings 表操作

**数据库表结构**：
```sql
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    category TEXT,
    description TEXT,
    is_editable INTEGER DEFAULT 1,
    is_visible INTEGER DEFAULT 1,
    updated_by TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**初始数据**（从 config.yaml 迁移）：
- memory_provider: 'local'
- jianying_enabled: true
- jianying_draft_dir: './data/outputs/jianying_drafts'
- whisperx_model: 'base'
- ffmpeg_path: 'ffmpeg'

**实现函数**：
- `get_system_setting(key)` - 获取配置项
- `set_system_setting(key, value, user_id)` - 设置配置项
- `get_settings_by_category(category)` - 按分类获取配置

**完成检查**：
- [ ] 表创建成功
- [ ] config.yaml 数据迁移成功
- [ ] 读写测试通过

---

### 步骤 1.9：编写迁移脚本

**创建文件**：`scripts/migrate_config_to_db.py`

**功能**：
1. 读取现有的 config.yaml
2. 将配置迁移到新数据库表
3. 保留原有 config.yaml 作为备份

**迁移逻辑**：
```python
# 1. 迁移 Providers（llm, video_gen, tts 等）
# 2. 迁移 Models（从硬编码列表）
# 3. 插入预设 Packages
# 4. 创建默认 UserConfigs
# 5. 迁移 SystemSettings（memory, jianying, local）
```

**完成检查**：
- [ ] 脚本可正常执行
- [ ] 迁移后数据完整
- [ ] 无重复数据

---

### 步骤 1.10：创建阶段完成备份

**执行命令**：
```bash
# 创建阶段完成标签
git add api/config_db_v3.py scripts/migrate_config_to_db.py
git commit -m "PHASE 1: 数据库层改造完成

- 新增 Providers 表及操作
- 新增 UserProviderConfigs 表（多用户隔离）
- 新增 Models 表及缓存机制
- 新增 Packages 表（3个预设套餐）
- 新增 UserConfigs 表（运行时配置）
- 新增 SystemSettings 表（通用配置）
- 创建配置迁移脚本"

git tag -a v2.0-settings-phase1-complete-$(date +%Y%m%d) -m "阶段一完成：数据库层"

# 备份数据库
cp data/config/user_config.db development-docs/settings-v3/backup/phase1-complete.db
```

**完成文档**：
创建 `development-docs/settings-v3/progress/phase1-complete.md`，记录：
- 完成时间
- 主要改动
- 测试结果
- 已知问题

---

## 阶段一完成标准

- [ ] 所有 6 个数据表创建成功
- [ ] 预设数据插入完整
- [ ] 数据访问函数实现并通过测试
- [ ] 迁移脚本可用
- [ ] Git 标签已创建
- [ ] 数据库已备份
- [ ] 阶段完成文档已编写

## 进入下一阶段条件

所有完成标准检查项通过，即可进入阶段二。
