# Provider/Model 架构检查工具 - 使用说明

## 📌 快速开始

### Windows 用户
双击运行：`check_architecture.bat`

### Mac/Linux 用户
```bash
python3 check_provider_architecture.py
```

---

## 🎯 这个工具做什么？

自动检查代码中是否把**模型名**错误地当作**厂商（Provider）**使用。

**为什么需要？**
- ❌ 错误：`provider = "kling-3.0"`（kling-3.0 是模型，不是厂商）
- ✅ 正确：`provider = "kling"`（kling 才是厂商）

这类错误会导致程序运行时报错！

---

## 🔍 检查什么？

### 1. 高危问题 🔴

**模型名被当作厂商使用**

例如：
```
❌ provider = "seedance"         # seedance 是模型
❌ engine = "kling-3.0"          # kling-3.0 是模型
❌ provider = "doubao-lite"      # doubao-lite 是模型
```

**影响**：程序会崩溃，报错 `AttributeError`

### 2. 中危问题 🟡

**使用了未知的厂商名**

例如：
```
❌ provider = "unknown-provider"  # 不在支持的厂商列表中
```

---

## 📖 如何看检查结果？

### 情况 1：✅ 未发现问题

```
✅ 未发现架构问题！
```

**操作**：可以正常使用，不需要修改任何代码。

---

### 情况 2：⚠️ 发现问题

```
⚠️  问题统计:
  - 发现问题:     2
  - 高危问题:     1 🔴
  - 中危问题:     1 🟡
```

**操作**：需要修复问题后再提交。

---

## 🛠️ 发现问题如何修复？

### 高危问题修复示例

**问题报告：**
```
🔴 高危问题 - 模型被当作 Provider 使用 (1 个):
------------------------------------------------------------
  1. modules/video_gen.py:794
     可疑名称: seedance
     代码: elif selected_engine == "seedance":
     ⚠️  'seedance' 应该是模型名，不是 Provider！
     💡 请检查该模型属于哪个 Provider（如 kling、volces、openai 等）
```

**修复步骤：**

1. 打开文件：`modules/video_gen.py`
2. 跳转到第 794 行
3. 把 `"seedance"` 改成正确的厂商名

**修复前：**
```python
elif selected_engine == "seedance":
    ...
```

**修复后：**
```python
elif selected_engine == "volces":  # seedance 属于 volces 厂商
    ...
```

---

### 中危问题修复示例

**问题报告：**
```
🟡 中危问题 - 未知的 Provider 引用 (1 个):
------------------------------------------------------------
  1. configs/config.yaml:27
     Provider: nano_banana
     代码: provider: nano_banana
     💡 请确认 'nano_banana' 是否在 PRESET_PROVIDERS 中
```

**修复步骤：**

1. 打开文件：`configs/config.yaml`
2. 跳转到第 27 行
3. 确认该模型属于哪个厂商

**修复前：**
```yaml
image_gen:
  provider: nano_banana  # ❌ 错误
```

**修复后：**
```yaml
image_gen:
  provider: volces      # ✅ nano_banana 属于 volces 厂商
  model: nano_banana    # ✅ 模型名单独配置
```

---

## 📚 正确的厂商列表

如果不确定某个模型属于哪个厂商，参考下表：

| 模型示例 | 正确的厂商名 |
|---------|-------------|
| `kling-3.0`, `kling-2.5` | `kling` |
| `seedance`, `doubao-lite`, `doubao-pro` | `volces`（字节火山方舟）|
| `moonshot-v1`, `moonshot-v1-32k` | `kimi` |
| `qwen-turbo`, `qwen-max` | `zhipu`（智谱）|
| `gpt-4`, `gpt-4o`, `gpt-3.5` | `openai` |
| `gemini-1.5`, `gemini-2.0` | `gemini` |
| `claude-3`, `claude-3.5` | `anthropic` |
| `abab6`, `wanx-v1` | `minimax` |
| `deepseek-chat`, `deepseek-coder` | `deepseek` |

**规则**：
- 厂商名 = 公司名称或产品平台名
- 模型名 = 具体的 AI 模型版本号

---

## 🔧 常见问题 FAQ

### Q1: 我不确定这个模型属于哪个厂商，怎么办？

**A**: 
1. 查看 `api/config_db_v3.py` 文件中的 `PRESET_MODELS` 列表
2. 搜索模型名，查看它属于哪个 provider
3. 或者询问开发人员

### Q2: 检查工具会不会有误报？

**A**: 
- 可能会有少量误报
- 如果确定代码是正确的，可以忽略
- 但大部分情况都是真实的错误，需要修复

### Q3: 修复后还需要重新运行检查吗？

**A**: 
- **建议**：修复后重新运行一次检查
- 确保所有问题都已解决
- 直到看到 `✅ 未发现架构问题！`

### Q4: 日志文件保存在哪里？

**A**: 
`data/config/architecture_check_YYYYMMDD_HHMMSS.log`

例如：`data/config/architecture_check_20260401_153000.log`

### Q5: 可以检查哪些类型的文件？

**A**: 
- ✅ Python 文件（`*.py`）
- ✅ 配置文件（`*.yaml`, `*.yml`）
- ✅ 前端文件（`*.ts`, `*.tsx`）

### Q6: 检查会修改我的代码吗？

**A**: 
- **不会**！
- 检查工具只读取代码，不会修改任何文件
- 它只是找出问题，需要手动修复

---

## 📊 完整输出示例

```
============================================================
📊 检查报告
============================================================

📁 扫描文件统计:
  - Python 文件:  15
  - YAML 文件:    2
  - TypeScript 文件: 10
  - 总计:         27

⚠️  问题统计:
  - 发现问题:     0
  - 高危问题:     0 🔴
  - 中危问题:     0 🟡

============================================================
✅ 未发现架构问题！
============================================================

📝 日志已保存到: data/config/architecture_check_20260401_153000.log
```

---

## 🎓 学习资源

想了解更多关于 Provider/Model 架构的知识，查看：

- 📖 [详细文档](../docs/architecture-check.md)
- 📖 [项目架构说明](../development-docs/settings-v3/plan/00-PROJECT-OVERVIEW.md)

---

## 💡 使用建议

1. **代码修改后立即检查**：防止问题累积
2. **提交代码前检查**：确保代码质量
3. **新功能开发中检查**：及时发现架构问题
4. **定期全面检查**：每周至少运行一次

---

## 📞 遇到问题？

如果遇到以下情况：

- ❌ 工具无法运行
- ❌ 不理解检查结果
- ❌ 不确定如何修复
- ❌ 怀疑是误报

**请联系开发人员**，提供以下信息：
1. 错误截图或日志内容
2. 修改的代码文件
3. 具体的操作步骤

---

**版本**: v1.0  
**更新日期**: 2026-04-01  
**维护者**: 开发团队
