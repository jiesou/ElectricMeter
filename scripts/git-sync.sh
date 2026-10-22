#!/usr/bin/env bash
# 维护铁律：compat 永远 = main + 一个"删掉现场要写的文件"的提交
# compat 上写的新提交会被自动搬到 main 上，然后 compat 按 main 重建
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FILES=(server/routes/chat.ts)
MARK="chore: clean"

if ! git diff-index --quiet HEAD --; then
  echo "有未提交的改动，先提交或 stash"
  exit 1
fi

START=$(git rev-parse --abbrev-ref HEAD)
trap 'git cherry-pick --abort 2>/dev/null || true; git switch -q "$START" 2>/dev/null || true' ERR

git fetch origin --prune
git switch -q main
git merge --ff-only origin/main

# compat 上除了那个删文件的提交，其余都是真活儿，按顺序挑到 main
for c in $(git rev-list --reverse main..compat); do
  [ "$(git log -1 --format=%s "$c")" = "$MARK" ] && continue
  echo ">> 把 $(git log -1 --format='%h %s' "$c") 搬到 main"
  git cherry-pick --allow-empty "$c"
done

# 已经正好是 main + 那个提交，就什么都不用做
if [ "$(git rev-list --count main..compat)" = 1 ] \
   && [ "$(git log -1 --format=%s compat)" = "$MARK" ] \
   && [ "$(git rev-parse compat^)" = "$(git rev-parse main)" ]; then
  echo "compat 已经是最新"
else
  git branch -f compat main
  git switch -q compat
  git rm -q "${FILES[@]}"
  git commit -q -m "$MARK"
fi

git switch -q "$START"

if [ -z "${SKIP_PUSH:-}" ]; then
  git push --force-with-lease origin main compat
fi

echo "--- 现在的样子 ---"
git log --oneline --graph -3 compat
