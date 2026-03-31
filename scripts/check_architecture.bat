@echo off
REM 芝麻开门 Open-Door - Provider/Model 架构检查脚本
REM Windows 批处理版本

echo ============================================================
echo 芝麻开门 Open-Door - Provider/Model 架构检查
echo ============================================================
echo.

REM 尝试多个 Python 命令
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo 使用 python 运行检查脚本...
    python scripts\check_provider_architecture.py
    goto :end
)

python3 --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo 使用 python3 运行检查脚本...
    python3 scripts\check_provider_architecture.py
    goto :end
)

py --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo 使用 py 运行检查脚本...
    py scripts\check_provider_architecture.py
    goto :end
)

echo.
echo 错误: 未找到 Python 解释器！
echo 请确保 Python 已安装并添加到系统 PATH 环境变量中。
echo.
echo 如果使用 Conda，请先激活环境：
echo   conda activate openwebui
echo   然后运行: python scripts\check_provider_architecture.py
echo.
pause
exit /b 1

:end
echo.
echo 检查完成！
if %ERRORLEVEL% EQU 0 (
    echo 结果: ✅ 未发现问题
) else (
    echo 结果: ⚠️  发现问题，请查看报告
)
echo.
pause
