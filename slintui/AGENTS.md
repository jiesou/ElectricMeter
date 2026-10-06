# AGENTS.md — slintui

## 截图流程

改完 UI 自己跑起来截图看一眼。GNOME Wayland 下截不了屏，让应用走 Xwayland，再按窗口标题截（命令都在本目录下跑）：

```bash
mkdir -p /tmp/agents
( sleep 6; .venv/bin/python scripts/x11_shot.py 民宿用电管理 /tmp/agents/shot.png 10 ) &
env -u WAYLAND_DISPLAY -u WAYLAND_SOCKET WINIT_UNIX_BACKEND=x11 timeout 13 .venv/bin/python scripts/mock_power.py > /tmp/agents/app.log 2>&1
wait
```

- `scripts/mock_power.py` 是客房用电页的假数据（不同数量的实体），后面跟个数字可以跳过前几间房；要看别的页面就换成 `main.py`，并临时把 `app-window.slint` 里的 `current-tab` 改掉，截完改回来
- 日志里 libEGL / MESA / ZINK 的报错是沙箱拿不到 GPU，可以不管
