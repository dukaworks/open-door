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
import base64
from datetime import datetime
from typing import Optional, List, Dict, Any

# ============================================================
# 加密工具（简单加密，生产环境应使用更安全的方案）
# ============================================================

_encryption_key = os.environ.get("OPEN_DOOR_KEY", "default-key-please-change-in-production")

def _get_xor_cipher(text: str, key: str) -> str:
    """简单的 XOR 加密/解密（可逆）"""
    result = []
    for i, c in enumerate(text):
        key_c = key[i % len(key)]
        result.append(chr(ord(c) ^ ord(key_c)))
    return ''.join(result)

def encrypt_value(value: Optional[str]) -> Optional[str]:
    """加密敏感值"""
    if not value:
        return None
    try:
        cipher = _get_xor_cipher(value, _encryption_key)
        return base64.b64encode(cipher.encode()).decode()
    except Exception:
        return None

def decrypt_value(encrypted: Optional[str]) -> Optional[str]:
    """解密敏感值（兼容明文存储的旧数据）"""
    if not encrypted:
        return None
    try:
        cipher = base64.b64decode(encrypted.encode()).decode()
        return _get_xor_cipher(cipher, _encryption_key)
    except Exception:
        # 解密失败，可能是明文存储的旧数据，直接返回原值
        return encrypted

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

# 预设服务商（共10个，不含Cliproxy发布时删除）
PRESET_PROVIDERS = [
    # 国际主流
    {
        "id": "openai",
        "name": "OpenAI",
        "description": "全球领先AI模型，ChatGPT、DALL·E、Whisper",
        "base_url": "https://api.openai.com/v1",
        "requires_secret": False,
    },
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "description": "性价比最高，适合脚本生成",
        "base_url": "https://api.deepseek.com/v1",
        "requires_secret": False,
    },
    {
        "id": "gemini",
        "name": "Google Gemini",
        "description": "多模态理解，支持图片/视频输入转脚本",
        "base_url": "https://generativelanguage.googleapis.com/v1",
        "requires_secret": False,
    },
    # 国内主流
    {
        "id": "kimi",
        "name": "Kimi (Moonshot)",
        "description": "适合长文本处理，小说/剧本转分镜脚本",
        "base_url": "https://api.moonshot.cn/v1",
        "requires_secret": False,
    },
    {
        "id": "minimax",
        "name": "MiniMax",
        "description": "对话与情绪表达最强，适合情感类内容",
        "base_url": "https://api.minimax.chat/v1",
        "requires_secret": False,
    },
    # 聚合平台
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "description": "支持 100+ 模型，一键切换",
        "base_url": "https://openrouter.ai/api/v1",
        "requires_secret": False,
    },
    {
        "id": "ollama",
        "name": "Ollama (本地)",
        "description": "本地部署，无需网络",
        "base_url": "http://localhost:11434/v1",
        "requires_secret": False,
    },
    # 三大云服务商
    {
        "id": "aliyun",
        "name": "阿里云百炼",
        "description": "通义千问/万相/听悟全系列",
        "base_url": "https://dashscope.aliyuncs.com/api/v1",
        "requires_secret": False,
    },
    {
        "id": "volces",
        "name": "字节火山方舟",
        "description": "Doubao大模型/混元视频/语音合成",
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "requires_secret": False,
    },
    {
        "id": "kling",
        "name": "可灵",
        "description": "可灵视频生成模型",
        "base_url": "https://api.klingai.com/v1",
        "requires_secret": False,
    },
    {
        "id": "tencent",
        "name": "腾讯混元",
        "description": "混元大模型/文生图/视频/语音全系列",
        "base_url": "https://hunyuan.cloud.tencent.com/hyllm/v1",
        "requires_secret": False,
    },
    # 自建调试平台（发布时删除）
    {
        "id": "cliproxy",
        "name": "Cliproxy (内部调试)",
        "description": "自建API聚合服务平台，仅用于开发调试",
        "base_url": "https://cliproxy.internal/api/v1",
        "requires_secret": False,
    },
]

# 预设模型（为所有保留的提供商添加热门模型）
PRESET_MODELS = [
    # ==================== OpenAI Models ====================
    {"id": "gpt-4o", "name": "GPT-4o", "model_id": "gpt-4o", "provider_id": "openai", "model_type": "llm"},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "model_id": "gpt-4o-mini", "provider_id": "openai", "model_type": "llm"},
    {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "model_id": "gpt-4-turbo", "provider_id": "openai", "model_type": "llm"},
    {"id": "dall-e-3", "name": "DALL·E 3", "model_id": "dall-e-3", "provider_id": "openai", "model_type": "image", "output_resolution": "1024x1024"},
    {"id": "whisper-1", "name": "Whisper", "model_id": "whisper-1", "provider_id": "openai", "model_type": "tts", "voice": "alloy", "speed": 1.0, "emotion": "neutral"},

    # ==================== DeepSeek Models ====================
    {"id": "deepseek-chat", "name": "DeepSeek Chat", "model_id": "deepseek-chat", "provider_id": "deepseek", "model_type": "llm"},
    {"id": "deepseek-coder", "name": "DeepSeek Coder", "model_id": "deepseek-coder", "provider_id": "deepseek", "model_type": "llm"},
    {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner", "model_id": "deepseek-reasoner", "provider_id": "deepseek", "model_type": "llm"},

    # ==================== Gemini Models ====================
    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "model_id": "gemini-2.0-flash", "provider_id": "gemini", "model_type": "llm"},
    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "model_id": "gemini-1.5-pro", "provider_id": "gemini", "model_type": "llm"},
    {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "model_id": "gemini-1.5-flash", "provider_id": "gemini", "model_type": "llm"},

    # ==================== Kimi Models ====================
    {"id": "moonshot-v1-8k", "name": "Kimi 8K", "model_id": "moonshot-v1-8k", "provider_id": "kimi", "model_type": "llm"},
    {"id": "moonshot-v1-32k", "name": "Kimi 32K", "model_id": "moonshot-v1-32k", "provider_id": "kimi", "model_type": "llm"},
    {"id": "moonshot-v1-128k", "name": "Kimi 128K", "model_id": "moonshot-v1-128k", "provider_id": "kimi", "model_type": "llm"},

    # ==================== MiniMax Models ====================
    {"id": "abab6.5s-chat", "name": "MiniMax 6.5s", "model_id": "abab6.5s-chat", "provider_id": "minimax", "model_type": "llm"},
    {"id": "abab6.5t-chat", "name": "MiniMax 6.5t", "model_id": "abab6.5t-chat", "provider_id": "minimax", "model_type": "llm"},
    {"id": "speech-02-hd", "name": "MiniMax TTS HD", "model_id": "speech-02-hd", "provider_id": "minimax", "model_type": "tts", "voice": "female-shaonv", "speed": 1.0, "emotion": "neutral"},

    # ==================== OpenRouter Models ====================
    {"id": "openrouter-gpt-4o", "name": "GPT-4o (via OpenRouter)", "model_id": "openai/gpt-4o", "provider_id": "openrouter", "model_type": "llm"},
    {"id": "openrouter-claude-3.5", "name": "Claude 3.5 Sonnet", "model_id": "anthropic/claude-3.5-sonnet", "provider_id": "openrouter", "model_type": "llm"},
    {"id": "openrouter-gemini-pro", "name": "Gemini Pro", "model_id": "google/gemini-pro", "provider_id": "openrouter", "model_type": "llm"},

    # ==================== Ollama Models ====================
    {"id": "ollama-llama3", "name": "Llama 3", "model_id": "llama3", "provider_id": "ollama", "model_type": "llm"},
    {"id": "ollama-mistral", "name": "Mistral", "model_id": "mistral", "provider_id": "ollama", "model_type": "llm"},
    {"id": "ollama-codellama", "name": "Code Llama", "model_id": "codellama", "provider_id": "ollama", "model_type": "llm"},

    # ==================== 阿里云百炼 Models ====================
    {"id": "qwen-turbo", "name": "通义千问 Turbo", "model_id": "qwen-turbo", "provider_id": "aliyun", "model_type": "llm"},
    {"id": "qwen-plus", "name": "通义千问 Plus", "model_id": "qwen-plus", "provider_id": "aliyun", "model_type": "llm"},
    {"id": "qwen-max", "name": "通义千问 Max", "model_id": "qwen-max", "provider_id": "aliyun", "model_type": "llm"},
    {"id": "qwen-vl-max", "name": "通义千问 VL Max", "model_id": "qwen-vl-max", "provider_id": "aliyun", "model_type": "llm"},
    {"id": "wanx-v1", "name": "通义万相 图像", "model_id": "wanx-v1", "provider_id": "aliyun", "model_type": "image", "output_resolution": "4K"},
    {"id": "wanx2.1-t2v-turbo", "name": "通义万相 视频 Turbo", "model_id": "wanx2.1-t2v-turbo", "provider_id": "aliyun", "model_type": "video", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "cosyvoice-v1", "name": "通义听悟", "model_id": "cosyvoice-v1", "provider_id": "aliyun", "model_type": "tts", "voice": "zhitian_emo", "speed": 1.0, "emotion": "neutral"},

    # ==================== 字节火山方舟 Models ====================
    {"id": "doubao-lite", "name": "豆包 Lite", "model_id": "doubao-lite-4k", "provider_id": "volces", "model_type": "llm"},
    {"id": "doubao-pro", "name": "豆包 Pro", "model_id": "doubao-pro-32k", "provider_id": "volces", "model_type": "llm"},
    {"id": "doubao-256k", "name": "豆包 256K", "model_id": "doubao-pro-256k", "provider_id": "volces", "model_type": "llm"},
    {"id": "volces-tts", "name": "火山语音", "model_id": "volces-tts-v1", "provider_id": "volces", "model_type": "tts", "voice": "zh_female_qingxin", "speed": 1.0, "emotion": "neutral"},

    # ==================== Kling AI Models ====================
    {"id": "kling-3.0", "name": "可灵", "model_id": "kling-3.0", "provider_id": "kling", "model_type": "video", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "kling-3.0-pro", "name": "可灵 Pro", "model_id": "kling-3.0-pro", "provider_id": "kling", "model_type": "video", "duration": 10, "ratio": "16:9", "quality": "high"},
    {"id": "kling-3.0-4k", "name": "可灵 4K", "model_id": "kling-3.0-4k", "provider_id": "kling", "model_type": "video", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "kling-1.6", "name": "可灵 1.6", "model_id": "kling-1.6", "provider_id": "kling", "model_type": "video", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "kling-pro", "name": "可灵 Pro", "model_id": "kling-pro", "provider_id": "kling", "model_type": "video", "duration": 10, "ratio": "16:9", "quality": "high"},
    {"id": "kling-omni", "name": "可灵 Omni", "model_id": "kling-omni", "provider_id": "kling", "model_type": "video", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "kling-3.0-5s", "name": "可灵 (5秒)", "model_id": "kling-3.0", "provider_id": "kling", "model_type": "video", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "kling-3.0-10s", "name": "可灵 (10秒)", "model_id": "kling-3.0", "provider_id": "kling", "model_type": "video", "duration": 10, "ratio": "16:9", "quality": "high"},
    {"id": "kling-3.0-9-16", "name": "可灵 (9:16)", "model_id": "kling-3.0", "provider_id": "kling", "model_type": "video", "duration": 5, "ratio": "9:16", "quality": "high"},
    {"id": "kling-3.0-1-1", "name": "可灵 (1:1)", "model_id": "kling-3.0", "provider_id": "kling", "model_type": "video", "duration": 5, "ratio": "1:1", "quality": "high"},
    {"id": "kling-1.6-5s", "name": "可灵 1.6 (5秒)", "model_id": "kling-1.6", "provider_id": "kling", "model_type": "video", "duration": 5, "ratio": "16:9", "quality": "standard"},
    {"id": "kling-1.6-10s", "name": "可灵 1.6 (10秒)", "model_id": "kling-1.6", "provider_id": "kling", "model_type": "video", "duration": 10, "ratio": "16:9", "quality": "standard"},

    # ==================== 腾讯混元 Models ====================
    {"id": "hunyuan-lite", "name": "混元 Lite", "model_id": "hunyuan-lite", "provider_id": "tencent", "model_type": "llm"},
    {"id": "hunyuan-standard", "name": "混元 Standard", "model_id": "hunyuan-standard", "provider_id": "tencent", "model_type": "llm"},
    {"id": "hunyuan-pro", "name": "混元 Pro", "model_id": "hunyuan-pro", "provider_id": "tencent", "model_type": "llm"},
    {"id": "hunyuan-image", "name": "混元文生图", "model_id": "hunyuan-vision", "provider_id": "tencent", "model_type": "image", "output_resolution": "1024x1024"},
    {"id": "hunyuan-video", "name": "混元视频", "model_id": "hunyuan-video", "provider_id": "tencent", "model_type": "video", "duration": 5, "ratio": "16:9", "quality": "high"},
    {"id": "hunyuan-tts", "name": "混元语音", "model_id": "hunyuan-tts-v1", "provider_id": "tencent", "model_type": "tts", "voice": "101001", "speed": 1.0, "emotion": "neutral"},

    # ==================== Cliproxy (内部调试) ====================
    {"id": "cliproxy-test", "name": "Cliproxy Test", "model_id": "cliproxy-test", "provider_id": "cliproxy", "model_type": "llm"},
]

# 预设套餐
PRESET_PACKAGES = [
    # ==================== 阿里云百炼套餐 ====================
    {
        "id": "aliyun-express",
        "name": "百炼-快速套餐",
        "icon": "☁️",
        "description": "阿里云百炼快速入门，性价比之选",
        "services": {
            "llm": {"provider_id": "aliyun", "model_id": "qwen-turbo"},
            "video": {"provider_id": "aliyun", "model_id": "wanx2.1-t2v-turbo"},
            "image": {"provider_id": "aliyun", "model_id": "wanx-v1"},
            "tts": {"provider_id": "aliyun", "model_id": "cosyvoice-v1"},
        },
    },
    {
        "id": "aliyun-pro",
        "name": "百炼-专业套餐",
        "icon": "🌤️",
        "description": "阿里云百炼专业版，全功能解锁",
        "services": {
            "llm": {"provider_id": "aliyun", "model_id": "qwen-max"},
            "video": {"provider_id": "aliyun", "model_id": "wanx2.1-t2v-turbo"},
            "image": {"provider_id": "aliyun", "model_id": "wanx-v1"},
            "tts": {"provider_id": "aliyun", "model_id": "cosyvoice-v1"},
        },
    },

    # ==================== 字节火山方舟套餐 ====================
    {
        "id": "volces-express",
        "name": "方舟-Express",
        "icon": "🚀",
        "description": "字节火山方舟快速版，极速体验",
        "services": {
            "llm": {"provider_id": "volces", "model_id": "doubao-lite"},
            "video": {"provider_id": "aliyun", "model_id": "wanx2.1-t2v-turbo"},
            "image": {"provider_id": "aliyun", "model_id": "wanx-v1"},
            "tts": {"provider_id": "volces", "model_id": "volces-tts"},
        },
    },
    {
        "id": "volces-pro",
        "name": "方舟-专业套餐",
        "icon": "🌟",
        "description": "字节火山方舟专业版，256K长文本",
        "services": {
            "llm": {"provider_id": "volces", "model_id": "doubao-256k"},
            "video": {"provider_id": "aliyun", "model_id": "wanx2.1-t2v-turbo"},
            "image": {"provider_id": "aliyun", "model_id": "wanx-v1"},
            "tts": {"provider_id": "volces", "model_id": "volces-tts"},
        },
    },

    # ==================== 腾讯混元套餐 ====================
    {
        "id": "tencent-express",
        "name": "腾讯-Express",
        "icon": "🎯",
        "description": "腾讯混元快速入门，稳定可靠",
        "services": {
            "llm": {"provider_id": "tencent", "model_id": "hunyuan-lite"},
            "video": {"provider_id": "tencent", "model_id": "hunyuan-video"},
            "image": {"provider_id": "tencent", "model_id": "hunyuan-image"},
            "tts": {"provider_id": "tencent", "model_id": "hunyuan-tts"},
        },
    },
    {
        "id": "tencent-pro",
        "name": "腾讯-专业套餐",
        "icon": "💎",
        "description": "腾讯混元专业版，全功能体验",
        "services": {
            "llm": {"provider_id": "tencent", "model_id": "hunyuan-pro"},
            "video": {"provider_id": "tencent", "model_id": "hunyuan-video"},
            "image": {"provider_id": "tencent", "model_id": "hunyuan-image"},
            "tts": {"provider_id": "tencent", "model_id": "hunyuan-tts"},
        },
    },
]

# 用户自定义提供商示例（测试数据，不含 provider_type）
USER_PROVIDERS = [
    {
        "id": "openai-compat",
        "name": "OpenAI 兼容",
        "description": "兼容OpenAI API格式的自定义服务",
        "base_url": "https://api.openai.com/v1",
        "requires_secret": False,
    },
    {
        "id": "local-ollama",
        "name": "本地 Ollama",
        "description": "本地运行的Ollama服务",
        "base_url": "http://localhost:11434/v1",
        "requires_secret": False,
    },
]

# 用户自定义套餐示例（测试数据）
USER_PACKAGES = [
    {
        "id": "xiaoming-work",
        "name": "小明工作流",
        "icon": "💼",
        "description": "DeepSeek+阿里视频，性价比最高的工作组合",
        "services": {
            "llm": {"provider_id": "deepseek", "model_id": "deepseek-chat"},
            "video": {"provider_id": "aliyun", "model_id": "wanx2.1-t2v-turbo"},
            "image": {"provider_id": "aliyun", "model_id": "wanx-v1"},
            "tts": {"provider_id": "minimax", "model_id": "speech-02-hd"},
        },
        "created_by": "user_xiaoming",
    },
    {
        "id": "short-video",
        "name": "短视频专用",
        "icon": "📱",
        "description": "MiniMax+Kling视频，情绪表达+动作流畅",
        "services": {
            "llm": {"provider_id": "minimax", "model_id": "abab6.5s-chat"},
            "video": {"provider_id": "kling", "model_id": "kling-3.0"},
            "image": {"provider_id": "aliyun", "model_id": "wanx-v1"},
            "tts": {"provider_id": "minimax", "model_id": "speech-02-hd"},
        },
        "created_by": "user_creator",
    },
    {
        "id": "novel-adapt",
        "name": "小说改编套餐",
        "icon": "📚",
        "description": "Kimi长文本+阿里视频，小说转短视频",
        "services": {
            "llm": {"provider_id": "kimi", "model_id": "moonshot-v1-128k"},
            "video": {"provider_id": "aliyun", "model_id": "wanx2.1-t2v-turbo"},
            "image": {"provider_id": "aliyun", "model_id": "wanx-v1"},
            "tts": {"provider_id": "minimax", "model_id": "speech-02-hd"},
        },
        "created_by": "user_writer",
    },
]


# ============================================================
# 初始化
# ============================================================


def init_config_db_v3():
    """初始化配置数据库 v3"""
    db_path = _get_config_db_path()
    
    with sqlite3.connect(db_path) as conn:
        # 1. Providers 表（移除 provider_type 字段）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
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
        
        # 3. Models 表（添加 model_type 字段）
        conn.execute("""
            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                model_id TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                model_type TEXT NOT NULL,
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
    
    # 插入 Providers（不含 provider_type）
    for provider in PRESET_PROVIDERS:
        existing = conn.execute(
            "SELECT id FROM providers WHERE id = ?", (provider["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO providers
                   (id, name, description, base_url, requires_secret)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    provider["id"],
                    provider["name"],
                    provider["description"],
                    provider["base_url"],
                    1 if provider["requires_secret"] else 0,
                ),
            )
    
    # 插入 Models（含 model_type）
    for model in PRESET_MODELS:
        existing = conn.execute(
            "SELECT id FROM models WHERE id = ?", (model["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO models
                   (id, name, model_id, provider_id, model_type, duration, ratio, quality,
                    output_resolution, voice, speed, emotion, cached_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    model["id"],
                    model["name"],
                    model["model_id"],
                    model["provider_id"],
                    model["model_type"],
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
    
    # 插入 Providers（预设，不含 provider_type）
    for provider in PRESET_PROVIDERS:
        existing = conn.execute(
            "SELECT id FROM providers WHERE id = ?", (provider["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO providers
                   (id, name, description, base_url, requires_secret, is_preset, created_by)
                   VALUES (?, ?, ?, ?, ?, 1, 'system')""",
                (
                    provider["id"],
                    provider["name"],
                    provider["description"],
                    provider["base_url"],
                    1 if provider["requires_secret"] else 0,
                ),
            )
    
    # 插入用户自定义提供商示例（不含 provider_type）
    for provider in USER_PROVIDERS:
        existing = conn.execute(
            "SELECT id FROM providers WHERE id = ?", (provider["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO providers
                   (id, name, description, base_url, requires_secret, is_preset, created_by)
                   VALUES (?, ?, ?, ?, ?, 0, 'user')""",
                (
                    provider["id"],
                    provider["name"],
                    provider["description"],
                    provider["base_url"],
                    1 if provider["requires_secret"] else 0,
                ),
            )
    
    # 插入 Packages（预设）
    for package in PRESET_PACKAGES:
        existing = conn.execute(
            "SELECT id FROM packages WHERE id = ?", (package["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO packages 
                   (id, name, icon, description, services_json, is_preset, created_by)
                   VALUES (?, ?, ?, ?, ?, 1, 'system')""",
                (
                    package["id"],
                    package["name"],
                    package["icon"],
                    package["description"],
                    json.dumps(package["services"], ensure_ascii=False),
                ),
            )
    
    # 插入用户自定义套餐示例
    for package in USER_PACKAGES:
        existing = conn.execute(
            "SELECT id FROM packages WHERE id = ?", (package["id"],)
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO packages 
                   (id, name, icon, description, services_json, is_preset, created_by)
                   VALUES (?, ?, ?, ?, ?, 0, ?)""",
                (
                    package["id"],
                    package["name"],
                    package["icon"],
                    package["description"],
                    json.dumps(package["services"], ensure_ascii=False),
                    package.get("created_by", "user"),
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
    """获取所有服务商（不含 provider_type）"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """SELECT id, name, description, base_url,
                      is_preset, requires_secret, status
               FROM providers WHERE status = 'active' ORDER BY name"""
        ).fetchall()

        return [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2],
                "base_url": row[3],
                "is_preset": bool(row[4]),
                "requires_secret": bool(row[5]),
                "status": row[6],
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
    """保存用户的提供商配置（API Key 和 Secret 会被加密）"""
    db_path = _get_config_db_path()
    now = datetime.now().isoformat()
    
    # 加密敏感数据
    encrypted_api_key = encrypt_value(api_key)
    encrypted_api_secret = encrypt_value(api_secret)
    
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
                    encrypted_api_key,
                    encrypted_api_secret,
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
                    encrypted_api_key,
                    encrypted_api_secret,
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
    """获取服务商的模型列表（含 model_type）"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """SELECT id, name, model_id, model_type, duration, ratio, quality,
                      output_resolution, voice, speed, emotion, is_preset
               FROM models WHERE provider_id = ? ORDER BY model_type, is_preset DESC, name""",
            (provider_id,),
        ).fetchall()

        return [
            {
                "id": row[0],
                "name": row[1],
                "model_id": row[2],
                "model_type": row[3],
                "duration": row[4],
                "ratio": row[5],
                "quality": row[6],
                "output_resolution": row[7],
                "voice": row[8],
                "speed": row[9],
                "emotion": row[10],
                "is_preset": bool(row[11]),
            }
            for row in rows
        ]


def get_all_models() -> List[Dict[str, Any]]:
    """获取所有模型列表（含 model_type 和 provider_id）"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """SELECT m.id, m.name, m.model_id, m.model_type, m.duration, m.ratio, m.quality,
                      m.output_resolution, m.voice, m.speed, m.emotion, m.is_preset, m.provider_id, p.name as provider_name
               FROM models m
               JOIN providers p ON m.provider_id = p.id
               ORDER BY m.model_type, m.is_preset DESC, p.name, m.name"""
        ).fetchall()

        return [
            {
                "id": row[0],
                "name": row[1],
                "model_id": row[2],
                "model_type": row[3],
                "duration": row[4],
                "ratio": row[5],
                "quality": row[6],
                "output_resolution": row[7],
                "voice": row[8],
                "speed": row[9],
                "emotion": row[10],
                "is_preset": bool(row[11]),
                "provider_id": row[12],
                "provider_name": row[13],
            }
            for row in rows
        ]


def reset_preset_models():
    """重置预设模型数据（删除所有模型后重新插入）"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        # 删除所有模型
        conn.execute("DELETE FROM models")
        # 重新插入预设模型
        for model in PRESET_MODELS:
            conn.execute(
                """INSERT INTO models
                   (id, name, model_id, provider_id, model_type, duration, ratio, quality,
                    output_resolution, voice, speed, emotion, is_preset, cached_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
                (
                    model.get("id"),
                    model.get("name"),
                    model.get("model_id"),
                    model.get("provider_id"),
                    model.get("model_type"),
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
        conn.commit()
        return len(PRESET_MODELS)


def reset_all_preset_data():
    """重置所有预设数据（删除所有提供商、模型、套餐后重新插入）"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        # 删除所有模型（先删，因为有外键约束）
        conn.execute("DELETE FROM models")

        # 删除所有套餐（先删，因为有外键约束）
        conn.execute("DELETE FROM packages")

        # 删除所有预设提供商和所有在预设列表中的提供商
        preset_provider_ids = [p["id"] for p in PRESET_PROVIDERS]
        if preset_provider_ids:
            placeholders = ",".join("?" * len(preset_provider_ids))
            conn.execute(
                f"DELETE FROM providers WHERE id IN ({placeholders})",
                preset_provider_ids
            )

        # 重新插入预设提供商
        for provider in PRESET_PROVIDERS:
            conn.execute(
                """INSERT OR REPLACE INTO providers
                   (id, name, description, base_url, is_preset, requires_secret)
                   VALUES (?, ?, ?, ?, 1, ?)""",
                (
                    provider["id"],
                    provider["name"],
                    provider["description"],
                    provider["base_url"],
                    1 if provider["requires_secret"] else 0,
                ),
            )

        # 重新插入预设模型
        for model in PRESET_MODELS:
            conn.execute(
                """INSERT OR REPLACE INTO models
                   (id, name, model_id, provider_id, model_type, duration, ratio, quality,
                    output_resolution, voice, speed, emotion, is_preset, cached_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
                (
                    model.get("id"),
                    model.get("name"),
                    model.get("model_id"),
                    model.get("provider_id"),
                    model.get("model_type"),
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

        # 重新插入预设套餐
        for package in PRESET_PACKAGES:
            conn.execute(
                """INSERT OR REPLACE INTO packages
                   (id, name, icon, description, is_preset, services_json, created_by)
                   VALUES (?, ?, ?, ?, 1, ?, 'system')""",
                (
                    package["id"],
                    package["name"],
                    package.get("icon", "📦"),
                    package.get("description", ""),
                    json.dumps(package["services"], ensure_ascii=False),
                ),
            )

        conn.commit()

        return {
            "providers": len(PRESET_PROVIDERS),
            "models": len(PRESET_MODELS),
            "packages": len(PRESET_PACKAGES),
        }


def create_model(
    id: str,
    name: str,
    model_id: str,
    provider_id: str,
    model_type: str,
    duration: Optional[int] = None,
    ratio: Optional[str] = None,
    quality: Optional[str] = None,
    output_resolution: Optional[str] = None,
    voice: Optional[str] = None,
    speed: Optional[float] = None,
    emotion: Optional[str] = None,
) -> Dict[str, Any]:
    """创建新模型（自定义，含 model_type）"""
    db_path = _get_config_db_path()

    with sqlite3.connect(db_path) as conn:
        # 检查ID是否已存在
        existing = conn.execute(
            "SELECT id FROM models WHERE id = ?", (id,)
        ).fetchone()
        if existing:
            raise ValueError(f"模型ID '{id}' 已存在")

        conn.execute(
            """INSERT INTO models
               (id, name, model_id, provider_id, model_type, duration, ratio, quality,
                output_resolution, voice, speed, emotion, is_preset, cached_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
            (
                id,
                name,
                model_id,
                provider_id,
                model_type,
                duration,
                ratio,
                quality,
                output_resolution,
                voice,
                speed,
                emotion,
                datetime.now().isoformat(),
            ),
        )

        return {"id": id, "name": name, "success": True}


def update_model(
    model_id: str,
    name: Optional[str] = None,
    model_id_field: Optional[str] = None,
    model_type: Optional[str] = None,
    duration: Optional[int] = None,
    ratio: Optional[str] = None,
    quality: Optional[str] = None,
    output_resolution: Optional[str] = None,
    voice: Optional[str] = None,
    speed: Optional[float] = None,
    emotion: Optional[str] = None,
) -> Dict[str, Any]:
    """更新模型（仅允许更新自定义模型，含 model_type）"""
    db_path = _get_config_db_path()

    with sqlite3.connect(db_path) as conn:
        # 检查是否是预设模型
        row = conn.execute(
            "SELECT is_preset FROM models WHERE id = ?", (model_id,)
        ).fetchone()

        if not row:
            raise ValueError(f"模型 '{model_id}' 不存在")

        if row[0]:
            raise ValueError("预设模型不能修改")

        # 构建更新字段
        updates = []
        params = []
        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if model_id_field is not None:
            updates.append("model_id = ?")
            params.append(model_id_field)
        if model_type is not None:
            updates.append("model_type = ?")
            params.append(model_type)
        if duration is not None:
            updates.append("duration = ?")
            params.append(duration)
        if ratio is not None:
            updates.append("ratio = ?")
            params.append(ratio)
        if quality is not None:
            updates.append("quality = ?")
            params.append(quality)
        if output_resolution is not None:
            updates.append("output_resolution = ?")
            params.append(output_resolution)
        if voice is not None:
            updates.append("voice = ?")
            params.append(voice)
        if speed is not None:
            updates.append("speed = ?")
            params.append(speed)
        if emotion is not None:
            updates.append("emotion = ?")
            params.append(emotion)

        if not updates:
            return {"success": True, "message": "无需更新"}

        params.append(model_id)
        conn.execute(
            f"UPDATE models SET {', '.join(updates)} WHERE id = ?",
            params,
        )

        return {"success": True, "message": "模型已更新"}


def delete_model(model_id: str) -> bool:
    """删除模型（仅允许删除自定义模型）"""
    db_path = _get_config_db_path()

    with sqlite3.connect(db_path) as conn:
        # 检查是否是预设模型
        row = conn.execute(
            "SELECT is_preset FROM models WHERE id = ?", (model_id,)
        ).fetchone()

        if not row:
            raise ValueError(f"模型 '{model_id}' 不存在")

        if row[0]:
            raise ValueError("预设模型不能删除")

        conn.execute("DELETE FROM models WHERE id = ?", (model_id,))
        return True


# ============================================================
# Packages API
# ============================================================


def get_all_packages() -> List[Dict[str, Any]]:
    """获取所有套餐"""
    db_path = _get_config_db_path()
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """SELECT id, name, icon, description, is_preset, services_json, created_by
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
                "created_by": row[6],
            }
            for row in rows
        ]


def create_package(
    id: str,
    name: str,
    icon: str,
    description: str,
    services: Dict[str, Any],
    created_by: str = "user"
) -> Dict[str, Any]:
    """创建新套餐"""
    db_path = _get_config_db_path()
    
    with sqlite3.connect(db_path) as conn:
        # 检查ID是否已存在
        existing = conn.execute(
            "SELECT id FROM packages WHERE id = ?", (id,)
        ).fetchone()
        if existing:
            raise ValueError(f"套餐ID '{id}' 已存在")
        
        conn.execute(
            """INSERT INTO packages 
               (id, name, icon, description, services_json, is_preset, created_by)
               VALUES (?, ?, ?, ?, ?, 0, ?)""",
            (id, name, icon, description, json.dumps(services, ensure_ascii=False), created_by),
        )
        
        return {"id": id, "name": name, "success": True}


def delete_package(package_id: str) -> bool:
    """删除套餐（仅允许删除非预设套餐）"""
    db_path = _get_config_db_path()
    
    with sqlite3.connect(db_path) as conn:
        # 检查是否是预设套餐
        row = conn.execute(
            "SELECT is_preset FROM packages WHERE id = ?", (package_id,)
        ).fetchone()
        
        if not row:
            raise ValueError(f"套餐 '{package_id}' 不存在")
        
        if row[0]:
            raise ValueError("预设套餐不能删除")

        conn.execute("DELETE FROM packages WHERE id = ?", (package_id,))
        return True


def update_package(
    package_id: str,
    name: str,
    icon: str,
    description: str,
    services: Dict[str, Any],
) -> Dict[str, Any]:
    """更新套餐（仅允许更新非预设套餐）"""
    db_path = _get_config_db_path()

    with sqlite3.connect(db_path) as conn:
        # 检查套餐是否存在以及是否是预设套餐
        row = conn.execute(
            "SELECT is_preset FROM packages WHERE id = ?", (package_id,)
        ).fetchone()

        if not row:
            raise ValueError(f"套餐 '{package_id}' 不存在")

        if row[0]:
            raise ValueError("预设套餐不能修改")

        # 更新套餐
        conn.execute(
            """UPDATE packages
               SET name = ?, icon = ?, description = ?, services_json = ?
               WHERE id = ?""",
            (name, icon, description, json.dumps(services, ensure_ascii=False), package_id),
        )

        return {"id": package_id, "name": name, "success": True}


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
        # 获取第一个预设套餐
        package_row = conn.execute(
            "SELECT id, services_json FROM packages WHERE is_preset = 1 ORDER BY id LIMIT 1"
        ).fetchone()

        if not package_row:
            raise ValueError("数据库中没有预设套餐，请先初始化数据库")

        package_id = package_row[0]
        services = json.loads(package_row[1])

        # 使用套餐中的配置创建默认用户配置
        conn.execute(
            """INSERT INTO user_configs
               (user_id, package_id, llm_provider_id, llm_model_id,
                video_provider_id, video_model_id, image_provider_id,
                tts_provider_id, tts_model_id, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                package_id,
                services.get("llm", {}).get("provider_id", "deepseek"),
                services.get("llm", {}).get("model_id", "deepseek-chat"),
                services.get("video", {}).get("provider_id", "aliyun"),
                services.get("video", {}).get("model_id", "wanx2.1-t2v-turbo"),
                services.get("image", {}).get("provider_id", "aliyun"),
                services.get("tts", {}).get("provider_id", "minimax"),
                services.get("tts", {}).get("model_id", "speech-01"),
                now,
            ),
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

def init_config_db_v3_with_force():
    """强制重新初始化，确保测试数据存在"""
    db_path = _get_config_db_path()
    
    with sqlite3.connect(db_path) as conn:
        # 检查是否已有用户自定义套餐
        count = conn.execute("SELECT COUNT(*) FROM packages WHERE is_preset = 0").fetchone()[0]
        
        if count == 0:
            # 插入用户自定义套餐示例
            for package in USER_PACKAGES:
                existing = conn.execute(
                    "SELECT id FROM packages WHERE id = ?", (package["id"],)
                ).fetchone()
                if not existing:
                    conn.execute(
                        """INSERT INTO packages 
                           (id, name, icon, description, services_json, is_preset, created_by)
                           VALUES (?, ?, ?, ?, ?, 0, ?)""",
                        (
                            package["id"],
                            package["name"],
                            package["icon"],
                            package["description"],
                            json.dumps(package["services"], ensure_ascii=False),
                            package.get("created_by", "user"),
                        ),
                    )
            print(f"[init_config_db_v3] 已添加 {len(USER_PACKAGES)} 个测试套餐")

init_config_db_v3()
init_config_db_v3_with_force()
