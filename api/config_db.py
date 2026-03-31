"""
芝麻开门 Open-Door
用户配置数据库模块 - 管理用户 API 配置、模型缓存、套餐

功能：
- 用户配置 CRUD（API Key、模型、Base URL）
- 提供商模型列表缓存
- 预设套餐管理
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
    return os.path.join(db_dir, "user_config.db")


# ============================================================
# 预定义数据
# ============================================================

# 提供商默认 Base URL
DEFAULT_BASE_URLS = {
    "deepseek": "https://api.deepseek.com/v1",
    "kimi": "https://api.moonshot.cn/v1",
    "minimax": "https://api.minimax.chat/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1",
    "kling": "https://api.klingai.com/v1",
    "volces": "https://ark.cn-beijing.volces.com/api/v3",
    "aliyun": "https://dashscope.aliyuncs.com/api/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "oneapi": "http://localhost:3000/v1",
    "ollama": "http://localhost:11434/v1",
}

# 提供商元信息
PROVIDER_INFO = {
    "deepseek": {
        "name": "DeepSeek",
        "type": "llm",
        "description": "性价比最高，适合脚本生成",
        "requires_secret": False,
    },
    "kimi": {
        "name": "Kimi (Moonshot)",
        "type": "llm",
        "description": "适合长文本处理，小说/剧本转分镜脚本",
        "requires_secret": False,
    },
    "minimax": {
        "name": "MiniMax",
        "type": "llm",
        "description": "对话与情绪表达最强",
        "requires_secret": False,
    },
    "gemini": {
        "name": "Google Gemini",
        "type": "llm",
        "description": "多模态理解，支持图片/视频输入",
        "requires_secret": False,
    },
    "kling": {
        "name": "Kling AI",
        "type": "video",
        "description": "可灵视频生成模型",
        "requires_secret": True,
    },
    "volces": {
        "name": "字节火山方舟",
        "type": "video",
        "description": "Doubao大模型，适合短视频内容创作",
        "requires_secret": False,
    },
    "aliyun": {
        "name": "阿里云百炼",
        "type": "image",
        "description": "通义万相 AI 绘画，4K 高清输出",
        "requires_secret": False,
    },
    "openrouter": {
        "name": "OpenRouter (API聚合)",
        "type": "llm",
        "description": "支持 100+ 模型，一键切换",
        "requires_secret": False,
    },
    "oneapi": {
        "name": "OneAPI (本地聚合)",
        "type": "llm",
        "description": "自建 API 聚合服务",
        "requires_secret": False,
    },
    "ollama": {
        "name": "Ollama (本地模型)",
        "type": "llm",
        "description": "本地部署，无需网络",
        "requires_secret": False,
    },
}

# 预设套餐
PRESET_PACKAGES = [
    # 三大云服务商套餐
    {
        "id": "aliyun-express",
        "name": "百炼-快速套餐",
        "icon": "☁️",
        "description": "阿里云百炼快速入门，性价比之选",
        "services": [
            {"type": "llm", "provider": "deepseek"},
            {"type": "image", "provider": "aliyun"},
            {"type": "video", "provider": "aliyun"},
            {"type": "tts", "provider": "minimax"},
        ],
    },
    {
        "id": "aliyun-pro",
        "name": "百炼-专业套餐",
        "icon": "🌤️",
        "description": "阿里云百炼专业版，全功能解锁",
        "services": [
            {"type": "llm", "provider": "kimi"},
            {"type": "image", "provider": "aliyun"},
            {"type": "video", "provider": "aliyun"},
            {"type": "tts", "provider": "minimax"},
        ],
    },
    {
        "id": "volces-express",
        "name": "方舟-Express",
        "icon": "🚀",
        "description": "字节火山方舟快速版，极速体验",
        "services": [
            {"type": "llm", "provider": "minimax"},
            {"type": "image", "provider": "aliyun"},
            {"type": "video", "provider": "aliyun"},
            {"type": "tts", "provider": "minimax"},
        ],
    },
    {
        "id": "volces-pro",
        "name": "方舟-专业套餐",
        "icon": "🌟",
        "description": "字节火山方舟专业版，256K长文本",
        "services": [
            {"type": "llm", "provider": "kimi"},
            {"type": "image", "provider": "aliyun"},
            {"type": "video", "provider": "aliyun"},
            {"type": "tts", "provider": "minimax"},
        ],
    },
    {
        "id": "tencent-express",
        "name": "腾讯-Express",
        "icon": "🎯",
        "description": "腾讯混元快速入门，稳定可靠",
        "services": [
            {"type": "llm", "provider": "deepseek"},
            {"type": "image", "provider": "aliyun"},
            {"type": "video", "provider": "kling"},
            {"type": "tts", "provider": "minimax"},
        ],
    },
    {
        "id": "tencent-pro",
        "name": "腾讯-专业套餐",
        "icon": "💎",
        "description": "腾讯混元专业版，全功能体验",
        "services": [
            {"type": "llm", "provider": "kimi"},
            {"type": "image", "provider": "aliyun"},
            {"type": "video", "provider": "kling"},
            {"type": "tts", "provider": "minimax"},
        ],
    },
]


# ============================================================
# 初始化
# ============================================================


def init_config_db():
    """初始化配置数据库"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        # 用户配置表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL DEFAULT 'default',
                config_type TEXT NOT NULL,
                provider TEXT NOT NULL,
                api_key TEXT,
                api_secret TEXT,
                model TEXT,
                base_url TEXT,
                custom_params TEXT,
                is_active INTEGER DEFAULT 1,
                is_default INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, config_type, provider)
            )
        """)

        # 模型缓存表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS provider_models_cache (
                provider TEXT PRIMARY KEY,
                models_json TEXT NOT NULL,
                cached_at TEXT NOT NULL
            )
        """)

        # 预设套餐表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS preset_packages (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT,
                description TEXT,
                services_json TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0
            )
        """)

        # 插入预设套餐（如果不存在）
        for pkg in PRESET_PACKAGES:
            existing = conn.execute(
                "SELECT id FROM preset_packages WHERE id = ?", (pkg["id"],)
            ).fetchone()
            if not existing:
                conn.execute(
                    """INSERT INTO preset_packages 
                       (id, name, icon, description, services_json, sort_order) 
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        pkg["id"],
                        pkg["name"],
                        pkg["icon"],
                        pkg["description"],
                        json.dumps(pkg["services"], ensure_ascii=False),
                        PRESET_PACKAGES.index(pkg),
                    ),
                )


# ============================================================
# 提供商 API
# ============================================================


def get_all_providers() -> List[Dict[str, Any]]:
    """获取所有支持的提供商列表"""
    providers = []
    for provider_id, info in PROVIDER_INFO.items():
        providers.append(
            {
                "id": provider_id,
                "name": info["name"],
                "type": info["type"],
                "description": info["description"],
                "requires_secret": info["requires_secret"],
                "default_url": DEFAULT_BASE_URLS.get(provider_id),
            }
        )
    return providers


def get_provider_models(provider: str, force_refresh: bool = False) -> List[str]:
    """
    获取提供商模型列表（自动获取 + 缓存）
    """
    db_path = _get_config_db_path()
    now = datetime.now().isoformat()

    with sqlite3.connect(db_path) as conn:
        # 检查缓存（除非强制刷新）
        if not force_refresh:
            cached = conn.execute(
                "SELECT models_json, cached_at FROM provider_models_cache WHERE provider = ?",
                (provider,),
            ).fetchone()

            if cached:
                models_json, cached_at = cached
                # 24小时内使用缓存
                cached_time = datetime.fromisoformat(cached_at)
                if (datetime.now() - cached_time).total_seconds() < 86400:
                    return json.loads(models_json)

        # 获取用户配置中该提供商的 API Key
        config = conn.execute(
            "SELECT api_key FROM user_config WHERE provider = ? AND is_active = 1 LIMIT 1",
            (provider,),
        ).fetchone()

        api_key = config[0] if config else None

        # TODO: 调用厂商 API 获取模型列表
        # 这里先返回硬编码的模型列表，后续实现真正的 API 调用
        models = _fetch_models_from_provider(provider, api_key)

        # 存入缓存
        conn.execute(
            """INSERT OR REPLACE INTO provider_models_cache 
               (provider, models_json, cached_at) VALUES (?, ?, ?)""",
            (provider, json.dumps(models, ensure_ascii=False), now),
        )

        return models


def refresh_provider_models(provider: str) -> List[str]:
    """强制刷新提供商模型列表"""
    return get_provider_models(provider, force_refresh=True)


def _fetch_models_from_provider(
    provider: str, api_key: Optional[str] = None
) -> List[str]:
    """
    从提供商获取模型列表
    TODO: 实现真正的 API 调用
    """
    # 硬编码的模型列表（后续实现真正的 API 调用）
    MODEL_LISTS = {
        "deepseek": ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
        "kimi": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        "minimax": ["abab6.5s-chat", "abab6.5g-chat"],
        "gemini": ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-1.5-pro"],
        "kling": ["kling-3.0", "kling-1.6", "kling-pro"],
        "volces": ["doubao-lite", "doubao-pro", "doubao-256k"],
        "aliyun": ["qwen-turbo", "qwen-plus", "qwen-max", "wanx-v1", "wanx2.1-t2v-turbo"],
        "openrouter": [
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "anthropic/claude-3-opus",
        ],
        "oneapi": ["gpt-4o", "claude-3-opus"],
        "ollama": ["qwen2.5:latest", "llama3:latest", "mistral:latest"],
    }

    return MODEL_LISTS.get(provider, [])


# ============================================================
# 用户配置 API
# ============================================================


def get_user_configs(user_id: str = "default") -> List[Dict[str, Any]]:
    """获取用户所有配置"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        configs = conn.execute(
            """SELECT id, config_type, provider, api_key, api_secret, model, 
                      base_url, custom_params, is_active, is_default, updated_at
               FROM user_config WHERE user_id = ?""",
            (user_id,),
        ).fetchall()

        result = []
        for row in configs:
            provider_info = PROVIDER_INFO.get(row[2], {})
            result.append(
                {
                    "id": row[0],
                    "config_type": row[1],
                    "provider": row[2],
                    "provider_name": provider_info.get("name", row[2]),
                    "api_key_configured": bool(row[3]),
                    "api_secret_configured": bool(row[4]),
                    "model": row[5],
                    "base_url": row[6],
                    "custom_params": json.loads(row[7]) if row[7] else {},
                    "is_active": bool(row[8]),
                    "is_default": bool(row[9]),
                    "updated_at": row[10],
                }
            )

        return result


def save_user_config(
    user_id: str,
    config_type: str,
    provider: str,
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
    custom_params: Optional[Dict] = None,
    is_default: bool = False,
) -> Dict[str, Any]:
    """保存用户配置"""
    db_path = _get_config_db_path()
    now = datetime.now().isoformat()

    with sqlite3.connect(db_path) as conn:
        # 检查是否已存在
        existing = conn.execute(
            """SELECT id FROM user_config 
               WHERE user_id = ? AND config_type = ? AND provider = ?""",
            (user_id, config_type, provider),
        ).fetchone()

        if existing:
            # 更新
            conn.execute(
                """UPDATE user_config SET 
                   api_key = ?, api_secret = ?, model = ?, base_url = ?,
                   custom_params = ?, is_default = ?, updated_at = ?
                   WHERE user_id = ? AND config_type = ? AND provider = ?""",
                (
                    api_key,
                    api_secret,
                    model,
                    base_url,
                    json.dumps(custom_params, ensure_ascii=False)
                    if custom_params
                    else None,
                    1 if is_default else 0,
                    now,
                    user_id,
                    config_type,
                    provider,
                ),
            )
        else:
            # 插入
            conn.execute(
                """INSERT INTO user_config 
                   (user_id, config_type, provider, api_key, api_secret, model, base_url, 
                    custom_params, is_default, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_id,
                    config_type,
                    provider,
                    api_key,
                    api_secret,
                    model,
                    base_url,
                    json.dumps(custom_params, ensure_ascii=False)
                    if custom_params
                    else None,
                    1 if is_default else 0,
                    now,
                    now,
                ),
            )

    return {"success": True, "message": "配置已保存"}


def delete_user_config(user_id: str, config_id: int) -> Dict[str, Any]:
    """删除用户配置"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "DELETE FROM user_config WHERE id = ? AND user_id = ?", (config_id, user_id)
        )

    return {"success": True, "message": "配置已删除"}


# ============================================================
# 套餐 API
# ============================================================


def get_preset_packages() -> List[Dict[str, Any]]:
    """获取预设套餐列表"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        packages = conn.execute(
            "SELECT id, name, icon, description, services_json, sort_order FROM preset_packages ORDER BY sort_order"
        ).fetchall()

        result = []
        for row in packages:
            result.append(
                {
                    "id": row[0],
                    "name": row[1],
                    "icon": row[2],
                    "description": row[3],
                    "services": json.loads(row[4]),
                }
            )

        return result


# ============================================================
# 启动时初始化
# ============================================================

init_config_db()
