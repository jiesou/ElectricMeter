# AGENTS.md — slintui

## 开发原则

- 不写死任何颜色，统一用 [Palette](https://docs.slint.dev/latest/docs/slint/reference/std-widgets/globals/palette) 也可以用各种[混色合成方式](https://docs.slint.dev/latest/docs/slint/reference/property-types/colors-and-brushes/#color-methods)
- 尽量不写死任何尺寸 sizing，统一使用 [Sizing](slintui/ui/sizing.slint)；窗口本身不定宽高，比例宽度直接写 `width: 74%`，写 `parent.width * 74%` 会报 binding loop（`x` / `y` 不收百分号，只能写 `parent.width * 19%`）
- 组件放 `ui/components/`，页面放 `ui/`
- 业务一个包（照老板端 `evaluation/` 的样式）：人数监控收在 `people/`（`page.py` 装配 / `viewport.py` 推理视口 / `calibration.py` 判定线）；共享基建（`camera_service` / `settings` / `power` / `mock`）放顶层

## 在板子上开发

- 板子 `~/services/ElectricMeter/` 是同一份仓库的 sparse checkout（只取 `slintui/`），正式更新在板子上 `git pull`
- 本机未提交的改动用 `scripts/sync.sh` rsync 过去调试（已排除 `settings.json` 与模型素材）
- `settings.json` 是板子本地配置（RKNN + 真摄像头），板子上已 `assume-unchanged` 不管它；若上游改过它，板子 `git pull` 会覆盖，先备份
- 如果 ssh 连不上，可以本地调试，照样运行，本机走 ONNX + 视频文件，两边配置就是不一样的
- 板子 venv 在 `~/services/ElectricMeter/.venv`，启动 `DISPLAY=:0 ../.venv/bin/python main.py`

## 截图流程

改完 UI 自己跑起来截图看一眼。GNOME Wayland 下截不了屏，让应用走 Xwayland，再按窗口标题截（命令都在本目录下跑）：

```bash
mkdir -p /tmp/agents
( sleep 6; .venv/bin/python scripts/x11_shot.py 民宿用电管理 /tmp/agents/shot.png 10 Home ) &
env -u WAYLAND_DISPLAY -u WAYLAND_SOCKET WINIT_UNIX_BACKEND=x11 timeout 15 .venv/bin/python main.py > /tmp/agents/app.log 2>&1
wait
```

- `scripts/x11_shot.py` 第四个参数是截图前要按的键：传 `Home` 截的是 mock 数据（客房用电页按 Home 切换），不传就是真实数据。合成按键只送给当前获得焦点的窗口，桌面焦点不在应用里时按不动（GNOME 下 mutter 会保住自己的焦点），这时直接在应用窗口里手按 `Home` 也一样
- 要看别的页面就临时把 `ui/app-data.slint` 里的 `current-tab` 改掉，截完改回来
- 日志里 libEGL / MESA / ZINK 的报错是沙箱拿不到 GPU，可以不管
