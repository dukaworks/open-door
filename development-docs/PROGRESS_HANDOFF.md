# Open-Door (原 Pilipili-AutoVideo) 项目进度交接文档

> 创建时间: 2026-03-30
> 最后更新: 2026-03-30
> 上下文: 品牌升级 + 深色模式 + 导航修复 + 主页精简

---

## 一、已完成的主要工作

### 1. 认证系统 (Backend - Python/FastAPI)

- **`api/auth.py`** (新建) - 完整的 JWT 认证模块
  - JWT Token 生成/验证 (HS256)
  - 密码哈希 (PBKDF2 + SHA256)
  - 用户 CRUD 操作 (SQLite)
  - 第一个注册用户自动成为 admin
  - Profile 更新、密码修改、偏好设置 API

- **`core/config.py`** (修改) - 添加 AuthConfig 配置

- **`api/server.py`** (修改) - 挂载 auth 路由

### 2. 认证系统 (Frontend - React/TypeScript)

- **`contexts/AuthContext.tsx`** - 认证状态管理
- **`contexts/ThemeContext.tsx`** - 主题支持 (light/dark/system)
- **`pages/Login.tsx`** - 登录/注册页面
- **`pages/Profile.tsx`** - 用户信息管理
- **`pages/Preferences.tsx`** - 主题和语言设置
- **`components/UserMenu.tsx`** - 用户下拉菜单
- **`lib/api.ts`** - 添加 userApi (profile/preferences)
- **`i18n.ts`** - 国际化 (中文/英文)
- **`App.tsx`** - 路由 + 认证保护

### 3. CSS 主题系统修复

- **`index.css`** - 添加深色模式 CSS 变量:
  - `--accent-muted` / `--accent-muted-foreground` (图标容器)
  - `--light-text` (深色背景上的浅色文字)
  - 修复 `.dark` 主题颜色

- **转换以下文件的硬编码颜色为 CSS 变量:**
  - `Studio.tsx` (14处)
  - `Home.tsx` (10处)
  - `LoginDialog.tsx` (全部 hex 颜色)
  - `Settings.tsx` (2处)
  - `Profile.tsx` (1处)
  - `Preferences.tsx` (1处)
  - `DebugPanel.tsx` (1处)

### 4. 品牌升级 (2026-03-30)

- **名称变更**:
  - "噼哩噼哩" → "芝麻开门"
  - "Pilipili-AutoVideo" → "Open-Door"
  
- **修改的文件**:
  - `Home.tsx` - Logo + 标题
  - `Studio.tsx` - 侧边栏 Logo + localStorage key
  - `Login.tsx` - 登录页标题
  - `index.html` - 浏览器标题

### 5. 导航修复 (2026-03-30)

- 修复 wouter Link 用法 (href → to)
- 移除侧边栏"首页"菜单
- Logo 点击行为: 已登录 → 跳转 Studio，未登录 → 留在首页

### 6. 深色模式优化 (2026-03-30)

- 调亮 `--sidebar-foreground` (0.85 → 0.92)
- 调亮 `--muted-foreground` (0.70 → 0.80)
- 修复 AgentConsole 步骤指示器颜色
- 修复 .card-white 深色模式适配

### 7. 主页精简 (2026-03-30)

- 移除 "全自动 AI 视频代理 · 本地部署" 标签
- 标题改为 "一个点子 一句话 从创意到大片"
- 移除大段介绍文字
- Footer 简化

---

## 二、数据库变更

- `users` 表添加 `is_admin` 列
- `users` 表添加 `avatar_url` 列
- 新建 `user_preferences` 表

---

## 三、待完成事项

### 🔴 高优先级

1. **UI 修修补补** - 用户今天要完成的工作
   - 深色模式测试和微调
   - 其他界面细节调整

2. **OAuth 集成** - ⚠️ **部署前才能做**
   - 需要用户先申请 GitHub OAuth App
   - 需要用户先申请 Google OAuth
   - 需要提供 Client ID / Client Secret
   - 实现 OAuth 登录流程
   - 账号绑定页面 UI

---

## 四、关键文件清单

```
pilipili-frontend/client/src/
├── contexts/
│   ├── AuthContext.tsx      # 认证状态
│   └── ThemeContext.tsx    # 主题管理
├── pages/
│   ├── Login.tsx           # 登录注册
│   ├── Profile.tsx         # 用户中心
│   ├── Preferences.tsx     # 偏好设置
│   ├── Studio.tsx          # 主工作台
│   └── Home.tsx            # 首页
├── components/
│   ├── UserMenu.tsx        # 用户菜单
│   ├── LoginDialog.tsx    # 登录弹窗
│   └── DebugPanel.tsx     # 调试面板
├── lib/api.ts              # API 封装
├── i18n.ts                 # 国际化
└── index.css               # CSS 变量定义

api/
├── auth.py                 # 后端认证 (新建)
└── server.py               # 后端入口 (修改)

core/
└── config.py               # 配置 (修改)
```

---

## 五、技术决策

1. **密码安全**: 使用 PBKDF2 + SHA256 多次迭代哈希
2. **JWT**: HS256 算法，过期时间 7 天
3. **CSS 变量**: 所有颜色使用 CSS 变量，支持 light/dark/system 主题
4. **第一个用户**: 自动成为 admin
5. **品牌升级**: 从"噼哩噼哩"升级为"芝麻开门 Open-Door"

---

## 六、已知限制

1. **OAuth**: 必须在部署前完成，因为需要配置回调 URL
2. **账号绑定**: 目前是占位符，需要 OAuth 实现后完善
3. **数据库**: 使用 SQLite (data/users.db)

---

## 七、构建状态

- ✅ Frontend 构建通过
- ✅ 所有硬编码颜色已转换为 CSS 变量
- ✅ 品牌名称已更新

---

## 八、下一步建议

1. 根据用户反馈继续优化 UI
2. **等用户拿到 OAuth 凭证后再实现 OAuth 登录**

---

*此文档用于上下文交接，避免长会话带来的问题。*
