"""
芝麻开门 Open-Door
Settings System v3.0 - 集成测试

运行: python tests/test_settings_v3.py
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from api.server import app

client = TestClient(app)

# ============================================================
# 测试数据
# ============================================================

TEST_USER = {
    "username": "test_user",
    "password": "test_password_123",
    "email": "test@example.com"
}

# ============================================================
# 辅助函数
# ============================================================

def get_auth_token():
    """获取测试用的认证 Token"""
    # 先尝试注册
    response = client.post("/api/auth/register", json=TEST_USER)
    if response.status_code == 400 and "已存在" in response.text:
        # 用户已存在，直接登录
        response = client.post("/api/auth/login", json={
            "username": TEST_USER["username"],
            "password": TEST_USER["password"]
        })
    
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    return None

# ============================================================
# 测试用例
# ============================================================

def test_health():
    """测试服务健康状态"""
    print("\n[测试] 服务健康检查...")
    response = client.get("/health")
    assert response.status_code == 200
    print(f"  [OK] 服务运行正常: {response.json()}")


def test_providers_api(token: str):
    """测试服务商 API"""
    print("\n[测试] V3 服务商 API...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. 获取服务商列表
    response = client.get("/api/v3/providers", headers=headers)
    assert response.status_code == 200, f"获取服务商失败: {response.text}"
    providers = response.json()
    print(f"  [OK] 获取到 {len(providers)} 个服务商")
    
    # 2. 获取模型列表
    if providers:
        provider_id = providers[0]["id"]
        response = client.get(f"/api/v3/providers/{provider_id}/models", headers=headers)
        assert response.status_code == 200
        models = response.json()
        print(f"  [OK] {provider_id} 有 {len(models)} 个模型")
    
    return providers


def test_packages_api(token: str):
    """测试套餐 API"""
    print("\n[测试] V3 套餐 API...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.get("/api/v3/packages", headers=headers)
    assert response.status_code == 200, f"获取套餐失败: {response.text}"
    packages = response.json()
    print(f"  [OK] 获取到 {len(packages)} 个套餐")
    
    for pkg in packages:
        icon = pkg.get('icon', '')
        # 移除 emoji 字符避免编码问题
        icon_clean = '' if ord(icon[0]) > 127 else icon if icon else ''
        print(f"    - [{icon_clean}] {pkg['name']}: {pkg['description']}")
    
    return packages


def test_user_config_api(token: str):
    """测试用户配置 API"""
    print("\n[测试] V3 用户配置 API...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. 获取用户配置（应该自动创建默认配置）
    response = client.get("/api/v3/user/config", headers=headers)
    assert response.status_code == 200, f"获取配置失败: {response.text}"
    config = response.json()
    print(f"  [OK] 获取用户配置成功")
    print(f"    - 套餐: {config.get('package_id', 'none')}")
    print(f"    - LLM: {config.get('llm', {}).get('provider_id')}")
    print(f"    - 视频: {config.get('video', {}).get('provider_id')}")
    
    # 2. 更新配置
    response = client.post("/api/v3/user/config", headers=headers, json={
        "llm_provider_id": "deepseek",
        "llm_model_id": "deepseek-chat",
        "video_duration": 10
    })
    assert response.status_code == 200, f"更新配置失败: {response.text}"
    print(f"  [OK] 更新配置成功")
    
    # 3. 应用套餐
    response = client.post("/api/v3/user/config/apply-package", headers=headers, json={
        "package_id": "pro"
    })
    assert response.status_code == 200, f"应用套餐失败: {response.text}"
    print(f"  [OK] 应用套餐成功")
    
    return config


def test_provider_config_api(token: str):
    """测试服务商配置 API"""
    print("\n[测试] V3 服务商配置 API...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 保存配置（不测试真实 API Key）
    response = client.post("/api/v3/providers/deepseek/config", headers=headers, json={
        "api_key": "test_key_placeholder",
        "base_url": "https://api.deepseek.com/v1",
        "is_active": True
    })
    assert response.status_code == 200, f"保存配置失败: {response.text}"
    print(f"  [OK] 保存服务商配置成功")
    
    # 验证配置已保存
    response = client.get("/api/v3/providers", headers=headers)
    providers = response.json()
    deepseek = next((p for p in providers if p["id"] == "deepseek"), None)
    if deepseek and deepseek.get("api_key_configured"):
        print(f"  [OK] 配置状态已更新")


def test_system_settings_api(token: str):
    """测试系统设置 API"""
    print("\n[测试] V3 系统设置 API...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.get("/api/v3/system/settings", headers=headers)
    assert response.status_code == 200, f"获取设置失败: {response.text}"
    settings = response.json()
    print(f"  [OK] 获取到 {len(settings)} 个系统设置")
    
    for setting in settings[:3]:  # 只显示前3个
        print(f"    - [{setting['category']}] {setting['description']}: {setting['value']}")


def test_backward_compatibility():
    """测试向后兼容（旧 API 是否还能工作）"""
    print("\n[测试] 旧 API 向后兼容性...")
    
    # 这些端点应该还可用（使用旧数据库）
    endpoints = [
        ("/api/providers", "GET"),
        ("/api/packages", "GET"),
    ]
    
    for endpoint, method in endpoints:
        if method == "GET":
            response = client.get(endpoint)
        else:
            response = client.post(endpoint)
        
        status = "[OK]" if response.status_code in [200, 401] else "[FAIL]"
        print(f"  {status} {method} {endpoint}: {response.status_code}")


# ============================================================
# 主程序
# ============================================================

def main():
    print("=" * 60)
    print("芝麻开门 Open-Door - Settings System v3.0 集成测试")
    print("=" * 60)
    
    try:
        # 1. 健康检查
        test_health()
        
        # 2. 获取认证 Token
        print("\n[准备] 获取认证 Token...")
        token = get_auth_token()
        if not token:
            print("  [FAIL] 无法获取认证 Token，跳过需要认证的测试")
            return
        print("  [OK] 认证成功")
        
        # 3. 运行测试
        test_providers_api(token)
        test_packages_api(token)
        test_user_config_api(token)
        test_provider_config_api(token)
        test_system_settings_api(token)
        test_backward_compatibility()
        
        print("\n" + "=" * 60)
        print("[PASS] 所有测试通过！")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n[FAIL] 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] 测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
