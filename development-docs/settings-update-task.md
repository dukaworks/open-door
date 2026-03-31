# 设置更新任务

## 1. 设置的原始数据和状态

### 1.1 设置-API连接器的对话课操作的原始数据来自configs/config.yaml的llm 部分

```yaml
llm:
  default_provider: deepseek
  deepseek:
    api_key: YOUR_DEEPSEEK_API_KEY
    model: deepseek-chat
    base_url: https://api.deepseek.com/v1
  kimi:
    api_key: YOUR_KIMI_API_KEY
    model: moonshot-v1-32k
    base_url: https://api.moonshot.cn/v1
  minimax:
    api_key: YOUR_MINIMAX_API_KEY
    model: MiniMax-Text-01
    base_url: https://api.minimax.chat/v1
  zhipu:
    api_key: YOUR_ZHIPU_API_KEY
    model: glm-4
    base_url: https://open.bigmodel.cn/api/paas/v4
  gemini:
    api_key: YOUR_GEMINI_API_KEY
    model: gemini-1.5-pro
  ollama:
    base_url: http://localhost:11434/v1
    model: qwen2.5:latest
    api_key: ollama
image_gen:
  provider: nano_banana
  api_key: YOUR_GEMINI_API_KEY
  model: gemini-3-pro-image-preview
  output_resolution: 4K
video_gen:
  default_provider: kling
  kling:
    api_key: YOUR_KLING_API_KEY
    api_secret: YOUR_KLING_API_SECRET
    model: kling-v3
    base_url: https://api-beijing.klingai.com
    default_duration: 5
    default_ratio: '16:9'
    default_quality: high
  seedance:
    api_key: YOUR_VOLCENGINE_API_KEY
    model: doubao-seedance-1-5-pro-250528
    base_url: https://ark.cn-beijing.volces.com/api/v3
    default_duration: 5
    default_ratio: '16:9'
tts:
  default_provider: minimax
  minimax:
    api_key: YOUR_MINIMAX_API_KEY
    model: speech-02-hd
    default_voice: female-shaonv
    speed: 1.0
    emotion: neutral
local:
  ffmpeg_path: ffmpeg
  whisperx_model: base
  output_dir: ./data/outputs
  assets_dir: ./data/assets
  temp_dir: ./data/temp
jianying:
  enabled: true
  draft_dir: ./data/outputs/jianying_drafts
memory:
  enabled: true
  provider: local
  mem0_api_key: ''
  local_db_path: ./data/memory/mem0.db
  user_id: default_user
server:
  host: 0.0.0.0
  port: 8000
  frontend_port: 3000
  cors_origins:
  - http://localhost:3000
auth:
  enabled: true
  jwt_secret: your-secret-key
  jwt_expire_hours: 24
```

## 2 主要的设置项 只能修改 api_key 一个字段

其他的字段 不能够修改，写死在配置文件中

```yaml
llm:
  default_provider: deepseek   
  deepseek:
    api_key: YOUR_DEEPSEEK_API_KEY  # DeepSeek的API密钥 - 目前唯一可以修改的字段
    model: deepseek-chat     
    base_url: https://api.deepseek.com/v1  
```

## 3 设置的业务逻辑

### 3.1 模型的角色分类

- **默认LLM提供商**：用于处理自然语言任务，如对话、生成文本等。
- **大脑层**：推理模型列表。
- **视觉层**：图片生成。
- **动态层**：用于视频。
- **配音层**：用于处理文本到语音的转换。
- **记忆系统（可选）**：用于处理记忆相关任务。

### 3.2 目前的设置逻辑

- **默认LLM提供商**：选定大脑层提供的通用推理模型，用于生成脚本等重要任务
- **大脑层**：配置通用推理模型API Key, 不能选模型ID
- **视觉层**：配置图片生成模型API Key, 不能选模型ID
- **动态层**：配置视频生成模型API Key, 不能选模型ID
- **配音层**：配置配音模型API Key, 不能选模型ID
- **记忆系统（可选）**：配置记忆系统API Key, 不能选模型ID，也不能选择供应商。本地方案是SQLite 数据库，使用本地文件存储。

## 4 设置的界面

### 4.1 设置对话框界面

- 对话框标题
- 描述文字
- 默认提供商卡片
    - 默认提供商卡片标题
    - 4个选择按钮

- 大脑层导航标签页
    - 通用推理模型卡片列表
- 视觉层导航标签页
    - 图片生成模型卡片列表
- 动态层卡片
    - 视频生成模型卡片列表
- 配音层卡片
    - 配音模型卡片列表
- 记忆系统卡片
    - 记忆系统卡片列表

- 安全提示

- 保存修改按钮（这个目前消失了，需要修复）



