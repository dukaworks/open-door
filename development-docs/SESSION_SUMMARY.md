# 项目开发会话总结

## 项目信息

- **项目名称**: 芝麻开门 OpenDoor (原: Pilipili-AutoVideo)
- **版本**: v2.5
- **GitHub**: https://github.com/dukaworks/Pilipili-AutoVideo
- **本地目录**: `G:\GithubSpace\Pilipili-AutoVideo` (即将改为 `open-door`)

## 本次会话完成的工作

### 1. UI/UX 优化
- ✅ 新增动态粒子网络 (Canvas-based ParticleNetwork)
- ✅ 粒子之间自动连线，根据颜色渐变
- ✅ 鼠标交互效果
- ✅ 好莱坞风格 Hero 区域

### 2. i18n 多语言完善
- ✅ 修复 Preferences 页面硬编码的 "English" 按钮
- ✅ 添加所有语言的完整翻译:
  - 简体中文 (zh-CN)
  - English (en-US)
  - 繁體中文 (zh-TW)
  - 日本語 (ja)
  - 한국어 (ko)

### 3. 品牌升级
- ✅ 项目名称: 噼哩噼哩 → 芝麻开门 OpenDoor
- ✅ CLI 命令: `pilipili` → `opendoor`
- ✅ README.md 全面更新
- ✅ Python 后端所有文件注释更新
- ✅ 移除 ASCII LOGO (终端乱码问题)

### 4. Git 提交
- ✅ 已提交 v2.5 版本
- ✅ 已推送到 GitHub

## 技术栈

### 前端
- React 19 + TypeScript
- TailwindCSS + CSS Variables
- i18next (多语言)
- Canvas (粒子网络)

### 后端
- Python 3.10+
- FastAPI
- LangGraph (工作流编排)
- FFmpeg (视频组装)

## 常用命令

```bash
# 启动后端
python cli/main.py server

# 启动前端
cd pilipili-frontend/client && pnpm dev

# CLI 命令
opendoor run --topic "你的创意"
opendoor test
opendoor config --init
```

## 待完成 / 后续任务

1. ~~项目目录重命名为 `open-door`~~ (进行中)
2. GitHub 仓库重命名
3. Git remote URL 更新
4. (无其他待定任务)

## 重要文件位置

| 文件 | 路径 |
|------|------|
| 前端入口 | `pilipili-frontend/client/src/App.tsx` |
| 首页 | `pilipili-frontend/client/src/pages/Home.tsx` |
| i18n 配置 | `pilipili-frontend/client/src/i18n.ts` |
| 全局样式 | `pilipili-frontend/client/src/index.css` |
| 粒子网络组件 | `pilipili-frontend/client/src/components/ParticleNetwork.tsx` |
| CLI 入口 | `cli/main.py` |
| API 服务 | `api/server.py` |

## 会话时间

- 最后更新: 2025-03-30
