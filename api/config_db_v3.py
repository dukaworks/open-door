"""
芝麻开门 Open-Door
Settings System v3.0 - 用户配置数据库模块

数据表：
- providers: 服务商信息
- user_provider_configs: 用户的 API Key 配置（多用户隔离）
- models: 模型参数
- packages: 套餐模板
- user_configs: 用户运行时配置
- system_settings: 系统通用配置
"""

import os
import sqlite3
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

# ============================================================
# 数据库路径
# ============================================================


def _get_config_db_path() -> str:
    """获取配置数据库路径"""
    db_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "config"
    )
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, "config_v3.db")


# ============================================================
# 预设数据
# ============================================================

# 预设服务商
PRESET_PROVIDERS = [
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "provider_type": "llm",
        "description": "性价比最高，适合脚本生成",
        "base_url": "https://api.deepseek.com/v1",
        "requires_secret": False,
    },
    {
        "id": "kimi",
        "name": "Kimi (Moonshot)",
        "provider_type": "llm",
        "description": "适合长文本处理，小说/剧本转分镜脚本",
        "base_url": "https://api.moonshot.cn/v1",
        "requires_secret": False,
    },
    {
        "id": "minimax",
        "name": "MiniMax",
        "provider_type": "llm",
        "description": "对话与情绪表达最强，适合情感类内容",
        "base_url": "https://api.minimax.chat/v1",
        "requires_secret": False,
    },
    {
        "id": "gemini",
        "name": "Google Gemini",
        "provider_type": "llm",
        "description": "多模态理解，支持图片/视频输入转脚本",
        "base_url": "https://generativelanguage.googleapis.com/v1",
        "requires_secret": False,
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "provider_type": "llm",
        "description": "支持 100+ 模型，一键切换",
        "base_url": "https://openrouter.ai/api/v1",
        "requires_secret": False,
    },
    {
        "id": "ollama",
        "name": "Ollama (本地)",
        "provider_type": "llm",
        "description": "本地部署，无需网络",
        "base_url": "http://localhost:11434/v1",
        "requires_secret": False,
    },
    {
        "id": "nano_banana",
        "name": "Nano Banana",
        "provider_type": "image",
        "description": "4K 首帧锁定，主体一致性最强",
        "base_url": "",
        "requires_secret": False,
    },
    {
        "id": "kling",
        "name": "Kling 3.0",
        "provider_type": "video",
        "description": "动作/产品/抖音短视频首选",
        "base_url": "https://api-beijing.klingai.com",
        "requires_secret": True,
    },
    {
        "id": "seedance",
        "name": "Seedance 1.5",
        "provider_type": "video",
        "description": "叙事短剧/多角色连戏首选",
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "requires_secret": False,
    },
    {
        "id": "minimax_tts",
        "name": "MiniMax TTS",
        "provider_type": "tts",
        "description": "高质量语音合成",
        "base_url": "https://api.minimax.chat/v1",
        "requires_secret": False,
    },
]

# 预设模型
PRESET_MODELS = [
    # LLM Models
    {"id": "deepseek-chat", "name": "DeepSeek Chat", "model_id": "deepseek-chat", "provider_id": "deepseek"},
    {"id": "deepseek-coder", "name": "DeepSeek Coder", "model_id": "deepseek-coder", "provider_id": "deepseek"},
    {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner", "model_id": "deepseek-reasoner", "provider_id": "deepseek"},
    {"id": "kimi-8k", "name": "Kimi 8K", "model_id": "moonshot-v1-8k", "provider_id": "kimi"},
    {"id": "kimi-32k", "name": "Kimi 32K", "model_id": "moonshot-v1-32k", "provider_id": "kimi"},
    {"id": "kimi-128k", "name": "Kimi 128K", "model_id": "moonshot-v1-128k", "provider_id": "kimi"},
    {"id": "minimax-6.5s", "name": "MiniMax 6.5s", "model_id": "abab6.5s-chat", "provider_id": "minimax"},
    {"id": "gemini-flash", "name": "Gemini 2.0 Flash", "model_id": "gemini-2.0-flash", "provider_id": "gemini"},
    {"id": "gemini-pro", "name": "Gemini 1.5 Pro", "model_id": "gemini-1.5-pro", "provider_id": "gemini"},
    # Video Models
    {"id": "kling-v3", "name": "Kling V3", "model_id": "kling-v3", "provider_id": "kling", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "kling-v3-omni", "name": "Kling V3 Omni", "model_id": "kling-v3-omni", "provider_id": "kling", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "seedance-1.5", "name": "Seedance 1.5", "model_id": "doubao-seedance-1-5-pro-250528", "provider_id": "seedance", "duration": 5, "ratio": "16:9", "quality": "high"},
    # Image Models
    {"id": "nano-banana-4k", "name": "Nano Banana 4K", "model_id": "gemini-3-pro-image-preview", "provider_id": "nano_banana", "output_resolution": "4K"},
    # TTS Models
    {"id": "minimax-tts-hd", "name": "MiniMax TTS HD", "model_id": "speech-02-hd", "provider_id": "minimax_tts", "voice": "female-shaonv", "speed": 1.0, "emotion": "neutral"},
]

# 预设套餐
PRESET_PACKAGES = [
    {
        "id": "basic",
        "name": "基础版",
        "icon": "🌟",
        "description": "免费体验推荐，适合新手入门",
        "services": {
            "llm": {"provider_id": "deepseek", "model_id": "deepseek-chat"},
            "video": {"provider_id": "kling", "model_id": "kling-v3"},
            "image": {"provider_id": "nano_banana"},
            "tts": {"provider_id": "minimax_tts", "model_id": "minimax-tts-hd"},
        },
    },
    {
        "id": "pro",
        "name": "专业版",
        "icon": "🚀",
        "description": "全功能解锁，适合专业创作者",
        "services": {
            "llm": {"provider_id": "kimi", "model_id": "kimi-32k"},
            "video": {"provider_id": "seedance", "model_id": "seedance-1.5"},
            "image": {"provider_id": "nano_banana"},
            "tts": {"provider_id": "minimax_tts", "model_id": "minimax-tts-hd"},
        },
    },
    {
        "id": "flagship",
        "name": "旗舰版",
        "icon": "👑",
        "description": "无限可能，适合团队和企业",
        "services": {
            "llm": {"provider_id": "gemini", "model_id": "gemini-pro"},
            "video": {"provider_id": "kling", "model_id": "kling-v3-omni"},
            "image": {"provider_id": "nano_banana"},
            "tts": {"provider_id": "minimax_tts", "model_id": "minimax-tts-hd"},
        },
    },
]


# ============================================================
# 初始化
# ============================================================


def init_config_db_v3():
    """初始化配置数据库 v3"""
    db_path = _get_config_db_path()
    
    with sqlite3.connect(db_path) as conn:
        # 1. Providers 表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                provider_type TEXT NOT NULL,
                description TEXT,
                base_url TEXT,
                is_preset INTEGER DEFAULT 1,
                requires_secret INTEGER DEFAULT 0,
                created_by TEXT DEFAULT 'system',
                status TEXT DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 2. UserProviderConfigs 表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_provider_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                api_key TEXT,
                api_secret TEXT,
                base_url TEXT,
                is_active INTEGER DEFAULT 1,
                is_default INTEGER DEFAULT 0,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, provider_id)
            )
        """)
        
        # 3. Models 表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                model_id TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                duration INTEGER,
                ratio TEXT,
                quality TEXT,
                output_resolution TEXT,
                voice TEXT,
                speed REAL,
                emotion TEXT,
                is_preset INTEGER DEFAULT 1,
                cached_at TEXT,
                FOREIGN KEY (provider_id) REFERENCES providers(id)
            )
        """)
        
        # 4. Packages 表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS packages (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT,
                description TEXT,
                is_preset INTEGER DEFAULT 1,
                services_json TEXT NOT NULL,
                created_by TEXT DEFAULT 'system'
            )
        """)
        
        # 5. UserConfigs 表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_configs (
                id INTEGER PRIMARY KEY,
                user_id TEXT UNIQUE NOT NULL,
                package_id TEXT,
                llm_provider_id TEXT,
                llm_model_id TEXT,
                video_provider_id TEXT,
                video_model_id TEXT,
                image_provider_id TEXT,
                tts_provider_id TEXT,
                tts_model_id TEXT,
                video_duration INTEGER DEFAULT 5,
                video_ratio TEXT DEFAULT '16:9',
                video_quality TEXT DEFAULT 'high',
                multi_shot INTEGER DEFAULT 0,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 6. SystemSettings 表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                category TEXT,
                description TEXT,
                is_editable INTEGER DEFAULT 1,
                is_visible INTEGER DEFAULT 1,
                updated_by TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 插入预设数据
        _insert_preset_data(conn)
        
    print(f"[init_config_db_v3] 数据库初始化完成: {db_path}")


def _insert_preset_data(conn: sqlite3.Connection):
    """插入预设数据"""
    
    # 插入 Providers
    for provider in PRESET_PROVIDERS:
        existing = conn.execute(
            "SELECT id FROM providers WHERE id = ?", (provider["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO providers 
                   (id, name, provider_type, description, base_url, requires_secret)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    provider["id"],
                    provider["name"],
                    provider["provider_type"],
                    provider["description"],
                    provider["base_url"],
                    1 if provider["requires_secret"] else 0,
                ),
            )
    
    # 插入 Models
    for model in PRESET_MODELS:
        existing = conn.execute(
            "SELECT id FROM models WHERE id = ?", (model["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO models 
                   (id, name, model_id, provider_id, duration, ratio, quality, 
                    output_resolution, voice, speed, emotion, cached_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    model["id"],
                    model["name"],
                    model["model_id"],
                    model["provider_id"],
                    model.get("duration"),
                    model.get("ratio"),
                    model.get("quality"),
                    model.get("output_resolution"),
                    model.get("voice"),
                    model.get("speed"),
                    model.get("emotion"),
                    datetime.now().isoformat(),
                ),
            )
    
    # 插入 Packages
    for package in PRESET_PACKAGES:
        existing = conn.execute(
            "SELECT id FROM packages WHERE id = ?", (package["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO packages 
                   (id, name, icon, description, services_json)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    package["id"],
                    package["name"],
                    package["icon"],
                    package["description"],
                    json.dumps(package["services"], ensure_ascii=False),
                ),
            )
    
    # 插入默认 SystemSettings
    default_settings = [
        ("memory_provider", '"local"', "memory", "记忆系统提供商", 1, 1),
        ("jianying_enabled", "true", "jianying", "启用剪映导出", 1, 1),
        ("jianying_draft_dir", '"./data/outputs/jianying_drafts"', "jianying", "剪映草稿目录", 1, 0),
        ("whisperx_model", '"base"', "local", "字幕识别模型", 1, 0),
        ("ffmpeg_path", '"ffmpeg"', "local", "FFmpeg 路径", 1, 0),
    ]
    for setting in default_settings:
        existing = conn.execute(
            "SELECT key FROM system_settings WHERE key = ?", (setting[0],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO system_settings 
                   (key, value, category, description, is_editable, is_visible)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                setting,
            )


# ============================================================
# Providers API
# ============================================================


def get_all_providers() -> List[Dict[str, Any]]:
    """获取所有服务商"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """SELECT id, name, provider_type, description, base_url, 
                      is_preset, requires_secret, status
               FROM providers WHERE status = 'active' ORDER BY name"""
        ).fetchall()
        
        return [
            {
                "id": row[0],
                "name": row[1],
                "provider_type": row[2],
                "description": row[3],
                "base_url": row[4],
                "is_preset": bool(row[5]),
                "requires_secret": bool(row[6]),
                "status": row[7],
            }
            for row in rows
        ]


def get_user_providers(user_id: str) -> List[Dict[str, Any]]:
    """获取用户的服务商列表（含配置状态）"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        # 获取所有预设服务商
        providers = get_all_providers()
        
        # 获取用户的配置
        user_configs = conn.execute(
            """SELECT provider_id, api_key, api_secret, is_active, is_default
               FROM user_provider_configs WHERE user_id = ?""",
            (user_id,),
        ).fetchall()
        
        user_config_map = {
            row[0]: {
                "api_key_configured": bool(row[1]),
                "api_secret_configured": bool(row[2]),
                "is_active": bool(row[3]),
                "is_default": bool(row[4]),
            }
            for row in user_configs
        }
        
        # 合并信息
        for provider in providers:
            config = user_config_map.get(provider["id"], {})
            provider["api_key_configured"] = config.get("api_key_configured", False)
            provider["api_secret_configured"] = config.get("api_secret_configured", False)
            provider["is_active"] = config.get("is_active", False)
            provider["is_default"] = config.get("is_default", False)
        
        return providers


def save_user_provider_config(
    user_id: str,
    provider_id: str,
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    base_url: Optional[str] = None,
    is_active: bool = True,
    is_default: bool = False,
) -> Dict[str, Any]:
    """保存用户的提供商配置"""
    db_path = _get_config_db_path()
    now = datetime.now().isoformat()
    
    with sqlite3.connect(db_path) as conn:
        # 检查是否已存在
        existing = conn.execute(
            "SELECT id FROM user_provider_configs WHERE user_id = ? AND provider_id = ?",
            (user_id, provider_id),
        ).fetchone()
        
        if existing:
            # 更新
            conn.execute(
                """UPDATE user_provider_configs SET
                   api_key = ?, api_secret = ?, base_url = ?,
                   is_active = ?, is_default = ?, updated_at = ?
                   WHERE user_id = ? AND provider_id = ?""",
                (
                    api_key,
                    api_secret,
                    base_url,
                    1 if is_active else 0,
                    1 if is_default else 0,
                    now,
                    user_id,
                    provider_id,
                ),
            )
        else:
            # 插入
            conn.execute(
                """INSERT INTO user_provider_configs
                   (user_id, provider_id, api_key, api_secret, base_url, 
                    is_active, is_default, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_id,
                    provider_id,
                    api_key,
                    api_secret,
                    base_url,
                    1 if is_active else 0,
                    1 if is_default else 0,
                    now,
                ),
            )
        
        return {"success": True, "message": "配置已保存"}


# ============================================================
# Models API
# ============================================================


def get_models_by_provider(provider_id: str) -> List[Dict[str, Any]]:
    """获取服务商的模型列表"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """SELECT id, name, model_id, duration, ratio, quality,
                      output_resolution, voice, speed, emotion
               FROM models WHERE provider_id = ? ORDER BY name""",
            (provider_id,),
        ).fetchall()
        
        return [
            {
                "id": row[0],
                "name": row[1],
                "model_id": row[2],
                "duration": row[3],
                "ratio": row[4],
                "quality": row[5],
                "output_resolution": row[6],
                "voice": row[7],
                "speed": row[8],
                "emotion": row[9],
            }
            for row in rows
        ]


# ============================================================
# Packages API
# ============================================================


def get_all_packages() -> List[Dict[str, Any]]:
    """获取所有套餐"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """SELECT id, name, icon, description, is_preset, services_json
               FROM packages ORDER BY is_preset DESC, id"""
        ).fetchall()
        
        return [
            {
                "id": row[0],
                "name": row[1],
                "icon": row[2],
                "description": row[3],
                "is_preset": bool(row[4]),
                "services": json.loads(row[5]),
            }
            for row in rows
        ]


# ============================================================
# UserConfigs API
# ============================================================


def get_user_config(user_id: str) -> Optional[Dict[str, Any]]:
    """获取用户配置"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            """SELECT package_id, llm_provider_id, llm_model_id,
                      video_provider_id, video_model_id, image_provider_id,
                      tts_provider_id, tts_model_id, video_duration,
                      video_ratio, video_quality, multi_shot
               FROM user_configs WHERE user_id = ?""",
            (user_id,),
        ).fetchone()
        
        if not row:
            return None
        
        return {
            "package_id": row[0],
            "llm": {"provider_id": row[1], "model_id": row[2]},
            "video": {"provider_id": row[3], "model_id": row[4]},
            "image": {"provider_id": row[5]},
            "tts": {"provider_id": row[6], "model_id": row[7]},
            "runtime_params": {
                "duration": row[8],
                "ratio": row[9],
                "quality": row[10],
                "multi_shot": bool(row[11]),
            },
        }


def create_default_user_config(user_id: str) -> Dict[str, Any]:
    """为新用户创建默认配置"""
    db_path = _get_config_db_path()
    now = datetime.now().isoformat()
    
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """INSERT INTO user_configs
               (user_id, package_id, llm_provider_id, llm_model_id,
                video_provider_id, video_model_id, image_provider_id,
                tts_provider_id, tts_model_id, updated_at)
               VALUES (?, 'basic', 'deepseek', 'deepseek-chat',
                       'kling', 'kling-v3', 'nano_banana',
                       'minimax_tts', 'minimax-tts-hd', ?)""",
            (user_id, now),
        )
    
    return get_user_config(user_id)


# ============================================================
# SystemSettings API
# ============================================================


def get_system_setting(key: str) -> Optional[Any]:
    """获取系统设置"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT value FROM system_settings WHERE key = ?",
            (key,),
        ).fetchone()
        
        if row and row[0]:
            return json.loads(row[0])
        return None


def set_system_setting(key: str, value: Any, updated_by: str = "system") -> bool:
    """设置系统设置"""
    db_path = _get_config_db_path()
    now = datetime.now().isoformat()
    
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """UPDATE system_settings SET value = ?, updated_by = ?, updated_at = ?
               WHERE key = ?""",
            (json.dumps(value, ensure_ascii=False), updated_by, now, key),
        )
    
    return True


# ============================================================
# 启动时初始化
# ============================================================

init_config_db_v3()
