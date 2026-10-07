# Mock 模式

## 1. 定论

mock 模式只覆盖**客房数据**这一条链：Web 与香橙派大屏各有一个 data 注入点，运行期按 `Home` 键切换。

- 不用环境变量、URL 参数、localStorage，也不为 mock 单开启动入口；模式是运行期状态，默认连真实接口，刷新或重启回真实。
- mock 数据只写进同一份 data，页面与组件不认识 mock。
- 真实接口连不上就是连不上，不自动降级到 mock。

## 2. 两侧共同约定

| 项目 | 约定 |
|---|---|
| 触发 | 键盘 `Home`，任何页面、任何焦点都生效 |
| 开关 | 一个 `mock` 布尔 + 一个切换函数；`mock` 与 `data` 是仅有的两个新名词 |
| 切换语义 | 停掉当前来源 → 清空快照 → 订阅另一来源，1 秒内看到新数据 |
| camera | 不 mock，画面只能来自真实链路，两侧视频部分零改动 |
| 提示 | 页面上不加任何切换说明或按钮，旁人看不出这是假数据 |

## 3. Web

`web/src/data.ts` 是唯一注入点：持有 `rooms`、`status`、`mock`，导出 `connect()`、`toggleMock()`、`disconnect()`。`connect()` 按 `mock` 选来源，真实走 `api.ts` 的 REST + SSE，mock 走 `mock.ts` 的 `startMockRooms`，两者写的是同一份 `rooms`。

页面与组件从 `data.ts` 直接取，不再由 `App.vue` 用 props 传 `rooms`/`status`/`demo`；搜索与筛选仍留在 `App.vue` 用 props 传。`Home` 只在 `App.vue` 挂一次全局监听。

`web/src/mock.ts` 保留六间房，每秒一帧，必须肉眼可见：

- 功率按实体在房内的序号取相位，围绕基准值正弦浮动 ±40W，各房不同步。
- 电量按 `powerW / 3600000 * DEMO_SPEED` 累积，`DEMO_SPEED = 40`（演示时 1 秒当 40 秒），两位小数下每秒都在涨。
- 离线房整间不动，保留最后读数。

`CameraPage.vue` 固定请求 `/api/cv/stream`，不感知 mock。`VITE_DEMO` 与 `public/demo-camera.svg` 删除。

## 4. 香橙派大屏

`slintui/power.py` 是唯一注入点：`PowerStream` 加 `mock` 标志与 `toggle_mock()`，停掉当前来源、按新来源重新取数，两种来源写同一份 `rows`。mock 分支不起线程，直接把 `mock.py` 的固定数据写进 `rows`、`updated` 写「演示数据」，`main.py` 此时把底部 `server` 留空。

`slintui/mock.py` 只有数据：四间房（单表 / 混合 / 无实体 / 多表），形状与真实快照一致。大屏不需要数值浮动。

键盘：`ui/app-window.slint` 整棵树包一层 `FocusScope`（`Window` 本身没有 `key-pressed`），`Key.Home` 切 mock、其余按键 `reject` 放行，`main.py` 绑定 `AppData.toggle_mock`。

已知局限：

- Slint 键盘事件按焦点派发，设置页输入框会吃掉 `Home`，那一处切不了。
- 上板若只有触摸没有键盘就切不了 mock，需要时再给顶部窗口按钮行加一个按钮。

截图流程不再有 `scripts/mock_power.py`：跑 `main.py`，由 `scripts/x11_shot.py` 的可选按键参数用 XTEST 发一个 `Home`，命令记在 `slintui/AGENTS.md`。XTEST 只送给当前获得焦点的窗口，桌面焦点不在应用里时按不动（GNOME 下 mutter 会保住自己的焦点），这时在应用窗口里手按 `Home`。

## 5. 不做什么

- 不搭 mock server，不为 mock 单开启动入口。
- mock 不覆盖视频画面、人数统计、历史统计与远程通断。
- 不做模式持久化，不加切换按钮与状态说明。

## 6. 验收

| 侧 | 怎么验 |
|---|---|
| Web | `bun run --cwd web check`、`bun run --cwd web build` 通过；不启后端时按 `Home` 出现六间房；盯客房总览 5 秒，功率与累计电量都有肉眼可见变化；离线房不动；详情页、视频页按 `Home` 同样生效 |
| 大屏 | X11 下跑 `main.py` 并发送 `Home`：客房用电页是四间固定数据、底部显示「演示数据」；再按一次回到真实来源；人数监控页不受影响 |

## 依据

- [项目定义](../../../AGENTS.md)
- [网页前端第一版设计](网页前端第一版设计.md)
- [web/src/data.ts](../../../web/src/data.ts)、[web/src/mock.ts](../../../web/src/mock.ts)
- [slintui/power.py](../../../slintui/power.py)、[slintui/mock.py](../../../slintui/mock.py)
