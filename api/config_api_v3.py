"""
芝麻开门 Open-Door
Settings System v3.0 - 配置管理 API

RESTful API 端点：
- /api/v3/providers - 服务商管理
- /api/v3/packages - 套餐管理
- /api/v3/user/config - 用户配置
- /api/v3/system/settings - 系统设置
"""

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
    get_all_packages,
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


class ProviderTestResponse(BaseModel):
    """服务商测试响应"""
    success: bool
    message: str
    latency_ms: Optional[int] = None


class ProviderResponse(BaseModel):
    """服务商响应"""
    id: str
    name: str
    provider_type: str
    description: str
    base_url: str
    is_preset: bool
    requires_secret: bool
    api_key_configured: bool = False
    api_secret_configured: bool = False
    is_active: bool = False
    is_default: bool = False


class ModelResponse(BaseModel):
    """模型响应"""
    id: str
    name: str
    model_id: str
    duration: Optional[int] = None
    ratio: Optional[str] = None
    quality: Optional[str] = None
    output_resolution: Optional[str] = None
    voice: Optional[str] = None
    speed: Optional[float] = None
    emotion: Optional[str] = None


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
        return SuccessResponse(success=True, message="配置已保存")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"保存配置失败: {str(e)}"
        )


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
    from api.config_db_v3 import _get_config_db_path
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
            
            api_key = row[0]
            api_secret = row[1]
            base_url = row[2]
        
        # 根据服务商类型进行测试
        start_time = time.time()
        
        if provider_id == "deepseek":
            success, message = await _test_deepseek(api_key, base_url)
        elif provider_id == "kimi":
            success, message = await _test_kimi(api_key, base_url)
        elif provider_id == "kling":
            success, message = await _test_kling(api_key, api_secret)
        elif provider_id == "minimax":
            success, message = await _test_minimax(api_key)
        else:
            success, message = True, "该服务商暂不支持自动测试，请手动验证"
        
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
                    return False, "API Key 无效或已过期"
                else:
                    return False, f"连接失败，状态码: {resp.status}"
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
                    return False, "API Key 无效或已过期"
                else:
                    return False, f"连接失败，状态码: {resp.status}"
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
                        request.tts_provider_id or "minimax_tts",
                        request.tts_model_id or "minimax-tts-hd",
                        request.video_duration or 5,
                        request.video_ratio or "16:9",
                        request.video_quality or "high",
                        1 if request.multi_shot else 0,
                        now,
                    )
                )
        
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
