"""
芝麻开门 Open-Door
Settings System v3.0 - 配置管理 API

RESTful API 端点：
- /api/v3/providers - 服务商管理
- /api/v3/packages - 套餐管理
- /api/v3/user/config - 用户配置
- /api/v3/system/settings - 系统设置
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status

# 导入认证模块
from api.auth import get_current_user, TokenData

# 导入数据库模块
from api.config_db_v3 import (
    get_all_providers,
    get_user_providers,
    save_user_provider_config,
    get_models_by_provider,
    get_all_models,
    reset_preset_models,
    reset_all_preset_data,
    create_model,
    update_model,
    delete_model,
    get_all_packages,
    create_package,
    update_package,
    delete_package,
    get_user_config,
    create_default_user_config,
    get_system_setting,
    set_system_setting,
)

# ============================================================
# 请求/响应模型
# ============================================================


class ProviderConfigRequest(BaseModel):
    """保存服务商配置请求"""
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    base_url: Optional[str] = None
    is_active: bool = True
    is_default: bool = False


class ProviderConfigResponse(BaseModel):
    """获取服务商配置响应（解密后）"""
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    base_url: Optional[str] = None
    is_active: bool = False


class ProviderModelsResponse(BaseModel):
    """从提供商API获取的模型列表响应"""
    models: List[str]
    source: str  # "api" | "cache" | "fallback"
    cached_at: Optional[str] = None
    is_default: bool = False


class ProviderTestResponse(BaseModel):
    """服务商测试响应"""
    success: bool
    message: str
    latency_ms: Optional[int] = None


class ProviderResponse(BaseModel):
    """服务商响应（不含 provider_type）"""
    id: str
    name: str
    description: str
    base_url: str
    is_preset: bool
    requires_secret: bool
    api_key_configured: bool = False
    api_secret_configured: bool = False
    is_active: bool = False
    is_default: bool = False


class ModelResponse(BaseModel):
    """模型响应（含 model_type）"""
    id: str
    name: str
    model_id: str
    model_type: str
    duration: Optional[int] = None
    ratio: Optional[str] = None
    quality: Optional[str] = None
    output_resolution: Optional[str] = None
    voice: Optional[str] = None
    speed: Optional[float] = None
    emotion: Optional[str] = None
    is_preset: Optional[bool] = None
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None


class ServiceConfig(BaseModel):
    """服务配置"""
    provider_id: str
    model_id: Optional[str] = None


class PackageResponse(BaseModel):
    """套餐响应"""
    id: str
    name: str
    icon: str
    description: str
    is_preset: bool
    services: Dict[str, Any]


class UserConfigResponse(BaseModel):
    """用户配置响应"""
    package_id: Optional[str]
    llm: ServiceConfig
    video: ServiceConfig
    image: ServiceConfig
    tts: ServiceConfig
    runtime_params: Dict[str, Any]


class SaveUserConfigRequest(BaseModel):
    """保存用户配置请求"""
    llm_provider_id: Optional[str] = None
    llm_model_id: Optional[str] = None
    video_provider_id: Optional[str] = None
    video_model_id: Optional[str] = None
    image_provider_id: Optional[str] = None
    tts_provider_id: Optional[str] = None
    tts_model_id: Optional[str] = None
    video_duration: Optional[int] = 5
    video_ratio: Optional[str] = "16:9"
    video_quality: Optional[str] = "high"
    multi_shot: Optional[bool] = False


class ApplyPackageRequest(BaseModel):
    """应用套餐请求"""
    package_id: str


class CreatePackageRequest(BaseModel):
    """创建套餐请求"""
    id: str = Field(..., description="套餐唯一标识")
    name: str = Field(..., description="套餐名称")
    icon: str = Field(default="📦", description="套餐图标")
    description: str = Field(default="", description="套餐描述")
    services: Dict[str, Any] = Field(..., description="服务配置")


class PackageConfigStatus(BaseModel):
    """套餐配置状态响应"""
    package_id: str
    package_name: str
    services: Dict[str, Any]
    config_status: Dict[str, bool]  # provider_id -> is_configured


class SystemSettingResponse(BaseModel):
    """系统设置响应"""
    key: str
    value: Any
    category: str
    description: str
    is_editable: bool
    is_visible: bool


class UpdateSystemSettingRequest(BaseModel):
    """更新系统设置请求"""
    value: Any


class SuccessResponse(BaseModel):
    """通用成功响应"""
    success: bool
    message: str


class CreateProviderRequest(BaseModel):
    """创建自定义服务商请求（不含 provider_type）"""
    id: str = Field(..., description="服务商唯一标识")
    name: str = Field(..., description="服务商显示名称")
    description: str = Field(default="", description="服务商描述")
    base_url: str = Field(default="", description="API基础URL")
    requires_secret: bool = Field(default=False, description="是否需要API Secret")
    api_key: Optional[str] = Field(default=None, description="API Key（可选，创建时同时配置）")
    api_secret: Optional[str] = Field(default=None, description="API Secret（可选，创建时同时配置）")


class CreateModelRequest(BaseModel):
    """创建模型请求（含 model_type）"""
    id: str = Field(..., description="模型唯一标识")
    name: str = Field(..., description="模型显示名称")
    model_id: str = Field(..., description="实际API调用用的模型ID")
    provider_id: str = Field(..., description="所属服务商ID")
    model_type: str = Field(..., description="模型类型: llm/video/image/tts")
    duration: Optional[int] = Field(default=None, description="视频时长(秒)")
    ratio: Optional[str] = Field(default=None, description="视频比例")
    quality: Optional[str] = Field(default=None, description="视频质量")
    output_resolution: Optional[str] = Field(default=None, description="输出分辨率")
    voice: Optional[str] = Field(default=None, description="TTS声音")
    speed: Optional[float] = Field(default=None, description="TTS语速")
    emotion: Optional[str] = Field(default=None, description="TTS情绪")


class UpdateModelRequest(BaseModel):
    """更新模型请求（含 model_type）"""
    name: Optional[str] = Field(default=None, description="模型显示名称")
    model_id: Optional[str] = Field(default=None, description="实际API调用用的模型ID")
    model_type: Optional[str] = Field(default=None, description="模型类型: llm/video/image/tts")
    duration: Optional[int] = Field(default=None, description="视频时长(秒)")
    ratio: Optional[str] = Field(default=None, description="视频比例")
    quality: Optional[str] = Field(default=None, description="视频质量")
    output_resolution: Optional[str] = Field(default=None, description="输出分辨率")
    voice: Optional[str] = Field(default=None, description="TTS声音")
    speed: Optional[float] = Field(default=None, description="TTS语速")
    emotion: Optional[str] = Field(default=None, description="TTS情绪")


# ============================================================
# 路由定义
# ============================================================

router = APIRouter(prefix="/api/v3", tags=["配置管理 V3"])


# ============================================================
# Providers API
# ============================================================


@router.get("/providers", response_model=List[ProviderResponse])
async def list_providers(
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取所有服务商列表（含当前用户配置状态）
    """
    try:
        providers = get_user_providers(current_user.user_id)
        return providers
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取服务商列表失败: {str(e)}"
        )


@router.get("/providers/{provider_id}/models", response_model=List[ModelResponse])
async def list_provider_models(
    provider_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取指定服务商的模型列表
    """
    try:
        models = get_models_by_provider(provider_id)
        return models
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模型列表失败: {str(e)}"
        )


@router.get("/models", response_model=List[ModelResponse])
async def list_all_models(
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取所有模型列表（按类型分组）
    """
    try:
        models = get_all_models()
        return models
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模型列表失败: {str(e)}"
        )


@router.post("/models/reset", response_model=SuccessResponse)
async def reset_models(
    current_user: TokenData = Depends(get_current_user)
):
    """
    重置预设模型数据
    """
    try:
        count = reset_preset_models()
        return {
            "success": True,
            "message": f"已重置 {count} 个预设模型"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重置模型失败: {str(e)}"
        )


@router.post("/reset-all", response_model=SuccessResponse)
async def reset_all_data(
    current_user: TokenData = Depends(get_current_user)
):
    """
    重置所有预设数据（提供商、模型、套餐）
    """
    try:
        result = reset_all_preset_data()
        return {
            "success": True,
            "message": f"已重置所有预设数据：{result['providers']}个提供商、{result['models']}个模型、{result['packages']}个套餐"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重置所有数据失败: {str(e)}"
        )


@router.post("/providers", response_model=SuccessResponse)
async def create_new_provider(
    request: CreateProviderRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    创建自定义服务商
    
    用户可添加自己的API服务商（如OpenAI兼容服务），可同时配置API Key
    """
    try:
        from api.config_db_v3 import _get_config_db_path, encrypt_value
        import sqlite3
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            # 检查ID是否已存在
            existing = conn.execute(
                "SELECT id FROM providers WHERE id = ?", (request.id,)
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"服务商ID '{request.id}' 已存在"
                )
            
            # 插入新服务商
            conn.execute(
                """INSERT INTO providers
                   (id, name, description, base_url, requires_secret, is_preset, created_by)
                   VALUES (?, ?, ?, ?, ?, 0, ?)""",
                (
                    request.id,
                    request.name,
                    request.description,
                    request.base_url,
                    1 if request.requires_secret else 0,
                    current_user.user_id,
                ),
            )
            
            # 同时保存API Key配置（如果提供了）
            if request.api_key or request.api_secret:
                # 检查是否已有配置
                existing_config = conn.execute(
                    """SELECT id FROM user_provider_configs 
                       WHERE user_id = ? AND provider_id = ?""",
                    (current_user.user_id, request.id)
                ).fetchone()
                
                # 加密存储
                encrypted_key = encrypt_value(request.api_key) if request.api_key else None
                encrypted_secret = encrypt_value(request.api_secret) if request.api_secret else None
                
                if existing_config:
                    # 更新现有配置
                    updates = []
                    params = []
                    if encrypted_key:
                        updates.append("api_key = ?")
                        params.append(encrypted_key)
                    if encrypted_secret:
                        updates.append("api_secret = ?")
                        params.append(encrypted_secret)
                    if request.base_url:
                        updates.append("base_url = ?")
                        params.append(request.base_url)
                    
                    if updates:
                        params.extend([current_user.user_id, request.id])
                        conn.execute(
                            f"""UPDATE user_provider_configs 
                                SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                                WHERE user_id = ? AND provider_id = ?""",
                            params
                        )
                else:
                    # 创建新配置
                    conn.execute(
                        """INSERT INTO user_provider_configs 
                           (user_id, provider_id, api_key, api_secret, base_url, is_active)
                           VALUES (?, ?, ?, ?, ?, 1)""",
                        (
                            current_user.user_id,
                            request.id,
                            encrypted_key,
                            encrypted_secret,
                            request.base_url,
                        ),
                    )
        
        return SuccessResponse(success=True, message=f"服务商「{request.name}」创建成功")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建服务商失败: {str(e)}"
        )


@router.put("/providers/{provider_id}", response_model=SuccessResponse)
async def update_provider(
    provider_id: str,
    request: CreateProviderRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    更新自定义服务商信息（仅允许更新非预设服务商）
    可同时更新 API Key/Secret
    """
    try:
        from api.config_db_v3 import _get_config_db_path, encrypt_value
        import sqlite3
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            # 检查是否是预设服务商
            row = conn.execute(
                "SELECT is_preset FROM providers WHERE id = ?",
                (provider_id,)
            ).fetchone()
            
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="服务商不存在"
                )
            
            if row[0]:  # is_preset = 1
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="预设服务商不能修改"
                )
            
            # 更新服务商信息
            conn.execute(
                """UPDATE providers SET
                    name = ?,
                    description = ?,
                    base_url = ?,
                    requires_secret = ?
                WHERE id = ?""",
                (
                    request.name,
                    request.description,
                    request.base_url,
                    1 if request.requires_secret else 0,
                    provider_id,
                ),
            )
            
            # 同时更新 API Key/Secret（如果提供了）
            if request.api_key or request.api_secret:
                # 检查是否已有配置
                existing_config = conn.execute(
                    """SELECT id FROM user_provider_configs 
                       WHERE user_id = ? AND provider_id = ?""",
                    (current_user.user_id, provider_id)
                ).fetchone()
                
                # 加密存储
                encrypted_key = encrypt_value(request.api_key) if request.api_key else None
                encrypted_secret = encrypt_value(request.api_secret) if request.api_secret else None
                
                if existing_config:
                    # 更新现有配置
                    updates = []
                    params = []
                    if encrypted_key:
                        updates.append("api_key = ?")
                        params.append(encrypted_key)
                    if encrypted_secret:
                        updates.append("api_secret = ?")
                        params.append(encrypted_secret)
                    if request.base_url:
                        updates.append("base_url = ?")
                        params.append(request.base_url)
                    
                    if updates:
                        params.extend([current_user.user_id, provider_id])
                        conn.execute(
                            f"""UPDATE user_provider_configs 
                                SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                                WHERE user_id = ? AND provider_id = ?""",
                            params
                        )
                else:
                    # 创建新配置
                    conn.execute(
                        """INSERT INTO user_provider_configs 
                           (user_id, provider_id, api_key, api_secret, base_url, is_active)
                           VALUES (?, ?, ?, ?, ?, 1)""",
                        (
                            current_user.user_id,
                            provider_id,
                            encrypted_key,
                            encrypted_secret,
                            request.base_url,
                        ),
                    )
        
        return SuccessResponse(success=True, message=f"服务商「{request.name}」已更新")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新服务商失败: {str(e)}"
        )


@router.delete("/providers/{provider_id}", response_model=SuccessResponse)
async def delete_provider(
    provider_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    删除自定义服务商（仅允许删除非预设服务商）
    """
    try:
        from api.config_db_v3 import _get_config_db_path
        import sqlite3
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            # 检查是否是预设服务商
            row = conn.execute(
                "SELECT is_preset, name FROM providers WHERE id = ?",
                (provider_id,)
            ).fetchone()
            
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="服务商不存在"
                )
            
            if row[0]:  # is_preset = 1
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="预设服务商不能删除"
                )
            
            # 删除服务商及相关配置
            conn.execute("DELETE FROM user_provider_configs WHERE provider_id = ?", (provider_id,))
            conn.execute("DELETE FROM models WHERE provider_id = ?", (provider_id,))
            conn.execute("DELETE FROM providers WHERE id = ?", (provider_id,))
        
        return SuccessResponse(success=True, message="服务商已删除")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除服务商失败: {str(e)}"
        )


@router.get("/providers/{provider_id}/config", response_model=ProviderConfigResponse)
async def get_provider_config(
    provider_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取用户对指定服务商的配置（含解密后的 API Key）
    """
    try:
        from api.config_db_v3 import _get_config_db_path
        import sqlite3
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            row = conn.execute(
                """SELECT api_key, api_secret, base_url, is_active, is_default
                   FROM user_provider_configs 
                   WHERE user_id = ? AND provider_id = ?""",
                (current_user.user_id, provider_id),
            ).fetchone()
            
            if not row:
                return ProviderConfigResponse(
                    api_key=None,
                    api_secret=None,
                    base_url=None,
                    is_active=False,
                    is_default=False,
                )
            
            return ProviderConfigResponse(
                api_key=row[0],
                api_secret=row[1],
                base_url=row[2],
                is_active=bool(row[3]),
                is_default=bool(row[4]),
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取配置失败: {str(e)}"
        )


@router.post("/providers/{provider_id}/config", response_model=SuccessResponse)
async def save_provider_config(
    provider_id: str,
    request: ProviderConfigRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    保存用户对指定服务商的配置（API Key 等）
    """
    try:
        result = save_user_provider_config(
            user_id=current_user.user_id,
            provider_id=provider_id,
            api_key=request.api_key,
            api_secret=request.api_secret,
            base_url=request.base_url,
            is_active=request.is_active,
            is_default=request.is_default,
        )

        # 清除用户配置缓存，使修改立即生效
        from api.user_config_service import UserConfigService
        UserConfigService.invalidate_cache(current_user.user_id)

        return SuccessResponse(success=True, message="配置已保存")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"保存配置失败: {str(e)}"
        )


@router.get("/providers/{provider_id}/models-from-api", response_model=ProviderModelsResponse)
async def get_provider_models_from_api(
    provider_id: str,
    refresh: bool = False,
    current_user: TokenData = Depends(get_current_user)
):
    """
    从提供商 API 获取可用模型列表
    
    支持 OpenAI 兼容格式的提供商（DeepSeek/Kimi/MiniMax/OpenRouter/Ollama/阿里云等）
    结果会缓存 7 天，refresh=true 可强制刷新
    """
    print(f"[模型列表API] 开始处理: provider={provider_id}, user={current_user.user_id if current_user else 'None'}")
    
    try:
        from api.config_db_v3 import _get_config_db_path, decrypt_value
        import sqlite3
        import json
        from datetime import datetime, timedelta
        
        db_path = _get_config_db_path()
        print(f"[模型列表API] 数据库路径: {db_path}")
    except Exception as e:
        print(f"[模型列表API] 导入或获取数据库路径失败: {str(e)}")
        return ProviderModelsResponse(
            models=[],
            source="fallback",
            cached_at=None
        )
    
    try:
        # 获取用户配置
        with sqlite3.connect(db_path) as conn:
            row = conn.execute(
                """SELECT api_key, api_secret, base_url 
                   FROM user_provider_configs 
                   WHERE user_id = ? AND provider_id = ?""",
                (current_user.user_id, provider_id),
            ).fetchone()
            
            print(f"[模型列表API] 用户配置查询结果: {row is not None}")
            
            if not row or not row[0]:
                # 没有 API Key，返回空列表
                print(f"[模型列表API] 未找到 API Key")
                return ProviderModelsResponse(
                    models=[],
                    source="fallback",
                    cached_at=None
                )
            
            api_key = decrypt_value(row[0]) if row[0] else None
            base_url = row[2]
            print(f"[模型列表API] API Key 获取成功: {bool(api_key)}, base_url: {base_url}")
        
        # 获取提供商的 base_url
        with sqlite3.connect(db_path) as conn:
            row = conn.execute(
                "SELECT base_url FROM providers WHERE id = ?",
                (provider_id,)
            ).fetchone()
            provider_base_url = row[0] if row else None
            print(f"[模型列表API] 提供商默认 base_url: {provider_base_url}")
        
        # 使用用户配置的 base_url 或提供商默认的
        final_base_url = base_url or provider_base_url
        
        print(f"[模型列表API] 最终 base_url: {final_base_url}")
        
        if not final_base_url:
            print(f"[模型列表API] 没有可用的 base_url")
            return ProviderModelsResponse(
                models=[],
                source="fallback",
                cached_at=None
            )
        
        # 检查缓存
        cache_key = f"models:{provider_id}:{current_user.user_id}"
        cache_file = os.path.join(os.path.dirname(db_path), "model_cache.json")
        
        print(f"[模型列表API] 刷新模式: {refresh}, 缓存文件存在: {os.path.exists(cache_file)}")
        
        if not refresh and os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    cache = json.load(f)
                    cached_data = cache.get(cache_key)
                    if cached_data:
                        cached_at = datetime.fromisoformat(cached_data['cached_at'])
                        if datetime.now() - cached_at < timedelta(days=7):
                            return ProviderModelsResponse(
                                models=cached_data['models'],
                                source="cache",
                                cached_at=cached_data['cached_at']
                            )
            except Exception:
                pass  # 缓存读取失败，继续从 API 获取
        
        # 从 API 获取模型列表
        models = await _fetch_models_from_api(provider_id, api_key, final_base_url)
        
        # 保存缓存
        try:
            cache = {}
            if os.path.exists(cache_file):
                with open(cache_file, 'r') as f:
                    cache = json.load(f)
            cache[cache_key] = {
                'models': models,
                'cached_at': datetime.now().isoformat()
            }
            with open(cache_file, 'w') as f:
                json.dump(cache, f)
        except Exception:
            pass  # 缓存写入失败不影响返回结果
        
        return ProviderModelsResponse(
            models=models,
            source="api",
            cached_at=datetime.now().isoformat()
        )
        
    except Exception as e:
        # 出错时打印详细错误并返回空列表
        import traceback
        print(f"[模型列表API] 发生异常: {str(e)}")
        print(f"[模型列表API] 堆栈: {traceback.format_exc()}")
        return ProviderModelsResponse(
            models=[],
            source="fallback",
            cached_at=None
        )


async def _fetch_models_from_api(provider_id: str, api_key: str, base_url: str) -> List[str]:
    """从提供商 API 获取模型列表"""
    import aiohttp
    
    # OpenAI 兼容格式的提供商
    openai_compatible = ['deepseek', 'kimi', 'minimax', 'openrouter', 'ollama', 'aliyun', 'volces', 'kling']
    
    print(f"[获取模型列表] 提供商: {provider_id}, base_url: {base_url}")
    
    if provider_id in openai_compatible:
        url = base_url.rstrip("/") + "/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        
        # OpenRouter 需要额外的请求头
        if provider_id == "openrouter":
            headers["Referer"] = "https://openmodel.local"
            headers["X-Title"] = "OpenModel"
        
        print(f"[获取模型列表] 请求 URL: {url}")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=30) as resp:
                    print(f"[获取模型列表] 响应状态: {resp.status}")
                    
                    if resp.status == 200:
                        data = await resp.json()
                        # OpenAI 格式: { "data": [{"id": "model-name"}, ...] }
                        if 'data' in data and isinstance(data['data'], list):
                            models = [m.get('id', '') for m in data['data'] if m.get('id')]
                            print(f"[获取模型列表] 成功获取 {len(models)} 个模型")
                            return models
                        else:
                            print(f"[获取模型列表] 响应格式不正确: {data.keys() if isinstance(data, dict) else '非字典'}")
                    else:
                        text = await resp.text()
                        print(f"[获取模型列表] 请求失败: {resp.status}, 响应: {text[:200]}")
                    return []
        except Exception as e:
            print(f"[获取模型列表] 异常: {str(e)}")
            return []
    
    # Gemini 特殊处理
    elif provider_id == 'gemini':
        url = base_url.rstrip("/") + f"/models?key={api_key}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=30) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        # Gemini 格式: { "models": [{"name": "models/model-name"}, ...] }
                        if 'models' in data and isinstance(data['models'], list):
                            models = []
                            for m in data['models']:
                                name = m.get('name', '')
                                # 去掉前缀 "models/"
                                if name.startswith('models/'):
                                    name = name[7:]
                                if name:
                                    models.append(name)
                            return models
                    return []
        except Exception:
            return []
    
    # Kling 暂不支持获取模型列表
    elif provider_id == 'kling':
        return []
    
    # 默认返回空
    return []


@router.post("/providers/{provider_id}/test", response_model=ProviderTestResponse)
async def test_provider_config(
    provider_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    测试服务商配置是否有效
    
    验证 API Key 是否可以正常调用服务商 API
    """
    import time
    from api.config_db_v3 import _get_config_db_path, decrypt_value
    import sqlite3
    
    try:
        # 获取用户的配置
        db_path = _get_config_db_path()
        with sqlite3.connect(db_path) as conn:
            row = conn.execute(
                """SELECT api_key, api_secret, base_url 
                   FROM user_provider_configs 
                   WHERE user_id = ? AND provider_id = ?""",
                (current_user.user_id, provider_id),
            ).fetchone()
            
            if not row or not row[0]:  # 没有配置或没有 api_key
                return ProviderTestResponse(
                    success=False,
                    message="未找到 API Key 配置，请先配置 API Key"
                )
            
            api_key_raw = row[0]
            api_key = decrypt_value(api_key_raw) if api_key_raw else None
            api_key = api_key.strip() if api_key else None  # 去除前后空格
            api_secret = decrypt_value(row[1]) if row[1] else None
            base_url = row[2]
            
            print(f"[测试API] provider={provider_id}, api_key_raw长度={len(api_key_raw) if api_key_raw else 0}, api_key长度={len(api_key) if api_key else 0}")
            print(f"[测试API] api_key前20字符={api_key[:20] if api_key else 'None'}...")
        
        # 根据服务商类型进行测试
        start_time = time.time()
        
        if provider_id == "gemini":
            # Gemini 特殊处理
            success, message = await _test_gemini(api_key, base_url)
        elif provider_id == "openrouter":
            # OpenRouter 特殊处理（需要额外请求头）
            success, message = await _test_openrouter(api_key, base_url)
        else:
            # 通用 OpenAI 兼容 API 测试
            success, message = await _test_openai_compatible(api_key, base_url)
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return ProviderTestResponse(
            success=success,
            message=message,
            latency_ms=latency_ms
        )
        
    except Exception as e:
        return ProviderTestResponse(
            success=False,
            message=f"测试失败: {str(e)}"
        )


async def _test_deepseek(api_key: str, base_url: Optional[str]) -> tuple:
    """测试 DeepSeek API"""
    import aiohttp
    
    url = base_url or "https://api.deepseek.com/v1"
    url = url.rstrip("/") + "/models"
    
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    return True, "连接成功"
                elif resp.status == 401:
                    text = await resp.text()
                    return False, f"API Key 无效或已过期 (401): {text[:100]}"
                else:
                    text = await resp.text()
                    return False, f"连接失败，状态码: {resp.status}, 响应: {text[:100]}"
    except Exception as e:
        return False, f"网络错误: {str(e)}"


async def _test_kimi(api_key: str, base_url: Optional[str]) -> tuple:
    """测试 Kimi API"""
    import aiohttp
    
    url = base_url or "https://api.moonshot.cn/v1"
    url = url.rstrip("/") + "/models"
    
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    return True, "连接成功"
                elif resp.status == 401:
                    text = await resp.text()
                    return False, f"API Key 无效或已过期 (401): {text[:100]}"
                else:
                    text = await resp.text()
                    return False, f"连接失败，状态码: {resp.status}, 响应: {text[:100]}"
    except Exception as e:
        return False, f"网络错误: {str(e)}"


async def _test_kling(api_key: str, api_secret: Optional[str]) -> tuple:
    """测试 Kling API"""
    if not api_secret:
        return False, "Kling 需要同时配置 API Key 和 API Secret"
    
    import aiohttp
    import jwt
    import uuid
    
    try:
        # 生成 Kling JWT Token
        token = jwt.encode(
            {
                "iss": api_key,
                "exp": datetime.utcnow().timestamp() + 1800,
                "nbf": datetime.utcnow().timestamp() - 5,
                "sub": str(uuid.uuid4()),
            },
            api_secret,
            algorithm="HS256",
        )
        
        url = "https://api.klingai.com/v1/account"
        headers = {"Authorization": f"Bearer {token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    return True, "连接成功"
                elif resp.status == 401:
                    return False, "API Key 或 API Secret 无效"
                else:
                    return False, f"连接失败，状态码: {resp.status}"
    except Exception as e:
        return False, f"测试失败: {str(e)}"


async def _test_minimax(api_key: str) -> tuple:
    """测试 MiniMax API"""
    import aiohttp
    
    url = "https://api.minimax.chat/v1/query_account"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    return True, "连接成功"
                elif resp.status == 401:
                    return False, "API Key 无效或已过期"
                else:
                    return False, f"连接失败，状态码: {resp.status}"
    except Exception as e:
        return False, f"网络错误: {str(e)}"


async def _test_gemini(api_key: str, base_url: Optional[str]) -> tuple:
    """测试 Google Gemini API"""
    import aiohttp
    
    # Gemini API 把 key 放在 query 参数里
    url = base_url or "https://generativelanguage.googleapis.com/v1beta"
    url = url.rstrip("/") + f"/models?key={api_key}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    return True, "连接成功"
                elif resp.status == 400:
                    text = await resp.text()
                    return False, f"API Key 无效 (400): {text[:100]}"
                elif resp.status == 403:
                    text = await resp.text()
                    return False, f"API Key 无权限或被禁用 (403): {text[:100]}"
                else:
                    text = await resp.text()
                    return False, f"连接失败，状态码: {resp.status}, 响应: {text[:100]}"
    except aiohttp.ClientError as e:
        return False, f"网络错误: {str(e)}"
    except Exception as e:
        return False, f"测试失败: {str(e)}"


async def _test_openai_compatible(api_key: str, base_url: Optional[str], provider_id: str = "") -> tuple:
    """通用 OpenAI 兼容 API 测试"""
    import aiohttp
    
    url = base_url or "https://api.openai.com/v1"
    url = url.rstrip("/") + "/models"
    
    headers = {"Authorization": f"Bearer {api_key}"}
    
    # OpenRouter 需要额外的请求头
    if provider_id == "openrouter" or (base_url and "openrouter" in base_url.lower()):
        headers["Referer"] = "https://openmodel.local"  # OpenRouter 要求的 Referer
        headers["X-Title"] = "OpenModel"  # OpenRouter 要求的站点标题
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    return True, "连接成功"
                elif resp.status == 401:
                    text = await resp.text()
                    return False, f"API Key 无效或已过期 (401): {text[:100]}"
                else:
                    text = await resp.text()
                    return False, f"连接失败，状态码: {resp.status}, 响应: {text[:100]}"
    except aiohttp.ClientError as e:
        return False, f"网络错误: {str(e)}"
    except Exception as e:
        return False, f"测试失败: {str(e)}"


async def _test_openrouter(api_key: str, base_url: Optional[str]) -> tuple:
    """测试 OpenRouter API（需要特殊请求头）"""
    import aiohttp
    
    url = base_url or "https://openrouter.ai/api/v1"
    url = url.rstrip("/") + "/models"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Referer": "https://openmodel.local",
        "X-Title": "OpenModel"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    return True, "连接成功"
                elif resp.status == 401:
                    text = await resp.text()
                    return False, f"API Key 无效或已过期 (401): {text[:100]}"
                else:
                    text = await resp.text()
                    return False, f"连接失败，状态码: {resp.status}, 响应: {text[:100]}"
    except aiohttp.ClientError as e:
        return False, f"网络错误: {str(e)}"
    except Exception as e:
        return False, f"测试失败: {str(e)}"


# ============================================================
# Models API
# ============================================================


@router.post("/models", response_model=SuccessResponse)
async def create_new_model(
    request: CreateModelRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    创建新模型（自定义）
    """
    try:
        result = create_model(
            id=request.id,
            name=request.name,
            model_id=request.model_id,
            provider_id=request.provider_id,
            model_type=request.model_type,
            duration=request.duration,
            ratio=request.ratio,
            quality=request.quality,
            output_resolution=request.output_resolution,
            voice=request.voice,
            speed=request.speed,
            emotion=request.emotion,
        )
        return SuccessResponse(success=True, message=f"模型「{request.name}」创建成功")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建模型失败: {str(e)}"
        )


@router.put("/models/{model_id}", response_model=SuccessResponse)
async def update_existing_model(
    model_id: str,
    request: UpdateModelRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    更新模型（仅允许更新自定义模型）
    """
    try:
        result = update_model(
            model_id=model_id,
            name=request.name,
            model_id_field=request.model_id,
            model_type=request.model_type,
            duration=request.duration,
            ratio=request.ratio,
            quality=request.quality,
            output_resolution=request.output_resolution,
            voice=request.voice,
            speed=request.speed,
            emotion=request.emotion,
        )
        return SuccessResponse(success=True, message="模型已更新")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新模型失败: {str(e)}"
        )


@router.delete("/models/{model_id}", response_model=SuccessResponse)
async def remove_model(
    model_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    删除模型（仅允许删除自定义模型）
    """
    try:
        delete_model(model_id)
        return SuccessResponse(success=True, message="模型已删除")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除模型失败: {str(e)}"
        )


# ============================================================
# Packages API
# ============================================================


@router.get("/packages", response_model=List[PackageResponse])
async def list_packages(
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取所有可用套餐
    """
    try:
        packages = get_all_packages()
        return packages
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取套餐列表失败: {str(e)}"
        )


@router.post("/packages", response_model=SuccessResponse)
async def create_new_package(
    request: CreatePackageRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    创建新套餐
    """
    try:
        result = create_package(
            id=request.id,
            name=request.name,
            icon=request.icon,
            description=request.description,
            services=request.services,
            created_by=current_user.user_id
        )
        return SuccessResponse(success=True, message=f"套餐「{request.name}」创建成功")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建套餐失败: {str(e)}"
        )


@router.put("/packages/{package_id}", response_model=SuccessResponse)
async def update_existing_package(
    package_id: str,
    request: CreatePackageRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    更新套餐（仅允许更新非预设套餐）
    """
    try:
        result = update_package(
            package_id=package_id,
            name=request.name,
            icon=request.icon,
            description=request.description,
            services=request.services,
        )
        return SuccessResponse(success=True, message=f"套餐「{request.name}」已更新")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新套餐失败: {str(e)}"
        )


@router.delete("/packages/{package_id}", response_model=SuccessResponse)
async def remove_package(
    package_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    删除套餐（仅允许删除非预设套餐）
    """
    try:
        delete_package(package_id)
        return SuccessResponse(success=True, message="套餐已删除")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除套餐失败: {str(e)}"
        )


@router.get("/packages/{package_id}/config-status", response_model=PackageConfigStatus)
async def get_package_config_status(
    package_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取指定套餐的配置状态
    
    返回套餐中每个服务商是否已配置API Key
    """
    try:
        from api.config_db_v3 import _get_config_db_path
        import sqlite3
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            # 获取套餐信息
            row = conn.execute(
                """SELECT name, services_json FROM packages WHERE id = ?""",
                (package_id,)
            ).fetchone()
            
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="套餐不存在"
                )
            
            import json
            package_name = row[0]
            services = json.loads(row[1])
            
            # 获取用户的服务商配置状态
            config_status = {}
            for service_type, service_config in services.items():
                provider_id = service_config.get("provider_id")
                if provider_id:
                    config_row = conn.execute(
                        """SELECT api_key FROM user_provider_configs 
                           WHERE user_id = ? AND provider_id = ?""",
                        (current_user.user_id, provider_id)
                    ).fetchone()
                    config_status[provider_id] = bool(config_row and config_row[0])
            
            return PackageConfigStatus(
                package_id=package_id,
                package_name=package_name,
                services=services,
                config_status=config_status
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取套餐配置状态失败: {str(e)}"
        )


# ============================================================
# User Config API
# ============================================================


@router.get("/user/config", response_model=UserConfigResponse)
async def get_current_user_config(
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取当前用户的配置
    
    如果用户没有配置，自动创建默认配置
    """
    try:
        config = get_user_config(current_user.user_id)
        
        if not config:
            # 创建默认配置
            config = create_default_user_config(current_user.user_id)
        
        return UserConfigResponse(**config)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取用户配置失败: {str(e)}"
        )


@router.post("/user/config", response_model=SuccessResponse)
async def update_user_config(
    request: SaveUserConfigRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    更新用户配置
    """
    try:
        from api.config_db_v3 import _get_config_db_path
        import sqlite3
        
        db_path = _get_config_db_path()
        now = datetime.now().isoformat()
        
        with sqlite3.connect(db_path) as conn:
            # 检查用户配置是否存在
            existing = conn.execute(
                "SELECT id FROM user_configs WHERE user_id = ?",
                (current_user.user_id,)
            ).fetchone()
            
            if existing:
                # 更新
                conn.execute(
                    """UPDATE user_configs SET
                        llm_provider_id = COALESCE(?, llm_provider_id),
                        llm_model_id = COALESCE(?, llm_model_id),
                        video_provider_id = COALESCE(?, video_provider_id),
                        video_model_id = COALESCE(?, video_model_id),
                        image_provider_id = COALESCE(?, image_provider_id),
                        tts_provider_id = COALESCE(?, tts_provider_id),
                        tts_model_id = COALESCE(?, tts_model_id),
                        video_duration = COALESCE(?, video_duration),
                        video_ratio = COALESCE(?, video_ratio),
                        video_quality = COALESCE(?, video_quality),
                        multi_shot = COALESCE(?, multi_shot),
                        updated_at = ?
                    WHERE user_id = ?""",
                    (
                        request.llm_provider_id,
                        request.llm_model_id,
                        request.video_provider_id,
                        request.video_model_id,
                        request.image_provider_id,
                        request.tts_provider_id,
                        request.tts_model_id,
                        request.video_duration,
                        request.video_ratio,
                        request.video_quality,
                        1 if request.multi_shot else 0,
                        now,
                        current_user.user_id,
                    )
                )
            else:
                # 插入新配置
                conn.execute(
                    """INSERT INTO user_configs
                        (user_id, package_id, llm_provider_id, llm_model_id,
                         video_provider_id, video_model_id, image_provider_id,
                         tts_provider_id, tts_model_id, video_duration,
                         video_ratio, video_quality, multi_shot, updated_at)
                    VALUES (?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        current_user.user_id,
                        request.llm_provider_id or "deepseek",
                        request.llm_model_id or "deepseek-chat",
                        request.video_provider_id or "kling",
                        request.video_model_id or "kling-v3",
                        request.image_provider_id or "nano_banana",
                        request.tts_provider_id or "minimax",
                        request.tts_model_id or "minimax-tts-hd",
                        request.video_duration or 5,
                        request.video_ratio or "16:9",
                        request.video_quality or "high",
                        1 if request.multi_shot else 0,
                        now,
                    )
                )

        # 清除用户配置缓存，使修改立即生效
        from api.user_config_service import UserConfigService
        UserConfigService.invalidate_cache(current_user.user_id)

        return SuccessResponse(success=True, message="配置已更新")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新配置失败: {str(e)}"
        )


@router.post("/user/config/apply-package", response_model=SuccessResponse)
async def apply_package(
    request: ApplyPackageRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    应用指定套餐到用户配置
    """
    try:
        from api.config_db_v3 import _get_config_db_path
        import sqlite3
        import json
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            # 获取套餐配置
            row = conn.execute(
                "SELECT services_json FROM packages WHERE id = ?",
                (request.package_id,)
            ).fetchone()
            
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="套餐不存在"
                )
            
            services = json.loads(row[0])
            now = datetime.now().isoformat()
            
            # 提取各服务的配置
            llm = services.get("llm", {})
            video = services.get("video", {})
            image = services.get("image", {})
            tts = services.get("tts", {})
            
            # 检查用户配置是否存在
            existing = conn.execute(
                "SELECT id FROM user_configs WHERE user_id = ?",
                (current_user.user_id,)
            ).fetchone()
            
            if existing:
                conn.execute(
                    """UPDATE user_configs SET
                        package_id = ?,
                        llm_provider_id = ?,
                        llm_model_id = ?,
                        video_provider_id = ?,
                        video_model_id = ?,
                        image_provider_id = ?,
                        tts_provider_id = ?,
                        tts_model_id = ?,
                        updated_at = ?
                    WHERE user_id = ?""",
                    (
                        request.package_id,
                        llm.get("provider_id"),
                        llm.get("model_id"),
                        video.get("provider_id"),
                        video.get("model_id"),
                        image.get("provider_id"),
                        tts.get("provider_id"),
                        tts.get("model_id"),
                        now,
                        current_user.user_id,
                    )
                )
            else:
                conn.execute(
                    """INSERT INTO user_configs
                        (user_id, package_id, llm_provider_id, llm_model_id,
                         video_provider_id, video_model_id, image_provider_id,
                         tts_provider_id, tts_model_id, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        current_user.user_id,
                        request.package_id,
                        llm.get("provider_id"),
                        llm.get("model_id"),
                        video.get("provider_id"),
                        video.get("model_id"),
                        image.get("provider_id"),
                        tts.get("provider_id"),
                        tts.get("model_id"),
                        now,
                    )
                )

        # 清除用户配置缓存，使修改立即生效
        from api.user_config_service import UserConfigService
        UserConfigService.invalidate_cache(current_user.user_id)

        return SuccessResponse(success=True, message=f"已应用套餐: {request.package_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"应用套餐失败: {str(e)}"
        )


# ============================================================
# System Settings API
# ============================================================


@router.get("/system/settings", response_model=List[SystemSettingResponse])
async def list_system_settings(
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取所有系统设置
    
    仅管理员可访问敏感设置
    """
    try:
        from api.config_db_v3 import _get_config_db_path
        import sqlite3
        import json
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            # 检查是否是管理员
            is_admin = getattr(current_user, 'is_admin', False)
            
            if is_admin:
                rows = conn.execute(
                    """SELECT key, value, category, description, 
                              is_editable, is_visible
                       FROM system_settings ORDER BY category, key"""
                ).fetchall()
            else:
                # 普通用户只能看到可见的设置
                rows = conn.execute(
                    """SELECT key, value, category, description, 
                              is_editable, is_visible
                       FROM system_settings WHERE is_visible = 1
                       ORDER BY category, key"""
                ).fetchall()
            
            settings = []
            for row in rows:
                value = json.loads(row[1]) if row[1] else None
                settings.append(SystemSettingResponse(
                    key=row[0],
                    value=value,
                    category=row[2],
                    description=row[3],
                    is_editable=bool(row[4]),
                    is_visible=bool(row[5]),
                ))
            
            return settings
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取系统设置失败: {str(e)}"
        )


@router.get("/system/settings/{key}", response_model=SystemSettingResponse)
async def get_system_setting_by_key(
    key: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    获取指定系统设置
    """
    try:
        from api.config_db_v3 import _get_config_db_path
        import sqlite3
        import json
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            row = conn.execute(
                """SELECT key, value, category, description, 
                          is_editable, is_visible
                   FROM system_settings WHERE key = ?""",
                (key,)
            ).fetchone()
            
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="设置项不存在"
                )
            
            # 检查权限
            is_admin = getattr(current_user, 'is_admin', False)
            if not row[5] and not is_admin:  # is_visible = 0 and not admin
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="无权访问此设置"
                )
            
            value = json.loads(row[1]) if row[1] else None
            return SystemSettingResponse(
                key=row[0],
                value=value,
                category=row[2],
                description=row[3],
                is_editable=bool(row[4]),
                is_visible=bool(row[5]),
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取设置失败: {str(e)}"
        )


@router.post("/system/settings/{key}", response_model=SuccessResponse)
async def update_system_setting(
    key: str,
    request: UpdateSystemSettingRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    更新系统设置
    
    需要管理员权限或设置项允许编辑
    """
    try:
        from api.config_db_v3 import _get_config_db_path
        import sqlite3
        
        db_path = _get_config_db_path()
        
        with sqlite3.connect(db_path) as conn:
            # 检查设置是否存在和是否可编辑
            row = conn.execute(
                "SELECT is_editable FROM system_settings WHERE key = ?",
                (key,)
            ).fetchone()
            
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="设置项不存在"
                )
            
            is_admin = getattr(current_user, 'is_admin', False)
            is_editable = bool(row[0])
            
            if not is_editable and not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="该设置项不允许修改"
                )
            
            # 更新设置
            success = set_system_setting(key, request.value, current_user.user_id)
            
            if success:
                return SuccessResponse(success=True, message="设置已更新")
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="更新失败"
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新设置失败: {str(e)}"
        )
