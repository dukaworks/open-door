# Settings System v3.0 改造 - 工作总览

## 当前状态

### 已完成的修复（2026-03-31）
- ✅ 用户资料更新 SQL 错误修复
- ✅ 头像上传功能修复
- ✅ 用户中心账号绑定标签页
- ✅ Studio 页面菜单风格统一

### Git 状态
- 当前分支：main
- 最新标签：v2.0-settings-start
- 已提交：92bb9bd FIX: 修复用户中心和头像相关BUG

## 改造计划概览

### 阶段一：数据库层（2-3天）
创建 6 个新数据表：
1. **Providers** - 服务商信息
2. **UserProviderConfigs** - 用户的 API Key 配置
3. **Models** - 模型参数
4. **Packages** - 套餐模板
5. **UserConfigs** - 用户运行时配置
6. **SystemSettings** - 系统通用配置

### 阶段二：后端 API（2-3天）
创建 RESTful API：
- `/api/v3/providers` - 服务商管理
- `/api/v3/providers/{id}/models` - 模型列表
- `/api/v3/providers/{id}/test` - 配置测试
- `/api/v3/packages` - 套餐管理
- `/api/v3/user/config` - 用户配置
- `/api/v3/system/settings` - 系统设置

### 阶段三：前端界面（3-4天）
重构 SettingsDialog：
- 套餐选择标签页
- 提供商配置标签页
- 系统设置标签页
- 底部菜单配置检查集成

### 阶段四：集成测试（2天）
- 前后端联调
- 数据迁移测试
- 废弃旧 Settings.tsx

## 备份策略

每个阶段必须执行：
```bash
# 1. 创建 Git 标签
git tag -a v2.0-settings-phase{N}-complete -m "阶段{N}完成"

# 2. 备份数据库
cp data/config/user_config.db development-docs/settings-v3/backup/phase{N}.db

# 3. 编写进度文档
echo "阶段{N}完成" > development-docs/settings-v3/progress/phase{N}.md
```

## 下一步行动

1. **提交当前版本到 GitHub**
   ```bash
   git push origin main
   git push origin v2.0-settings-start
   ```

2. **开始阶段一：数据库层改造**
   - 创建 `api/config_db_v3.py`
   - 实现 6 个数据表
   - 编写迁移脚本

3. **每日工作法**
   - 每个工作单元完成后提交
   - 每天结束创建备份标签
   - 记录进度到 progress 目录

## 项目文档位置

- 总览：`development-docs/settings-v3/plan/00-PROJECT-OVERVIEW.md`
- 阶段一：`development-docs/settings-v3/plan/01-PHASE1-DATABASE.md`
- 备份目录：`development-docs/settings-v3/backup/`
- 进度目录：`development-docs/settings-v3/progress/`

## 确认事项

- ✅ 数据表设计确认
- ✅ 配置优先级策略确认
- ✅ 备份策略确认
- ⏳ 提交 GitHub
- ⏳ 开始阶段一

---

**请确认以上计划后，我们开始执行第一步：提交到 GitHub**
