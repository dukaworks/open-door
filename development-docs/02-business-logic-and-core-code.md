# 噼哩噼哩 Pilipili-AutoVideo 业务逻辑与核心代码分析

## 文档信息

- **文档编号**: DEV-DOC-002
- **版本**: 1.0
- **创建日期**: 2026-03-26
- **项目**: Pilipili-AutoVideo
- **类型**: 业务分析文档

---

## 1. 核心业务流程

### 1.1 端到端工作流概览

```
用户输入 → 脚本生成 → 人工审核 → 并发生成 → 视频生成 → 组装导出
  (topic)   (LLM)     (pause)   (图片+TTS)  (I2V)      (FFmpeg)
```

**核心数据流转**：

```python
# 1. 输入
topic: str = "Cyberpunk Mars colony, 60 seconds"

# 2. Stage 1: 脚本生成 (modules/llm.py)
VideoScript(
    title="赛博朋克火星殖民地",
    scenes=[Scene(scene_id=1, duration=5.0, image_prompt="...", video_prompt="...", voiceover="..."), ...],
    characters=[CharacterInfo(...), ...],
    metadata={"description": "...", "tags": [...]}
)

# 3. Stage 3: TTS 时长覆盖 duration
# modules/tts.py → update_scene_durations()
# Scene.duration = TTS时长 + 0.5s padding (向上取整到 0.5s)

# 4. Stage 4: 视频生成 (modules/video_gen.py)
# 依赖精确的 scene.duration，确保音画同步

# 5. Stage 5: 组装 (modules/assembler.py)
# xfade 转场 + 配音混音 + 字幕烧录 → 最终 MP4
```

---

## 2. 核心算法详解

### 2.1 算法 1：TTS 时长驱动的音画同步

**问题**：传统视频生成中，音频和视频时长不一致，导致音画不同步。

**解决方案**：

```python
# modules/tts.py

def update_scene_durations(
    scenes: list[Scene],
    voiceover_results: dict[int, tuple[str, float]],
    padding: float = 0.5,
) -> list[Scene]:
    """
    根据 TTS 实际时长更新分镜的 duration 字段
    
    核心算法：
    1. 生成 TTS 配音，使用 mutagen 精确测量毫秒级时长
    2. 计算视频时长 = TTS 时长 + 缓冲 (padding)
    3. 向上取整到最近的 0.5 秒，避免切换太急
    
    效果：配音时长 = 视频时长，完美音画同步
    """
    for scene in scenes:
        if scene.scene_id in voiceover_results:
            _, tts_duration = voiceover_results[scene.scene_id]
            if tts_duration > 0:
                raw_duration = tts_duration + padding
                scene.duration = round(raw_duration * 2) / 2  # 取最近的 0.5 倍数
    
    return scenes
```

**实现细节**：

```python
# 精确时长测量 (modules/tts.py)
def get_audio_duration(audio_path: str) -> float:
    """优先级：mutagen > wave > ffprobe > 估算"""
    try:
        from mutagen.mp3 import MP3
        audio = MP3(audio_path)
        return audio.info.length  # 精确到毫秒
    except ImportError:
        pass
    # 回退...
    
    # ffprobe 方案
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
        capture_output=True, text=True, timeout=10
    )
    return float(result.stdout.strip())  # 精确到毫秒
```

**关键点**：
- TTS 先生成，精确测量时长
- 视频生成阶段使用 TTS 时长作为目标
- 0.5s padding 避免切换太急

---

### 2.2 算法 2：Shot Mode 自动检测

**问题**：不同类型的分镜需要不同的视频生成模式，如何自动选择？

**解决方案**：

```python
# modules/video_gen.py

ShotMode = Literal["multi_ref", "first_end_frame", "t2v", "i2v"]

def auto_detect_shot_mode(scene: Scene) -> ShotMode:
    """
    自动判断最优的生成模式
    
    判断规则：
    1. 有角色参考图 + 动作 → multi_ref (Omni 多参考)
    2. 有首尾帧关键词 → first_end_frame (Omni 首尾帧)
    3. 纯风景/无人物 → t2v (Omni 文生视频)
    4. 其他 → i2v (传统图生视频)
    """
    prompt_lower = (scene.video_prompt + " " + scene.image_prompt + " ".join(scene.style_tags)).lower()
    
    # 有角色参考图 → multi_ref
    if scene.reference_character:
        return "multi_ref"
    
    # 转场/运镜关键词 → first_end_frame
    transition_keywords = [
        "transition", "morph", "transform", "cut to", "fade to",
        "time lapse", "timelapse", "dissolve",
        "转场", "过渡", "变换", "延时", "时光流逝"
    ]
    if any(kw in prompt_lower for kw in transition_keywords):
        return "first_end_frame"
    
    # 纯风景/无人物 → t2v
    landscape_keywords = ["landscape", "scenery", "nature", "sky", ...]
    person_keywords = ["person", "people", "man", "woman", ...]
    has_landscape = any(kw in prompt_lower for kw in landscape_keywords)
    has_person = any(kw in prompt_lower for kw in person_keywords)
    
    if has_landscape and not has_person:
        return "t2v"
    
    # 默认 → i2v
    return "i2v"
```

**模式说明**：

| 模式 | 适用场景 | API |
|------|----------|-----|
| `multi_ref` | 有固定人物 + 动作/对话 | Kling Omni image_list（最多3主体）|
| `first_end_frame` | 场景转换/运镜/过渡 | Kling Omni first_frame + end_frame |
| `t2v` | 纯风景/氛围/空镜 | Kling Omni 纯文本 prompt |
| `i2v` | 其他（默认回退）| Kling v3 image2video |

---

### 2.3 算法 3：智能视频引擎路由

**问题**：Kling 和 Seedance 各有优势，如何根据内容自动选择？

**解决方案**：

```python
# modules/video_gen.py

def smart_route_engine(scene: Scene, default: str = "kling") -> str:
    """
    根据场景内容智能选择视频引擎
    
    规则：
    - 对话/口型同步 → Seedance（原生音素级口型同步）
    - 多人/多角色 → Seedance（多主体一致性更强）
    - 动作/运动/体育 → Kling（动态能量更强）
    - 其他 → 默认引擎
    """
    seedance_keywords = [
        "talking", "speaking", "dialogue", "conversation", "lip sync",
        "multiple characters", "crowd", "interview", "说话", "对话", "多人"
    ]
    
    kling_keywords = [
        "action", "running", "jumping", "sports", "explosion", "fast",
        "dynamic", "energetic", "chase", "fight", "dance",
        "动作", "奔跑", "跳跃", "运动", "爆炸", "舞蹈"
    ]
    
    prompt_lower = (scene.video_prompt + " " + " ".join(scene.style_tags)).lower()
    
    seedance_score = sum(1 for kw in seedance_keywords if kw in prompt_lower)
    kling_score = sum(1 for kw in kling_keywords if kw in prompt_lower)
    
    if seedance_score > kling_score:
        return "seedance"
    elif kling_score > seedance_score:
        return "kling"
    else:
        return default
```

---

### 2.4 算法 4：会话级模型黑名单

**问题**：API 服务不稳定时，反复重试浪费时间。

**解决方案**：

```python
# modules/image_gen.py

# 进程级单例，重启后自动清空
_FAILED_MODELS: set[str] = set()

def _mark_model_failed(model_name: str, reason: str, verbose: bool = False):
    """将模型加入黑名单，本次任务不再使用"""
    if model_name not in _FAILED_MODELS:
        _FAILED_MODELS.add(model_name)
        if verbose:
            print(f"[ImageGen] ⚠️ 模型 {model_name} 已加入黑名单（{reason}）")

# 使用
FALLBACK_MODELS = [
    config.image_gen.model,                    # config 配置的主模型
    "models/gemini-2.5-flash-image",          # 备选1
    "models/gemini-3.1-flash-image-preview",   # 备选2
]
# 过滤掉黑名单模型
available_models = [m for m in FALLBACK_MODELS if m not in _FAILED_MODELS]
```

**效果**：
- 某个模型首次失败（如 503），立即加入黑名单
- 后续所有 Scene 直接跳过该模型
- 进程重启后黑名单自动清空

---

### 2.5 算法 5：记忆系统 - 风格偏好学习

**问题**：如何让系统随使用次数增长越来越懂用户？

**解决方案**：

```python
# modules/memory.py

class MemoryManager:
    def learn_from_script(self, script_data: dict, project_id: str):
        """从生成的脚本中自动学习"""
        
        # 1. 学习平均分镜时长
        avg_duration = sum(s.get("duration", 5) for s in scenes) / len(scenes)
        self.local_store.save_style_preference("avg_scene_duration", str(round(avg_duration, 1)))
        
        # 2. 学习风格标签
        all_tags = [tag for scene in scenes for tag in scene.get("style_tags", [])]
        top_tags = Counter(all_tags).most_common(5)
        self.local_store.save_style_preference("top_style_tags", json.dumps(top_tags))
        
        # 3. 学习转场偏好
        transitions = [s.get("transition", "crossfade") for s in scenes]
        top_transition = Counter(transitions).most_common(1)[0][0]
        self.local_store.save_style_preference("preferred_transition", top_transition)
    
    def learn_from_rating(self, project_id: str, rating: int):
        """从用户评分中强化/衰减偏好"""
        if rating >= 4:
            # 高评分：强化权重（最多 5.0）
            conn.execute("""
                UPDATE style_preferences 
                SET weight = MIN(weight * 1.2, 5.0) 
                WHERE user_id = ?
            """, (user_id,))
        elif rating <= 2:
            # 低评分：衰减权重（最低 0.1）
            conn.execute("""
                UPDATE style_preferences 
                SET weight = MAX(weight * 0.8, 0.1) 
                WHERE user_id = ?
            """, (user_id,))
    
    def build_context_for_generation(self, topic: str) -> str:
        """生成注入 LLM 的上下文"""
        # 获取风格偏好
        prefs = self.local_store.get_style_preferences(user_id)
        context = "用户历史风格偏好：\n" + "\n".join([f"- {k}: {v}" for k, v in prefs.items()])
        
        # 获取程序性记忆（成功的提示词模式）
        topic_category = self._classify_topic(topic)
        prompts = self.local_store.get_procedural_memories(user_id, topic_category, "image_prompt")
        context += f"\n该类主题成功的提示词：\n" + "\n".join(prompts)
        
        return context
```

---

### 2.6 算法 6：JSON 安全解析

**问题**：LLM 输出可能包含 markdown 代码块、前缀文字等，标准 json.loads 失败。

**解决方案**：

```python
# modules/llm.py

def _parse_json_safely(text: str) -> dict:
    """多策略安全解析 JSON"""
    text = text.strip()
    
    # 策略1：直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # 策略2：提取 ```json ... ``` 代码块
    code_blocks = re.findall(r'```(?:json)?\s*([\s\S]*?)```', text)
    if code_blocks:
        candidate = max(code_blocks, key=len).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
    
    # 策略3：找到最外层 { ... }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    
    # 策略4：逐步缩小范围，找到能解析的最大 JSON
    for match in re.finditer(r'\{', text):
        # 找到匹配的 }，尝试解析
        # 只接受包含 scenes 或 title 字段的对象
        ...
    
    raise ValueError(f"无法解析 LLM 输出为 JSON: {text[:200]}...")
```

---

### 2.7 算法 7：FFmpeg 转场拼接与音频对齐

**问题**：xfade 转场会重叠，导致视频总时长缩短，音频需要精确偏移对齐。

**解决方案**：

```python
# modules/assembler.py

def _merge_with_transitions(clips, transitions, output_path, transition_duration=0.5):
    """xfade 转场拼接"""
    
    # 计算转场 offset
    # 第 i 个转场 offset = sum(duration[0..i]) - (i+1) * transition_duration
    cumulative_duration = 0.0
    for i in range(len(clips) - 1):
        cumulative_duration += durations[i]
        offset = cumulative_duration - (i + 1) * transition_duration
        offset = max(offset, 0.001)  # 确保不为负
        
        # 构建 xfade 滤镜
        filter_parts.append(
            f"xfade=transition={xfade_type}:duration={transition_duration}:offset={offset:.3f}"
        )


def _mix_audio_aligned(video_path, audio_clips, scene_durations, transition_duration, output_path):
    """
    音频精确对齐
    
    关键：xfade 使视频总时长缩短 (N-1) * transition_duration
    第 i 段音频的起始时间 = sum(duration[0..i-1]) - i * transition_duration
    """
    for i, (clip, dur) in enumerate(zip(audio_clips, scene_durations)):
        # 计算该段音频在最终视频中的起始时间
        offset_s = sum(scene_durations[:i]) - i * transition_duration
        offset_s = max(offset_s, 0.0)
        
        delay_ms = int(offset_s * 1000)
        
        # 使用 adelay 滤镜设置延迟
        filter_parts.append(f"[{input_idx}:a]adelay={delay_ms}|{delay_ms}[a{idx}]")
    
    # amix 混合所有音频轨
    filter_complex = f"{mix_input_str}amix=inputs={len(valid_entries)}:duration=longest[aout]"
```

---

## 3. 核心数据结构

### 3.1 Scene（分镜）

```python
# modules/llm.py

@dataclass
class Scene:
    scene_id: int
    duration: float                    # 秒（由 TTS 时长动态决定）
    image_prompt: str                  # 发给 Nano Banana 的生图提示词（英文）
    video_prompt: str                  # 发给 Kling/Seedance 的运动描述（英文）
    voiceover: str = ""                # 中文旁白文案（发给 TTS）
    transition: str = "crossfade"     # 转场类型
    camera_motion: str = "static"      # 镜头运动
    style_tags: list = field(default_factory=list)  # 风格标签
    reference_character: Optional[str] = None     # 角色参考图路径
    
    # v2.0 新增
    shot_mode: Optional[ShotMode] = None            # 生成模式
    character_refs: Optional[list[str]] = None      # 多主体参考图
    speaker_id: Optional[int] = None               # 说话人 ID
    characters_in_scene: Optional[list[int]] = None # 本分镜出现的角色
```

### 3.2 VideoScript（完整脚本）

```python
# modules/llm.py

@dataclass
class VideoScript:
    title: str
    topic: str
    style: str
    total_duration: float
    scenes: list[Scene]
    characters: list[CharacterInfo] = field(default_factory=list)  # 角色列表
    metadata: dict = field(default_factory=dict)
```

### 3.3 CharacterInfo（人物信息）

```python
# modules/llm.py

@dataclass
class CharacterInfo:
    character_id: int
    name: str                          # 人物名称
    description: str                   # 外貌描述（中文）
    appearance_prompt: str             # 外貌英文提示词（用于生图）
    gender: str = "female"             # 性别（用于 TTS 音色分配）
    thumbnail_base64: Optional[str] = None  # 截图缩略图
    replacement_image: Optional[str] = None  # 替换参考图路径
```

---

## 4. 核心 API 调用模式

### 4.1 LLM 脚本生成

```python
# modules/llm.py

async def generate_script(topic, style, duration_hint, memory_context, config):
    """两轮生成 + Reflection 检查"""
    
    # 构建 System Prompt
    system_prompt = SCRIPT_SYSTEM_PROMPT.format(
        style_guidance=f"用户指定风格：{style}\n用户历史偏好：\n{memory_context}"
    )
    
    # 第一轮：生成初稿
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"请为以下主题创作...：\n\n主题：{topic}"}
        ],
        temperature=0.7,
    )
    raw_script = response.choices[0].message.content
    
    # 第二轮：Reflection 检查
    reflection_response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "你是一位严格的视频脚本审核员"},
            {"role": "user", "content": f"请检查以下脚本：\n\n{raw_script}"}
        ],
        temperature=0.3,
    )
    
    # 解析 JSON
    return _dict_to_video_script(_parse_json_safely(reflection_response), topic)
```

### 4.2 图像生成（会话级黑名单 + Fallback）

```python
# modules/image_gen.py

async def generate_keyframe(scene, output_dir, reference_images):
    """带黑名单和模型 Fallback 的图像生成"""
    
    # 模型列表（按优先级排序）
    FALLBACK_MODELS = [
        config.image_gen.model,
        "models/gemini-2.5-flash-image",
        "models/gemini-3.1-flash-image-preview",
    ]
    available_models = [m for m in FALLBACK_MODELS if m not in _FAILED_MODELS]
    
    # 依次尝试，直到成功
    for model_name in available_models:
        try:
            response = client.models.generate_content(model=model_name, contents=...)
            # 处理响应...
            return output_path
        except Exception as e:
            if "503" in str(e):
                _mark_model_failed(model_name, "503 服务不可用")
                continue
            elif "404" in str(e):
                _mark_model_failed(model_name, "404 模型不存在")
                continue
            raise
    
    # 所有模型都失败：生成占位图兜底
    _create_placeholder_image(output_path, scene.scene_id)
```

### 4.3 视频生成（Kling Omni 批量模式）

```python
# modules/video_gen.py

async def generate_video_clips_omni_batch(scenes, keyframe_paths, config):
    """
    Kling Omni 多镜头批量生成
    
    每次最多 6 个分镜一起提交，大幅减少 API 调用次数
    """
    
    # 1. 上传关键帧到 catbox.moe CDN（Kling Omni 要求公开 URL）
    image_list = []
    for scene in scenes:
        cdn_url = await _upload_image_to_cdn(keyframe_paths[scene.scene_id])
        image_list.append({"image_url": cdn_url})
    
    # 2. 构建 multi_prompt
    # 关键：total_duration = 所有分镜时长之和（3~15s）
    total_duration = min(15, max(3, len(scenes) * 3))  # 每分镜最少 3s
    multi_prompt = [
        {
            "index": i + 1,
            "prompt": f"<<<image_{i+1}>>> {scene.video_prompt}",
            "duration": str(scene_duration)  # 每分镜时长
        }
        for i, scene in enumerate(scenes)
    ]
    
    # 3. 提交任务
    payload = {
        "model_name": "kling-v3-omni",
        "multi_shot": True,
        "shot_type": "customize",
        "multi_prompt": multi_prompt,
        "image_list": image_list,
        "duration": str(total_duration),
    }
    
    # 4. 轮询等待
    while status != "succeed":
        result = await poll_task(task_id)
        await asyncio.sleep(10)
    
    # 5. 下载视频
    return [download(v["url"]) for v in result["videos"]]
```

### 4.4 TTS 多人声线拆分合成

```python
# modules/tts.py

async def generate_voiceover_multi_speaker(scene, output_dir):
    """
    多人声线拆分合成
    
    将 "女：你好。男：你好啊。" 拆分为两段，分别合成，
    再用 ffmpeg 拼接成一个 MP3
    """
    
    # 1. 拆分旁白
    segments = _split_voiceover_by_speaker(voiceover_text)
    # → [('female', '你好。'), ('male', '你好啊。')]
    
    # 2. 并发合成每段
    seg_tasks = [_call_minimax_tts(text, voice_id) for text, voice_id in segments]
    seg_paths = await asyncio.gather(*seg_tasks)
    
    # 3. FFmpeg 拼接
    _concat_mp3_with_ffmpeg(seg_paths, output_path)
    
    # 4. 测量精确时长
    duration = get_audio_duration(output_path)
    
    return output_path, duration
```

---

## 5. 工作流编排（API Server）

### 5.1 核心工作流函数

```python
# api/server.py

async def run_workflow(project_id: str, request: CreateProjectRequest):
    """5 阶段流水线"""
    
    # Stage 1: LLM 生成脚本
    script = await asyncio.to_thread(generate_script_sync, topic=request.topic, ...)
    save_project_meta(project_id)
    
    # Stage 2: 人工审核关卡
    await push_status(project_id, WorkflowStage.AWAITING_REVIEW, 20, "请审核...")
    review_event = asyncio.Event()
    _review_events[project_id] = review_event
    await asyncio.wait_for(review_event.wait(), timeout=1800)  # 等待 30 分钟
    
    # 获取审核决策
    decision = _review_decisions.get(project_id)
    if not decision["approved"]:
        return  # 用户取消
    
    # 更新分镜
    if decision.get("scenes"):
        script.scenes = [Scene(**s) for s in decision["scenes"]]
    
    # Stage 3: 并行生成关键帧 + TTS
    keyframe_task = asyncio.to_thread(generate_all_keyframes_sync, ...)
    audio_task = asyncio.to_thread(generate_all_voiceovers_sync, ...)
    keyframe_paths, voiceover_results = await asyncio.gather(keyframe_task, audio_task)
    
    # 更新 duration
    script.scenes = update_scene_durations(script.scenes, voiceover_results)
    audio_paths = {sid: path for sid, (path, _) in voiceover_results.items()}
    
    # Stage 4: 视频生成
    video_clips = await asyncio.to_thread(generate_all_video_clips_sync, ...)
    
    # Stage 5: 组装 + 草稿生成
    plan = AssemblyPlan(scenes=script.scenes, video_clips=video_clips, audio_clips=audio_paths, ...)
    await asyncio.to_thread(assemble_video, plan)
    await asyncio.to_thread(generate_jianying_draft, ...)
    
    # 完成
    await push_status(project_id, WorkflowStage.COMPLETED, 100, "视频生成完成")
```

### 5.2 WebSocket 状态推送

```python
# 推送状态
async def push_status(project_id, stage, progress, message, **kwargs):
    status = {
        "type": "status",
        "project_id": project_id,
        "stage": stage.value,
        "progress": progress,
        "message": message,
        "timestamp": datetime.now().isoformat(),
        **kwargs
    }
    await manager.broadcast(project_id, status)

# 前端接收
useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/' + projectId);
    ws.onmessage = (event) => {
        const status = JSON.parse(event.data);
        setWorkflowStatus(status);
    };
}, [projectId]);
```

---

## 6. 剪映草稿生成（v2.0 分轨模式）

### 6.1 分轨模式说明

v2.0 之前：生成合并后的视频再导入剪映（不可编辑）
v2.0 之后：每个分镜作为独立素材导入（可单独替换）

```python
# modules/jianying_draft.py

def _generate_with_pyjianyingdraft(script, video_clips, audio_clips, output_dir):
    """v2.0 分轨模式"""
    
    # 创建草稿
    draft_folder = draft.DraftFolder(output_dir)
    jy_draft = draft_folder.create_draft(draft_name=safe_name, width=1920, height=1080)
    
    # 添加轨道（分轨模式）
    jy_draft.add_track(draft.TrackType.video)      # 视频轨道（多片段）
    jy_draft.add_track(draft.TrackType.audio, "配音")  # 配音轨道
    jy_draft.add_track(draft.TrackType.text, "字幕")   # 字幕轨道
    
    # 逐分镜添加片段
    current_s = 0.0
    for scene in script.scenes:
        # 视频片段（独立素材）
        video_segment = draft.VideoSegment(
            material=draft.VideoMaterial(video_path),
            target_timerange=draft.trange(f"{current_s}s", f"{duration}s"),
        )
        jy_draft.add_segment(video_segment)
        
        # 配音片段
        audio_segment = draft.AudioSegment(...)
        jy_draft.add_segment(audio_segment, "配音")
        
        # 字幕片段
        text_segment = draft.TextSegment(...)
        jy_draft.add_segment(text_segment, "字幕")
        
        current_s += duration
    
    jy_draft.save()
```

**效果**：用户在剪映中可以看到每个分镜是独立素材，可单独替换视频/配音/字幕。

---

## 7. 错误处理策略

### 7.1 API 错误处理矩阵

| 模块 | 错误类型 | 处理策略 |
|------|----------|----------|
| **LLM** | JSON 解析失败 | 多策略解析 → Reflection 回退 |
| **ImageGen** | 503/429 限速 | 加入黑名单 → 切换模型 |
| **ImageGen** | IMAGE_SAFETY | 简化 prompt 重试 → 占位图兜底 |
| **TTS** | 1002/1004 限速 | 指数退避重试（5s, 10s, 20s, 40s）|
| **VideoGen** | Omni 失败 | 抛出异常（不降级）|
| **FFmpeg** | 编码错误 | 详细错误信息 + 回退编码参数 |

### 7.2 断点续传

```python
# api/server.py

@app.post("/api/projects/{project_id}/resume")
async def resume_project(project_id):
    """从已有文件继续（跳过已完成的阶段）"""
    
    # 1. 读取 script.json
    script = load_script(project_dir)
    
    # 2. 扫描已有文件
    keyframe_paths = scan_existing_files("keyframes", "scene_*_keyframe.*")
    audio_paths = scan_existing_files("audio", "scene_*_voiceover.mp3")
    
    # 3. 跳过已有文件，继续后续阶段
    video_clips = await generate_all_video_clips(keyframe_paths=keyframe_paths, ...)
    
    # 4. 继续组装
    ...
```

---

## 8. 配置与扩展

### 8.1 多 Provider 支持

```python
# core/config.py

@dataclass
class LLMConfig:
    default_provider: str = "deepseek"
    deepseek: LLMProviderConfig = field(default_factory=lambda: LLMProviderConfig(...))
    kimi: LLMProviderConfig = field(default_factory=lambda: LLMProviderConfig(...))
    minimax: LLMProviderConfig = field(default_factory=lambda: LLMProviderConfig(...))
    zhipu: LLMProviderConfig = ...
    gemini: LLMProviderConfig = ...
    openai: LLMProviderConfig = ...
    ollama: LLMProviderConfig = ...

# 使用
provider_cfg = getattr(config.llm, config.llm.default_provider)
client = AsyncOpenAI(api_key=provider_cfg.api_key, base_url=provider_cfg.base_url)
```

### 8.2 环境变量覆盖

```python
# core/config.py

env_overrides = {
    "DEEPSEEK_API_KEY": ("llm", "deepseek", "api_key"),
    "KLING_API_KEY": ("video_gen", "kling", "api_key"),
    "MINIMAX_API_KEY": ("tts", "minimax", "api_key"),
    # ...
}

for env_var, path_tuple in env_overrides.items():
    value = os.environ.get(env_var)
    if value:
        d = raw
        for key in path_tuple[:-1]:
            d = d.setdefault(key, {})
        d[path_tuple[-1]] = value  # 环境变量优先级最高
```

---

## 9. 性能优化

### 9.1 并发策略

| 阶段 | 并发数 | 说明 |
|------|--------|------|
| 关键帧生成 | 3 | 避免 Gemini API 限速 |
| TTS 生成 | 5 | MiniMax 有 RPM 限制 |
| 视频生成 | 3 | Kling/Seedance 并发限制 |
| Omni 批量 | 6/批 | Kling Omni 上限 |

### 9.2 缓存与断点

- **断点续传**：已存在的文件跳过重新生成
- **会话级黑名单**：避免重复失败
- **项目元数据持久化**：重启不丢失项目状态

---

## 10. 总结

### 核心算法要点

| 算法 | 核心价值 |
|------|----------|
| **TTS 时长驱动** | 绝对音画同步（配音时长 = 视频时长）|
| **Shot Mode 自动检测** | 根据内容类型自动选择最优生成模式 |
| **智能引擎路由** | Kling（动作）vs Seedance（对话）|
| **会话级黑名单** | API 不稳定时快速失败切换 |
| **记忆系统** | 随使用次数增长，风格越来越懂用户 |
| **JSON 安全解析** | LLM 输出容错处理 |
| **FFmpeg 转场对齐** | 精确的音频偏移计算 |
| **分轨草稿模式** | 剪映中可单独编辑每个分镜 |

### 核心设计原则

1. **数据驱动**：TTS 时长驱动视频时长，确保音画同步
2. **容错优先**：黑名单 + 多策略解析 + 占位图兜底
3. **渐进增强**：从 i2v 到 Omni，从单分镜到批量
4. **用户可控**：人工审核关卡 + 分轨草稿可编辑

---

*文档版本: 1.0 | 最后更新: 2026-03-26*