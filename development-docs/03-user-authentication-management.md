# 噼哩噼哩 Pilipili-AutoVideo 用户认证管理与升级计划

## 文档信息

- **文档编号**: DEV-DOC-003
- **版本**: 1.0
- **创建日期**: 2026-03-26
- **项目**: Pilipili-AutoVideo
- **类型**: 升级计划文档

---

## 1. 当前系统状态

### 1.1 现有认证机制

当前版本为**单用户本地部署**模式，认证机制如下：

```yaml
# configs/config.yaml
memory:
  user_id: "default_user"  # 硬编码，无认证
```

```python
# modules/memory.py
class MemoryManager:
    def __init__(self):
        self.user_id = config.memory.user_id  # 默认 "default_user"
```

**问题**：
- 无用户注册/登录
- 无多用户隔离
- API Key 存储在配置文件中（安全风险）
- 项目数据无权限控制

### 1.2 现有 API Key 管理

```python
# api/server.py

@app.post("/api/settings/keys")
async def update_api_keys(request: UpdateApiKeysRequest):
    """更新 API Keys - 当前无认证保护"""
    updates = {
        "llm.deepseek.api_key": request.llm_api_key,
        "image_gen.api_key": request.image_gen_api_key,
        ...
    }
    _write_config_updates(updates)  # 直接写入配置文件
    reset_config()
```

**问题**：
- 任何人都可以修改 API Key
- 无使用配额限制
- 无审计日志

---

## 2. 升级目标

### 2.1 阶段一：基础认证（MVP）

- [x] 用户注册（邮箱/用户名）
- [x] 用户登录（密码 Hash）
- [x] Session/JWT 认证
- [x] 用户隔离（每个用户只能访问自己的项目）
- [x] 密码重置

### 2.2 阶段二：高级功能

- [ ] API Key 管理（每个用户独立存储）
- [ ] 使用配额管理
- [ ] API Key 使用统计
- [ ] 审计日志
- [ ] 邀请码/团队协作

### 2.3 阶段三：企业功能

- [ ] SSO / OAuth 登录
- [ ] API Key 轮换
- [ ] 部门/项目组管理
- [ ] 计费/账单

---

## 3. 技术方案

### 3.1 架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                        认证服务层 (Auth Service)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 注册/登录 │  │ JWT签发  │  │ 权限验证 │  │ API Key  │          │
│  │ /register│  │ /login   │  │ /auth    │  │ 管理     │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
├─────────────────────────────────────────────────────────────────────┤
│                        用户数据库 (SQLite/PostgreSQL)              │
│  users | user_api_keys | projects | api_usage | audit_logs         │
├─────────────────────────────────────────────────────────────────────┤
│                        API 层 (FastAPI + Dependencies)            │
│  Depends(get_current_user) → 验证 JWT → 返回用户                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据库设计

```sql
-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt/argon2
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE
);

-- 用户 API Keys 表（每个用户独立存储）
CREATE TABLE user_api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service VARCHAR(50) NOT NULL,  -- deepseek/kimi/minimax/gemini/kling/seedance
    api_key VARCHAR(255) NOT NULL,
    api_secret VARCHAR(255),       -- Kling 等需要 secret
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 项目表（用户隔离）
CREATE TABLE projects (
    id VARCHAR(20) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    topic VARCHAR(500),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- API 使用统计
CREATE TABLE api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    tokens_used INTEGER DEFAULT 0,
    requests_count INTEGER DEFAULT 0,
    cost_usd DECIMAL(10, 6),
    period_date DATE,  -- 每日统计
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 审计日志
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3 认证流程

#### 3.3.1 注册

```python
# api/auth.py

from passlib.hash import bcrypt
from pydantic import EmailStr

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str  # 最小长度 8

@app.post("/api/auth/register")
async def register(request: RegisterRequest):
    # 1. 验证用户名/邮箱唯一性
    if await db.users.find_one({"username": request.username}):
        raise HTTPException(400, "用户名已存在")
    if await db.users.find_one({"email": request.email}):
        raise HTTPException(400, "邮箱已被注册")
    
    # 2. 密码强度验证
    if len(request.password) < 8:
        raise HTTPException(400, "密码长度至少 8 位")
    
    # 3. 密码 Hash
    password_hash = bcrypt.hash(request.password)
    
    # 4. 创建用户
    user = await db.users.insert_one({
        "username": request.username,
        "email": request.email,
        "password_hash": password_hash,
        "created_at": datetime.now(),
    })
    
    return {"user_id": str(user.inserted_id), "message": "注册成功"}
```

#### 3.3.2 登录

```python
# api/auth.py

from datetime import datetime, timedelta
import jwt

SECRET_KEY = os.environ.get("JWT_SECRET", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = timedelta(hours=24)

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    # 1. 查找用户
    user = await db.users.find_one({"username": request.username})
    if not user:
        raise HTTPException(401, "用户名或密码错误")
    
    # 2. 验证密码
    if not bcrypt.verify(request.password, user["password_hash"]):
        raise HTTPException(401, "用户名或密码错误")
    
    if not user["is_active"]:
        raise HTTPException(403, "账户已被禁用")
    
    # 3. 生成 JWT
    access_token = jwt.encode(
        {
            "sub": str(user["id"]),
            "username": user["username"],
            "exp": datetime.utcnow() + ACCESS_TOKEN_EXPIRE
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )
    
    # 4. 记录审计日志
    await db.audit_logs.insert_one({
        "user_id": user["id"],
        "action": "login",
        "ip_address": request.client.host if request.client else None,
    })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["id"]),
            "username": user["username"],
            "email": user["email"]
        }
    }
```

#### 3.3.3 依赖注入（Protected Endpoints）

```python
# api/auth.py

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

security = HTTPBearer()

class TokenData(BaseModel):
    user_id: str
    username: str

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """验证 JWT 并返回当前用户"""
    credentials_exception = HTTPException(
        status_code=401,
        detail="无效的认证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        username = payload.get("username")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    return TokenData(user_id=user_id, username=username)


# 使用示例
@app.get("/api/projects")
async def list_projects(current_user: TokenData = Depends(get_current_user)):
    """获取当前用户的项目列表"""
    projects = await db.projects.find({"user_id": current_user.user_id}).to_list()
    return projects
```

### 3.4 API Key 管理

#### 3.4.1 用户配置 API Key

```python
# api/keys.py

class UpdateUserApiKeysRequest(BaseModel):
    deepseek_key: Optional[str] = None
    kimi_key: Optional[str] = None
    minimax_key: Optional[str] = None
    gemini_key: Optional[str] = None
    kling_key: Optional[str] = None
    kling_secret: Optional[str] = None
    seedance_key: Optional[str] = None

@app.post("/api/keys")
async def update_user_api_keys(
    request: UpdateUserApiKeysRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """更新当前用户的 API Keys（加密存储）"""
    
    services = [
        ("deepseek", request.deepseek_key),
        ("kimi", request.kimi_key),
        ("minimax", request.minimax_key),
        ("gemini", request.gemini_key),
        ("kling", request.kling_key, request.kling_secret),
        ("seedance", request.seedance_key),
    ]
    
    for service in services:
        service_name = service[0]
        api_key = service[1]
        api_secret = service[2] if len(service) > 2 else None
        
        if api_key:
            # 加密存储（使用用户专属密钥或数据库透明加密）
            encrypted_key = encrypt_api_key(api_key, current_user.user_id)
            
            await db.user_api_keys.update_one(
                {"user_id": current_user.user_id, "service": service_name},
                {
                    "$set": {
                        "api_key": encrypted_key,
                        "api_secret": encrypt_api_key(api_secret, current_user.user_id) if api_secret else None,
                        "updated_at": datetime.now()
                    }
                },
                upsert=True
            )
    
    # 记录审计日志
    await db.audit_logs.insert_one({
        "user_id": current_user.user_id,
        "action": "update_api_keys",
        "resource_type": "api_keys",
    })
    
    return {"message": "API Keys 已更新"}
```

#### 3.4.2 读取当前用户的 API Keys（脱敏）

```python
@app.get("/api/keys/status")
async def get_keys_status(current_user: TokenData = Depends(get_current_user)):
    """获取当前用户的 API Key 配置状态（不返回真实 Key）"""
    
    keys = await db.user_api_keys.find({"user_id": current_user.user_id}).to_list()
    
    return {
        "deepseek": {"configured": any(k["service"] == "deepseek" for k in keys)},
        "kimi": {"configured": any(k["service"] == "kimi" for k in keys)},
        "minimax": {"configured": any(k["service"] == "minimax" for k in keys)},
        "gemini": {"configured": any(k["service"] == "gemini" for k in keys)},
        "kling": {"configured": any(k["service"] == "kling" for k in keys)},
        "seedance": {"configured": any(k["service"] == "seedance" for k in keys)},
    }
```

### 3.5 认证后的工作流调用

```python
# api/projects.py

async def get_user_config(user_id: str) -> PilipiliConfig:
    """获取用户的配置（全局配置 + 用户个人 API Keys）"""
    
    config = get_config()  # 加载全局配置
    
    # 覆盖用户个人的 API Keys
    user_keys = await db.user_api_keys.find({"user_id": user_id}).to_list()
    
    for key_record in user_keys:
        decrypted_key = decrypt_api_key(key_record["api_key"], user_id)
        
        if key_record["service"] == "deepseek":
            config.llm.deepseek.api_key = decrypted_key
        elif key_record["service"] == "gemini":
            config.image_gen.api_key = decrypted_key
        # ... 其他服务
    
    return config


@app.post("/api/projects")
async def create_project(
    request: CreateProjectRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """创建新项目（用户隔离）"""
    
    # 获取用户的配置
    user_config = await get_user_config(current_user.user_id)
    
    # 创建项目（绑定 user_id）
    project_id = str(uuid.uuid4())[:8]
    await db.projects.insert_one({
        "id": project_id,
        "user_id": current_user.user_id,  # 绑定用户
        "topic": request.topic,
        "status": "idle",
        "created_at": datetime.now(),
    })
    
    # 启动工作流（传入用户配置）
    background_tasks.add_task(
        run_workflow, project_id, request, user_config
    )
    
    return {"project_id": project_id, "message": "工作流已启动"}


# 修复：run_workflow 需要支持传入自定义配置
async def run_workflow(project_id: str, request, config: PilipiliConfig):
    """工作流（支持传入配置）"""
    # 使用 user_config 而不是全局配置
    ...
```

---

## 4. 密码重置流程

### 4.1 发送重置邮件

```python
@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """发送密码重置邮件"""
    user = await db.users.find_one({"email": request.email})
    
    if user:
        # 生成重置 Token（短时效）
        reset_token = jwt.encode(
            {"sub": str(user["id"]), "type": "password_reset", "exp": datetime.utcnow() + timedelta(hours=1)},
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        
        # 发送邮件（需要配置 SMTP）
        await send_email(
            to=user["email"],
            subject="重置密码",
            body=f"点击链接重置密码：https://yourdomain.com/reset-password?token={reset_token}"
        )
    
    # 无论用户是否存在，都返回成功（防止邮箱枚举）
    return {"message": "如果邮箱存在，已发送重置链接"}
```

### 4.2 重置密码

```python
@app.post("/api/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """重置密码"""
    try:
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(400, "无效的 Token")
        
        user_id = payload["sub"]
        
        # 更新密码
        new_hash = bcrypt.hash(request.new_password)
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password_hash": new_hash}}
        )
        
        return {"message": "密码重置成功"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(400, "Token 已过期")
```

---

## 5. 实施路线图

### 5.1 Phase 1：基础认证（1-2 周）

| 任务 | 预估工时 | 优先级 |
|------|----------|--------|
| 数据库表设计 | 1 天 | P0 |
| 用户注册 API | 2 天 | P0 |
| 用户登录 API (JWT) | 2 天 | P0 |
| 依赖注入 get_current_user | 1 天 | P0 |
| 用户隔离（项目 CRUD）| 2 天 | P0 |
| 前端登录/注册页面 | 3 天 | P1 |
| 单元测试 | 2 天 | P1 |

**交付物**：
- `/api/auth/register` - 注册
- `/api/auth/login` - 登录
- `/api/projects` - 用户隔离的项目列表

### 5.2 Phase 2：API Key 管理（1 周）

| 任务 | 预估工时 | 优先级 |
|------|----------|--------|
| 用户 API Key 存储（加密）| 2 天 | P0 |
| 用户 API Key 读取（脱敏）| 1 天 | P0 |
| 使用统计表设计 | 1 天 | P1 |
| 使用统计记录 | 2 天 | P1 |
| 前端 API Key 管理页面 | 2 天 | P1 |

**交付物**：
- `/api/keys` - 用户管理自己的 API Keys
- `/api/keys/status` - 查看配置状态
- 使用统计 Dashboard

### 5.3 Phase 3：安全与审计（1 周）

| 任务 | 预估工时 | 优先级 |
|------|----------|--------|
| 审计日志记录 | 2 天 | P1 |
| 审计日志查询（管理员）| 1 天 | P1 |
| 速率限制 | 2 天 | P1 |
| 密码重置 | 2 天 | P1 |

**交付物**：
- 完整的审计日志
- 速率限制保护
- 密码重置功能

---

## 6. 向后兼容性

### 6.1 单用户模式兼容

```python
# 配置选项
auth:
  mode: "single"  # single | multi
  # 单用户模式：使用默认用户 ID
  default_user_id: "default_user"
```

```python
# 兼容逻辑
def get_current_user_or_default():
    """单用户模式下返回默认用户，多用户模式要求登录"""
    config = get_config()
    
    if config.auth.mode == "single":
        return TokenData(
            user_id=config.auth.default_user_id,
            username="default"
        )
    else:
        # 多用户模式，从 JWT 获取
        return Depends(get_current_user)
```

### 6.2 现有配置迁移

```python
# 首次启动时，将 config.yaml 中的 API Keys 迁移到第一个用户
async def migrate_existing_keys():
    """将配置文件的 Keys 迁移到默认用户"""
    config = get_config()
    
    default_user = await db.users.find_one({"username": "default"})
    if not default_user:
        # 创建默认用户
        default_user_id = await create_default_user()
    
    # 迁移 LLM Keys
    for provider in ["deepseek", "kimi", "minimax", "gemini"]:
        provider_cfg = getattr(config.llm, provider)
        if provider_cfg.api_key:
            await store_encrypted_key(default_user_id, provider, provider_cfg.api_key)
    
    # 迁移其他 Keys
    if config.image_gen.api_key:
        await store_encrypted_key(default_user_id, "gemini", config.image_gen.api_key)
    
    # ... 其他
```

---

## 7. 安全考虑

### 7.1 密码安全

- 使用 **bcrypt** 或 **argon2** 密码 Hash
- 密码最小长度 8 位
- 密码重置 Token 有效期 1 小时

### 7.2 API Key 安全

- **加密存储**：使用用户专属密钥加密
- **不返回明文**：只返回配置状态
- **日志脱敏**：审计日志不记录 Key

### 7.3 JWT 安全

- 有效期：24 小时（可配置）
- Algorithm: HS256
- Secret Key：环境变量配置

### 7.4 速率限制

```python
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/auth/login")
@limiter.limit("5/minute")  # 5 次/分钟
async def login(request: LoginRequest):
    ...
```

---

## 8. 前端改动

### 8.1 登录页面

```
┌──────────────────────────────────────┐
│         登录                         │
├──────────────────────────────────────┤
│  用户名: [____________]              │
│  密码:   [____________]              │
│           [登录]                     │
│                                      │
│  没有账号？[注册]                     │
│  忘记密码？[重置]                     │
└──────────────────────────────────────┘
```

### 8.2 注册页面

```
┌──────────────────────────────────────┐
│         注册                         │
├──────────────────────────────────────┤
│  用户名: [____________]              │
│  邮箱:   [____________]              │
│  密码:   [____________]              │
│  确认密码: [____________]            │
│           [注册]                     │
│                                      │
│  已有账号？[登录]                     │
└──────────────────────────────────────┘
```

### 8.3 设置页面（认证后）

```
┌──────────────────────────────────────┐
│  用户: username   [登出]              │
├──────────────────────────────────────┤
│  API Keys:                           │
│  ┌────────────────────────────────┐ │
│  │ DeepSeek: [已配置] [编辑]      │ │
│  │ Kimi:     [未配置] [添加]      │ │
│  │ MiniMax:  [已配置] [编辑]      │ │
│  │ Gemini:   [已配置] [编辑]      │ │
│  │ Kling:    [已配置] [编辑]      │ │
│  │ Seedance: [未配置] [添加]      │ │
│  └────────────────────────────────┘ │
│                                      │
│  使用统计:                            │
│  ┌────────────────────────────────┐ │
│  │ 今日: $0.50 (1,000 tokens)     │ │
│  │ 本月: $12.30 (25,000 tokens)   │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## 9. 测试计划

| 测试场景 | 测试用例 |
|----------|----------|
| 注册 | 成功注册、用户名重复、邮箱重复、密码强度不足 |
| 登录 | 成功登录、错误密码、用户不存在、账户禁用 |
| JWT | 有效 Token、无效 Token、过期 Token |
| 项目隔离 | 用户 A 无法访问用户 B 的项目 |
| API Keys | 更新成功、读取脱敏、加密存储验证 |
| 审计日志 | 登录、项目创建、Key 更新都被记录 |

---

## 10. 总结

本计划将 Pilipili-AutoVideo 从单用户本地工具升级为**多用户认证系统**，核心改动包括：

1. **JWT 认证**：安全的用户认证机制
2. **用户隔离**：项目、配置完全隔离
3. **独立 API Key 存储**：每个用户管理自己的 Keys
4. **审计日志**：完整的操作记录
5. **向后兼容**：单用户模式可继续使用

**预计工时**：4-5 周（分 3 个 Phase）

---

*文档版本: 1.0 | 最后更新: 2026-03-26*