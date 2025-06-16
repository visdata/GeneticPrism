#!/bin/bash
# 获取当前目录路径
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 打开 static 目录
cd "$script_dir/.."

# 获取 google_analytics 统计数据
/usr/bin/scp xfl@8.141.84.169:/home/xfl/pycode/code/google_analytics.json static/
