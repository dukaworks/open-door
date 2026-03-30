# 噼哩噼哩 Pilipili-AutoVideo 故障排查指南

## 文档信息

- **文档编号**: DEV-DOC-007
- **版本**: 1.0
- **创建日期**: 2026-03-26
- **项目**: Pilipili-AutoVideo
- **类型**: 故障排查文档

---

## 1. 快速诊断流程

### 1.1 症状 → 排查方向

```
┌─────────────────────────────────────────────────────────────────┐
│                        症状分类                                  │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ 启动失败     │  生成失败     │  性能问题     │  输出异常       │
│ (服务无法启动)│ (中途报错)   │ (慢/卡顿)     │ (视频有问题)    │
├──────────────┼──────────────┼──────────────┼─────────────────┤
│ 1. 检查依赖  │ 1. 检查配置  │ 1. 检查资源  │ 1. 检查日志     │
│ 2. 检查配置  │ 2. 检查API   │ 2. 检查网络  │ 2. 验证输入     │
│ 3. 检查权限  │ 3. 检查日志  │ 3. 检查缓存  │ 3. 检查生成器   │
│ 4. 检查日志  │ 4. 断点续传  │ 4. 检查并发  │ 4. 检查FFmpeg   │
└──────────────┴──────────────┴──────────────┴─────────────────┘
```

### 1.2 诊断命令

```bash
# 1. 检查服务健康
curl http://localhost:8000/health

# 2. 检查配置文件
python -c "from core.config import get_config; c = get_config(); print('OK' if c else 'ERROR')"

# 3. 检查 FFmpeg
ffmpeg -version
ffprobe -version

# 4. 检查日志（实时）
python cli/main.py server 2>&1 | head -50

# 5. 检查磁盘空间
df -h

# 6. 检查内存
free -h

# 7. 检查进程
ps aux | grep python
```

---

## 2. 启动失败

### 2.1 模块导入错误

**症状**：
```
ModuleNotFoundError: No module named 'xxxx'
```

**排查**：
```bash
# 1. 检查依赖安装
pip list | grep -i xxxx

# 2. 重新安装依赖
pip install -r requirements.txt

# 3. 检查 Python 版本
python --version  # 应为 3.10+
```

**解决**：
```bash
# 完整重装
pip uninstall -y -r requirements.txt
pip install -r requirements.txt
```

### 2.2 配置文件错误

**症状**：
```
yaml.YAMLError: expected '<document start>', but found ...
```

**排查**：
```bash
# 验证 YAML 语法
python -c "import yaml; yaml.safe_load(open('configs/config.yaml'))"
```

**解决**：
```yaml
# 常见 YAML 错误：

# 1. 缩进问题（使用空格，不要用 Tab）
llm:
  default_provider: "deepseek"  # ✓
deepseek:                        # ✗ 缩进错误
    api_key: "xxx"

# 2. 字符串引号
api_key: "sk-xxx"  # ✓ 有引号
api_key: sk-xxx    # ✗ 无引号可能导致解析错误

# 3. 布尔值
enabled: true      # ✓
enabled: yes      # ✗
```

### 2.3 FFmpeg 未安装

**症状**：
```
FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'
```

**排查**：
```bash
ffmpeg -version  # 应该输出版本信息
```

**解决**：
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# 1. 下载 https://ffmpeg.org/download.html
# 2. 解压并添加到 PATH
# 3. 或放在项目根目录 ffmpeg/bin/ffmpeg.exe
```

---

## 3. API 调用错误

### 3.1 API Key 配置错误

**症状**：
```
RuntimeError: DeepSeek API Key 未配置，请在 config.yaml 中设置 llm.deepseek.api_key
```

**排查**：
```bash
# 1. 检查配置文件
cat configs/config.yaml | grep -A2 deepseek

# 2. 检查环境变量
echo $DEEPSEEK_API_KEY
```

**解决**：
```yaml
# configs/config.yaml
llm:
  default_provider: "deepseek"
  deepseek:
    api_key: "sk-xxxx"  # 填入你的 Key
    model: "deepseek-chat"
```

### 3.2 API Key 无效

**症状**：
```
openai.APIAuthenticationError: Incorrect API key
```

**排查**：
```bash
# 测试 API Key
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1}'
```

**解决**：
1. 检查 Key 是否过期
2. 检查 Key 是否有权限
3. 重新获取 Key 并更新配置

### 3.3 API 限速 (429)

**症状**：
```
RuntimeError: MiniMax TTS API 错误 1002: RPM limit exceeded
```

**排查**：
```bash
# 查看日志中的限速信息
# api/server.py 日志：
# [TTS] Scene 1 限速 (RPM限速)，10s 后重试 (attempt 2/4)...
```

**解决**：
```python
# 1. 降低并发数（已在代码中实现）
# modules/tts.py
max_concurrent: int = 2  # 已从 5 降到 2

# 2. 升级 API 配额
# 登录各平台控制台，升级 RPM/TPM 限制

# 3. 使用备用 API（如果配置了）
# 例如：同时配置 DeepSeek 和 Kimi，优先 Key 不足时自动切换
```

### 3.4 API 服务不可用 (503)

**症状**：
```
google.api_core.exceptions.ServiceUnavailable: 503 ...
```

**排查**：
```bash
# 1. 检查服务状态
curl -I https://api.deepseek.com
curl -I https://generativelanguage.googleapis.com
```

**解决**：
```python
# 代码已有 fallback 机制
# modules/image_gen.py
_FAILED_MODELS = set()  # 自动跳过失败模型

# 如果持续失败，检查：
# 1. 网络连通性
# 2. 服务商状态页面
# 3. 更换备用服务商
```

---

## 4. 生成失败

### 4.1 LLM 生成失败

**症状**：
```
ValueError: 无法解析 LLM 输出为 JSON
```

**排查**：
```python
# 1. 检查 LLM 返回
# 日志中查看：
# [LLM] 初稿生成完成，长度: xxx 字符

# 2. 检查模型支持
# 某些模型不支持 JSON mode
```

**解决**：
```python
# 1. 代码已有 JSON 解析容错
# modules/llm.py -> _parse_json_safely()
# 多策略：直接解析 → 代码块提取 → 范围查找

# 2. 调整模型参数
# 降低 temperature: 0.7 → 0.5

# 3. 增强提示词
# 在 system prompt 中强调 JSON 格式
```

### 4.2 图像生成失败

**症状**：
```
RuntimeError: Scene 1 所有图像模型均已加入黑名单
```

**排查**：
```bash
# 1. 查看失败原因
# 日志：
# [ImageGen] ⚠️ 模型 gemini-2.0-flash 已加入黑名单（503 服务不可用）

# 2. 检查 API Key 额度
# Google AI Studio → 检查配额
```

**解决**：
```bash
# 1. 重启服务（清空黑名单）
# Ctrl+C 然后重新启动

# 2. 检查并充值 API 额度
# https://aistudio.google.com/app/apikey

# 3. 使用备用模型
# configs/config.yaml
image_gen:
  model: "models/gemini-2.5-flash-image"  # 更稳定的模型
```

### 4.3 视频生成失败

**症状**：
```
RuntimeError: Kling Omni 任务失败: task_status_msg
```

**排查**：
```bash
# 1. 查看 Kling 返回的错误信息
# 日志：
# [VideoGen] Omni 任务 xxx 状态: failed (具体错误信息)

# 2. 检查参数
# - prompt 长度是否超过 512 字符
# - 视频时长是否在 3-15s 范围内
# - 图片是否有效
```

**解决**：
```python
# 1. 截断过长的 prompt
# modules/video_gen.py
prompt = prompt[:512]  # 已实现

# 2. 调整视频时长
# 确保总时长在 3-15s 范围内

# 3. 检查图片
# 确保关键帧图片有效
```

### 4.4 FFmpeg 组装失败

**症状**：
```
RuntimeError: FFmpeg 执行失败 (返回码 1): ...
```

**排查**：
```bash
# 1. 检查输入文件
ls -la data/outputs/xxx/clips/
ls -la data/outputs/xxx/audio/

# 2. 检查 FFmpeg 版本
ffmpeg -version  # 需要 4.0+

# 3. 手动测试 FFmpeg 命令
ffmpeg -i input.mp4 -t 5 -vf "scale=1920:1080" output.mp4
```

**解决**：
```python
# 1. 确保所有输入文件有效
# 清理损坏的文件

# 2. 使用更兼容的编码参数
# modules/assembler.py
H264_COMPAT_ARGS = [
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",  # 关键：确保兼容性
    "-profile:v", "high",
    "-level:v", "4.1",
]

# 3. 检查磁盘空间
df -h
```

---

## 5. 输出异常

### 5.1 视频无声音

**症状**：
生成的 MP4 文件没有声音

**排查**：
```bash
# 1. 检查音频文件
ls -la data/outputs/xxx/audio/
file scene_001_voiceover.mp3

# 2. 检查 FFmpeg 日志
# 应该有：Stream #0:1: Audio: aac
```

**解决**：
```python
# 1. 检查音频格式
# modules/tts.py 生成 MP3，应该是有效的

# 2. 检查 FFmpeg 混音
# modules/assembler.py -> _mix_audio_aligned()
# 确保音频轨正确混合

# 3. 使用 ffprobe 检查输出
ffprobe -i output.mp4 -show_streams
```

### 5.2 字幕丢失

**症状**：
生成的视频没有字幕

**排查**：
```bash
# 1. 检查 SRT 文件
cat data/outputs/xxx/temp/subtitles.srt

# 2. 检查 FFmpeg 烧录日志
# 应该有：subtitles='xxx.srt'
```

**解决**：
```python
# 1. 确保 add_subtitles=True
# api/server.py
plan = AssemblyPlan(
    ...
    add_subtitles=True,  # 确认开启
)

# 2. 检查 SRT 文件存在
# modules/assembler.py -> _generate_srt()

# 3. 检查字体问题
# Windows：确保 Microsoft YaHei 字体存在
```

### 5.3 视频分辨率不对

**症状**：
输出视频不是 1920x1080

**解决**：
```python
# modules/assembler.py
# 已强制统一分辨率
def _trim_video(input_path, output_path, duration,
                target_w: int = 1920, target_h: int = 1080):
    vf = (
        f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
        f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:black"
    )
```

---

## 6. 性能问题

### 6.1 生成速度慢

**排查**：
```python
# 1. 检查是否在并发生成
# 日志应该显示并行：
# [ImageGen] 并发生成 3 个分镜...

# 2. 检查网络延迟
ping api.deepseek.com

# 3. 检查 API 响应时间
# LLM 通常 3-10s
# TTS 通常 3-5s
# 视频生成通常 60-180s
```

**优化**：
```bash
# 1. 使用更快的模型
# configs/config.yaml
llm:
  default_provider: "deepseek"  # 比 kimi 更快

# 2. 减少分镜数量
# 同样是 60 秒，3 个分镜比 6 个更快

# 3. 使用批量模式
# 已默认启用 Kling Omni 批量生成
```

### 6.2 内存占用高

**排查**：
```bash
# 检查内存
free -h
ps aux --sort=-%mem | head
```

**解决**：
```python
# 1. 定期清理临时文件
# 已有断点续传，生成的图片/音频不会重复生成

# 2. 手动清理
rm -rf data/temp/*
rm -rf data/outputs/xxx/temp/

# 3. 限制并发数
# tts: max_concurrent: 2 (已降低)
# image_gen: max_concurrent: 3
```

### 6.3 磁盘空间不足

**症状**：
```
OSError: [Errno 28] No space left on device
```

**排查**：
```bash
df -h
du -sh data/*
```

**解决**：
```bash
# 1. 清理临时文件
rm -rf data/temp/*

# 2. 清理旧的输出（保留最近 7 天）
find data/outputs -name "*.mp4" -mtime +7 -delete

# 3. 清理缓存
rm -rf data/cache/*

# 4. 扩展磁盘
# 云服务器可以在线扩容
```

---

## 7. 网络问题

### 7.1 连接超时

**症状**：
```
asyncio.TimeoutError
```

**解决**：
```python
# 1. 增加超时时间
# modules/video_gen.py
timeout = 900  # 15 分钟，足够视频生成

# 2. 检查网络
ping -c 5 api.deepseek.com

# 3. 使用代理（如需要）
# configs/config.yaml
llm:
  deepseek:
    base_url: "https://api.deepseek.com/v1"  # 或代理地址
```

### 7.2 SSL 证书问题

**症状**：
```
ssl.SSLError: [SSL: CERTIFICATE_VERIFY_FAILED]
```

**解决**：
```python
# 1. 更新证书
pip install --upgrade certifi

# 2. 在 Linux 上更新 CA 证书
sudo update-ca-certificates

# 3. 临时禁用验证（仅开发环境）
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
```

---

## 8. 特定场景问题

### 8.1 断点续传失败

**症状**：
重启后从头开始生成

**排查**：
```bash
# 1. 检查文件是否存在
ls -la data/outputs/xxx/keyframes/
ls -la data/outputs/xxx/audio/

# 2. 检查日志
# 应该显示：xxx 已存在，跳过生成
```

**解决**：
```python
# 1. 使用 resume API
POST /api/projects/{project_id}/resume

# 2. 确保脚本文件存在
ls data/outputs/xxx/script.json

# 3. 如果文件损坏，手动删除从该阶段重新生成
```

### 8.2 剪映草稿无法导入

**症状**：
剪映提示草稿损坏

**排查**：
```bash
# 1. 检查草稿目录
ls -la data/outputs/xxx/jianying_draft/

# 2. 检查 manifest.json
cat data/outputs/xxx/jianying_draft/xxx_manifest.json
```

**解决**：
```python
# 1. 使用兼容的路径格式
# Windows: 确保路径格式正确
# Linux/macOS: 确保权限正确

# 2. 检查 pyJianYingDraft 版本
pip show pyJianYingDraft

# 3. 手动导入素材
# 如果草稿损坏，手动将 clips/ 导入剪映
```

---

## 9. 错误码速查表

| 错误码 | 错误类型 | 解决方向 |
|--------|----------|----------|
| `1001` | 参数错误 | 检查请求参数格式 |
| `1002` | RPM 限速 | 降低并发或升级配额 |
| `1003` | TPM 限速 | 升级日配额 |
| `1004` | 并发限速 | 等待后重试 |
| `2001` | 认证失败 | 检查 API Key |
| `2002` | 权限不足 | 升级 API 权限 |
| `3001` | 服务不可用 | 检查服务商状态 |
| `3002` | 模型不存在 | 检查模型名称 |
| `4001` | 输入文件不存在 | 检查文件路径 |
| `4002` | 输出文件写入失败 | 检查磁盘空间和权限 |
| `5001` | FFmpeg 错误 | 检查 FFmpeg 版本和参数 |

---

## 10. 日志分析

### 10.1 日志级别

```python
# 调整日志级别
# api/server.py
import logging
logging.basicConfig(level=logging.DEBUG)  # 开发环境
# 生产环境使用 WARNING
```

### 10.2 关键日志标识

```bash
# 脚本生成
[LLM] 使用模型: xxx
[LLM] 主题: xxx
[LLM] 初稿生成完成

# 图像生成
[ImageGen] Scene 1 生成关键帧
[ImageGen] 使用备用模型: xxx

# TTS 生成
[TTS] Scene 1 生成配音
[TTS] Scene 1 配音完成，时长: x.xxs

# 视频生成
[VideoGen] Scene 1 使用引擎: xxx, shot_mode: xxx
[VideoGen] Kling Omni 任务已提交: xxx

# 组装
[Assembler] 开始组装 6 个分镜
[Assembler] 组装完成: xxx
```

---

## 11. 常见问题快速解决

### 问题 → 一键修复

```bash
# 1. 所有服务重启
pkill -f python
python cli/main.py server &

# 2. 清理缓存和临时文件
rm -rf data/temp/* data/cache/*
docker system prune -f  # 如果使用 Docker

# 3. 重装依赖
pip install -r requirements.txt --force-reinstall

# 4. 检查完整健康状态
curl http://localhost:8000/health | python -m json.tool
```

---

## 12. 联系支持

### 12.1 提交 Issue

请提供以下信息：

1. **环境**：操作系统、Python 版本、Docker 版本
2. **配置**：configs/config.yaml（隐藏 Key）
3. **日志**：完整的错误日志
4. **复现步骤**：如何触发该问题

### 12.2 自助排查清单

- [ ] 服务健康检查：`curl http://localhost:8000/health`
- [ ] FFmpeg 可用：`ffmpeg -version`
- [ ] 配置正确：`python -c "from core.config import get_config; print('OK')"`
- [ ] API Key 有效：各平台测试 Key
- [ ] 磁盘空间充足：`df -h`
- [ ] 网络连通：ping 目标 API

---

*文档版本: 1.0 | 最后更新: 2026-03-26*