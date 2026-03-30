# 噼哩噼哩 Pilipili-AutoVideo API 参考文档

## 文档信息

- **文档编号**: DEV-DOC-008
- **版本**: 1.0
- **创建日期**: 2026-03-26
- **项目**: Pilipili-AutoVideo
- **类型**: API 参考文档

---

## 1. API 概述

### 1.1 Base URL

```
http://localhost:8000
```

### 1.2 认证方式

当前版本为**无认证**（单用户模式），所有端点可直接访问。

未来版本将支持 JWT 认证：

```
Authorization: Bearer <token>
```

### 1.3 响应格式

所有 API 返回 JSON 格式：

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

错误响应：

```json
{
  "code": 1,
  "message": "错误描述",
  "detail": "详细信息"
}
```

### 1.4 WebSocket

实时状态推送：

```
ws://localhost:8000/ws/{project_id}
```

---

## 2. 项目管理 API

### 2.1 创建项目

创建新视频项目并启动生成工作流。

**端点**：`POST /api/projects`

**请求体**：

```json
{
  "topic": "Cyberpunk Mars colony, 60 seconds, cold color palette",
  "style": "赛博朋克，冷色调，科技感",
  "target_duration": 60,
  "voice_id": "female_shaonv",
  "video_engine": "kling",
  "reference_images": [],
  "add_subtitles": true,
  "resolution": "1080p"
}
```

**参数说明**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `topic` | string | ✅ | 视频主题描述 |
| `style` | string | - | 风格描述 |
| `target_duration` | int | - | 目标时长（秒），默认 60 |
| `voice_id` | string | - | TTS 音色 ID |
| `video_engine` | string | - | 视频引擎：`kling` / `seedance` / `auto` |
| `reference_images` | array | - | 角色参考图路径列表 |
| `add_subtitles` | boolean | - | 是否添加字幕，默认 true |
| `resolution` | string | - | 分辨率：`720p` / `1080p` / `4K` |

**响应**：

```json
{
  "project_id": "a1b2c3d4",
  "message": "工作流已启动"
}
```

---

### 2.2 获取项目列表

**端点**：`GET /api/projects`

**响应**：

```json
[
  {
    "id": "a1b2c3d4",
    "topic": "Cyberpunk Mars colony",
    "created_at": "2026-03-26T10:00:00",
    "status": {
      "stage": "completed",
      "progress": 100,
      "message": "视频生成完成"
    }
  },
  {
    "id": "e5f6g7h8",
    "topic": "Ancient palace romance",
    "created_at": "2026-03-26T11:00:00",
    "status": {
      "stage": "generating_video",
      "progress": 60,
      "message": "视频生成中"
    }
  }
]
```

---

### 2.3 获取项目详情

**端点**：`GET /api/projects/{project_id}`

**响应**：

```json
{
  "id": "a1b2c3d4",
  "topic": "Cyberpunk Mars colony",
  "created_at": "2026-03-26T10:00:00",
  "status": {
    "stage": "completed",
    "progress": 100,
    "message": "视频生成完成",
    "current_scene": null,
    "total_scenes": 6
  },
  "script": {
    "title": "赛博朋克火星殖民地",
    "scenes": [
      {
        "scene_id": 1,
        "duration": 5.0,
        "image_prompt": "...",
        "video_prompt": "...",
        "voiceover": "在 2150 年..."
      }
    ]
  },
  "result": {
    "final_video": "data/outputs/a1b2c3d4/output/赛博朋克火星殖民地.mp4",
    "draft_dir": "data/outputs/a1b2c3d4/output/jianying_draft"
  }
}
```

---

### 2.4 提交审核

在人工审核阶段提交分镜审核决策。

**端点**：`POST /api/projects/{project_id}/review`

**请求体**：

```json
{
  "approved": true,
  "scenes": [
    {
      "scene_id": 1,
      "duration": 5.0,
      "image_prompt": "修改后的 prompt",
      "video_prompt": "...",
      "voiceover": "在 2150 年..."
    }
  ]
}
```

**参数说明**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `approved` | boolean | ✅ | 是否批准 |
| `scenes` | array | - | 修改后的分镜列表（仅当 approved=true 时有效）|

**响应**：

```json
{
  "message": "审核决策已提交",
  "approved": true
}
```

---

### 2.5 更新分镜

在审核界面实时更新分镜内容。

**端点**：`PUT /api/projects/{project_id}/script`

**请求体**：

```json
{
  "scenes": [
    {
      "scene_id": 1,
      "voiceover": "新的大纲文案"
    }
  ]
}
```

**响应**：

```json
{
  "message": "分镜已更新"
}
```

---

### 2.6 下载项目结果

获取成品视频和剪映草稿的下载链接。

**端点**：`GET /api/projects/{project_id}/download`

**响应**：

```json
{
  "final_video": "data/outputs/a1b2c3d4/output/赛博朋克火星殖民地.mp4",
  "draft_dir": "data/outputs/a1b2c3d4/output/jianying_draft",
  "total_duration": 58.5
}
```

---

### 2.7 断点续传

从已有的 keyframes + audio 文件继续生成。

**端点**：`POST /api/projects/{project_id}/resume`

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `video_engine` | string | 视频引擎，默认 `kling` |
| `add_subtitles` | boolean | 是否添加字幕，默认 true |

**响应**：

```json
{
  "project_id": "a1b2c3d4",
  "message": "断点续传已启动，从视频生成阶段继续"
}
```

---

## 3. 设置 API

### 3.1 更新 API Keys

更新各服务的 API Key 配置。

**端点**：`POST /api/settings/keys`

**请求体**：

```json
{
  "llm_provider": "deepseek",
  "llm_api_key": "sk-xxx",
  "image_gen_api_key": "AIza-xxx",
  "tts_api_key": "xxx",
  "kling_api_key": "xxx",
  "kling_api_secret": "xxx",
  "seedance_api_key": "xxx",
  "mem0_api_key": "m0-xxx"
}
```

**响应**：

```json
{
  "message": "API Keys 已更新并写入配置文件",
  "updated_keys": ["llm.deepseek.api_key", "image_gen.api_key"]
}
```

---

### 3.2 获取 API Keys 状态

检查各 API Key 的配置状态。

**端点**：`GET /api/settings/keys/status`

**响应**：

```json
{
  "llm": {
    "provider": "deepseek",
    "configured": true
  },
  "image_gen": {
    "provider": "nano_banana",
    "configured": true
  },
  "tts": {
    "provider": "minimax",
    "configured": true
  },
  "kling": {
    "configured": true
  },
  "seedance": {
    "configured": false
  }
}
```

---

### 3.3 测试 API Key

测试指定服务的 API Key 是否有效。

**端点**：`POST /api/settings/keys/test`

**请求体**：

```json
{
  "service": "llm"
}
```

**参数说明**：

| 参数 | 可选值 |
|------|--------|
| `service` | `llm` / `image_gen` / `tts` / `kling` / `seedance` |

**响应（成功）**：

```json
{
  "success": true,
  "message": "DeepSeek 连接成功，模型: deepseek-chat"
}
```

**响应（失败）**：

```json
{
  "success": false,
  "message": "连接失败: AuthenticationError: Incorrect API key"
}
```

---

## 4. 文件上传 API

### 4.1 上传参考图

上传角色参考图或视频（自动提取帧）。

**端点**：`POST /api/upload/reference`

**请求体**：`multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | file | 图片或视频文件 |

**支持格式**：
- 图片：`.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`
- 视频：`.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`

**响应**：

```json
{
  "path": "G:/GithubSpace/Pilipili-AutoVideo/data/uploads/references/abc123.jpg",
  "filename": "abc123.jpg",
  "type": "image",
  "message": "参考图已上传"
}
```

---

## 5. 对标视频分析 API

### 5.1 上传并分析视频

上传对标视频，使用 Gemini 分析结构。

**端点**：`POST /api/analyze/upload`

**请求体**：`multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | file | 视频文件 |

**响应**：

```json
{
  "analysis_id": "xyz789abc",
  "status": "processing",
  "message": "视频已上传，正在分析中..."
}
```

---

### 5.2 查询分析结果

查询对标视频分析进度或结果。

**端点**：`GET /api/analyze/{analysis_id}`

**响应（处理中）**：

```json
{
  "analysis_id": "xyz789abc",
  "status": "processing",
  "filename": "demo.mp4"
}
```

**响应（已完成）**：

```json
{
  "analysis_id": "xyz789abc",
  "status": "completed",
  "result": {
    "title": "科技感短视频",
    "style": "赛博朋克，冷色调",
    "aspect_ratio": "16:9",
    "total_duration": 30.5,
    "characters": [
      {
        "character_id": 1,
        "name": "男主角",
        "description": "年轻男性，黑色短发...",
        "appearance_prompt": "young man, black hair..."
      }
    ],
    "scenes": [
      {
        "scene_id": 1,
        "duration": 5,
        "image_prompt": "...",
        "video_prompt": "...",
        "voiceover": "欢迎来到未来世界...",
        "shot_mode": "i2v"
      }
    ],
    "overall_prompt": "cyberpunk style, neon lights..."
  }
}
```

---

### 5.3 替换角色参考图

为对标视频中的角色上传替换参考图。

**端点**：`POST /api/analyze/{analysis_id}/replace-character`

**请求体**：`multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| `character_id` | int | 角色 ID（表单字段） |
| `file` | file | 图片文件 |

**响应**：

```json
{
  "message": "人物 男主角 的替换参考图已更新",
  "character_id": 1,
  "path": "G:/.../uploads/references/new_ref.jpg"
}
```

---

## 6. WebSocket API

### 6.1 连接

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/a1b2c3d4');

ws.onmessage = (event) => {
  const status = JSON.parse(event.data);
  console.log(status);
};
```

### 6.2 消息格式

**状态消息**：

```json
{
  "type": "status",
  "project_id": "a1b2c3d4",
  "stage": "generating_script",
  "progress": 10,
  "message": "正在分析主题，生成视频脚本...",
  "timestamp": "2026-03-26T10:00:00"
}
```

**阶段值**：

| stage | 说明 |
|-------|------|
| `idle` | 空闲 |
| `generating_script` | 生成脚本 |
| `awaiting_review` | 等待审核 |
| `generating_images` | 生成关键帧 |
| `generating_audio` | 生成配音 |
| `generating_video` | 生成视频 |
| `assembling` | 组装视频 |
| `completed` | 完成 |
| `failed` | 失败 |

**带操作的状态**：

```json
{
  "type": "status",
  "stage": "awaiting_review",
  "progress": 20,
  "message": "脚本已生成，请审核并确认分镜内容后继续",
  "requires_action": true,
  "action_type": "review_script"
}
```

---

## 7. 公共端点

### 7.1 健康检查

**端点**：`GET /health`

**响应**：

```json
{
  "status": "ok",
  "version": "1.0.0",
  "name": "噼哩噼哩 Pilipili-AutoVideo"
}
```

---

## 8. Python SDK

### 8.1 安装

```bash
pip install pilipili-auto
```

### 8.2 使用

```python
from pilipili import PilipiliClient

client = PilipiliClient(base_url="http://localhost:8000")

# 创建项目
project = client.create_project(
    topic="Cyberpunk Mars colony",
    style="赛博朋克",
    target_duration=60
)
print(f"Project ID: {project.project_id}")

# 监听状态
for status in client.watch_project(project.project_id):
    print(f"Progress: {status.progress}% - {status.message}")
    
    if status.stage == "completed":
        print(f"Video: {status.result.final_video}")
        break
```

---

## 9. 错误码

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| `0` | 成功 | 200 |
| `1` | 通用错误 | 400 |
| `1001` | 参数错误 | 400 |
| `1002` | 认证失败 | 401 |
| `1003` | 权限不足 | 403 |
| `1004` | 资源不存在 | 404 |
| `1005` | 限速 | 429 |
| `1006` | 服务不可用 | 503 |

---

## 10. 限流说明

| 端点 | 限制 |
|------|------|
| `POST /api/projects` | 10 次/分钟 |
| `POST /api/settings/keys` | 5 次/分钟 |
| `GET /api/projects` | 60 次/分钟 |

---

## 11. 示例

### 11.1 cURL 示例

```bash
# 创建项目
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Cyberpunk Mars colony",
    "style": "赛博朋克，冷色调",
    "target_duration": 60
  }'

# 查询项目
curl http://localhost:8000/api/projects/a1b2c3d4

# 测试 API Key
curl -X POST http://localhost:8000/api/settings/keys/test \
  -H "Content-Type: application/json" \
  -d '{"service": "llm"}'
```

### 11.2 Python 示例

```python
import requests

BASE_URL = "http://localhost:8000"

# 创建项目
resp = requests.post(f"{BASE_URL}/api/projects", json={
    "topic": "Cyberpunk Mars colony",
    "target_duration": 60
})
project_id = resp.json()["project_id"]

# 轮询状态
import time
while True:
    resp = requests.get(f"{BASE_URL}/api/projects/{project_id}")
    status = resp.json()["status"]
    print(f"{status['progress']}%: {status['message']}")
    
    if status["stage"] == "completed":
        print(f"完成！视频: {resp.json()['result']['final_video']}")
        break
    elif status["stage"] == "failed":
        print(f"失败: {status.get('error')}")
        break
    
    time.sleep(2)
```

### 11.3 JavaScript 示例

```javascript
// 创建项目
const response = await fetch('http://localhost:8000/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: 'Cyberpunk Mars colony',
    target_duration: 60
  })
});
const { project_id } = await response.json();

// WebSocket 监听
const ws = new WebSocket(`ws://localhost:8000/ws/${project_id}`);
ws.onmessage = (event) => {
  const status = JSON.parse(event.data);
  console.log(`${status.progress}%: ${status.message}`);
  
  if (status.stage === 'completed') {
    console.log('完成！', status.result);
  }
};
```

---

*文档版本: 1.0 | 最后更新: 2026-03-26*