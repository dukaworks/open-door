
# 项目结构

```text
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
├── pilipili-frontend/        # React 19 前端
│   ├── client/src/
│   │   ├── pages/            # Home / Studio / Settings
│   │   ├── components/       # UI 组件
│   │   └── contexts/         # React Context
│   └── package.json
├── configs/                  # 配置文件
│   ├── config.example.yaml   # 配置模板
│   └── config.yaml           # 本地配置（gitignore）
├── data/                     # 数据目录
│   ├── outputs/              # 生成视频 + 草稿
│   ├── memory/               # SQLite 记忆库
│   └── uploads/              # 上传的参考图/视频
├── skills/                   # Skill 封装规范
│   └── SKILL.md              # AI Agent 调用规范
├── tests/                    # 单元测试
│   └── test_pipeline.py      # 18 个测试用例
├── requirements.txt          # Python 依赖
└── pyproject.toml            # 项目元信息
```
