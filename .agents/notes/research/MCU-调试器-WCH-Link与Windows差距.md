# WCH-Link / WCH-LinkE：Linux 相比 Windows 差多少

> 调研基准日 2026-10-10。用途：下位 MCU 选型（CH32V307）的调试器与开发环境取舍。
> 证据强度：**强** 官方手册/GitHub issue/整楼实测 · **中** 知名博客/单人实测 · **弱** 聚合文/单条评论。
> 结论一句话：**"能不能用" Linux 已基本追平，部分环节更好；真正差的是"官方 GUI 工具链 + 固件升级/救砖"这条应急链路。**

---

## 环节 × 平台 对照

| 环节 | Windows | Linux | 判定 |
|---|---|---|---|
| 编译（MRS2 / 开源 GCC） | ✅ | ✅ MRS2 Linux 版（.deb / .tar.xz，V2.5.0） | 无差 |
| **烧录（芯片）** | MRS / LinkUtility / WCHISPTool | ✅ `wchisp`、官方 `WCHISPTool_CMD`（多平台）、openocd | 无差，命令行更顺 |
| **调试（断点/单步）** | MRS 一键 Debug | ✅ `wlink` / OpenOCD + Cortex-Debug（需自配 launch.json） | ◐ 多一次配置 |
| **官方 MRS 里点"下载"** | ✅ | ⚠️ 历史上 Linux 版连"上传"图标都不显示 | ❌ 差（IDE 集成） |
| **官方 GUI 管理工具** | LinkUtility / WCHISPStudio | ❌ 无（WCHISPTool 自 v3.4 起 Wine 也失效） | ❌ 缺工具 |
| **固件升级** | 一键在线 | ⚠️ 仅第三方 `wlink-iap`（29★、停更、有刷砖记录） | ❌ **硬伤** |
| **救砖** | LinkUtility 能救 | ⚠️ LinkE 需**第二颗 LinkE**；"救回"几乎都走 Windows | ❌ **硬伤** |
| USB 枚举/驱动 | 官方 .inf，插上即用 | 须自建 udev + libusb；切模式会换 VID:PID | ◐ 需手工配 |
| 命令行 CI/自动化 | 一般 | ✅ 天然友好 | Linux 优 |
| 救 CH549 | 需 Zadig 换驱动 | ✅ `ch552tool` 直接用 libusb | **Linux 优** |

---

## 关键证据（原文）

### 官方 IDE
- **MRS1 Linux 版曾"能编译、不能烧"**（openwch/ch32v003 #16，Debian 11）：
  > "The MounRiver Studio can be downloaded, installed and used in Linux without problems. The examples can be imported and compiled, but it is **not possible to program** the CH32V003F4P6."
  > "The **Win installation of MRS always shows the 'upload' icon** … whereas **the Linux version never shows the 'upload' icon**."
  → 升级到 MRS 1.5 + 新工具链后，命令行 openocd 能正常烧。是"IDE 集成差"，不是"Linux 不行"。
- **MRS2 有 Linux 版且跟进到 2026**（官方 API `api.mounriver.com/...fetchRecent2?osType=LINUX`，`MounRiverStudio_Linux_X64_V2.5.0.tar.xz`，2026-06-30）。装机摩擦：Fedora 41→42 升级后曾崩，需容器跑旧版。[中]
- **WCH-LinkUtility / WCHISPStudio 只有 Windows**；**WCHISPTool_CMD 是官方多平台命令行**（v4.0，覆盖 CH32V30x/V317）。

### 开源工具
- **`wlink`**（345★，活跃）：README 把 **`WCH-LinkE CH32V305` 标为 "the recommended debug probe"**；WCH-Link CH549 注明"切模式需重刷"。Linux 需 `libudev`/`libusb`。
- **`wchisp`**（333★）：实测 **Linux 比 Windows 更稳**——
  > "It works as expected on Linux. On Windows, my experience has been much flakier."
- **WCH fork OpenOCD**：官方 `openwch/openocd_wch` **只有 Windows 二进制**（#4 要 Linux 版至今 OPEN）；`cjacker/wch-openocd` **Linux 编译会失败**（缺 jimtcl configure，#1 多人报）；解法见 `Seneral/riscv-openocd-wch` README。
- **probe-rs**：原生支持 WCH-LinkE(RV)，CH32V307 有 target yaml + auto-detect；**但 SDI print 至今未支持**（#3023 OPEN）。
- **pyOCD**：只支持 ARM，**CH32V 直接排除**。

### 固件升级 / 救砖
- **官方手册 6.3 明文：LinkE 离线升级"需要两个 WCH-LinkE"**。
- **Linux 升级只有 `wlink-iap`**（停更、单作者）——实测刷砖：
  > "attempting a firmware update with this tool resulted in bricked devices, both for the WCH-Link and WCH-LinkE."
- **变砖头号原因 = MRS/LinkUtility 弹窗升级**（EEVBlog / Reddit / openwch 一致）。
- **"Linux 不枚举、Windows 才枚举"**：
  > "It wouldn't enumerate on Linux. However, it would enumerate on Windows, and using the Windows updater I updated the WCH LinkE and then it would enumerate on Linux."
  → 根因：砖掉后报 USB ID `4348:55e0`，**Linux 内核不认**（CH341 驱动只认 `4348:5523`）。
- **救 CH549**：Linux 用 `ch552tool` 可自救；**LinkE 不行**（CH32V305FBP6 无 BOOT 引脚）。

---

## VID:PID 对照

| VID:PID | 含义 |
|---|---|
| `1a86:8010` | WCH-Link/LinkE **RISC-V 模式**（正常） |
| `1a86:8011` | 老款 WCH-Link **ARM/HID 模式** |
| `1a86:8012` | **ARM/DAP 模式** |
| `4348:55e0` / `1a86:55e0` | **ISP/BOOT/变砖恢复模式** |
| `1a86:55dd` | LinkE **高速 JTAG**（非调试固件模式） |

udev 规则要覆盖全部，尤其 `4348:55e0`（否则救砖时又因权限失败）。

---

## Linux 避坑清单

1. **一次买 2 颗 WCH-LinkE**（LinkE 救砖硬需求 + 保险）。
2. **装依赖**：`libudev-devel libusb1-devel`（Fedora）。
3. **配全 udev**：`1a86:8010` / `8012` / `4348:55e0`，`GROUP="plugdev"` + `MODE="0660"`，`udevadm control --reload-rules && udevadm trigger`。
4. **先确认模式**：`lsusb | grep -iE "WCH-Link|WinChipHead"`，要 `1a86:8010`（RV）。
5. **首选 `wlink`** 烧录/调试；别用 pyOCD。
6. **自编译 WCH 版 OpenOCD** 时按 `Seneral/riscv-openocd-wch`（修 jimtcl + `--disable-ch347 --disable-werror`）。
7. **MRS 弹"升级固件"别盲点 Yes**（变砖头号原因）；**别随手 `wlink-iap` 盲刷**。
8. **Cortex-Debug ≥1.5.0 要求 GDB9+**，与沁恒 GCC8.3 内置 GDB8 冲突 → 降级到 1.4.4 或用系统 `gdb-multiarch`。
9. **兜底留 `wchisp`**：Link 全砖，芯片照样烧（只是不能在线调试）。
10. **备一台 Windows（或 VM）**：所有"救回来"的案例几乎都靠它。

---

## 未查到 / 存疑

- 21ic BBS / 沁恒官方 BBS 全文（SPA/登录/反爬）。
- 任何一篇"Linux vs Windows 系统性量化对比"文章。
- CH32V307 + wlink/OpenOCD 在 Linux 下"零折腾"的完整成功报告。
- `1a86:8011` 是否仍出现在现代 LinkE（现主要为 8010/8012/55e0）。
- `openwch/openocd_wch` 官方 Linux 构建脚本是否真能跑通（无成功记录）。

---

## 来源

- 官方：`WCH-LinkUserManual.PDF`（V2.4 / V1.6）、`WCH-LinkE使用说明` V1.6、`WCHISPTool_CMD` 下载页、MounRiver 官方 API
- GitHub：`openwch/ch32v003#16`、`ch32-rs/wlink`（+issue #88/#6）、`ch32-rs/wchisp`、`Community-PIO-CH32V/platform-ch32v#47`、`cjacker/wch-openocd#1`、`treideme/openocd-hacks#1`、`probe-rs#3023`、`cnlohr/ch32fun#662`、`cjacker/wlink-iap`
- 论坛/博客：EEVBlog《Reflashing a bricked WCH-LinkE》《Mounriver Studio… under linux》、Reddit r/embedded《Pissed about WCH LinkE not working》、blaat-schaap《Debugging the CH32V Series》、腾讯云《便宜但多坑：吐槽沁恒微》
