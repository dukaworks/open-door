"""
芝麻开门 Open-Door
统一用户配置服务

优先级：
1. v3 数据库（UserConfigs + UserProviderConfigs）
2. config.yaml（向后兼容）
3. 代码默认值

用途：
- 提供统一的配置读取接口
- 支持配置缓存，提高性能
- 确保用户配置实时生效
"""

import time
from functools import lru_cache
from typing import Optional, Dict
from dataclasses import dataclass
from datetime import datetime

from core.config import get_config, LLMProviderConfig


# ============================================================
# 数据类定义
# ============================================================


@dataclass
class LLMConfig:
    """LLM 配置"""
    provider_id: str
    model_id: str
    api_key: str
    base_url: str


@dataclass
class VideoConfig:
    """视频生成配置"""
    provider_id: str
    model_id: str
    api_key: str
    api_secret: str
    base_url: str
    duration: int
    ratio: str
    quality: str

    @classmethod
    def default(cls):
        return cls(
            provider_id="kling",
            model_id="kling-3.0",
            api_key="",
            api_secret="",
            base_url="https://api.klingai.com/v1",
            duration=5,
            ratio="16:9",
            quality="high",
        )


@dataclass
class ImageConfig:
    """图片生成配置"""
    provider_id: str
    model_id: str
    api_key: str
    base_url: str

    @classmethod
    def default(cls):
        return cls(
            provider_id="volces",
            model_id="gemini-2.0-flash-preview-image-generation",
            api_key="",
            base_url="https://ark.cn-beijing.volces.com/api/v3",
        )


@dataclass
class TTSConfig:
    """语音合成配置"""
    provider_id: str
    model_id: str
    api_key: str
    voice: str
    speed: float
    emotion: str

    @classmethod
    def default(cls):
        return cls(
            provider_id="minimax",
            model_id="speech-02-hd",
            api_key="",
            voice="female-shaonv",
            speed=1.0,
            emotion="neutral",
        )


# ============================================================
# 缓存时间戳
# ============================================================

_cache_timestamps: Dict[str, float] = {}


def _should_refresh(cache_key: str, ttl: int = 300) -> bool:
    """检查缓存是否需要刷新（默认5分钟TTL）"""
    if cache_key not in _cache_timestamps:
        return True
    return time.time() - _cache_timestamps[cache_key] > ttl


def _update_cache_time(cache_key: str):
    """更新缓存时间戳"""
    _cache_timestamps[cache_key] = time.time()


# ============================================================
# UserConfigService
# ============================================================


class UserConfigService:
    """统一用户配置服务"""

    # ========================================================
    # LLM 配置
    # ========================================================

    @staticmethod
    def get_llm_config(user_id: str) -> LLMConfig:
        """获取 LLM 配置（provider, model, api_key）

        优先级：
        1. v3 数据库（UserConfigs + UserProviderConfigs）
        2. config.yaml（向后兼容）
        3. 代码默认值
        """
        cache_key = f"llm:{user_id}"

        # 1. 尝试从数据库读取
        try:
            if _should_refresh(cache_key):
                from api.config_db_v3 import get_user_config, get_user_provider_config

                user_config = get_user_config(user_id)
                if user_config and user_config.get("llm_provider_id"):
                    provider_id = user_config["llm_provider_id"]
                    provider_config = get_user_provider_config(user_id, provider_id)
                    if provider_config:
                        config = LLMConfig(
                            provider_id=provider_id,
                            model_id=user_config.get("llm_model_id", ""),
                            api_key=provider_config.get("api_key", ""),
                            base_url=provider_config.get("base_url", ""),
                        )
                        _update_cache_time(cache_key)
                        print(f"[UserConfigService] 从数据库读取 LLM 配置: {provider_id}")
                        return config
        except Exception as e:
            print(f"[UserConfigService] 数据库读取失败，回退到 config.yaml: {e}")

        # 2. 回退到 config.yaml
        try:
            config = get_config()
            provider_id = config.llm.default_provider
            provider_cfg = getattr(config.llm, provider_id)
            return LLMConfig(
                provider_id=provider_id,
                model_id=provider_cfg.model,
                api_key=provider_cfg.api_key,
                base_url=provider_cfg.base_url,
            )
        except Exception as e:
            print(f"[UserConfigService] config.yaml 读取失败，使用默认值: {e}")

        # 3. 使用代码默认值
        return LLMConfig(
            provider_id="deepseek",
            model_id="deepseek-chat",
            api_key="",
            base_url="https://api.deepseek.com/v1",
        )

    # ========================================================
    # 视频配置
    # ========================================================

    @staticmethod
    def get_video_config(user_id: str) -> VideoConfig:
        """获取视频配置（provider, model, api_key, duration, ratio, quality）

        优先级：
        1. v3 数据库
        2. config.yaml
        3. 代码默认值
        """
        cache_key = f"video:{user_id}"

        # 1. 尝试从数据库读取
        try:
            if _should_refresh(cache_key):
                from api.config_db_v3 import get_user_config, get_user_provider_config

                user_config = get_user_config(user_id)
                if user_config and user_config.get("video_provider_id"):
                    provider_id = user_config["video_provider_id"]
                    provider_config = get_user_provider_config(user_id, provider_id)
                    if provider_config:
                        config = VideoConfig(
                            provider_id=provider_id,
                            model_id=user_config.get("video_model_id", "kling-3.0"),
                            api_key=provider_config.get("api_key", ""),
                            api_secret=provider_config.get("api_secret", ""),
                            base_url=provider_config.get("base_url", ""),
                            duration=user_config.get("video_duration", 5),
                            ratio=user_config.get("video_ratio", "16:9"),
                            quality=user_config.get("video_quality", "high"),
                        )
                        _update_cache_time(cache_key)
                        print(f"[UserConfigService] 从数据库读取视频配置: {provider_id}")
                        return config
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

    # ========================================================
    # 图片配置
    # ========================================================

    @staticmethod
    def get_image_config(user_id: str) -> ImageConfig:
        """获取图片配置（provider, model, api_key）

        优先级：
        1. v3 数据库
        2. config.yaml
        3. 代码默认值
        """
        cache_key = f"image:{user_id}"

        # 1. 尝试从数据库读取
        try:
            if _should_refresh(cache_key):
                from api.config_db_v3 import get_user_config, get_user_provider_config

                user_config = get_user_config(user_id)
                if user_config and user_config.get("image_provider_id"):
                    provider_id = user_config["image_provider_id"]
                    provider_config = get_user_provider_config(user_id, provider_id)
                    if provider_config:
                        config = ImageConfig(
                            provider_id=provider_id,
                            model_id=user_config.get("image_model_id", ""),
                            api_key=provider_config.get("api_key", ""),
                            base_url=provider_config.get("base_url", ""),
                        )
                        _update_cache_time(cache_key)
                        print(f"[UserConfigService] 从数据库读取图片配置: {provider_id}")
                        return config
        except Exception as e:
            print(f"[UserConfigService] 数据库读取失败，回退到 config.yaml: {e}")

        # 2. 回退到 config.yaml
        try:
            config = get_config()
            return ImageConfig(
                provider_id="volces",  # config.yaml 中是 nano_banana，这是 provider_id
                model_id=config.image_gen.model,
                api_key=config.image_gen.api_key,
                base_url="",  # 图片生成不使用 base_url
            )
        except Exception as e:
            print(f"[UserConfigService] config.yaml 读取失败，使用默认值: {e}")

        # 3. 使用代码默认值
        return ImageConfig.default()

    # ========================================================
    # TTS 配置
    # ========================================================

    @staticmethod
    def get_tts_config(user_id: str) -> TTSConfig:
        """获取 TTS 配置（provider, model, api_key, voice, speed, emotion）

        优先级：
        1. v3 数据库
        2. config.yaml
        3. 代码默认值
        """
        cache_key = f"tts:{user_id}"

        # 1. 尝试从数据库读取
        try:
            if _should_refresh(cache_key):
                from api.config_db_v3 import get_user_config, get_user_provider_config

                user_config = get_user_config(user_id)
                if user_config and user_config.get("tts_provider_id"):
                    provider_id = user_config["tts_provider_id"]
                    provider_config = get_user_provider_config(user_id, provider_id)
                    if provider_config:
                        config = TTSConfig(
                            provider_id=provider_id,
                            model_id=user_config.get("tts_model_id", "speech-02-hd"),
                            api_key=provider_config.get("api_key", ""),
                            voice=user_config.get("tts_voice", "female-shaonv"),
                            speed=user_config.get("tts_speed", 1.0),
                            emotion=user_config.get("tts_emotion", "neutral"),
                        )
                        _update_cache_time(cache_key)
                        print(f"[UserConfigService] 从数据库读取 TTS 配置: {provider_id}")
                        return config
        except Exception as e:
            print(f"[UserConfigService] 数据库读取失败，回退到 config.yaml: {e}")

        # 2. 回退到 config.yaml
        try:
            config = get_config()
            provider_id = config.tts.default_provider
            provider_cfg = getattr(config.tts, provider_id)
            return TTSConfig(
                provider_id=provider_id,
                model_id=config.tts.model,
                api_key=provider_cfg.api_key if hasattr(provider_cfg, 'api_key') else config.tts.api_key,
                voice=config.tts.default_voice,
                speed=config.tts.speed,
                emotion=config.tts.emotion,
            )
        except Exception as e:
            print(f"[UserConfigService] config.yaml 读取失败，使用默认值: {e}")

        # 3. 使用代码默认值
        return TTSConfig.default()

    # ========================================================
    # 缓存管理
    # ========================================================

    @staticmethod
    def invalidate_cache(user_id: str):
        """清除用户配置缓存（配置修改时调用）"""
        cache_keys = [f"llm:{user_id}", f"video:{user_id}", f"image:{user_id}", f"tts:{user_id}"]
        for key in cache_keys:
            if key in _cache_timestamps:
                del _cache_timestamps[key]
        print(f"[UserConfigService] 已清除用户 {user_id} 的配置缓存")

    @staticmethod
    def invalidate_all_cache():
        """清除所有配置缓存（用于测试或系统级配置变更）"""
        global _cache_timestamps
        _cache_timestamps = {}
        print("[UserConfigService] 已清除所有配置缓存")
