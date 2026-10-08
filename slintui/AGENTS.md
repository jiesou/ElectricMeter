# AGENTS.md — slintui

## 开发原则

- 不写死任何颜色，统一用 [Palette](https://docs.slint.dev/latest/docs/slint/reference/std-widgets/globals/palette) 也可以用各种[混色合成方式](https://docs.slint.dev/latest/docs/slint/reference/property-types/colors-and-brushes/#color-methods)
- 尽量不写死任何尺寸 sizing，统一使用 [Sizing](slintui/ui/sizing.slint)
- 组件放 `ui/components/`，页面放 `ui/`

## 截图流程

改完 UI 自己跑起来截图看一眼。GNOME Wayland 下截不了屏，让应用走 Xwayland，再按窗口标题截（命令都在本目录下跑）：

```bash
mkdir -p /tmp/agents
( sleep 6; .venv/bin/python scripts/x11_shot.py 民宿用电管理 /tmp/agents/shot.png 10 Home ) &
env -u WAYLAND_DISPLAY -u WAYLAND_SOCKET WINIT_UNIX_BACKEND=x11 timeout 15 .venv/bin/python main.py > /tmp/agents/app.log 2>&1
wait
```

- `scripts/x11_shot.py` 第四个参数是截图前要按的键：传 `Home` 截的是 mock 数据（客房用电页按 Home 切换），不传就是真实数据。合成按键只送给当前获得焦点的窗口，桌面焦点不在应用里时按不动（GNOME 下 mutter 会保住自己的焦点），这时直接在应用窗口里手按 `Home` 也一样
- 要看别的页面就临时把 `app-window.slint` 里的 `current-tab` 改掉，截完改回来
- 日志里 libEGL / MESA / ZINK 的报错是沙箱拿不到 GPU，可以不管
