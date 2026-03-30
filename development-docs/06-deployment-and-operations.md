# 噼哩噼哩 Pilipili-AutoVideo 部署与运维指南

## 文档信息

- **文档编号**: DEV-DOC-006
- **版本**: 1.0
- **创建日期**: 2026-03-26
- **项目**: Pilipili-AutoVideo
- **类型**: 部署运维文档

---

## 1. 部署模式概述

### 1.1 支持的部署模式

| 模式 | 适用场景 | 复杂度 | 推荐度 |
|------|----------|--------|--------|
| **本地开发** | 个人开发者、本地调试 | 低 | ⭐⭐⭐⭐⭐ |
| **Docker Compose** | 小团队、生产部署 | 中 | ⭐⭐⭐⭐⭐ |
| **Kubernetes** | 大规模生产、企业级 | 高 | ⭐⭐⭐ |
| **Serverless** | 边缘部署、按需扩展 | 中 | ⭐⭐ |

### 1.2 系统要求

| 组件 | 最低配置 | 推荐配置 |
|------|----------|----------|
| **CPU** | 4 核 | 8 核+ |
| **内存** | 8 GB | 16 GB+ |
| **磁盘** | 50 GB SSD | 100 GB SSD |
| **网络** | 10 Mbps | 50 Mbps+ |
| **操作系统** | Ubuntu 20.04+ / Windows 10+ / macOS 12+ | - |

### 1.3 依赖服务

| 服务 | 用途 | 必需 | 可选 |
|------|------|------|------|
| **FFmpeg** | 视频组装 | ✅ | |
| **Python 3.10+** | 运行时 | ✅ | |
| **Node.js 18+** | 前端构建 | ✅ | |
| **SQLite** | 本地存储 | ✅ | |
| **Redis** | 缓存/会话 | | ✅ |
| **PostgreSQL** | 生产数据库 | | ✅ |
| **Docker** | 容器化 | | ✅ |

---

## 2. 本地开发部署

### 2.1 环境准备

```bash
# 1. 克隆项目
git clone https://github.com/OpenDemon/Pilipili-AutoVideo.git
cd Pilipili-AutoVideo

# 2. 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate  # Windows

# 3. 安装依赖
pip install -r requirements.txt

# 4. 安装 FFmpeg
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# 下载 https://ffmpeg.org/download.html 并添加到 PATH

# 5. 验证安装
ffmpeg -version
python --version  # 应为 3.10+
```

### 2.2 配置

```bash
# 1. 复制配置模板
cp configs/config.example.yaml configs/config.yaml

# 2. 编辑配置（填入 API Keys）
# 详见 README.md 或 config.example.yaml
```

### 2.3 启动服务

```bash
# 方式1：CLI 模式
python cli/main.py run --topic "Cyberpunk Mars colony, 60 seconds"

# 方式2：Web UI 模式（推荐）

# 终端1：启动后端
python cli/main.py server

# 终端2：启动前端
cd pilipili-frontend
pnpm install
pnpm dev

# 访问 http://localhost:3000
```

### 2.4 开发调试

```bash
# 1. 启用调试模式
export DEBUG=1

# 2. 后端热重载
pip install uvicorn[reload]
uvicorn api.server:app --reload --reload-dir api --reload-dir modules

# 3. 前端热重载
cd pilipili-frontend
pnpm dev --host 0.0.0.0

# 4. VS Code 调试配置
# .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["api.server:app", "--reload"],
      "cwd": "${workspaceFolder}",
      "env": {"PYTHONPATH": "${workspaceFolder}"}
    }
  ]
}
```

---

## 3. Docker Compose 部署

### 3.1 docker-compose.yml

```yaml
version: '3.8'

services:
  # 后端服务
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./configs:/app/configs
    environment:
      - PYTHONUNBUFFERED=1
      - PILIPILI_CONFIG=/app/configs/config.yaml
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 前端服务
  frontend:
    build:
      context: ./pilipili-frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_BASE=http://localhost:8000
    depends_on:
      - backend
    restart: unless-stopped

  # 可选：Redis 缓存
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

### 3.2 Dockerfile.backend

```dockerfile
FROM python:3.11-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建数据目录
RUN mkdir -p data/{outputs,memory,temp,uploads}

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3.3 .env 文件

```bash
# API Keys（必需）
DEEPSEEK_API_KEY=sk-xxxx
GEMINI_API_KEY=AIza-xxxx
KLING_API_KEY=xxxx
KLING_API_SECRET=xxxx
MINIMAX_API_KEY=xxxx

# 可选配置
PILIPILI_CONFIG=/app/configs/config.yaml
LOG_LEVEL=INFO
DEBUG=false
```

### 3.4 启动

```bash
# 1. 启动所有服务
docker-compose up -d

# 2. 查看日志
docker-compose logs -f

# 3. 检查状态
docker-compose ps

# 4. 访问
# 后端: http://localhost:8000
# 前端: http://localhost:3000
# 健康检查: http://localhost:8000/health

# 5. 停止
docker-compose down
```

---

## 4. Kubernetes 部署（生产级）

### 4.1 K8s 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ingress Controller                       │
│                    (Traefik / Nginx Ingress)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Backend     │    │   Frontend    │    │  MinIO / S3   │
│   Deployment  │    │   Deployment  │    │  (文件存储)    │
│               │    │               │    │               │
│ - 3 replicas  │    │ - 2 replicas │    │               │
│ - HPA        │    │ - HPA        │    │               │
└───────┬───────┘    └───────┬───────┘    └───────────────┘
        │                    │
        ▼                    ▼
┌───────────────┐    ┌───────────────┐
│   Redis       │    │  PostgreSQL   │
│   (Cache)     │    │  (Metadata)   │
└───────────────┘    └───────────────┘
```

### 4.2 后端 Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pilipili-backend
  labels:
    app: pilipili
    component: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pilipili
      component: backend
  template:
    metadata:
      labels:
        app: pilipili
        component: backend
    spec:
      containers:
      - name: backend
        image: pilipili/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: PILIPILI_CONFIG
          value: /app/configs/config.yaml
        envFrom:
        - secretRef:
            name: pilipili-secrets
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: config
          mountPath: /app/configs
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: pilipili-data
      - name: config
        configMap:
          name: pilipili-config
---
apiVersion: v1
kind: Service
metadata:
  name: pilipili-backend
spec:
  selector:
    app: pilipili
    component: backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pilipili-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pilipili-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 4.3 前端 Deployment

```yaml
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pilipili-frontend
  labels:
    app: pilipili
    component: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pilipili
      component: frontend
  template:
    metadata:
      labels:
        app: pilipili
        component: frontend
    spec:
      containers:
      - name: frontend
        image: pilipili/frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: VITE_API_BASE
          value: http://pilipili-backend:8000
        resources:
          requests:
            cpu: "200m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: pilipili-frontend
spec:
  selector:
    app: pilipili
    component: frontend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

### 4.4 Ingress 配置

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pilipili-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - pilipili.yourdomain.com
    secretName: pilipili-tls
  rules:
  - host: pilipili.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: pilipili-backend
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: pilipili-frontend
            port:
              number: 80
```

### 4.5 Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: pilipili-secrets
type: Opaque
stringData:
  DEEPSEEK_API_KEY: sk-xxxx
  GEMINI_API_KEY: AIza-xxxx
  KLING_API_KEY: xxxx
  KLING_API_SECRET: xxxx
  MINIMAX_API_KEY: xxxx
  JWT_SECRET: your-super-secret-jwt-key
```

---

## 5. 运维监控

### 5.1 日志管理

```bash
# Docker 日志
docker-compose logs -f backend

# Kubernetes 日志
kubectl logs -f deployment/pilipili-backend

# 聚合日志（ELK/EFK）
# 使用 Filebeat 收集日志到 Elasticsearch
```

### 5.2 监控指标

```python
# 关键指标
METRICS = {
    # 服务健康
    "request_count": "请求总数",
    "request_latency": "请求延迟（p50/p95/p99）",
    "error_rate": "错误率",
    
    # 业务指标
    "active_projects": "活跃项目数",
    "completed_projects": "已完成项目数",
    "video_duration_generated": "已生成视频总时长",
    
    # 资源指标
    "cpu_usage": "CPU 使用率",
    "memory_usage": "内存使用率",
    "disk_usage": "磁盘使用率",
    "api_quota_usage": "API 配额使用",
}
```

### 5.3 健康检查

```python
# api/server.py - 健康检查端点

@app.get("/health")
async def health_check():
    """健康检查"""
    import psutil
    
    # 检查各组件
    checks = {
        "api": "ok",
        "config": "ok" if get_config() else "error",
        "ffmpeg": "ok" if shutil.which("ffmpeg") else "missing",
    }
    
    # 检查资源
    resources = {
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent,
    }
    
    # 整体状态
    all_ok = all(v == "ok" for v in checks.values())
    
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
        "resources": resources,
        "version": "1.0.0"
    }
```

### 5.4 Prometheus 集成

```python
# metrics.py - Prometheus 指标

from prometheus_client import Counter, Histogram, Gauge

# 请求计数
REQUEST_COUNT = Counter(
    'pilipili_requests_total',
    'Total requests',
    ['endpoint', 'method', 'status']
)

# 请求延迟
REQUEST_LATENCY = Histogram(
    'pilipili_request_duration_seconds',
    'Request duration',
    ['endpoint']
)

# 活跃项目
ACTIVE_PROJECTS = Gauge(
    'pilipili_active_projects',
    'Number of active projects'
)

# 使用示例
@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    
    REQUEST_COUNT.labels(
        endpoint=request.url.path,
        method=request.method,
        status=response.status_code
    ).inc()
    
    REQUEST_LATENCY.labels(
        endpoint=request.url.path
    ).observe(duration)
    
    return response


# 暴露指标端点
@app.get("/metrics")
async def metrics():
    from prometheus_client import generate_latest
    return Response(generate_latest(), media_type="text/plain")
```

---

## 6. 备份与恢复

### 6.1 备份策略

```bash
#!/bin/bash
# backup.sh

# 备份配置
BACKUP_DIR="/backup/pilipili"
DATE=$(date +%Y%m%d)

# 1. 备份配置
cp configs/config.yaml $BACKUP_DIR/config-$DATE.yaml

# 2. 备份数据库
cp data/memory/mem0.db $BACKUP_DIR/memory-$DATE.db

# 3. 备份项目元数据
cp -r data/projects_meta $BACKUP_DIR/projects_meta-$DATE

# 4. 备份生成的视频（可选，选择保留）
# find data/outputs -name "*.mp4" -mtime -7 -exec cp {} $BACKUP_DIR/videos/ \;

# 5. 清理旧备份（保留 30 天）
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

### 6.2 恢复流程

```bash
#!/bin/bash
# restore.sh

BACKUP_DATE=$1  # 例如：20260326

# 1. 恢复配置
cp $BACKUP_DIR/config-$BACKUP_DATE.yaml configs/config.yaml

# 2. 恢复数据库
cp $BACKUP_DIR/memory-$BACKUP_DATE.db data/memory/mem0.db

# 3. 恢复项目元数据
rm -rf data/projects_meta
cp -r $BACKUP_DIR/projects_meta-$BACKUP_DATE data/projects_meta

# 4. 重启服务
docker-compose restart
```

---

## 7. 安全配置

### 7.1 安全基线

```yaml
# 1. 限制端口访问
# ufw allow 8000/tcp   # API
# ufw allow 3000/tcp   # Frontend
# ufw enable

# 2. 防火墙规则（Docker）
docker run ... --iptables=true

# 3. 安全Headers（Nginx）
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000";
```

### 7.2 密钥管理

```bash
# 使用 Docker Secrets（生产）
echo "your-secret" | docker secret create api_key -

# 或使用 Kubernetes Secrets
kubectl create secret generic pilipili-secrets \
  --from-literal=api-key=xxx \
  --from-literal=jwt-secret=xxx
```

### 7.3 SSL/TLS

```bash
# Let's Encrypt（自动续期）
# docker-compose.yml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
```

---

## 8. 资源规划

### 8.1 小规模部署（< 10 用户）

| 资源 | 配置 |
|------|------|
| 服务器 | 4 核 8GB 1 台 |
| 磁盘 | 100GB SSD |
| 带宽 | 10 Mbps |

### 8.2 中规模部署（10-100 用户）

| 资源 | 配置 |
|------|------|
| Backend | 2 台 4 核 8GB |
| Frontend | 2 台 2 核 4GB |
| DB/Redis | 1 台 4 核 16GB |
| 磁盘 | 500GB SSD |
| 带宽 | 50 Mbps |

### 8.3 大规模部署（> 100 用户）

| 资源 | 配置 |
|------|------|
| Backend | 5+ 台 8 核 16GB (K8s HPA) |
| Frontend | 3+ 台 4 核 8GB |
| PostgreSQL | 主从 2 台 |
| Redis | 集群 3 台 |
| 对象存储 | MinIO / S3 |
| CDN | CloudFlare / 阿里云 CDN |
| 带宽 | 100 Mbps+ |

---

## 9. 升级流程

### 9.1 版本升级

```bash
# 1. 备份
./backup.sh

# 2. 更新代码
git pull origin main

# 3. 更新依赖
pip install -r requirements.txt

# 4. 数据库迁移（如有）
# python -m flask db upgrade

# 5. 重启服务
docker-compose down
docker-compose up -d

# 6. 验证
curl http://localhost:8000/health
```

### 9.2 回滚

```bash
# 回滚到上一版本
git reset --hard HEAD~1
docker-compose down
docker-compose up -d
```

---

## 10. 运维清单

### 10.1 日常检查

| 检查项 | 频率 | 工具 |
|--------|------|------|
| 服务健康状态 | 每小时 | curl /health |
| 磁盘使用率 | 每天 | df -h |
| 日志异常 | 每天 | grep ERROR |
| API 配额 | 每周 | 控制台 |
| 备份验证 | 每周 | restore test |

### 10.2 周/月任务

| 任务 | 频率 |
|------|------|
| 安全更新 | 每周 |
| 性能报表 | 每月 |
| 容量评估 | 每月 |
| 灾难恢复演练 | 每季度 |

---

## 11. 总结

| 部署模式 | 复杂度 | 适用场景 |
|----------|--------|----------|
| 本地开发 | 低 | 个人开发调试 |
| Docker Compose | 中 | 小团队/生产（简单）|
| Kubernetes | 高 | 大规模/企业级 |

**关键运维要点**：

1. **监控**：健康检查 + Prometheus + 日志聚合
2. **备份**：配置 + 数据库 + 项目元数据
3. **安全**：网络隔离 + Secrets 管理 + SSL
4. **容量**：根据用户规模选择合适的资源配置

---

*文档版本: 1.0 | 最后更新: 2026-03-26*