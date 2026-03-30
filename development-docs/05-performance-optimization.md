# 噼哩噼哩 Pilipili-AutoVideo 性能优化指南

## 文档信息

- **文档编号**: DEV-DOC-005
- **版本**: 1.0
- **创建日期**: 2026-03-26
- **项目**: Pilipili-AutoVideo
- **类型**: 优化指南文档

---

## 1. 性能优化概述

### 1.1 优化目标

| 指标 | 当前基线 | 优化目标 | 优化手段 |
|------|----------|----------|----------|
| **首帧生成时间** | 30-60s | <20s | 缓存 + 并发 |
| **TTS 生成时间** | 5-10s/分镜 | <3s | 语音缓存 |
| **视频生成时间** | 2-5min/分镜 | 1-2min | 批量 + Omni |
| **组装时间** | 30-60s | <20s | 增量 FFmpeg |
| **内存占用** | 2-4GB | <1GB | 对象复用 |
| **并发能力** | 3-5 并发 | 10+ 并发 | 异步优化 |

### 1.2 优化层次

```
┌─────────────────────────────────────────────────────────────────┐
│                      业务层优化                                 │
│  - 缓存策略：脚本模板、关键帧、TTS 结果                        │
│  - 批量处理：Omni 批量生成                                      │
│  - 断点续传：增量生成                                           │
├─────────────────────────────────────────────────────────────────┤
│                      并发优化                                    │
│  - asyncio：并发调度                                           │
│  - Semaphore：流量控制                                         │
│  - 线程池：CPU 密集任务                                        │
├─────────────────────────────────────────────────────────────────┤
│                      资源优化                                    │
│  - 对象池：复用 FFmpeg 实例                                     │
│  - 内存池：避免频繁分配                                         │
│  - 磁盘缓存：本地文件缓存                                       │
├─────────────────────────────────────────────────────────────────┤
│                      基础设施优化                               │
│  - CDN：静态资源加速                                           │
│  - 数据库：SQLite 索引优化                                      │
│  - 网络：连接池复用                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 并发优化

### 2.1 异步任务调度

```python
# 当前并发配置
# modules/tts.py
async def generate_all_voiceovers(scenes, ..., max_concurrent: int = 5):
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def _generate_with_semaphore(scene):
        async with semaphore:
            return await generate_voiceover(scene, ...)
    
    tasks = [_generate_with_semaphore(s) for s in scenes]
    return await asyncio.gather(*tasks)
```

**优化建议**：

```python
# 优化1：动态并发调整
async def generate_all_voiceovers(scenes, ..., config: PilipiliConfig):
    # 根据 API 限流动态调整
    base_limit = get_rate_limit("minimax")  # 获取当前限制
    semaphore = asyncio.Semaphore(base_limit)
    
    # 动态调整：根据 429 错误自动降速
    retry_count = 0
    while retry_count < 3:
        try:
            results = await asyncio.gather(*tasks)
            break
        except RateLimitError:
            # 遇到限速，自动降低并发
            new_limit = max(1, base_limit // 2)
            semaphore = asyncio.Semaphore(new_limit)
            retry_count += 1
            await asyncio.sleep(5 * retry_count)  # 等待后重试

# 优化2：优先级队列
import heapq

class PriorityTaskQueue:
    def __init__(self):
        self._queue = []
        self._waiting = {}  # task_id -> asyncio.Future
    
    def add_task(self, task_id: str, priority: int, coro):
        """添加任务（优先级越小越先执行）"""
        heapq.heappush(self._queue, (priority, task_id, coro))
    
    async def execute(self, max_concurrent: int = 3):
        semaphore = asyncio.Semaphore(max_concurrent)
        
        while self._queue:
            priority, task_id, coro = heapq.heappop(self._queue)
            
            async def wrapped():
                async with semaphore:
                    return await coro
            
            asyncio.create_task(wrapped())
```

### 2.2 批量处理优化

```python
# 当前：逐个生成
# modules/video_gen.py

# 优化：Kling Omni 批量生成
async def generate_video_clips_omni_batch(
    scenes: list[Scene],
    keyframe_paths: dict[int, str],
    batch_size: int = 6,  # Omni 最大支持 6
):
    """批量生成，大幅减少 API 调用"""
    
    results = {}
    for i in range(0, len(scenes), batch_size):
        batch = scenes[i:i + batch_size]
        
        # 单次 API 调用生成 batch_size 个分镜
        task_id = await _submit_kling_omni(batch, keyframe_paths)
        video_urls = await _poll_kling_omni_task(task_id)
        
        for j, scene in enumerate(batch):
            results[scene.scene_id] = video_urls[j]
    
    return results
```

**更进一步的优化**：

```python
# 智能批量：根据场景类型自动分批
def intelligent_batching(scenes: list[Scene]) -> list[list[Scene]]:
    """
    智能分批策略：
    - multi_ref 场景放一起（需要角色参考图）
    - t2v 场景放一起（纯文本）
    - 控制每批总时长不超过 15s
    """
    batches = []
    current_batch = []
    current_duration = 0
    
    for scene in scenes:
        scene_duration = scene.duration or 5
        
        # 如果加上这个场景超过 15s，开启新批次
        if current_duration + scene_duration > 15 and current_batch:
            batches.append(current_batch)
            current_batch = []
            current_duration = 0
        
        current_batch.append(scene)
        current_duration += scene_duration
    
    if current_batch:
        batches.append(current_batch)
    
    return batches
```

### 2.3 并发限流策略

```python
# modules/proxy/limiter.py - 增强版

class AdaptiveRateLimiter:
    """自适应限流器 - 根据 API 响应动态调整"""
    
    def __init__(self):
        self.provider_limits = {
            "minimax": {"rpm": 60, "rpd": 5000},
            "deepseek": {"rpm": 120, "rpd": 10000},
            "gemini": {"rpm": 60, "rpd": 1500},
            "kling": {"rpm": 10, "rpd": 100},
        }
        self.current_429_count = {}  # 记录 429 错误
    
    async def acquire(self, provider: str) -> bool:
        """获取令牌"""
        if self.current_429_count.get(provider, 0) > 3:
            # 连续 429，降低到 1 并等待恢复
            await self._wait_for_recovery(provider)
        
        limit = self.provider_limits[provider]["rpm"]
        # 使用令牌桶算法
        return await self._try_acquire(provider, limit)
    
    def on_429(self, provider: str):
        """记录 429 错误"""
        self.current_429_count[provider] = \
            self.current_429_count.get(provider, 0) + 1
    
    def on_success(self, provider: str):
        """成功后重置"""
        self.current_429_count[provider] = 0
```

---

## 3. 缓存策略

### 3.1 多级缓存架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         L1: 内存缓存                            │
│  - 脚本模板缓存                                                  │
│  - LLM 响应缓存（相同 topic）                                    │
│  - 关键帧 Base64 缓存                                          │
│  TTL: 5-30 分钟                                                 │
│  命中率: 10-30%                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         L2: 磁盘缓存                             │
│  - 生成的 TTS 音频                                              │
│  - 关键帧图片（已存在则跳过）                                    │
│  - 视频片段（断点续传）                                         │
│  持久化: 30 天或项目完成                                         │
├─────────────────────────────────────────────────────────────────┤
│                         L3: CDN 缓存                            │
│  - catbox.moe 上传的图片                                        │
│  - 公共资源                                                      │
│  外部依赖                                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 缓存实现

```python
# modules/cache.py

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Optional, Any
import asyncio
from functools import lru_cache

class CacheManager:
    """缓存管理器"""
    
    def __init__(self, cache_dir: str):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # 内存缓存
        self._memory_cache = {}
        self._cache_ttl = {
            "script": 1800,      # 30 分钟
            "keyframe": 3600,   # 1 小时
            "tts": 86400,       # 24 小时
            "video": 604800,    # 7 天
        }
    
    def _get_cache_key(self, prefix: str, *args) -> str:
        """生成缓存 Key"""
        content = json.dumps(args, sort_keys=True)
        return f"{prefix}_{hashlib.md5(content).hexdigest()[:16]}"
    
    def get(self, cache_type: str, key: str) -> Optional[Any]:
        """获取缓存"""
        # L1: 内存
        mem_key = f"{cache_type}:{key}"
        if mem_key in self._memory_cache:
            entry = self._memory_cache[mem_key]
            if time.time() - entry["timestamp"] < self._cache_ttl.get(cache_type, 3600):
                return entry["data"]
            del self._memory_cache[mem_key]
        
        # L2: 磁盘
        cache_path = self.cache_dir / cache_type / f"{key}.json"
        if cache_path.exists():
            try:
                with open(cache_path) as f:
                    data = json.load(f)
                # 写入内存缓存
                self._memory_cache[mem_key] = {
                    "data": data,
                    "timestamp": time.time()
                }
                return data
            except:
                pass
        
        return None
    
    def set(self, cache_type: str, key: str, value: Any):
        """设置缓存"""
        # L1: 内存
        mem_key = f"{cache_type}:{key}"
        self._memory_cache[mem_key] = {
            "data": value,
            "timestamp": time.time()
        }
        
        # L2: 磁盘
        cache_path = self.cache_dir / cache_type
        cache_path.mkdir(parents=True, exist_ok=True)
        
        with open(cache_path / f"{key}.json", "w") as f:
            json.dump(value, f)
    
    def invalidate(self, cache_type: str, key: str = None):
        """失效缓存"""
        if key:
            mem_key = f"{cache_type}:{key}"
            self._memory_cache.pop(mem_key, None)
            cache_path = self.cache_dir / cache_type / f"{key}.json"
            cache_path.unlink(missing_ok=True)
        else:
            self._memory_cache = {}


# LLM 响应缓存（相同主题复用）
class LLMResponseCache:
    """LLM 响应缓存"""
    
    def __init__(self):
        self.cache = CacheManager("./data/cache/llm")
    
    def get_cached_response(self, topic: str, style: str = None) -> Optional[dict]:
        """获取缓存的 LLM 响应"""
        key = self.cache._get_cache_key("script", topic, style)
        return self.cache.get("script", key)
    
    def cache_response(self, topic: str, style: str, response: dict):
        """缓存 LLM 响应"""
        key = self.cache._get_cache_key("script", topic, style)
        self.cache.set("script", key, response)
```

### 3.3 缓存使用示例

```python
# modules/llm.py - 使用缓存

async def generate_script(topic: str, style: str = None, ...):
    # 先检查缓存
    cache = LLMResponseCache()
    cached = cache.get_cached_response(topic, style)
    if cached:
        print(f"[LLM] 使用缓存脚本: {topic}")
        return dict_to_script(cached)
    
    # 缓存未命中，调用 LLM
    response = await _call_llm_api(topic, style)
    
    # 缓存结果
    cache.cache_response(topic, style, script_to_dict(response))
    
    return response


# modules/image_gen.py - 关键帧缓存
async def generate_keyframe(scene: Scene, output_dir: str, ...):
    # 检查文件是否已存在（断点续传）
    output_path = os.path.join(output_dir, f"scene_{scene.scene_id:03d}_keyframe.png")
    
    if os.path.exists(output_path):
        print(f"[ImageGen] Scene {scene.scene_id} 关键帧已存在，跳过")
        return output_path
    
    # 生成新的...


# modules/tts.py - TTS 结果缓存
async def generate_voiceover(scene: Scene, output_dir: str, ...):
    # 检查是否已有缓存
    output_path = os.path.join(output_dir, f"scene_{scene.scene_id:03d}_voiceover.mp3")
    
    if os.path.exists(output_path):
        duration = get_audio_duration(output_path)
        return output_path, duration
    
    # 生成新的...
```

---

## 4. 资源优化

### 4.1 FFmpeg 实例池

```python
# modules/assembler.py - FFmpeg 实例复用

import subprocess
from concurrent.futures import ProcessPoolExecutor
import threading

class FFmpegPool:
    """FFmpeg 实例池 - 避免频繁启动进程"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._executor = ProcessPoolExecutor(max_workers=2)
        self._active_tasks = {}
        self._initialized = True
    
    async def run_command(self, cmd: list[str], task_id: str = None) -> subprocess.CompletedProcess:
        """运行 FFmpeg 命令"""
        if task_id:
            # 异步执行
            loop = asyncio.get_event_loop()
            future = loop.run_in_executor(
                self._executor,
                lambda: subprocess.run(cmd, capture_output=True, text=True)
            )
            return await future
        else:
            # 同步执行（保留兼容性）
            return subprocess.run(cmd, capture_output=True, text=True)
    
    def shutdown(self):
        """关闭进程池"""
        self._executor.shutdown(wait=True)
```

### 4.2 内存优化

```python
# 优化1：及时释放大对象
async def generate_all_keyframes(scenes, ...):
    try:
        # 生成关键帧
        results = await _generate_frames(scenes)
        
        # 处理完成后立即释放
        for scene in scenes:
            scene.image_data = None  # 释放内存
        
        return results
    finally:
        # 强制垃圾回收
        import gc
        gc.collect()


# 优化2：生成器流式处理
def generate_srt_lines(scenes: list[Scene], audio_clips: dict):
    """流式生成 SRT，避免一次性加载所有数据"""
    index = 1
    durations = [s.duration for s in scenes]
    
    for i, scene in enumerate(scenes):
        if not scene.voiceover.strip():
            continue
        
        start_time = sum(durations[:i]) - i * 0.5
        start_time = max(start_time, 0.0)
        
        audio_path = audio_clips.get(scene.scene_id)
        if audio_path and os.path.exists(audio_path):
            duration = get_audio_duration(audio_path)
        else:
            duration = scene.duration
        
        end_time = start_time + duration
        
        yield str(index)
        yield f"{_format_srt_time(start_time)} --> {_format_srt_time(end_time)}"
        yield scene.voiceover.strip()
        yield ""
        
        index += 1


# 优化3：分块写入文件
def save_srt_file(scenes, audio_clips, output_path):
    """分块写入，避免大文件内存问题"""
    with open(output_path, "w", encoding="utf-8") as f:
        for line in generate_srt_lines(scenes, audio_clips):
            f.write(line + "\n")
```

### 4.3 磁盘空间优化

```python
# 清理策略

class StorageManager:
    """存储管理器"""
    
    @staticmethod
    def clean_temp_files(project_id: str, keep_days: int = 7):
        """清理临时文件"""
        import time
        import glob
        
        temp_dir = f"./data/temp/{project_id}"
        if not os.path.exists(temp_dir):
            return
        
        now = time.time()
        for pattern in ["*.mp4", "*.png", "*.mp3", "*.srt"]:
            for file in glob.glob(os.path.join(temp_dir, pattern)):
                if now - os.path.getmtime(file) > keep_days * 86400:
                    os.remove(file)
    
    @staticmethod
    def clean_cache(cache_type: str, max_size_mb: int = 1000):
        """清理缓存目录，超过最大限制时删除最旧的"""
        cache_dir = f"./data/cache/{cache_type}"
        if not os.path.exists(cache_dir):
            return
        
        total_size = sum(
            os.path.getsize(os.path.join(root, f))
            for root, _, files in os.walk(cache_dir)
            for f in files
        )
        
        if total_size > max_size_mb * 1024 * 1024:
            # 删除最旧的文件
            files = [
                (os.path.join(root, f), os.path.getmtime(os.path.join(root, f)))
                for root, _, files in os.walk(cache_dir)
                for f in files
            ]
            files.sort(key=lambda x: x[1])
            
            # 删除 20% 最旧的
            remove_count = len(files) // 5
            for file, _ in files[:remove_count]:
                os.remove(file)
    
    @staticmethod
    def get_storage_stats() -> dict:
        """获取存储统计"""
        stats = {}
        for category in ["outputs", "cache", "temp"]:
            path = f"./data/{category}"
            if os.path.exists(path):
                total = sum(
                    os.path.getsize(os.path.join(root, f))
                    for root, _, files in os.walk(path)
                    for f in files
                )
                stats[category] = total / (1024 * 1024)  # MB
        return stats
```

---

## 5. 数据库优化

### 5.1 SQLite 优化

```python
# 现有：modules/memory.py - LocalMemoryStore

# 优化：添加索引
def _init_db(self):
    with sqlite3.connect(self.db_path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS style_preferences (
                user_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, key)
            );
            
            -- 添加索引
            CREATE INDEX IF NOT EXISTS idx_procedural_memories_user_topic 
                ON procedural_memories(user_id, topic_category);
            CREATE INDEX IF NOT EXISTS idx_project_history_user_date 
                ON project_history(user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_feedback_events_project 
                ON feedback_events(project_id, created_at);
        """)

# 优化2：连接池
class SQLiteConnectionPool:
    """SQLite 连接池"""
    
    def __init__(self, db_path: str, pool_size: int = 3):
        self.db_path = db_path
        self._pool = []
        self._lock = threading.Lock()
        
        # 预创建连接
        for _ in range(pool_size):
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            self._pool.append(conn)
    
    def get_connection(self):
        with self._lock:
            if self._pool:
                return self._pool.pop()
            return sqlite3.connect(self.db_path, check_same_thread=False)
    
    def return_connection(self, conn):
        with self._lock:
            self._pool.append(conn)
    
    def close_all(self):
        for conn in self._pool:
            conn.close()
```

### 5.2 索引优化

```sql
-- 为项目元数据添加索引
CREATE INDEX IF NOT EXISTS idx_projects_meta_created 
    ON projects_meta(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_meta_status 
    ON projects_meta(status, created_at);

-- 为 API 使用统计添加索引
CREATE INDEX IF NOT EXISTS idx_api_usage_date 
    ON api_usage(period_date, user_id);

CREATE INDEX IF NOT EXISTS idx_api_usage_service 
    ON api_usage(service, period_date);
```

---

## 6. 网络优化

### 6.1 连接池

```python
# aiohttp 连接池配置

import aiohttp

class AiohttpPool:
    """aiohttp 连接池"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._session = None
        return cls._instance
    
    @property
    def session(self):
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,           # 最大连接数
                limit_per_host=30,   # 每个主机最大连接
                ttl_dns_cache=300,   # DNS 缓存 TTL
                keepalive_timeout=30 # 保持连接时间
            )
            timeout = aiohttp.ClientTimeout(total=60, connect=10)
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout
            )
        return self._session
    
    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()


# 使用
async def call_api(url: str, data: dict):
    session = AiohttpPool().session
    async with session.post(url, json=data) as resp:
        return await resp.json()
```

### 6.2 请求压缩

```python
# 优化 API 请求：压缩大请求体
import aiohttp
import zlib

async def compress_request(url: str, data: dict):
    """压缩请求数据"""
    json_str = json.dumps(data)
    compressed = zlib.compress(json_str.encode(), level=6)
    
    headers = {
        "Content-Encoding": "deflate",
        "Content-Type": "application/json"
    }
    
    session = AiohttpPool().session
    async with session.post(
        url, 
        data=compressed, 
        headers=headers
    ) as resp:
        return await resp.json()
```

---

## 7. 前端性能优化

### 7.1 资源加载优化

```typescript
// 前端：路由懒加载
// pilipili-frontend/client/src/App.tsx

import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const Studio = lazy(() => import('./pages/Studio'));
const Settings = lazy(() => import('./pages/Settings'));

// 使用 Suspense 包裹
function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/studio/:projectId" element={<Studio />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Router>
    </Suspense>
  );
}
```

### 7.2 虚拟列表

```typescript
// 分镜列表虚拟滚动
// pilipili-frontend/client/src/pages/Studio.tsx

import { useVirtualizer } from '@tanstack/react-virtual';

function SceneList({ scenes }) {
  const parentRef = useRef(null);
  
  const virtualizer = useVirtualizer({
    count: scenes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // 估算每项高度
    overscan: 5, // 预渲染 5 项
  });
  
  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size,
            }}
          >
            <SceneItem scene={scenes[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 7.3 WebSocket 优化

```typescript
// 压缩 WebSocket 消息
// pilipili-frontend/client/src/hooks/useWebSocket.ts

import { useEffect, useRef, useState } from 'react';

export function useWebSocket(projectId: string) {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    // 使用二进制帧传输
    ws.current = new WebSocket(`ws://localhost:8000/ws/${projectId}`);
    
    ws.current.binaryType = 'arraybuffer';
    
    ws.current.onmessage = (event) => {
      // 解压消息（如果需要）
      const data = event.data instanceof ArrayBuffer
        ? JSON.parse(new TextDecoder().decode(event.data))
        : JSON.parse(event.data);
      
      setStatus(data);
    };
    
    return () => {
      ws.current?.close();
    };
  }, [projectId]);
  
  return { ws: ws.current, status };
}
```

---

## 8. 监控与度量

### 8.1 性能指标收集

```python
# modules/metrics.py

import time
from dataclasses import dataclass
from typing import Optional

@dataclass
class PerformanceMetrics:
    """性能指标"""
    operation: str
    duration_ms: float
    timestamp: float
    success: bool
    error: Optional[str] = None

class MetricsCollector:
    """指标收集器"""
    
    def __init__(self):
        self._metrics = []
        self._operation_times = {}  # 累计时间
    
    def record(self, operation: str, duration_ms: float, success: bool, error: str = None):
        """记录指标"""
        metric = PerformanceMetrics(
            operation=operation,
            duration_ms=duration_ms,
            timestamp=time.time(),
            success=success,
            error=error
        )
        self._metrics.append(metric)
        
        # 累计
        if operation not in self._operation_times:
            self._operation_times[operation] = {
                "count": 0,
                "total_ms": 0,
                "errors": 0
            }
        
        self._operation_times[operation]["count"] += 1
        self._operation_times[operation]["total_ms"] += duration_ms
        if not success:
            self._operation_times[operation]["errors"] += 1
    
    def get_summary(self) -> dict:
        """获取汇总"""
        summary = {}
        for op, data in self._operation_times.items():
            summary[op] = {
                "count": data["count"],
                "avg_ms": data["total_ms"] / data["count"] if data["count"] > 0 else 0,
                "error_rate": data["errors"] / data["count"] if data["count"] > 0 else 0,
                "total_ms": data["total_ms"]
            }
        return summary
    
    def get_operation(self, operation: str, limit: int = 100) -> list:
        """获取指定操作的历史"""
        return [
            m for m in self._metrics[-limit:]
            if m.operation == operation
        ]


# 使用装饰器
def timed_operation(operation_name: str):
    """计时装饰器"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = (time.time() - start) * 1000
                MetricsCollector().record(operation_name, duration, True)
                return result
            except Exception as e:
                duration = (time.time() - start) * 1000
                MetricsCollector().record(operation_name, duration, False, str(e))
                raise
        return wrapper
    return decorator


# 使用
@timed_operation("llm_script_generation")
async def generate_script(...):
    ...
```

### 8.2 慢查询日志

```python
# 慢操作日志

import logging

logger = logging.getLogger(__name__)

SLOW_THRESHOLD_MS = 5000  # 5 秒

async def log_slow_operation(operation: str, duration_ms: float, **kwargs):
    if duration_ms > SLOW_THRESHOLD_MS:
        logger.warning(
            f"慢操作: {operation} 耗时 {duration_ms:.0f}ms",
            extra=kwargs
        )

# 在关键操作处调用
async def generate_keyframe(scene, ...):
    start = time.time()
    try:
        result = await _do_generate(...)
    finally:
        duration = (time.time() - start) * 1000
        await log_slow_operation("generate_keyframe", duration, scene_id=scene.scene_id)
```

---

## 9. 总结

### 9.1 优化策略汇总

| 层次 | 优化技术 | 预期收益 |
|------|----------|----------|
| **并发** | 自适应限流、优先级队列、智能批量 | 吞吐量 +50% |
| **缓存** | 多级缓存（内存/磁盘/CDN） | 重复请求 -80% |
| **资源** | FFmpeg 进程池、内存管理、存储清理 | 内存 -30% |
| **数据库** | 索引优化、连接池 | 查询性能 +100% |
| **网络** | 连接复用、请求压缩 | 网络效率 +30% |
| **前端** | 懒加载、虚拟列表、二进制 WS | 首屏 -40% |

### 9.2 实施优先级

1. **P0（立即）**：缓存策略、断点续传（已有基础）
2. **P1（本周）**：FFmpeg 进程池、自适应限流
3. **P2（下周）**：数据库索引、前端虚拟列表
4. **P3（后续）**：监控仪表盘、慢查询日志

---

*文档版本: 1.0 | 最后更新: 2026-03-26*