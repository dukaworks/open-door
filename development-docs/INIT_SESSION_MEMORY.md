# Pilipili-AutoVideo 项目启动记忆

> 本文件作为项目的初始化记忆文档，记录项目背景、架构、升级计划和待办事项。
> 每次新会话开始时，请先阅读此文件以了解项目上下文。

---

## 1. 项目概述

### 1.1 项目定位

**Pilipili-AutoVideo（噼哩噼哩）** 是一个完全本地部署的端到端 AI 视频生成代理。用户只需用一句话描述视频主题，系统即可自动完成：

1. 脚本策划与分镜设计（LLM）
2. 关键帧图像生成（Nano Banana / Gemini Image）
3. TTS 配音生成与时长测量（MiniMax TTS）
4. 视频片段生成（Kling 3.0 / Seedance 1.5）
5. FFmpeg 智能组装与字幕烧录
6. 剪映/剪映专业版草稿导出

### 1.2 核心差异化特性

| 特性 | 描述 |
|------|------|
| **绝对音画同步** | TTS 配音先生成并精确测量毫秒级时长，再以此控制视频 duration，实现完美音画对齐 |
| **关键帧锁策略** | Nano Banana 先生成 4K 关键帧图，再以此生成视频片段，确保主体一致性，无漂移 |
| **数字孪生记忆** | Mem0 驱动的记忆系统随项目数量增长持续学习用户风格偏好 |
| **技能化封装** | 整个工作流封装为标准 Skill，可被任意 AI Agent 调用 |

---

## 2. 系统架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        前端层 (React 19 + TailwindCSS)              │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────────────┐  │
│   │ Home    │  │ Studio  │  │Settings │  │ WebSocket Agent      │  │
│   │ (项目列表)│  │ (3-panel │  │ (API   │  │ Console (实时状态)   │  │
│   │         │  │ Studio)  │  │ Key管理)│  │                      │  │
│   └─────────┘  └─────────┘  └─────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        API 层 (FastAPI + LangGraph Workflow)       │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  REST API (项目 CRUD) │ WebSocket (实时推送) │ 人工审核关卡   │  │
│   └─────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        业务编排层 (LangGraph)                       │
│   ┌──────────┬──────────┬──────────┬──────────┬───────────────┐    │
│   │ 脚本生成 │ 分镜审核 │ 图片生成 │ TTS生成   │ 视频生成       │    │
│   │ (Stage1)│ (Stage2) │ (Stage3) │ (Stage3) │ (Stage4)       │    │
│   └──────────┴──────────┴──────────┴──────────┴───────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                        核心能力层 (modules/)                        │
│   ┌────────┬────────┬────────┬────────┬────────┬────────┬───────┐  │
│   │ LLM    │ImageGen│ TTS    │VideoGen│Assembler│JianYing│Memory │  │
│   │ 脚本   │ 关键帧 │ 配音   │ 视频   │ 组装    │ 草稿   │ 记忆  │  │
│   │ 生成   │ 生成   │ 生成   │ 生成   │ 拼接    │ 生成   │ 系统  │  │
│   └────────┴────────┴────────┴────────┴────────┴────────┴───────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        基础设施层                                    │
│   ┌──────────────┬──────────────┬──────────────┬────────────────┐  │
│   │ Python 3.10+ │ FFmpeg 4.0+  │ SQLite (本地) │ Docker (可选)   │  │
│   └──────────────┴──────────────┴──────────────┴────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块

| 模块 | 文件 | 功能 |
|------|------|------|
| LLM | `modules/llm.py` | 脚本生成（DeepSeek/Kimi/MiniMax/Gemini） |
| ImageGen | `modules/image_gen.py` | 关键帧生成（Nano Banana / Gemini Image） |
| TTS | `modules/tts.py` | 配音生成（MiniMax Speech）+ 时长测量 |
| VideoGen | `modules/video_gen.py` | 视频生成（Kling 3.0 Omni / Seedance 1.5） |
| Assembler | `modules/assembler.py` | FFmpeg 视频组装、转场、字幕烧录 |
| JianYingDraft | `modules/jianying_draft.py` | 剪映草稿生成（v2.0 分轨模式） |
| Memory | `modules/memory.py` | Mem0 记忆系统（风格偏好学习） |

---

## 3. 历史会话总结

### 3.1 之前的讨论（SESSION_HISTORY_2026-03-25）

| 主题 | 结论 |
|------|------|
| **3-panel Studio 是什么** | 不是独立 chatbot，是 Pilipili 的前端工作区界面，包含：左面板（分镜列表）、中面板（视频预览）、右面板（Agent Console） |
| **如何让 AI 记住项目进度** | 最佳实践：维护 `development-docs/MEETING_PROGRESS_SUMMARY.md`，每次新会话先读此文件 |
| **对话历史存储** | OpenCode 会话数据可能在云端加密存储，建议手动保存进度文档 |

### 3.2 开发文档清单

已完成的详细设计文档（共 9 篇）：

| 文档 | 内容 | 状态 |
|------|------|------|
| `00-project structure.md` | 项目结构 | ✅ |
| `01-project-architecture-and-tech-stack.md` | 架构与技术栈 | ✅ |
| `02-business-logic-and-core-code.md` | 业务逻辑与核心代码 | ✅ |
| `03-user-authentication-management.md` | 用户认证管理升级计划 | ✅ 设计 + 实现 |
| `04-unified-api-proxy-platform.md` | 统一 API 代理平台支持 | ✅ 设计 |
| `05-performance-optimization.md` | 性能优化指南 | ✅ 设计 |
| `06-deployment-and-operations.md` | 部署与运维指南 | ✅ |
| `07-troubleshooting-guide.md` | 故障排查指南 | ✅ |
| `08-api-reference-documentation.md` | API 参考文档 | ✅ |
| `09-ecosystem-and-plugin-system-design.md` | 生态与插件系统设计 | ✅ 设计 |

### 3.3 Phase 1 完成状态（2026-03-29）

**用户认证系统** 已完成实现：

| 任务 | 文件 | 状态 |
|------|------|------|
| 配置添加 | `core/config.py` - AuthConfig | ✅ |
| 认证模块 | `api/auth.py` - 用户注册/登录/JWT | ✅ |
| 依赖注入 | `api/auth.py` - get_current_user | ✅ |
| 路由注册 | `api/server.py` - include_router | ✅ |
| 用户隔离 | `api/server.py` - 项目 API | ✅ |
| 前端 AuthContext | `contexts/AuthContext.tsx` | ✅ |
| 登录页面 | `pages/Login.tsx` | ✅ |
| 路由保护 | `App.tsx` | ✅ |
| API Token | `lib/api.ts` | ✅ |

**向后兼容**：默认 `auth.enabled = false`，保持单用户模式

---

## 4. 升级路线图

基于现有设计文档，项目的核心升级方向如下：

### 4.1 Phase 1：用户认证系统（优先级：高）

**目标**：从单用户本地工具升级为多用户认证系统

| 任务 | 说明 |
|------|------|
| 数据库设计 | users, user_api_keys, projects, api_usage, audit_logs 表 |
| JWT 认证 | 注册、登录、Token 验证、依赖注入 |
| 用户隔离 | 项目 CRUD 按 user_id 隔离 |
| API Key 管理 | 用户独立存储（加密）、状态查询 |

**预计工时**：3-4 周

### 4.2 Phase 2：统一 API 代理平台（优先级：中）

**目标**：统一所有外部 API 调用，支持故障转移和限流

| 任务 | 说明 |
|------|------|
| 代理层架构 | modules/proxy/ 目录 |
| 服务注册表 | 模型名到实际 API 的映射 |
| 故障转移 | 主服务不可用时自动切换备选 |
| 限流控制 | 自适应限流、速率限制 |
| OpenRouter 集成 | 可选：通过 OpenRouter 统一调用 |

**预计工时**：2-3 周

### 4.3 Phase 3：性能优化（优先级：中）

**目标**：提升生成效率，降低资源占用

| 优化方向 | 预期收益 |
|----------|----------|
| 并发优化 | 自适应限流、优先级队列、智能批量 → 吞吐量 +50% |
| 缓存策略 | 多级缓存（内存/磁盘）→ 重复请求 -80% |
| 资源优化 | FFmpeg 进程池、内存管理 → 内存 -30% |
| 数据库优化 | 索引优化、连接池 → 查询性能 +100% |

**预计工时**：2-3 周

### 4.4 Phase 4：生态与插件系统（优先级：低-长期）

**目标**：构建开发者生态，扩展系统能力

| 阶段 | 任务 | 交付物 |
|------|------|--------|
| Phase 4.1 | Skill 系统 | SKILL.md 规范、SkillRegistry、5 个内置 Skill |
| Phase 4.2 | 插件框架 | Plugin 基类、插件市场后端 |
| Phase 4.3 | MCP 集成 | MCP Server、Python/JS SDK |

**预计工时**：3-6 个月

---

## 5. 当前技术债务与待解决问题

### 5.1 立即需要解决的

| 问题 | 影响 | 优先级 |
|------|------|--------|
| 无用户认证 | 无法多用户使用、API Key 不安全 | P0 |
| 配置存储在文件 | 多用户无法独立配置 | P0 |
| 错误处理不完善 | 生产环境稳定性风险 | P1 |

### 5.2 中期需要解决的

| 问题 | 影响 | 优先级 |
|------|------|--------|
| 无使用统计 | 无法统计 API 消费 | P1 |
| 无审计日志 | 安全合规风险 | P2 |
| 插件系统未实现 | 生态扩展受限 | P2 |

---

## 6. 接下来的工作

根据前面的讨论，我们决定从 **Phase 1：用户认证系统** 开始。

### 6.1 第一阶段任务分解

```
tasks:
  - 数据库设计与实现
    → 创建 migration 脚本
    → users, user_api_keys, projects, api_usage, audit_logs
    
  - 认证 API 实现
    → POST /api/auth/register
    → POST /api/auth/login
    → POST /api/auth/forgot-password
    → POST /api/auth/reset-password
    
  - 依赖注入实现
    → get_current_user()
    → 用户隔离的 Projects API
    
  - 用户 API Key 管理
    → POST /api/keys (加密存储)
    → GET /api/keys/status (脱敏)
    
  - 前端登录/注册页面
    → React 组件实现
    
  - 向后兼容
    → 单用户模式兼容逻辑
```

### 6.2 开始之前需要确认

1. **数据库选择**：SQLite（当前）还是 PostgreSQL（生产）？
2. **认证模式**：始终要求登录，还是保持单用户兼容模式？
3. **优先级**：是否先实现核心的注册/登录，其他功能后续迭代？

---

## 7. 文件位置

| 文件 | 路径 |
|------|------|
| 项目根目录 | `G:\GithubSpace\Pilipili-AutoVideo` |
| 开发文档 | `development-docs/` |
| 后端代码 | `api/`, `modules/`, `cli/` |
| 前端代码 | `pilipili-frontend/` |
| 配置文件 | `configs/config.yaml` |
| 测试 | `tests/test_pipeline.py` |

---

## 8. 如何继续

每次开始新会话时：

1. **先读此文件**：`read development-docs/INIT_SESSION_MEMORY.md`
2. **检查进度**：`read development-docs/MEETING_PROGRESS_SUMMARY.md`
3. **如有新文档**：更新本文件的 `升级路线图` 和 `接下来的工作` 部分

---

> 最后更新：2026-03-26
> 关联会话：ses_2d981daadffeWyIB9NLP56nbeN
