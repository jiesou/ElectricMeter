#!/usr/bin/env bash
# 把本机 slintui 同步到香橙派。板子上是同一份 git 仓库，正式更新走板子上的 git pull；
# 这个脚本用来把未提交的改动 / 不入库的模型素材推过去调试。
set -euo pipefail

BOARD="${BOARD:-orangepi5plus}"
DEST="${DEST:-services/ElectricMeter/slintui/}"

rsync -av --delete \
  --exclude '.venv/' --exclude '.venv-export/' --exclude '__pycache__/' --exclude '.git/' \
  --exclude 'settings.json' --exclude 'models/' --exclude 'samples/' \
  --exclude 'yolo11n.pt' --exclude 'rust/frame_sender/target/' \
  "$(dirname "$0")/../" "$BOARD:$DEST"
