# Rust 与 Python 分工

## 定论

- **SlintUI 由 Python 绑定 SDK 驱动**。`slintui/` 用 Python 的 `slint` 包，Python 直接读写 `.slint` 里的属性、global、callback。界面会越来越复杂、属性会越来越多，**Python 必须紧贴 UI，中间不放任何翻译层**。
- **Rust 只做薄层**。不碰网络、不做复杂逻辑、只管简单的 UI 交互级别的事。Rust 是**给 Python import 的扩展模块**，不是主程序。
- 明确不走：Rust 主程序 + 子进程 Python + 字符串协议；也不走「一套 UI 两个 binding 共同驱动」——Slint 官方是「一个应用选一种语言」，两条 binding 路（`slint-build` 编译成 Rust 类型 / 解释器给 Python 用）是二选一的分叉，共用不了同一个实例。

## UDP 图传搬 Rust

`slintui/udp_frame_uploader.py` 的图传链路交给 Rust。

- **Rust 模块就一个函数**：`send(frame_bytes, host, port)`，进去是 BGR 裸帧，出来什么都不用回。
- 里面干三件事：JPEG 编码（quality 80）→ 按 8 字节小端包头 `<IHH` 分片 → UDP 发出。
- **调度循环留在 Python**（`_upload_loop` 的 10fps 节拍）。Rust 侧因此无状态、无线程、无回调。
- **一次性跨边界**：不要把编码好的 JPEG 回传 Python 再发回去，那是白搬两趟大内存。
- host / port 由 Python 传数值，Rust 不认识 `settings.json`、不认识 `udp://` URL。
- 编码和发包期间**必须释放 GIL**，否则会卡住 Slint 事件循环和摄像头线程。
- 发包失败只打 stderr，不设计返回值。

## 收图：照搬老项目，放服务器里（不用 Rust）

**只有发用 Rust**；收是纯服务器的事，老项目那段 TS 基本逐行搬进了 `server/core/udp_camera.ts`：

- 接收端 `~/Documents/dev/Projects/ElectricDriveSystem/server/UdpCameraServer.ts:8`，`node:dgram` 的 `createSocket("udp4")`（Bun 直接支持，不用换 API）。
- 包头 8 字节小端 `frame_index u32 + chunk_index u16 + chunk_total u16`（`UdpCameraServer.ts:48-59`），与发送端 `'<IHH'` 对称。
- 重组按 `frameIndex → Map<chunkIndex, bytes>`，齐了按序拼，缺一片丢整帧（`UdpCameraServer.ts:75-112`）；清理只看 frameIndex 落后 5 帧，无超时、无重传（`:143-159`）。
- 帧不落盘：内存里留一份最新帧，`routes/cv.ts` 的 `GET /api/cv/stream` 转 MJPEG 给浏览器 `<img>`（老项目是 `server/routes/cv.ts:55,74`，按 cvClientIp 分路；我们只有一路，去掉那个参数）。
- 老项目里**没有**大屏直接收 UDP 的实现，板端 slintui 只发不收；更早的 12 字节带 IP 前缀版本（1KB 分片）已废弃。

板端老源码在 `~/Documents/dev/Projects/Playground/ElectricDriveCVClient/OPi5-RK3588-ElectricDrive/`：同目录有 `pyqt/` 旧 Qt 版、Buildroot 构建仓与 `sdcard.img`（内含开机自启 `S99electricdrive`）。

## 端口统一 8080

新项目一律 8080。`settings.json` 写的是 8000、UDP 默认值写的是 8099，都改掉。

## 构建与部署

- Rust 模块和 `slint` 自己的 wheel 用同一套规则：`abi3-py311` + `maturin>=1,<1.14.1`。
- 香橙派上能交叉编译就交叉编译，编好的 `.so` 拷过去。
- 板子环境：glibc + venv。
- **Rust 是必须上的**，不因为基准测出来收益小而放弃。

## 现状

- **发**已由 Rust 接手：`slintui/rust/frame_sender/`（PyO3 扩展，`uv sync` 时由 maturin 构建），Python 侧 10fps 调 `frame_sender.send(frame, host, port)`。
- **收**在服务器里，TypeScript：`server/core/udp_camera.ts` 起 UDP 收图，`server/routes/cv.ts` 出 `/api/cv/stream`（MJPEG）。没有独立的收图进程，也没有额外端口。
- 老 Python 的 `slintui/udp_frame_uploader.py` 已被取代，成了死代码。

