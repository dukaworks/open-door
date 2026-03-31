# Provider/Model 架构检查工具

## 简介

这是一个用于检查代码中是否存在"模型被当作厂商使用"错误的自动化工具。

**背景**：在开发过程中，容易出现将模型名（如 `kling-3.0`、`seedance`、`doubao-lite`）错误地当作 Provider（服务商）使用的问题。这会导致架构混乱和运行时错误。

## 使用方法

### Windows 用户

双击运行 `scripts\check_architecture.bat`，或在命令行执行：

```batch
scripts\check_architecture.bat
```

### Linux/Mac 用户

```bash
python scripts/check_provider_architecture.py
```

### Conda 环境

如果使用 Conda 环境，请先激活：

```bash
conda activate openwebui
python scripts/check_provider_architecture.py
```

## 检查内容

### 1. 🔴 高危问题 - 模型被当作 Provider 使用

检测将模型名错误地用作 Provider 的情况，例如：

```python
# ❌ 错误示例
provider = "kling-3.0"        # kling-3.0 是模型，不是 Provider
provider = "seedance"          # seedance 是模型，不是 Provider
engine = "nano_banana"         # nano_banana 是模型，不是 Provider

# ✅ 正确示例
provider = "kling"             # kling 是 Provider
provider = "volces"            # volces（字节火山方舟）是 Provider
```

### 2. 🟡 中危问题 - 未知的 Provider 引用

检测使用了不在 `PRESET_PROVIDERS` 列表中的 Provider，例如：

```python
# ❌ 错误示例
provider = "unknown-provider"

# ✅ 正确的 Provider（必须在 PRESET_PROVIDERS 中）
provider = "openai"
provider = "deepseek"
provider = "gemini"
provider = "volces"
provider = "kling"
```

## 可检测的模型名模式

脚本会检测以下可疑的模型名模式：

- `kling-3.0`, `kling-2.5`
- `doubao-lite`, `doubao-pro`
- `moonshot-v1`, `moonshot-v2`
- `qwen-turbo`, `qwen-max`
- `gpt-4`, `gpt-4o`, `gpt-3.5`
- `gemini-1.5`, `gemini-2.0`
- `claude-3`, `claude-3.5`
- `abab6`, `abab5.5`
- `wanx-v1`
- `hunyuan-lite`
- `seedance`（已知的错误）
- `nano_banana`（已知的错误）

## 扫描范围

- ✅ Python 文件 (`*.py`)
- ✅ YAML 配置文件 (`*.yaml`, `*.yml`)
- ✅ TypeScript/TSX 文件 (`*.ts`, `*.tsx`)

自动排除以下目录：
- `node_modules`
- `.git`
- `dist`
- `build`
- `__pycache__`
- `.pytest_cache`
- `venv`, `env`

## 输出示例

```
🔍 开始检查 Provider/Model 架构...
============================================================

📂 检查 Python 文件...
📂 检查 YAML 配置文件...
📂 检查 TypeScript 文件...

============================================================
📊 检查报告
============================================================

📁 扫描文件统计:
  - Python 文件:  15
  - YAML 文件:    2
  - TypeScript 文件: 10
  - 总计:         27

⚠️  问题统计:
  - 发现问题:     2
  - 高危问题:     1 🔴
  - 中危问题:     1 🟡

============================================================
📋 问题详情
============================================================

🔴 高危问题 - 模型被当作 Provider 使用 (1 个):
------------------------------------------------------------

  1. modules/video_gen.py:794
     可疑名称: seedance
     代码: elif selected_engine == "seedance":
     ⚠️  'seedance' 应该是模型名，不是 Provider！
     💡 请检查该模型属于哪个 Provider（如 kling、volces、openai 等）

🟡 中危问题 - 未知的 Provider 引用 (1 个):
------------------------------------------------------------

  1. configs/config.yaml:27
     Provider: nano_banana
     代码: provider: nano_banana
     💡 请确认 'nano_banana' 是否在 PRESET_PROVIDERS 中

============================================================
✅ 检查完成！
============================================================

📝 日志已保存到: data/config/architecture_check_20260401_153000.log
```

## 日志文件

每次检查都会生成日志文件，保存在 `data/config/architecture_check_YYYYMMDD_HHMMSS.log`

日志内容包含：
- 检查时间戳
- 详细的问题列表
- 每个问题的文件路径、行号、类型和代码上下文

## 正确的 Provider 列表

当前项目支持的 Provider（来自 `api/config_db_v3.py`）：

| Provider ID | Provider Name | 描述 |
|------------|---------------|------|
| `openai` | OpenAI | 全球领先AI模型，ChatGPT、DALL·E、Whisper |
| `deepseek` | DeepSeek | 性价比最高，适合脚本生成 |
| `gemini` | Google Gemini | 多模态理解，支持图片/视频输入转脚本 |
| `kimi` | Moonshot AI | 长上下文理解，适合长视频脚本 |
| `minimax` | MiniMax | 角色扮演强，适合对话式视频 |
| `zhipu` | 智谱 AI | GLM-4 系列，平衡性能和成本 |
| `volces` | 字节火山方舟 | 国产多模态，支持 Doubao 系列 |
| `kling` | Kling AI | 视频生成专精，支持 Omni/v3 API |
| `anthropic` | Anthropic | Claude 系列，安全性高 |
| `ollama` | Ollama | 本地模型部署，隐私安全 |

## 常见错误和修正

### 错误 1：模型名用作 Provider

**错误代码：**
```python
# modules/video_gen.py
provider = "seedance"  # ❌ 错误
```

**修正：**
```python
# 正确：seedance 是 volces 提供商下的模型
provider = "volces"    # ✅ 正确
model = "doubao-seedance-1-5-pro"  # ✅ 正确
```

### 错误 2：配置文件中使用模型名

**错误配置：**
```yaml
# configs/config.yaml
image_gen:
  provider: nano_banana  # ❌ 错误
```

**修正：**
```yaml
# 正确：nano_banana 是 volces 提供商下的图像模型
image_gen:
  provider: volces       # ✅ 正确
  model: nano_banana     # ✅ 正确
```

### 错误 3：条件判断中使用模型名

**错误代码：**
```python
if engine == "kling-3.0":  # ❌ 错误
    ...
```

**修正：**
```python
if engine == "kling":      # ✅ 正确
    model = "kling-3.0"     # ✅ 正确
    ...
```

## CI/CD 集成建议

可以将此检查脚本集成到 CI/CD 流程中，在代码提交或合并前自动检查：

```yaml
# .github/workflows/check.yml
name: Architecture Check

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - name: Run architecture check
        run: python scripts/check_provider_architecture.py
```

## 问题反馈

如果发现误报或需要添加新的检测规则，请：

1. 检查 `VALID_PROVIDERS` 列表是否需要更新
2. 检查 `SUSPICIOUS_MODEL_PATTERNS` 是否需要调整
3. 提交 Issue 或 PR 修改脚本

## 更新日志

- **2026-04-01**: 初始版本
  - 支持检测 Python、YAML、TypeScript 文件
  - 检测模型名被当作 Provider 使用
  - 检测未知的 Provider 引用
  - 生成详细的检查报告和日志
