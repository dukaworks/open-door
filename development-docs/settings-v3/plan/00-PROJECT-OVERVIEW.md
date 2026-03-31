# Settings System v3.0 改造项目总览

## 项目背景

当前配置体系存在的问题：
1. 配置分散在 config.yaml、数据库、环境变量多处
2. Settings.tsx (旧版) 和 SettingsDialog.tsx (半成品) 并存
3. 用户选择引擎后可能未配置 API Key，导致运行时错误
4. 缺乏统一的用户友好的配置引导

## 改造目标

构建一个**统一、易用、分层**的配置管理系统：
- **小白用户**：选择套餐 → 填 API Key → 开始使用
- **进阶用户**：切换模型、调整参数
- **高级用户**：自定义 Base URL、管理多提供商

## 核心原则

1. **配置统一入口**：数据库为主，config.yaml 为 fallback
2. **运行时检查**：底部菜单选择引擎时验证配置状态
3. **即时反馈**：每个配置项可测试连接
4. **逐步引导**：未配置时引导用户完成，而非报错

## 数据表架构

### 1. Providers（服务商）
```sql
id: TEXT PRIMARY KEY              -- 'kling', 'deepseek'
name: TEXT                        -- 显示名
provider_type: TEXT               -- 'llm' | 'image' | 'video' | 'tts'
description: TEXT                 -- 特长描述
base_url: TEXT                    -- 默认 Base URL
is_preset: BOOLEAN                -- 系统预设
requires_secret: BOOLEAN          -- 是否需要 api_secret
created_by: TEXT                  -- user_id 或 'system'
status: TEXT                      -- 'active' | 'disabled'
created_at: TIMESTAMP
```

### 2. Models（模型参数）
```sql
id: TEXT PRIMARY KEY              -- 'kling-v3-omni'
name: TEXT                        -- 显示名
model_id: TEXT                    -- 厂商API用的ID
provider_id: TEXT FOREIGN KEY     -- 关联 Providers

-- 视频模型专用（可空）
duration: INTEGER                 -- 默认时长(秒)
ratio: TEXT                       -- '16:9' | '9:16' | '1:1'
quality: TEXT                     -- 'high' | 'medium' | 'low'

-- 图片模型专用（可空）
output_resolution: TEXT           -- '4K' | '2K' | '1080p'

-- 配音模型专用（可空）
voice: TEXT                       -- 音色ID
speed: FLOAT                      -- 语速
emotion: TEXT                     -- 情绪

is_preset: BOOLEAN
cached_at: TIMESTAMP              -- 缓存更新时间
```

### 3. UserProviderConfigs（用户的提供商配置）
```sql
id: INTEGER PRIMARY KEY AUTOINCREMENT
user_id: TEXT                     -- 多用户隔离
provider_id: TEXT FOREIGN KEY     -- 关联 Providers
api_key: TEXT                     -- 用户填的 API Key
api_secret: TEXT                  -- 可选（如 Kling）
base_url: TEXT                    -- 可覆盖默认
is_active: BOOLEAN                -- 是否启用
is_default: BOOLEAN               -- 是否默认
updated_at: TIMESTAMP
UNIQUE(user_id, provider_id)
```

### 4. Packages（套餐模板）
```sql
id: TEXT PRIMARY KEY              -- 'basic', 'pro', 'flagship', uuid
name: TEXT                        -- '基础版'
icon: TEXT                        -- '🌟'
description: TEXT                 -- '免费体验推荐'
is_preset: BOOLEAN                -- 系统预设
services_json: TEXT               -- JSON格式套餐内容
created_by: TEXT                  -- user_id 或 'system'
```

### 5. UserConfigs（用户运行时配置）
```sql
id: INTEGER PRIMARY KEY
user_id: TEXT UNIQUE               -- 每个用户一条记录
package_id: TEXT                   -- 可选，关联 Packages
-- 实际生效的配置
llm_provider_id: TEXT
llm_model_id: TEXT
video_provider_id: TEXT
video_model_id: TEXT
image_provider_id: TEXT
tts_provider_id: TEXT
tts_model_id: TEXT
-- 运行时参数
video_duration: INTEGER
video_ratio: TEXT
video_quality: TEXT
multi_shot: BOOLEAN
updated_at: TIMESTAMP
```

### 6. SystemSettings（系统通用配置）
```sql
key: TEXT PRIMARY KEY              -- 'memory_provider', 'jianying_enabled'
value: TEXT                        -- JSON格式
category: TEXT                     -- 'memory' | 'jianying' | 'server'
description: TEXT
is_editable: BOOLEAN               -- 是否允许用户修改
is_visible: BOOLEAN                -- 用户可见
updated_by: TEXT
updated_at: TIMESTAMP
```

## 配置优先级策略

```
读取优先级（从高到低）：

1. UserProviderConfigs（用户配置的 API Key）
   ↓
2. SystemSettings（数据库系统配置）
   ↓
3. 环境变量（Docker/K8s 部署覆盖）
   ↓
4. config.yaml（文件级配置）
   ↓
5. 代码默认值
```

## 工作阶段规划

### 阶段一：数据库层改造（2-3天）
- [ ] 创建新的数据表（Providers, Models, UserProviderConfigs, Packages, UserConfigs, SystemSettings）
- [ ] 编写数据库初始化脚本
- [ ] 迁移现有 config.yaml 配置到数据库
- [ ] 创建数据访问层 API

### 阶段二：后端 API 改造（2-3天）
- [ ] 创建 /api/v3/providers CRUD 接口
- [ ] 创建 /api/v3/models 接口（含缓存机制）
- [ ] 创建 /api/v3/packages 接口
- [ ] 创建 /api/v3/user/config 接口
- [ ] 创建 /api/v3/system/settings 接口
- [ ] 实现配置测试连接功能
- [ ] 修改工作流读取配置的入口

### 阶段三：前端界面改造（3-4天）
- [ ] 重构 SettingsDialog.tsx 组件结构
- [ ] 实现"套餐选择"标签页
- [ ] 实现"提供商配置"标签页
- [ ] 实现"系统设置"标签页
- [ ] 底部菜单集成配置检查
- [ ] 实现配置测试反馈 UI

### 阶段四：集成与测试（2天）
- [ ] 前后端联调
- [ ] 迁移旧数据兼容性测试
- [ ] 废弃 Settings.tsx 旧页面
- [ ] 整体功能测试

### 阶段五：文档与发布（1天）
- [ ] 更新配置文档
- [ ] 编写用户操作指南
- [ ] 发布新版本

## 备份策略

每个阶段完成后必须：
1. 创建 Git 标签：`v2.0-settings-phase{N}-{date}`
2. 导出数据库备份到 `development-docs/settings-v3/backup/`
3. 记录阶段完成文档到 `development-docs/settings-v3/progress/`

## 风险与应对

| 风险 | 应对措施 |
|------|----------|
| 旧配置迁移失败 | 保留 config.yaml 完整读取逻辑作为 fallback |
| 多用户数据隔离问题 | 所有查询必须带 user_id 过滤 |
| API 测试连接超时 | 设置 5 秒超时，异步返回结果 |
| 模型列表获取失败 | 使用硬编码默认列表兜底 |

## 参与人员

- 产品/架构：用户
- 开发：CodeBuddy (AI Assistant)

## 启动时间

2026-03-31

## 预期完成时间

10-12 个工作日
