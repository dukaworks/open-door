# 噼哩噼哩 Pilipili-AutoVideo 项目架构与技术栈分析

## 文档信息

- **文档编号**: DEV-DOC-001
- **版本**: 1.0
- **创建日期**: 2026-03-26
- **项目**: Pilipili-AutoVideo
- **类型**: 架构分析文档

---

## 1. 项目概述

### 1.1 项目定位

**Pilipili-AutoVideo (噼哩噼哩)** 是一个完全本地部署的端到端 AI 视频生成代理。用户只需用一句话描述视频主题，系统即可自动完成以下全流程：

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

## 2. 系统架构总览

### 2.1 分层架构图

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

### 2.2 技术栈矩阵

| 层级 | 技术选型 | 版本 | 用途说明 |
|------|----------|------|----------|
| **后端运行时** | Python | 3.10+ | 核心业务逻辑 |
| **Web 框架** | FastAPI | 0.115+ | REST API + WebSocket |
| **工作流编排** | LangGraph (原生 asyncio) | - | 5 阶段流水线编排 |
| **前端框架** | React | 19 | SPA 应用 |
| **前端 UI** | TailwindCSS + Radix UI | - | 现代化 UI 组件 |
| **路由** | Wouter | 3.7 | 轻量级路由 |
| **图像生成** | Gemini (nano_banana) | - | 4K 关键帧生成 |
| **视频生成** | Kling 3.0 / Seedance 1.5 | - | I2V 视频生成 |
| **TTS** | MiniMax Speech 2.8 HD | - | 中文配音生成 |
| **视频组装** | FFmpeg + Python | 4.0+ | 转场、混音、字幕烧录 |
| **草稿生成** | pyJianYingDraft | - | 剪映草稿导出 |
| **记忆系统** | Mem0 + SQLite | - | 用户偏好学习 |
| **配置管理** | Pydantic + YAML | - | 配置加载与校验 |
| **部署** | Docker Compose | 20.0+ | 容器化部署（可选） |

---

## 3. 核心模块详解

### 3.1 模块目录结构

```
Pilipili-AutoVideo/
├── api/                      # FastAPI 后端服务
│   └── server.py             # 核心：工作流编排 + WebSocket
├── cli/                      # Click CLI 入口
│   └── main.py               # CLI 命令行工具
├── core/                     # 核心配置
│   └── config.py             # YAML 配置加载 + 环境变量覆盖
├── modules/                  # 核心业务模块 ⬅️ 关键
│   ├── llm.py                # LLM 脚本生成 (DeepSeek/Kimi/MiniMax/Gemini)
│   ├── image_gen.py          # 关键帧生成 (Nano Banana / Gemini Image)
│   ├── tts.py                # TTS 配音生成 (MiniMax Speech)
│   ├── video_gen.py          # 视频生成 (Kling 3.0 Omni / Seedance 1.5)
│   ├── assembler.py          # FFmpeg 视频组装
│   ├── jianying_draft.py     # 剪映草稿生成
│   └── memory.py             # Mem0 记忆系统
├── pilipili-frontend/         # React 19 前端
│   ├── client/src/
│   │   ├── pages/            # Home / Studio / Settings
│   │   ├── components/      # UI 组件
│   │   └── contexts/        # React Context
│   └── package.json
├── configs/                  # 配置文件
│   ├── config.example.yaml  # 配置模板
│   └── config.yaml          # 本地配置（gitignore）
├── data/                     # 数据目录
│   ├── outputs/             # 生成视频 + 草稿
│   ├── memory/              # SQLite 记忆库
│   └── uploads/             # 上传的参考图/视频
├── skills/                   # Skill 封装规范
│   └── SKILL.md             # AI Agent 调用规范
├── tests/                    # 单元测试
│   └── test_pipeline.py    # 18 个测试用例
├── requirements.txt         # Python 依赖
└── pyproject.toml           # 项目元信息
```

---

## 4. 数据流与工作流

### 4.1 5 阶段流水线（核心工作流）

```
┌────────────────────────────────────────────────────────────────────┐
│                        Stage 1: 脚本生成                            │
│  输入: topic (一句话主题)                                          │
│  处理: LLM (DeepSeek/Kimi/MiniMax/Gemini)                          │
│         └→ VideoScript (结构化分镜 JSON)                           │
│  输出: Scene 列表 + 角色信息 + 元数据                              │
│  特性: Agent-S Manager + Reflection 双层架构                      │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Stage 2: 人工审核关卡 ⬅️ 关键                   │
│  输入: 生成的脚本                                                   │
│  处理: WebSocket 推送状态 → 等待前端审核                           │
│  输出: 用户确认/修改后的 Scene 列表                                │
│  特性: 可暂停/恢复，最长等待 30 分钟                               │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Stage 3: 并行生成（图片 + TTS）                    │
│  图片: Nano Banana (Gemini Image) 生成 4K 关键帧                    │
│  TTS:  MiniMax Speech 生成配音 + 精确测量毫秒时长                  │
│  特性: asyncio.gather 并发执行，提升效率                          │
│  输出: keyframe_paths + voiceover_results (含精确时长)            │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                      Stage 4: 视频生成 (I2V)                       │
│  引擎: Kling v3 Omni (多镜头/多参考) 或 Seedance 1.5              │
│  模式: auto_detect_shot_mode() 自动判断生成模式                    │
│        - multi_ref: Omni 多参考生视频                              │
│        - first_end_frame: Omni 首尾帧控制                          │
│        - t2v: Omni 文生视频                                        │
│        - i2v: 传统图生视频 (回退)                                  │
│  输出: video_clips (MP4 片段)                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Stage 5: FFmpeg 组装 + 草稿导出                  │
│  组装: xfade 转场 + 配音混音 + 字幕烧录                            │
│  草稿: pyJianYingDraft 生成剪映草稿 (v2.0 分轨模式)               │
│  输出: final_video.mp4 + jianying_draft/                          │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 关键数据转换

```python
# 输入
topic: str = "Cyberpunk Mars colony, 60 seconds, cold color palette"

# Stage 1: LLM 生成
VideoScript(
    title="赛博朋克火星殖民地",
    scenes=[
        Scene(
            scene_id=1,
            duration=5.0,          # 初始估算，后续会被 TTS 时长覆盖
            image_prompt="...",    # 英文生图提示词
            video_prompt="...",    # 英文运动描述
            voiceover="...",       # 中文旁白
            ...
        ),
        ...
    ],
    characters=[...],               # 角色信息
)

# Stage 3: TTS 精确时长
voiceover_results: {
    1: ("/path/to/scene_001_voiceover.mp3", 4.8),  # (路径, 精确时长)
    2: ("/path/to/scene_002_voiceover.mp3", 5.2),
    ...
}

# 更新 scene.duration = TTS 时长 + padding
# → 实现绝对音画同步

# Stage 4: 视频生成
video_clips: {
    1: "/path/to/scene_001_clip.mp4",
    2: "/path/to/scene_002_clip.mp4",
    ...
}

# Stage 5: 最终输出
{
    "final_video": "data/outputs/xxx/output/赛博朋克火星殖民地.mp4",
    "draft_dir": "data/outputs/xxx/output/jianying_draft/",
    "script": {...},
    "total_duration": 58.5
}
```

---

## 5. 配置系统

### 5.1 双轨配置加载

```python
# core/config.py
CONFIG_SEARCH_PATHS = [
    Path("./configs/config.yaml"),           # 本地开发
    Path("./config.yaml"),                   # 项目根目录
    Path(os.path.expanduser("~/.pilipili/config.yaml")),  # 用户目录
]

# 配置优先级（从低到高）
# 1. 默认值 (dataclass 默认值)
# 2. YAML 文件 (configs/config.yaml)
# 3. 环境变量 (PILIPILI_CONFIG, DEEPSEEK_API_KEY 等)
```

### 5.2 支持的 LLM Provider

| Provider | Model | Base URL | 用途 |
|----------|-------|----------|------|
| `deepseek` | deepseek-chat | https://api.deepseek.com/v1 | 脚本生成（默认）|
| `kimi` | moonshot-v1-32k | https://api.moonshot.cn/v1 | 脚本生成 |
| `minimax` | MiniMax-Text-01 | https://api.minimax.chat/v1 | 脚本生成 |
| `zhipu` | glm-4 | https://open.bigmodel.cn/api/paas/v4 | 脚本生成 |
| `gemini` | gemini-2.5-flash | Google AI Studio | 脚本生成 + 图像理解 |
| `openai` | gpt-4o | https://api.openai.com/v1 | 脚本生成 |
| `ollama` | qwen2.5:latest | http://localhost:11434/v1 | 本地模型 |

### 5.3 环境变量覆盖

```bash
# 示例：Docker 部署时通过环境变量注入 API Key
export DEEPSEEK_API_KEY="sk-xxx"
export KLING_API_KEY="xxx"
export KLING_API_SECRET="xxx"
export MINIMAX_API_KEY="xxx"
export GEMINI_API_KEY="xxx"
```

---

## 6. 状态管理与实时通信

### 6.1 WebSocket 推送

```python
# api/server.py

class WorkflowStage(str, Enum):
    IDLE = "idle"
    GENERATING_SCRIPT = "generating_script"
    AWAITING_REVIEW = "awaiting_review"  # ⬅️ 人工审核关卡
    GENERATING_IMAGES = "generating_images"
    GENERATING_AUDIO = "generating_audio"
    GENERATING_VIDEO = "generating_video"
    ASSEMBLING = "assembling"
    COMPLETED = "completed"
    FAILED = "failed"

# 推送示例
await push_status(
    project_id="abc123",
    stage=WorkflowStage.GENERATING_IMAGES,
    progress=50,
    message="关键帧和配音生成完成，开始生成视频片段...",
    keyframes=["/path/to/kf1.png", "/path/to/kf2.png"]
)
```

### 6.2 人工审核关卡

```python
# Stage 2: 暂停工作流，等待用户审核
await push_status(
    project_id,
    WorkflowStage.AWAITING_REVIEW,
    20,
    "脚本已生成，请审核并确认分镜内容后继续",
    requires_action=True,
    action_type="review_script"
)

# 创建等待事件
review_event = asyncio.Event()
_review_events[project_id] = review_event
await asyncio.wait_for(review_event.wait(), timeout=1800)  # 30 分钟超时

# 用户提交审核决策
@app.post("/api/projects/{project_id}/review")
async def submit_review(project_id: str, decision: ReviewDecisionRequest):
    _review_decisions[project_id] = {
        "approved": decision.approved,
        "scenes": decision.scenes,  # 修改后的分镜
    }
    _review_events[project_id].set()  # 触发工作流继续
```

---

## 7. 前端架构

### 7.1 技术选型

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| TailwindCSS | 3.x | 原子化 CSS |
| Radix UI | - | 无样式 UI 组件 |
| Wouter | 3.7 | 路由（轻量级）|
| Shadcn/ui | - | 基于 Radix 的 UI 库 |
| Sonner | - | Toast 通知 |
| Zustand | - | 状态管理（可选）|

### 7.2 页面结构

```
pilipili-frontend/client/src/
├── App.tsx                    # 根组件 + 路由
├── main.tsx                   # 入口
├── pages/
│   ├── Home.tsx               # 项目列表 + 创建项目
│   ├── Studio.tsx             # 3-panel Studio (核心工作区)
│   │   ├── Left Panel         # 分镜列表 + 编辑
│   │   ├── Center Panel      # 视频预览
│   │   └── Right Panel        # Agent Console (WebSocket)
│   └── Settings.tsx           # API Key 管理 + 配置
├── components/
│   ├── ReferenceVideoPanel.tsx  # 对标视频分析
│   └── ...
└── contexts/
    └── ThemeContext.tsx       # 主题切换
```

### 7.3 3-Panel Studio 布局

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Header (项目信息)                          │
├────────────────┬─────────────────────────┬───────────────────────────┤
│                │                         │                           │
│   Left Panel   │    Center Panel         │    Right Panel           │
│   (分镜列表)   │    (视频预览 + 播放器)  │    (Agent Console)       │
│                │                         │                           │
│  - Scene 1    │   ┌─────────────────┐    │  ● 正在生成脚本...       │
│  - Scene 2    │   │                 │    │  ○ 等待审核              │
│  - Scene 3    │   │   视频预览      │    │  ○ 关键帧生成中          │
│    ...        │   │                 │    │  ○ 视频生成中            │
│                │   └─────────────────┘    │  ○ 组装完成             │
│                │                         │                           │
│  [+ 添加分镜] │   ▶ 播放 / ⏸ 暂停        │  [确认] [取消]           │
└────────────────┴─────────────────────────┴───────────────────────────┘
```

---

## 8. 记忆系统 (Mem0)

### 8.1 双层记忆架构

```python
# modules/memory.py

class MemoryManager:
    """
    记忆管理器 - 整合 Mem0 和本地 SQLite
    """

    def __init__(self):
        # 本地 SQLite 存储（始终可用）
        self.local_store = LocalMemoryStore(config.memory.local_db_path)

        # Mem0 云端（可选，需要 API Key）
        if config.memory.provider == "mem0":
            self.mem0_client = MemoryClient(api_key=...)
```

### 8.2 记忆类型

| 类型 | 存储方式 | 用途 |
|------|----------|------|
| **风格偏好** | SQLite | 视觉风格、节奏、转场、镜头运动、常用音色等 |
| **程序性记忆** | SQLite | 成功的提示词模式（按主题分类）|
| **项目历史** | SQLite | 所有历史项目记录 |
| **语义记忆** | Mem0 Cloud | 跨项目的语义搜索 |

### 8.3 学习机制

```python
# 被动学习：从生成的脚本中自动积累
memory.learn_from_script(script_data, project_id)

# 隐式学习：从用户的手动修改中学习
memory.learn_from_user_edit(project_id, scene_id, field, old_value, new_value)

# 显式学习：从用户评分中学习
memory.learn_from_rating(project_id, rating)  # rating >= 4 强化，<= 2 衰减

# 应用：生成新脚本时注入上下文
memory_context = memory.build_context_for_generation(topic)
# → 注入到 LLM System Prompt
```

---

## 9. 对标视频分析（v2.0 新增）

### 9.1 分析流程

```
上传对标视频
     │
     ▼
Gemini Video Understanding (或关键帧回退)
     │
     ▼
提取：人物列表 + 分镜结构 + 反推提示词
     │
     ▼
用户可替换角色参考图
     │
     ▼
创建项目，跳过 LLM，直接使用分析分镜
```

### 9.2 API 端点

```python
# 上传视频
POST /api/analyze/upload
→ analysis_id

# 查询结果
GET /api/analyze/{analysis_id}
→ {
    "status": "completed",
    "result": {
        "title": "...",
        "characters": [...],  # 人物外貌 + 英文提示词
        "scenes": [...],     # 分镜（含 reverse_prompt）
        "overall_prompt": "...",
        ...
    }
}

# 替换角色参考图
POST /api/analyze/{analysis_id}/replace-character
→ character.replacement_image = 用户上传的图
```

---

## 10. 错误处理与容错

### 10.1 会话级模型黑名单

```python
# modules/image_gen.py

_FAILED_MODELS: set[str] = set()  # 进程级单例

def _mark_model_failed(model_name: str, reason: str):
    """模型失败则加入黑名单，本次任务不再重试"""
    _FAILED_MODELS.add(model_name)

# 使用
available_models = [m for m in model_list if m not in _FAILED_MODELS]
```

### 10.2 重试策略

| 模块 | 重试策略 |
|------|----------|
| **LLM** | JSON 解析失败 → 多策略解析（markdown/前缀/后缀）|
| **Image Gen** | IMAGE_SAFETY → 简化 prompt 重试 → 占位图兜底 |
| **TTS** | 1002/1004 限速 → 指数退避（5s, 10s, 20s, 40s）|
| **Video Gen** | Omni 失败 → 抛出异常（不降级）|

---

## 11. 测试覆盖

```bash
# 运行测试
python -m pytest tests/test_pipeline.py -v

# 测试分类
pytest -v -m "not api and not e2e"  # 单元测试（无需 API Key）
pytest -v -m "api"                  # 集成测试（需要真实 Key）
pytest -v -m "e2e"                  # 端到端测试

# 当前覆盖
→ 18 个测试用例，全部通过
```

---

## 12. 部署模式

### 12.1 开发模式

```bash
# 后端
python cli/main.py server

# 前端
cd pilipili-frontend
pnpm install && pnpm dev

# 访问 http://localhost:3000
```

### 12.2 生产模式 (Docker)

```bash
# 复制环境变量
cp .env.example .env
# 编辑 .env 填入 API Keys

# 启动
docker-compose up -d

# 访问 http://localhost:3000
```

### 12.3 CLI 模式

```bash
# 基本用法
python cli/main.py run --topic "Cyberpunk Mars colony, 60 seconds"

# 指定引擎
python cli/main.py run --topic "Ancient palace" --engine seedance

# 列出历史项目
python cli/main.py list
```

---

## 13. 扩展性与未来规划

### 13.1 当前可扩展点

| 扩展点 | 当前实现 | 可扩展方向 |
|--------|----------|------------|
| **LLM Provider** | 7 种 | 添加 Anthropic/Ollama/本地模型 |
| **图像生成** | Nano Banana | 添加 DALL-E 3/Midjourney |
| **视频生成** | Kling/Seedance | 添加 Runway/Pika/Luma |
| **TTS** | MiniMax | 添加 ElevenLabs/Cosine |
| **记忆系统** | Mem0 + SQLite | 添加向量数据库（Milvus/Qdrant）|
| **Agent 集成** | Skill 封装 | MCP 协议支持 |

### 13.2 计划功能

- [ ] **多用户支持**：用户认证 + 隔离
- [ ] **API 代理层**：统一 API 代理（OpenRouter 模式）
- [ ] **更丰富的视频生成引擎**：Runway、Pika、Luma
- [ ] **实时协作**：多人同时编辑项目
- [ ] **模板系统**：预设视频模板（科普/种草/剧情）
- [ ] **视频理解**：上传现有视频，自动分析并重新生成

---

## 14. 总结

**Pilipili-AutoVideo** 是一个架构清晰、技术选型现代化、功能完整度高的端到端 AI 视频生成系统。其核心优势在于：

1. **绝对音画同步**：TTS 时长测量 → 视频 duration 控制
2. **关键帧锁策略**：高质量首帧 → 主体一致性
3. **记忆系统**：随使用次数增长，风格越来越匹配用户
4. **分轨草稿**：剪映中可单独替换每个分镜

架构设计遵循以下原则：
- **分层清晰**：前端 / API / 业务 / 能力 / 基础设施
- **模块独立**：每个模块可独立测试和替换
- **配置驱动**：双轨配置（YAML + 环境变量）
- **错误容错**：黑名单 + 重试 + 兜底

该系统既可作为个人创作工具，也可作为 AI Agent 的视频生成能力引擎，具备良好的可扩展性和商业化潜力。

---

*文档版本: 1.0 | 最后更新: 2026-03-26*