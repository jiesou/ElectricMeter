# Slint 大屏 Rust 化：可行性评估

> 结论：能切，而且比预想划算。但切分线不是「UI 逻辑 Rust / 业务 Python」，而是「**呈现 Rust / 感知 Python**」。
> 本文是调研结论汇总，**未落任何代码**。决策待定。

---

## 一、结论

| 层 | 归属 | 理由 |
|---|---|---|
| `.slint` 声明式 UI | **共享** | 语言无关，Rust 编译期 codegen，Python 运行时解释 |
| 窗口 / 事件循环 / 渲染 | **Rust** | Slint Rust 绑定是一等公民，Python 是 (beta) |
| 界面状态绑定（人数 / 房间 / 告警 / 图表） | **Rust** | 有类型、有所有权、无 GIL |
| **WS 客户端（console role）** | **Rust** | console 连接就是大屏主进程本身，放 Rust 侧故事才完整 |
| 摄像头采集 | **Python** | OpenCV 交叉编译到 2026-07 还在修 bug |
| RKNN 推理 | **Python** | 官方 aarch64 wheel vs 20-star Rust crate |
| 跨线计数状态机 | **Python** | 和推理耦合紧密，跨进程传轨迹 ID 是自找麻烦 |

净重写量：**~70 行 `main.rs` + 3 行 `build.rs` + 10 行 `Cargo.toml`，替掉 43 行 `main.py`**。

答辩话术：「大屏的 Slint UI 与通信层用 Rust 实现，编译期类型安全；感知侧（摄像头 + RKNN NPU 跨线计数）用 Python，复用 Rockchip 官方 rknnlite 运行时。两进程通过 `/dev/shm` 传帧、JSON 行传控制消息。」—— 技术上站得住，且比硬吹「全 Rust」诚实。

---

## 二、为什么 Rust 这条腿站得住

### Slint Rust 后端是一等公民，不是二等

| 证据 | 数据 |
|---|---|
| 版本 | crates.io `slint` = **1.18.1**（master 上 1.19.0-dev，**用 1.18，不要追 master**） |
| 累计下载 | 178 万，近 90 天 52 万 |
| 官方定位 | [language-integrations](https://slint.dev/docs/latest/slint/language-integrations/) 把 Rust 标 `Rust`，Python / TypeScript 明确标 `(beta)` |
| 2026 年提交 | compiler 1457 / `api/rs` 165 / `api/python` 129 |
| 测试 | `tests/driver/{rust,python,nodejs,cpp,interpreter}/` 同一套 `.slint` 跑 5 种语言；Rust driver 另有 `deterministic-output` 断言，Python 没有 |

**关键架构差异**：Python 绑定是 pyo3 包 `slint-interpreter`，**运行时解释** `.slint`；Rust 走 `slint-build`，**编译期生成 Rust struct**，零运行时解释。这本身就是「大屏该用 Rust」的硬论据。

### 交叉编译到 aarch64：官方一等支持

- `slint-build` 是**纯 Rust，零外部二进制依赖**（`api/rs/build/Cargo.toml` 只依赖 `i-slint-compiler` / `spin_on` / `toml_edit` / `derive_more`），不需要 clang / node / C++ 编译器。这是 cross 能干净工作的根本原因。
- 官方文档 [building.md#Cross-Compiling](https://github.com/slint-ui/slint/blob/master/docs/building.md) 明确推荐 [`cross`](https://github.com/rust-embedded/cross)。
- 官方根目录 `Cross.toml` 已配好镜像 `ghcr.io/slint-ui/slint/aarch64-unknown-linux-gnu`（已确认存在）。
- 官方 CI [cross_containers_and_demos.yaml](https://github.com/slint-ui/slint/blob/master/.github/workflows/cross_containers_and_demos.yaml) matrix 里有 `aarch64-unknown-linux-gnu`，跑 `cross build ... -p todo -p gallery` —— 跟本项目场景几乎一样。
- 镜像内容：arm64 的 `libfontconfig1-dev` `libxcb*` `libxkbcommon-dev` `libinput-dev` `libgbm-dev` `libssl-dev` + `clang` + `ninja`。

**后端选择**：
- 有 Wayland/X11（Orange Pi 官方镜像一般带 X11）→ `backend-winit`（默认），镜像里的 libxcb 正好够
- 裸跑大屏无窗口系统 → [`backend-linuxkms`](https://slint.dev/docs/latest/slint/guide/backends-and-renderers/backend_linuxkms/)，镜像里也有 `libgbm-dev`

**环境变量**：现有 `SLINT_STYLE` / `SLINT_FULLSCREEN` / `SLINT_SCALE_FACTOR` 三者在 Rust 侧行为一致。**但 `SLINT_STYLE` 是编译期生效的**（`api/rs/build/lib.rs` 读它），改样式要重新 `cargo build`，不像 Python 改环境变量就生效。

**许可**：Slint 有 GPLv3 / royalty-free / 商业三选一，**royalty-free 对 desktop 应用完全免费**（只需加 Slint 署名）。走 royalty-free，不开源。

---

## 三、`.slint` 复用率：文件 100%，逻辑代码几乎全丢

### `.slint` 文件：零改动

官方 [`examples/async-io`](https://github.com/slint-ui/slint/tree/master/examples/async-io) 是唯一同时提供 `main.rs` 和 `main.py`、**共用同一个 `stockticker.slint`** 的例子，结构一一对应：

| Rust（76 行） | Python（44 行） |
|---|---|
| `slint::slint!{ export {MainWindow, Symbol} from "stockticker.slint"; }` | `Symbol = slint.loader.stockticker.Symbol` |
| `MainWindow::new()?` | `MainWindow()` |
| `main_window.set_stocks(model.clone())` | `self.stocks = slint.ListModel([...])` |
| `main_window.on_refresh(move \|\| {...})` | `@slint.callback` + `async def refresh` |
| `VecModel<Symbol>` / `ModelRc` | `slint.ListModel` |

同样对应关系在 [`examples/todo`](https://github.com/slint-ui/slint/tree/master/examples/todo)（rust/ + node/ + cpp/ 共用 `ui/todo.slint`）和 [`demos/home-automation`](https://github.com/slint-ui/slint/tree/master/demos/home-automation)（rust/ + node/ + zephyr/ + esp-idf/ 共用）里都能验证。

现存 5 个 `.slint` 的 Rust 侧映射：
- `export global AppData` + `callback` → `ui.global::<AppData>()`，生成 `on_stop_app()` / `on_swap_cameras()` / `set_camera_frame()` / `invoke_request_camera_frame()`
- `camera-viewport.slint` 的 `Timer { interval: 16ms }` → `ui.global::<AppData>().on_request_camera_frame(|| ...)`
- `nav-bar.slint` / `radar-chart.slint` / `sizing.slint` 纯声明式，Rust 侧不碰
- `import { Palette, Button } from "std-widgets.slint"` 语言无关
- `frame <=> AppData.camera-frame` 双向绑定两种语言都由编译器处理

### 图像上传：唯一有技术含量的迁移点

| | Python | Rust |
|---|---|---|
| API | `slint.Image.load_from_array(np_uint8_hwc)` | `slint::Image::from_rgb8(SharedPixelBuffer<Rgb8Pixel>)` |
| 内存 | 内部 `SharedPixelBuffer::new` + `copy_to_slice`（**深拷贝**） | `SharedPixelBuffer::new` + `make_mut_bytes()` 填充 |
| 通道 | **只接受 RGB / RGBA**（`api/python/slint/image.rs`：`bpp==3 → from_rgb8`，`bpp==4 → from_rgba8`） | 同上，**Slint 没有 BGR 输入格式**（`internal/core/graphics/image.rs` 只有 `from_rgb8` / `from_rgba8` / `from_rgba8_premultiplied`） |
| 跨线程 | 直接调 | 必须 `weak.upgrade_in_event_loop(\|ui\| ui.set_x(...))`（[`examples/ffmpeg/lib.rs`](https://github.com/slint-ui/slint/blob/master/examples/ffmpeg/lib.rs) 是标准范式） |

OpenCV 给的是 BGR，Slint 只吃 RGB —— Rust 侧要显式 swap R/B。老代码 `xiaoxin_viewport.py` 当时写了 `cv2.cvtColor(..., COLOR_BGR2RGB)`，迁移时照做。

---

## 四、必须留在 Python 的两个

### RKNN：C API 极小，但 crate 不行

`rknn_api.h` 只有 **18 个 C 函数**（`rknn_init` / `rknn_query` / `rknn_inputs_set` / `rknn_run` / `rknn_outputs_get` / `rknn_outputs_release` / `rknn_destroy` 等）+ 约 20 个 POD struct，无 C++ 无 STL。API 面小到**手写 FFI 200 行比找 crate 更省事**。

但现成 crate 都不行：

| crate | stars | 最近推送 | 评价 |
|---|---|---|---|
| [darkautism/rknn-rs](https://github.com/darkautism/rknn-rs) | 20 | 2026-02-26 | 最像样。`rknn-sys-rs` 用 bindgen 包头文件，API 干净但 879 行只覆盖推理主路径。需 `libclang` + 手工部署 `librknnrt.so` |
| [RoggeOhta/rknpu2-rs](https://github.com/RoggeOhta/rknpu2-rs) | 24 | 2024-03-06 | 已死 |
| [boundarybitlabs/rknpu2-rs](https://github.com/boundarybitlabs/rknpu2-rs) | 12 | 2026-09-10 | 结构正规但 README 写 "Usage: Coming soon!"，零测试 |

Python 侧是**官方 wheel**：rknn-toolkit-lite2 2.3.2（`manylinux_2_17_aarch64`），装完即用，官方示例 6 行。**差距是数量级的。**

### OpenCV：交叉编译是真正的坑

[opencv](https://crates.io/crates/opencv) crate 数据健康（2494 star、468 万下载），但 README 自述 *"unstable and not very battle-tested"*，且要装 `clang` + `libclang-dev` 跑 bindgen。交叉编译相关 issue 到 2026-07 才修（[#720](https://github.com/twistedfall/opencv-rust/issues/720)、[#689](https://github.com/twistedfall/opencv-rust/issues/689)、[#682](https://github.com/twistedfall/opencv-rust/issues/682)），官方 slint cross 镜像里也**没有** arm64 的 OpenCV 开发包。

摄像头采集留 Python：不是「Rust 做不到」，是「能做但要花 2-3 天在构建地狱上，而你只需要 `cap.read()`」。

---

## 五、两进程 IPC

### 通道 1：控制消息 —— stdin/stdout 上的 JSON 行

**五个坑**：

1. **Python stdout 块缓冲** —— 最容易中招。子进程 stdout 是 pipe 不是 tty，`print()` 会攒在缓冲区，Rust 侧 `read_line` 干等。解法：Rust 启动时加 `-u`
2. **日志污染 stdout** —— 所有日志 `print(..., file=sys.stderr)`，`logging.basicConfig(stream=sys.stderr)`；Rust 侧 `stderr(Stdio::inherit())` 直接继承终端
3. **阻塞事件循环** —— `upgrade_in_event_loop` 不能做阻塞 IO。Python→Rust 起独立 `std::thread` 读 `BufReader::lines()`，收到才 `upgrade_in_event_loop`；Rust→Python 的 `writeln!` + **显式 `flush()`**
4. **管道缓冲 64KB** —— 控制消息（几十~几百字节）永远不塞得满
5. **子进程崩溃** —— 读线程 EOF（`lines()` 返回 `None`）即视为死了，UI 上显示「感知模块离线」。**不要搞 supervisor 自动重启**

不要为了 ergonomic 引入 `duct` / `os_pipe` —— spawn 一次读几行，`std::process` + `BufRead::lines()` 10 行够了，加依赖是净亏。

### 通道 2：图像帧 —— `/dev/shm`，**不能走 pipe**

1280×720 RGB = 2.7MB/帧 × 10fps = 27MB/s，Linux pipe 缓冲 64KB，**必然死锁**；base64 再 +33% 体积 +30% CPU。

```
Python: cv2.imencode('.jpg', frame, [IMWRITE_JPEG_QUALITY, 80])
        → 原子写 /dev/shm/em_frame.jpg（先写 .tmp 再 os.replace）
        → stdout 发 {"type":"frame_ready","path":"...","w":1280,"h":720}
Rust:   slint::Image::load_from_path(path)   ← winit/femtovg 后端默认开 image-decoders，workspace 的 image crate 已含 jpeg
        → weak.upgrade_in_event_loop(move |ui| ui.set_camera_frame(img))
```

`/dev/shm` 是 tmpfs、零拷贝，且「只保留最新帧」的语义天然正确 —— 摄像头场景丢帧无所谓。**原子写是必须的**，否则 Rust 可能读到写了一半的 JPEG。

### 最小 IPC 协议

**Python → Rust**（stdout，方向一）：

| type | 字段 | 时机 |
|---|---|---|
| `hello` | `fps, model, npu` | 启动完成报一次 |
| `presence` | `ts, occupants, inCount, outCount` | 1s 一次（对应 `sense` role） |
| `detection` | `ts, boxes:[{x,y,w,h,score}]` | 每帧（UI 要画框才需要） |
| `npu` | `ts, usage` | 1s 一次（替代 `npu_monitor.py` 的 `sudo cat`） |
| `alarm` | `ts, kind, message` | 仅告警时 |
| `frame_ready` | `ts, path, w, h` | 写完 `/dev/shm` 后 |

**Rust → Python**（stdin）：`set_server` / `swap_cameras` / `set_running` / `shutdown`。

---

## 六、WS 客户端放 Rust 侧的连带决定

规划文档里的三个 role，`console` 正好就是 Rust 主进程。有个选择题：

- **方案 A（推荐）**：Python worker 也起一条 `sense` 连接。IPC 只管本地帧和人数，服务器通信分两边。**每边做自己擅长的事，IPC 最干净。**
- **方案 B**：Rust 主进程同时开 `sense` + `console`，转发 Python 的 `presence`。少一层 RPC，但 Rust 侧多个转发线程。

**推荐 A。** `sense` 上行量是 1Hz 一行 JSON，别为了「统一」增加一层间接。

---

## 七、可执行路径

### 第 0 步 · 装工具链（本机已具备条件）

| 检查 | 结果 |
|---|---|
| Docker | **29.8.1 已运行** → `cross` 可用（podman 也在，可备选） |
| Rust | 未装。Fedora 44 仓库直接有 `cargo` / `rust` **1.98.1**，满足 Slint 1.18 的 edition 2024 |
| 网络 | `static.rust-lang.org` 200、`github.com` 200；`static.crates.io` 403 与 `ghcr.io` 401 是裸路径的正常响应（对象存储无索引 / registry 要 token），非被墙 |
| devcontainer | 本仓库无 `.devcontainer/`，CLI 在 `~/.local/bin/devcontainer` |

> 用户已批准安装 Rust 工具链。**当前搁置，未执行。**

### 第 1~3 步 · 消掉不确定性（判决性）

```bash
# 1. 一次性判决：Slint Rust 能不能跑
git clone --depth=1 https://github.com/slint-ui/slint-rust-template && cd slint-rust-template && cargo run

# 2. 验证本项目 298 行 .slint 在编译期能不能过（重点 radar-chart.slint 的 Path 元素）
#    build.rs: slint_build::compile("ui/app-window.slint").expect("Slint build failed");
#    src/main.rs: slint::include_modules!(); let ui = AppWindow::new()?; ui.run()?;
SLINT_STYLE=material-dark cargo run

# 3. 交叉编译
cp <官方>/Cross.toml .
cross build --release --target aarch64-unknown-linux-gnu
# 板子上 ldd 看缺什么 .so
```

`cross` 起不来时的备选：装 `gcc-aarch64-linux-gnu` + `libc6-dev-arm64-cross`，然后
`CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc PKG_CONFIG_ALLOW_CROSS=1 PKG_CONFIG_PATH_aarch64_unknown_linux_gnu=/usr/lib/aarch64-linux-gnu/pkgconfig cargo build --target aarch64-unknown-linux-gnu`。pkg-config 那套容易出错，**优先 cross**。

### 第 4~6 步

4. IPC：先只发一条 `{"type":"hello"}` 验证管道通不通，**不要一次写完**
5. 接 WS（按 [WS通信架构-ESP32与香橙派双device.md](./WS通信架构-ESP32与香橙派双device.md)）
6. RKNN + 跨线计数 + `/dev/shm` 帧 —— 最后做，且在板子上做

---

## 八、未验证的部分（不要在这些点上拍板）

1. **一行 Rust 都没编译过** —— 本机无 cargo，第 1~3 步就是为了消掉这个
2. **没验证本项目 5 个 `.slint` 在 Rust 编译期能过** —— 尤其 `radar-chart.slint` 的 `Path` + `MoveTo`/`LineTo`/`Close`。`.slint` 理论语言无关，但 `Path` 元素是后加的，**必须实测**
3. **没在香橙派上跑过任何东西** —— 不知道板子是 Wayland / 只有 X11 / 裸 DRM（决定 `backend-winit` vs `backend-linuxkms`），不知道 glibc 版本，不知道 `/dev/shm` 大小够不够
4. `opencv-rust` 的 aarch64 cross 能不能过没试 —— 但结论是「留 Python」，不验证不影响决策
5. `rknn-rs` 没编译过，只读了 `build.rs` 和 `lib.rs`
6. Slint 1.19 尚未发布，**用 `slint = "1.18"`，不要用 git 依赖追 master**

---

## 附：链接

- Slint 仓库 https://github.com/slint-ui/slint
- 交叉编译文档 https://github.com/slint-ui/slint/blob/master/docs/building.md#Cross-Compiling
- Rust 模板 https://github.com/slint-ui/slint-rust-template
- 官方 aarch64 CI https://github.com/slint-ui/slint/blob/master/.github/workflows/cross_containers_and_demos.yaml
- 跨线程推帧范例 https://github.com/slint-ui/slint/blob/master/examples/ffmpeg/lib.rs
- Rust / Python 同题对照 https://github.com/slint-ui/slint/tree/master/examples/async-io
- linuxkms 后端 https://slint.dev/docs/latest/slint/guide/backends-and-renderers/backend_linuxkms/
- 许可 FAQ https://github.com/slint-ui/slint/blob/master/FAQ.md
- rknn_api.h https://github.com/airockchip/rknn-toolkit2/blob/master/rknpu2/runtime/Linux/librknn_api/include/rknn_api.h
- rknn-toolkit-lite2 https://pypi.org/pypi/rknn-toolkit-lite2/
- rknn-rs https://github.com/darkautism/rknn-rs
- opencv-rust https://github.com/twistedfall/opencv-rust