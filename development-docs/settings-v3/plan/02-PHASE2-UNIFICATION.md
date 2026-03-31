# 阶段二：配置系统彻底打通

## 目标

让后端模块（video_gen.py, llm.py, tts.py 等）从 v3 数据库读取用户配置，不再依赖 config.yaml。

**核心改造点：**
1. 创建统一配置读取接口（UserConfigService）
2. 修改所有后端模块，使用新接口读取配置
3. 确保用户设置实时生效，无需重启服务

## 改造范围

### 后端模块清单

| 模块 | 文件 | 依赖配置 | 改造优先级 |
|------|------|----------|-----------|
| LLM生成 | `modules/llm.py` | llm_provider, llm_model, api_key | P0 |
| 视频生成 | `modules/video_gen.py` | video_provider, video_model, api_key, duration, ratio, quality | P0 |
| 图片生成 | `modules/image_gen.py` | image_provider, image_model, api_key | P1 |
| 语音合成 | `modules/tts.py` | tts_provider, tts_model, voice, speed | P1 |
| 工作流 | `api/server.py` | 整体配置调用 | P0 |

### 改造原则

1. **向后兼容**：v3数据库无数据时，回退到 config.yaml
2. **实时生效**：配置修改后立即生效，无需重启
3. **用户隔离**：多用户环境，每个用户独立配置
4. **统一接口**：所有模块通过同一接口读取配置

## 详细步骤

### 步骤 2.1：创建 UserConfigService（统一配置服务）

**创建文件：** `api/user_config_service.py`

**功能：**
```python
class UserConfigService:
    """统一用户配置服务

    优先级：
    1. v3 数据库（UserConfigs + UserProviderConfigs）
    2. config.yaml（向后兼容）
    3. 代码默认值
    """

    def get_llm_config(user_id: str) -> LLMConfig
        """获取 LLM 配置（provider, model, api_key）"""

    def get_video_config(user_id: str) -> VideoConfig
        """获取视频配置（provider, model, api_key, duration, ratio, quality）"""

    def get_image_config(user_id: str) -> ImageConfig
        """获取图片配置（provider, model, api_key）"""

    def get_tts_config(user_id: str) -> TTSConfig
        """获取 TTS 配置（provider, model, api_key, voice, speed）"""

    def get_system_settings() -> Dict
        """获取系统设置（从数据库或 config.yaml）"""

    def invalidate_cache(user_id: str)
        """清除用户配置缓存（配置修改时调用）"""
```

**实现要点：**
- 使用缓存机制（避免每次查询数据库）
- 提供 invalidate_cache 接口，配置修改时清除缓存
- 数据库查询失败时，回退到 config.yaml
- 使用 lru_cache 实现5分钟TTL缓存

### 步骤 2.2：改造 LLM 模块

**文件：** `modules/llm.py`

**改动点：**
```python
# 旧代码
from core.config import get_config
config = get_config()
provider_config = getattr(config.llm, config.llm.default_provider)

# 新代码
from api.user_config_service import UserConfigService
llm_config = UserConfigService.get_llm_config(user_id)
provider_config = LLMProviderConfig(
    api_key=llm_config.api_key,
    model=llm_config.model_id,
    base_url=llm_config.base_url,
)
```

**测试验证：**
- 用户切换模型后，新生成的脚本使用新模型
- 修改 API Key 后，不需要重启服务

### 步骤 2.3：改造视频生成模块

**文件：** `modules/video_gen.py`

**改动点：**
```python
# 旧代码
from core.config import get_config
config = get_config()
selected_engine = config.video_gen.default_provider

# 新代码
from api.user_config_service import UserConfigService
video_config = UserConfigService.get_video_config(user_id)
selected_engine = video_config.provider_id
model_id = video_config.model_id
duration = video_config.duration
ratio = video_config.ratio
quality = video_config.quality
```

**特殊处理：**
- Kling Omni API 的 model_id 选择逻辑（根据 duration, ratio, quality）
- Volces 模型的选择逻辑
- 保持现有的 smart_route_engine 逻辑，但优先从数据库读取用户配置

### 步骤 2.4：改造图片生成模块

**文件：** `modules/image_gen.py`

**改动点：**
```python
# 旧代码
from core.config import get_config
config = get_config()
image_provider = config.image_gen.provider

# 新代码
from api.user_config_service import UserConfigService
image_config = UserConfigService.get_image_config(user_id)
image_provider = image_config.provider_id
```

### 步骤 2.5：改造语音合成模块

**文件：** `modules/tts.py`

**改动点：**
```python
# 旧代码
from core.config import get_config
config = get_config()
tts_provider = config.tts.default_provider

# 新代码
from api.user_config_service import UserConfigService
tts_config = UserConfigService.get_tts_config(user_id)
tts_provider = tts_config.provider_id
voice = tts_config.voice
speed = tts_config.speed
```

### 步骤 2.6：修改 API 端点，传递 user_id

**文件：** `api/server.py`

**改动点：**
```python
# 所有调用模块的接口，需要传递 user_id

@app.post("/api/workflow/generate")
async def generate_video_workflow(request: WorkflowRequest):
    # 旧代码：不传 user_id
    # result = await generate_video_clips(...)

    # 新代码：传递 user_id
    result = await generate_video_clips(
        ...,  # 其他参数
        user_id=request.user_id,  # 新增
    )
```

**涉及接口：**
- `/api/workflow/generate` - 生成视频工作流
- `/api/llm/generate-script` - 生成脚本
- `/api/image/generate` - 生成图片
- `/api/tts/generate` - 生成语音

### 步骤 2.7：实现缓存失效机制

**文件：** `api/config_api_v3.py`

**改动点：**
```python
# 在保存用户配置时，清除缓存

@app.post("/api/settings/v3/user/config")
async def save_user_config(request: UserConfigRequest):
    # 保存配置到数据库
    result = save_user_config_to_db(request)

    # 清除缓存
    from api.user_config_service import UserConfigService
    UserConfigService.invalidate_cache(request.user_id)

    return {"success": True, "data": result}
```

### 步骤 2.8：添加系统级配置读取

**文件：** `api/user_config_service.py`

**新增功能：**
```python
def get_system_settings() -> SystemSettings:
    """
    获取系统级配置（从数据库 SystemSettings 表或 config.yaml）

    包含：
    - memory_provider
    - jianying_enabled
    - jianying_draft_dir
    - whisperx_model
    - ffmpeg_path
    """
```

## 配置优先级实现

```python
class UserConfigService:
    @staticmethod
    def get_video_config(user_id: str) -> VideoConfig:
        # 1. 尝试从数据库读取
        try:
            user_config = get_user_config(user_id)
            if user_config and user_config.video_provider_id:
                provider_config = get_user_provider_config(
                    user_id, user_config.video_provider_id
                )
                if provider_config:
                    return VideoConfig(
                        provider_id=user_config.video_provider_id,
                        model_id=user_config.video_model_id,
                        api_key=provider_config.api_key,
                        api_secret=provider_config.api_secret,
                        base_url=provider_config.base_url,
                        duration=user_config.video_duration,
                        ratio=user_config.video_ratio,
                        quality=user_config.video_quality,
                    )
        except Exception as e:
            print(f"[UserConfigService] 数据库读取失败，回退到 config.yaml: {e}")

        # 2. 回退到 config.yaml
        try:
            config = get_config()
            provider_id = config.video_gen.default_provider
            provider_cfg = getattr(config.video_gen, provider_id)
            return VideoConfig(
                provider_id=provider_id,
                model_id=provider_cfg.model,
                api_key=provider_cfg.api_key,
                api_secret=provider_cfg.api_secret,
                base_url=provider_cfg.base_url,
                duration=provider_cfg.default_duration,
                ratio=provider_cfg.default_ratio,
                quality=provider_cfg.default_quality,
            )
        except Exception as e:
            print(f"[UserConfigService] config.yaml 读取失败，使用默认值: {e}")

        # 3. 使用代码默认值
        return VideoConfig.default()
```

## 测试计划

### 单元测试

1. **配置读取优先级测试**
   - 数据库有数据 → 使用数据库
   - 数据库无数据，config.yaml 有 → 使用 config.yaml
   - 都没有 → 使用默认值

2. **缓存失效测试**
   - 修改配置后，缓存是否清除
   - 再次读取是否使用新配置

3. **多用户隔离测试**
   - 用户A和用户B的配置互不影响

### 集成测试

1. **端到端流程测试**
   - 用户在设置中修改模型
   - 生成视频时使用新模型
   - 验证视频生成结果

2. **实时生效测试**
   - 不重启服务
   - 修改配置后立即生效

## 完成检查清单

- [ ] UserConfigService 创建完成
- [ ] LLM 模块改造完成
- [ ] 视频生成模块改造完成
- [ ] 图片生成模块改造完成
- [ ] TTS 模块改造完成
- [ ] API 端点 user_id 传递完成
- [ ] 缓存失效机制实现完成
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 文档更新完成

## 预计时间

3-4 天

## 进入下一阶段条件

所有完成检查项通过，且集成测试成功。
