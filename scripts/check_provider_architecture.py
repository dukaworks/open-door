#!/usr/bin/env python3
"""
芝麻开门 Open-Door
Provider/Model 架构检查脚本

用途：
检查代码中是否存在"模型被当作厂商使用"的错误
防止类似 seedance、kling-3.0 等模型名被错误地用作 provider

使用方法：
    python scripts/check_provider_architecture.py

输出：
    - 控制台打印检查报告
    - 生成检查日志文件：data/config/architecture_check.log
"""

import os
import re
import sys
from pathlib import Path
from datetime import datetime
from typing import Set, List, Tuple, Dict

# ============================================================
# 配置
# ============================================================

PROJECT_ROOT = Path(__file__).parent.parent
IGNORE_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    "venv",
    "env",
}

# 正确的 Provider ID 列表（从 config_db_v3.py 提取）
VALID_PROVIDERS = {
    "openai",
    "deepseek",
    "gemini",
    "kimi",
    "minimax",
    "zhipu",
    "volces",
    "kling",
    "anthropic",
    "ollama",
}

# 可疑的模型名模式（这些通常是模型，不应该作为 provider）
SUSPICIOUS_MODEL_PATTERNS = [
    r"kling-\d+\.\d+",           # kling-3.0, kling-2.5
    r"doubao-[a-z]+",            # doubao-lite, doubao-pro
    r"moonshot-v\d+",            # moonshot-v1, moonshot-v2
    r"qwen-\w+",                 # qwen-turbo, qwen-max
    r"gpt-\d+[a-z]*",            # gpt-4, gpt-4o, gpt-3.5
    r"gemini-\d+\.[0-9]+",       # gemini-1.5, gemini-2.0
    r"claude-\d+[a-z]*",         # claude-3, claude-3.5
    r"abab\d+",                  # abab6, abab5.5
    r"wanx-v\d+",                # wanx-v1
    r"hunyuan-\w+",              # hunyuan-lite
    r"seedance",                 # seedance (已知的错误)
    r"nano_banana",              # nano_banana (已知的错误)
]

# 编译正则表达式
PATTERN_REGEX = re.compile("|".join(f"({p})" for p in SUSPICIOUS_MODEL_PATTERNS), re.IGNORECASE)

# ============================================================
# 工具函数
# ============================================================


def find_python_files(root: Path) -> List[Path]:
    """查找所有 Python 文件"""
    python_files = []
    for file_path in root.rglob("*.py"):
        # 跳过忽略的目录
        if any(ignored_dir in file_path.parts for ignored_dir in IGNORE_DIRS):
            continue
        python_files.append(file_path)
    return python_files


def find_yaml_files(root: Path) -> List[Path]:
    """查找所有 YAML 配置文件"""
    yaml_files = []
    for file_path in root.rglob("*.yaml"):
        if any(ignored_dir in file_path.parts for ignored_dir in IGNORE_DIRS):
            continue
        yaml_files.append(file_path)
    for file_path in root.rglob("*.yml"):
        if any(ignored_dir in file_path.parts for ignored_dir in IGNORE_DIRS):
            continue
        yaml_files.append(file_path)
    return yaml_files


def find_tsx_ts_files(root: Path) -> List[Path]:
    """查找所有 TypeScript/TSX 文件"""
    ts_files = []
    for file_path in root.rglob("*.ts"):
        if any(ignored_dir in file_path.parts for ignored_dir in IGNORE_DIRS):
            continue
        if "node_modules" in str(file_path):
            continue
        ts_files.append(file_path)
    for file_path in root.rglob("*.tsx"):
        if any(ignored_dir in file_path.parts for ignored_dir in IGNORE_DIRS):
            continue
        if "node_modules" in str(file_path):
            continue
        ts_files.append(file_path)
    return ts_files


def check_file_for_provider_issues(file_path: Path, file_type: str) -> List[Dict]:
    """检查单个文件中的 Provider/Model 架构问题"""
    issues = []

    try:
        content = file_path.read_text(encoding="utf-8")
        lines = content.split("\n")
    except Exception as e:
        print(f"  ⚠️  无法读取文件 {file_path}: {e}")
        return issues

    # 检查每行代码
    for line_num, line in enumerate(lines, 1):
        # 1. 检查可疑的模型名被用作 provider
        matches = PATTERN_REGEX.finditer(line)
        for match in matches:
            suspicious_name = match.group(0)
            
            # 检查是否在 provider 相关的上下文中
            provider_contexts = [
                r"provider\s*[:=]\s*['\"]",
                r'\.provider\s*[:=]',
                r"default_provider\s*[:=]",
                r"engine\s*[:=]\s*['\"]",
                r"selected_engine\s*[:=]",
                r"video_engine\s*[:=]",
                r"image_gen_provider",
            ]
            
            for context_pattern in provider_contexts:
                if re.search(context_pattern, line, re.IGNORECASE):
                    issues.append({
                        "file": str(file_path.relative_to(PROJECT_ROOT)),
                        "line": line_num,
                        "type": "MODEL_AS_PROVIDER",
                        "suspicious_name": suspicious_name,
                        "context": line.strip(),
                        "severity": "HIGH",
                    })
                    break

        # 2. 检查 provider 引用是否在 VALID_PROVIDERS 中
        # 查找所有可能的 provider 引用
        provider_refs = re.findall(
            r'provider\s*[:=]\s*["\']([^"\']+)["\']|\.provider\s*[:=]\s*["\']([^"\']+)["\']',
            line,
            re.IGNORECASE
        )
        
        for ref_match in provider_refs:
            provider_name = ref_match[0] or ref_match[1]
            if provider_name and provider_name.lower() not in VALID_PROVIDERS:
                # 排除变量引用（如 ${xxx}、xxx_variable）
                if not re.match(r'[$\{\{]', provider_name):
                    issues.append({
                        "file": str(file_path.relative_to(PROJECT_ROOT)),
                        "line": line_num,
                        "type": "UNKNOWN_PROVIDER",
                        "provider_name": provider_name,
                        "context": line.strip(),
                        "severity": "MEDIUM",
                    })

    return issues


def check_architecture() -> Tuple[List[Dict], Dict]:
    """执行全面的架构检查"""
    all_issues = []
    stats = {
        "python_files": 0,
        "yaml_files": 0,
        "ts_files": 0,
        "total_files": 0,
        "issues_found": 0,
        "high_severity": 0,
        "medium_severity": 0,
    }

    print("🔍 开始检查 Provider/Model 架构...")
    print("=" * 60)

    # 1. 检查 Python 文件
    print("\n📂 检查 Python 文件...")
    python_files = find_python_files(PROJECT_ROOT)
    stats["python_files"] = len(python_files)
    stats["total_files"] += len(python_files)

    for file_path in python_files:
        issues = check_file_for_provider_issues(file_path, "python")
        all_issues.extend(issues)

    # 2. 检查 YAML 文件
    print("📂 检查 YAML 配置文件...")
    yaml_files = find_yaml_files(PROJECT_ROOT)
    stats["yaml_files"] = len(yaml_files)
    stats["total_files"] += len(yaml_files)

    for file_path in yaml_files:
        issues = check_file_for_provider_issues(file_path, "yaml")
        all_issues.extend(issues)

    # 3. 检查 TypeScript 文件
    print("📂 检查 TypeScript 文件...")
    ts_files = find_tsx_ts_files(PROJECT_ROOT)
    stats["ts_files"] = len(ts_files)
    stats["total_files"] += len(ts_files)

    for file_path in ts_files:
        issues = check_file_for_provider_issues(file_path, "typescript")
        all_issues.extend(issues)

    # 统计
    stats["issues_found"] = len(all_issues)
    stats["high_severity"] = sum(1 for i in all_issues if i["severity"] == "HIGH")
    stats["medium_severity"] = sum(1 for i in all_issues if i["severity"] == "MEDIUM")

    return all_issues, stats


def print_report(issues: List[Dict], stats: Dict):
    """打印检查报告"""
    print("\n" + "=" * 60)
    print("📊 检查报告")
    print("=" * 60)

    print(f"\n📁 扫描文件统计:")
    print(f"  - Python 文件:  {stats['python_files']}")
    print(f"  - YAML 文件:    {stats['yaml_files']}")
    print(f"  - TypeScript 文件: {stats['ts_files']}")
    print(f"  - 总计:         {stats['total_files']}")

    print(f"\n⚠️  问题统计:")
    print(f"  - 发现问题:     {stats['issues_found']}")
    print(f"  - 高危问题:     {stats['high_severity']} 🔴")
    print(f"  - 中危问题:     {stats['medium_severity']} 🟡")

    if not issues:
        print("\n✅ 未发现架构问题！")
        return

    # 按严重程度和文件分组
    print(f"\n{'=' * 60}")
    print("📋 问题详情")
    print("=" * 60)

    # 高危问题：模型被当作 Provider 使用
    high_issues = [i for i in issues if i["severity"] == "HIGH"]
    if high_issues:
        print(f"\n🔴 高危问题 - 模型被当作 Provider 使用 ({len(high_issues)} 个):")
        print("-" * 60)
        for i, issue in enumerate(high_issues, 1):
            print(f"\n  {i}. {issue['file']}:{issue['line']}")
            print(f"     可疑名称: {issue['suspicious_name']}")
            print(f"     代码: {issue['context']}")
            print(f"     ⚠️  '{issue['suspicious_name']}' 应该是模型名，不是 Provider！")
            print(f"     💡 请检查该模型属于哪个 Provider（如 kling、volces、openai 等）")

    # 中危问题：未知的 Provider 引用
    medium_issues = [i for i in issues if i["severity"] == "MEDIUM"]
    if medium_issues:
        print(f"\n🟡 中危问题 - 未知的 Provider 引用 ({len(medium_issues)} 个):")
        print("-" * 60)
        for i, issue in enumerate(medium_issues, 1):
            print(f"\n  {i}. {issue['file']}:{issue['line']}")
            print(f"     Provider: {issue['provider_name']}")
            print(f"     代码: {issue['context']}")
            print(f"     💡 请确认 '{issue['provider_name']}' 是否在 PRESET_PROVIDERS 中")

    print(f"\n{'=' * 60}")
    print("✅ 检查完成！")
    print("=" * 60)


def save_log(issues: List[Dict], stats: Dict):
    """保存检查日志"""
    log_dir = PROJECT_ROOT / "data" / "config"
    log_dir.mkdir(parents=True, exist_ok=True)
    
    log_file = log_dir / f"architecture_check_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    
    with open(log_file, "w", encoding="utf-8") as f:
        f.write("芝麻开门 Open-Door - Provider/Model 架构检查日志\n")
        f.write("=" * 60 + "\n")
        f.write(f"检查时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("📊 统计信息\n")
        f.write("-" * 60 + "\n")
        for key, value in stats.items():
            f.write(f"{key}: {value}\n")
        
        f.write("\n" + "=" * 60 + "\n")
        f.write("📋 问题详情\n")
        f.write("=" * 60 + "\n\n")
        
        for i, issue in enumerate(issues, 1):
            f.write(f"问题 {i}\n")
            f.write(f"  文件: {issue['file']}\n")
            f.write(f"  行号: {issue['line']}\n")
            f.write(f"  类型: {issue['type']}\n")
            f.write(f"  严重程度: {issue['severity']}\n")
            
            if "suspicious_name" in issue:
                f.write(f"  可疑名称: {issue['suspicious_name']}\n")
            if "provider_name" in issue:
                f.write(f"  Provider: {issue['provider_name']}\n")
            
            f.write(f"  代码: {issue['context']}\n")
            f.write("\n")
    
    print(f"\n📝 日志已保存到: {log_file.relative_to(PROJECT_ROOT)}")


def main():
    """主函数"""
    try:
        issues, stats = check_architecture()
        print_report(issues, stats)
        
        if issues:
            save_log(issues, stats)
            sys.exit(1)  # 发现问题，返回非零退出码
        else:
            sys.exit(0)  # 无问题，返回零退出码
            
    except KeyboardInterrupt:
        print("\n\n⚠️  检查被用户中断")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ 检查过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
