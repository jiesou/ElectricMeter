# 下位 MCU 选型：有线以太网 + 业务核心

## 需求

1. Linux Desktop 开发体验 | 官方 IDE / 编译链 / 烧录工具原生支持 Linux
2. 兼 PlatformIO、Arduino | 目标芯片在 PlatformIO 有可用 platform/framework；有维护中的 Arduino core
3. 官方工具链体验也不差 | 官方 IDE + 官方 SDK + 官方烧录器在 Linux 可用且可用度高
4. 烧录、调试工具方便，如串口直接烧录（最好）或者daplink，不需要专有的烧录器、仿真器
5. 支持以太网 | 形态不限：MAC+PHY 内置 / 仅 MAC 外挂 PHY / SPI 网卡，以方便为准
6. 价格、算力、内存、外设数量

非常明确：ESP 只作 WiFi 模块；新 MCU 负责有线以太网与核心业务逻辑，外接 ESP（UART）、RS485 电能表（UART）、继电器/断路器（GPIO）。

排除：Espressif、ST、GD32、Microchip、NXP、Raspberry Pi（RP2040/RP2350）。重点：沁恒、瑞萨，以国产为主，目标是学新工具链。

---

## 结论

**首选 CH32V307RCT6（LQFP64，64 脚）** —— 就是 VCT6 的「少引脚版」：同芯片家族、同 MRS / `wchisp` 工具链、同 Arduino 路径、同样内置 10M 以太网 PHY，只是引脚 100→64、封装 14×14→10×10mm，更好焊，且是标准在售 SKU。

> **纠正（2026-10-10 复核）**：本文早前漏列 RCT6，并误以为「V307 只有 68/100 脚带以太网」。现行数据手册 V3.9 的引脚图明确 **CH32V307RCT6 有 `PC6/RXP(37) PC7/RXN(38) PC8/TXP(39) PC9/TXN(40)`**，即 64 脚同样带以太网（QFN68 的 WCU6 亦然）。

1. **首选 CH32V307RCT6（LQFP64）**：R1–R5 全过，比 VCT6 少 36 个引脚。单价约 ¥14–21。
2. **同家族备选 CH32V307WCU6（QFN68）**：现货更足（329），但 QFN 手焊稍难、略贵。
3. **CH32V317WCU6（QFN68）**：内置 10/100M PHY（强于 V307 的 10M），但 R2 不过（PIO 无 arduino framework、无 Arduino core）。
4. **备选 RA6M5（LQFP176）**：R1、R3、R5 通过；R2 只在 Portenta C33 板型上成立。单价约 ¥55，约为 V307 的 3 倍，需外挂 PHY，但资源充裕（2MB Flash / 512KB SRAM）。
5. 其余候选 R2 不过，或只有社区 core，或过度配置，不推荐。

> **选型取向**：越经典 / 走量越大 → 越便宜、越好买。优先标准在售 SKU（V307 家族），避开偏门封装（如 CH32V317TCU6 QFN36、V317VCT6 立创 0 现货）。

## 排序表（R2 按原表取 AND）

| 型号 | 封装 | R1 | R2 | R3 | R5 | 单价（分销快照） | 结论 |
|---|---|---|---|---|---|---|---|
| **CH32V307RCT6** | LQFP64 | ✅ | ✅ PIO board 含 arduino + 社区 Arduino core | ◐ `wchisp` 烧录 Linux 可用；调试器 GUI 仅 Windows | ✅ 千兆 MAC + 内置 10M PHY | ¥14–21（现货 46+449） | **首选（少引脚）** |
| CH32V307WCU6 | QFN68 | ✅ | ✅ 同上（variant 复用 `ch32v307_evt`） | ◐ 同上 | ✅ 同上 | ¥12.9–19.5（现货 329） | 同家族备选 |
| CH32V307VCT6 | LQFP100 | ✅ | ✅ 同上 | ◐ 同上 | ✅ 同上 | ¥13.8–20.8（现货 777） | 引脚多，不选 |
| RA6M5 | LQFP176 | ✅ e² studio / FSP Linux 安装器 | ◐ PIO 与官方 Arduino 仅 Portenta C33 板型 | ✅ RFP V3 Linux CLI；EK 板载 J-Link | ✅ 10/100 MAC + 外挂 PHY | ¥55（库存 0） | 备选 |
| CH32V317WCU6 | QFN68 | ✅ | ✗ PIO 无 arduino framework、Arduino 无 V317 变体 | ◐ | ✅ 内置 10/100M PHY | ¥13.6–18.1（现货 231） | 放弃 Arduino 才考虑 |
| CH32V317TCU6 | QFN36C4 | ✅ | ✗ 同上 | ◐ | ✅ 内置 10/100M PHY | 未查到 | 偏门，不选 |
| CH32V208WBU6 | QFN68 | ✅ | ✗ 无 Arduino | ◐ | ✅ 内置 10M PHY | ¥7.6–11.3（现货 415） | 放弃 Arduino 才考虑 |
| CH32V407RET6 | LQFP64 | ✅ | ✗ 无 Arduino | ◐ | ✅ 内置 10/100M PHY | ¥7.2（现货 1007） | 太新，`wchisp` 未支持 |
| CH32H417QEU6 | QFN128 | ✅ | ◐ 仅社区 Arduino core，自测未复现 | ◐ | ✅ 10/100M + RGMII | ¥24 | 双核 400MHz 过度配置 |
| AT32F407VGT7 | LQFP100 | ✅ AT32 IDE Linux 包 | ✗ PIO 只有 at32firmlib，无 Arduino | ✅ | ✅ 外挂 PHY | ¥14–22 | 排除 |
| AT32F437VGT7 | LQFP100 | ✅ 按系列推断 | ✗ 同上 | ✅ | ✅ 外挂 PHY | ¥22 | 排除 |
| BL618 | QFN56 | ◐ | ✗ 无 PIO；Arduino 只在 Windows 测过 | — | ◐ 速率资料冲突 | 未查 | 排除 |

## 候选细节

### CH32V307 家族（首选；按引脚数从少到多：RCT6 < WCU6 < VCT6）

三颗同芯片、同工具链，差别只在封装/引脚数。**都带以太网（千兆 MAC + 内置 10M PHY）**。

- **核心**：QingKe V4F 144MHz；256K Flash / 64K SRAM；8 路 USART；-40~85℃（订购代码 6）[强，DS V3.9]
- **封装与引脚**（DS V3.5 引脚图 + 订购表）[强]：
  - **CH32V307RCT6** —— LQFP64M，10×10mm，64 脚，GPIO 51。**PC6/RXP(37) PC7/RXN(38) PC8/TXP(39) PC9/TXN(40)** 已引出 → 有以太网。
  - **CH32V307WCU6** —— QFN68X8，8×8mm，68 脚，GPIO 54。引脚图同样有 PC6/RXP…PC9/TXN。
  - **CH32V307VCT6** —— LQFP100，14×14mm，100 脚，GPIO 80。
- **以太网**：千兆 MAC + 内置 10M PHY，无 100M；需要 100M 时外挂 PHY [强，DS]。内置 PHY 占用 PC6–PC9，与 TIM8/SDIO 冲突；启用以太网后 SDIO_D0/D1、I2S3、SPI3_MOSI 的默认脚随批号变化 [强]
- **工具链**：MRS 2 Linux x64 V2.5.0 官方发布（.deb / .tar.xz）[强，官方 API]；`WCHISPTool_CMD` 与开源 `wchisp` 在 Linux 可用，`wchisp` 覆盖 VCT6(0x70)/RCT6(0x71)/WCU6(0x73)，**串口/USB ISP 直烧，不需要专用烧录器** [强]；WCH-LinkUtility、WCHISPStudio 仅 Windows [强]；官方 EVT 是 MRS 工程，没有 Makefile / CMake [强]
- **PlatformIO**：`Community-PIO-CH32V/platform-ch32v`（社区维护，未进 PIO registry，需 git 安装）[强]。三颗都有 board：`genericCH32V307RCT6` / `genericCH32V307WCU6` / `genericCH32V307VCT6`，`frameworks` 均含 **arduino** [强]
- **Arduino**：PIO 的 arduino framework 走社区 `Community-PIO-CH32V/ArduinoCore-CH32V`（variant 只有 `ch32v307_evt`，即复用 VCT6 引脚定义；README 自标 EXPERIMENTAL，末次提交 2023-05）[强]。官方 `openwch/arduino_core_ch32` 只覆盖 VCT6 [强]。**注意：Arduino core 里没有以太网**，官方 issue #38 维护者明说要用 SDK 例程集成 [强]
- **RAM**：64K SRAM；lwIP 在 V307 上实测占用 35KB [中，单人实测]。可在用户选项中把 Flash/SRAM 划分换到 192K + 128K [中]
- **风险**：
  - Arduino 与 PlatformIO 都是板级定义，自制板的引脚定义需要改（待核）；RCT6/WCU6 直接套 VCT6 的 variant，引脚映射需自行核对
  - MRS Linux 安装脚本用 sudo 写 `/usr/lib`、`chmod -R 777` 并带 `--no-sandbox`，装在开发机上要留意
  - 官方独立勘误表未找到，只有 DS / RM 中的批号注释 [强]
  - 价格（立创自营快照 2026-10-10）：RCT6 ¥21.11(1+) / ¥16.41(30+)，现货 46；WCU6 ¥19.45(1+) / ¥14.75(30+)，现货 329；VCT6 ¥20.84(1+) / ¥16.31(30+)，现货 777

### RA6M5（备选）

- **核心**：Cortex-M33 200MHz；2MB Flash / 512KB SRAM；SCI ×10 [强，DS R01DS0366EJ0150 Rev.1.50]
- **温度**：BGA 为 -40~85℃，LQFP 为 -40~105℃。选 LQFP 版更易焊接、温度范围更宽 [强]
- **以太网**：ETHERC ×1，MII / RMII，10/100M，需外挂 PHY。Portenta C33 板载 100M PHY，PHY 型号未查 [中]
- **工具链**：e² studio 2026-07 与 FSP 6.6.0（2026-08-31）有 Linux 安装器，Linux 版含 ARM GNU 工具链。官方只验证了 Ubuntu 22.04，本机 Fedora 不在列表，建议放进 devcontainer [强]。RFP V3.15 支持 Linux 命令行，GUI 不支持 Linux [强]
- **PlatformIO**：`platform-renesas-ra` 1.9.0 收录 `portenta_c33` 板型，芯片即 R7FA6M5BH [强]
- **Arduino**：官方 `ArduinoCore-renesas` 1.6.0（2026-06-03 发布，最后提交 2026-05-28）。`variants/PORTENTA_C33` 绑定 Portenta 引脚，自制板要改 variant [强]
- **价格**：Future 中国 ¥55.14/片（LQFP，库存 0，快照）；EK-RA6M5 $54.38 [中/弱]。BGA176 未查
- **风险**：分销库存多为 0；Renesas 标注寿命至 2041 [中]

### 其他

- **CH32V317 家族**（与 V307 同系列、同 SDK）：内置 **10/100M PHY**（强于 V307 的 10M），千兆 MAC。封装 QFN36C4（TCU6，36 脚）/ QFN68（WCU6）/ LQFP100（VCT6）；QFN36 的引脚图里 **MDITP/MDITN/MDIRP/MDIRN + VDD_ETH/VDDK 是独立 PHY 脚，不占 GPIO** [强，DS V3.2/V3.5]。PIO 有 board（`genericCH32V317TCU6/WCU6/VCT6`）但 **frameworks 不含 arduino**；官方 Arduino core 无 V317 变体；ch32fun 也不支持 V317。→ **放弃 R2 的 Arduino 才考虑**。注意 V317VCT6 立创 0 现货需订货。
- **CH32V208**（无线型：BLE 5.3 + 10M 以太网 MAC+PHY）：封装 QFN28(GBU6)/QFN48(CBU6)/LQFP64M(RBT6)/QFN68(WBU6)，引脚最少（28 脚）。**以太网只在 QFN68/LQFP64 引出**（ETH_RXP/RXN/TXP/TXN = PC6–PC9），QFN48/QFN28 无以太网 [强，DS V2.7]。PIO 有 board 但无 arduino；官方 core 不覆盖；ch32fun 有以太网例程 `examples_v20x/eth_sfhip` [强]。→ 放弃 Arduino 才考虑；R2 不过。
- **CH32V407/467**（2026-08 新发布）：200MHz V3V + RVV；内置 10/100M MAC+PHY；封装 LQFP64(RET6)/QFN68(WEU6)/LQFP100(VET6)。PIO board 2026-06 才加、无 arduino、**`wchisp` 尚不支持**（只有 MRS+官方 SDK 路径）[强]。→ 太新，不选。
- **CH32H417**：双核 V5F 400MHz + V3F 160MHz；960K Flash / 896K SRAM；10/100M 内置 PHY，RGMII 外接 1G [中]。README 写 "100 Gigabit Ethernet MAC" 明显是笔误，以数据手册为准。对本任务过度配置。
- **CH32V407/467、CH565/569**：100M 或千兆，但 PIO 板无 Arduino，R2 不过 [强]
- **AT32F407 / 437**：R1、R3、R5 过，R2 不过：无 Arduino，PIO 官方 GitHub 平台不在 registry [强]
- **BL618**：RMII 外接 PHY，速率资料冲突（英文 DS 写 10/100M，中文 RM 写仅 100M）[强]；无 PIO；Arduino 核心只在 Windows 测过 [强]

## 排除项

- **无以太网**：HC32F460、HPM6200 系列、RA6E2
- **R2 不过（无 Arduino）**：HPM6364 / HPM6750（先楫）、HC32F4A0（华大）、N32G457 / N32H785（国民）、APM32F407（极海）、MM32F5277（灵动）、RA6M4 / RA6M3（瑞萨，PIO 与 Arduino 均无该板型）
- **R2 不过（PIO 与 Arduino 皆无该芯片）**：RA6M2、RA6E1、RA8M1
- **非 MCU**：CH395（外置以太网控制器）
- **非国产且 PIO 无板**：Nuvoton M480

## 待定事项

1. **R2 取 AND 还是 OR？** 原表写的是「PlatformIO 有可用 platform/framework」且「有维护中的 Arduino core」，本文按 AND。若改成 OR，还会进入 CH32V317、CH32V407/467、CH32H417、CH565/569、AT32F407/437/457、BL618。
2. **R6–R8 未定义。** 竞争指标里的 R7 单价、R8 算力没有阈值，本文只给了单价和资源，没有打分。
3. **资源是否够。** V307 只有 64K SRAM，需要确认业务逻辑 + lwIP 够用；RA6M5 资源充裕但价格约 3 倍。
4. **10M 是否够。** 控制类流量够用。若需要 100M，只能选 CH32V317（无 Arduino），或 V307 / RA6M5 外挂 PHY。
5. **RCT6 以太网需 FAE 书面确认。** 数据手册引脚图/引脚表都显示 RCT6 有 PC6–PC9 = ETH_RXP/RXN/TXP/TXN，但 Table 2-1-1 的 Ethernet 行是跨列合并单元格，未逐型号列；建议下单前向 WCH 确认一次。

## 未查项

- MRS 未装 IDE 实测；RA6M5 在 Fedora 上未实测
- WCH、Renesas 的独立勘误表未找到 / 未查，只有数据手册注释
- 人民币价多为分销快照；RA6M5 BGA176、PHY 型号未查
- CH32V307 自制板的 Arduino 引脚适配未实测
- CH32V317TCU6（QFN36）、CH32V208 各封装未逐一分销比价

## 来源

- WCH CH32V20x/30x 数据手册 V3.5 / V3.9（引脚图、引脚定义表、订购表）[强]；官方仓库 `openwch/ch32v307`、`openwch/arduino_core_ch32`、`openwch/ch32v407_ch32v467`、`openwch/ch32h417`、`openwch/ch569` [强]
- 社区 `Community-PIO-CH32V/platform-ch32v`（`boards/genericCH32V307RCT6|WCU6|VCT6.json`、`builder/frameworks/arduino.py`）、`ArduinoCore-CH32V`、`ArduinoCore-CH32H4` [强，社区维护]
- MounRiver 官方 API 与 MRS 2 V2.5.0 Linux 包 [强]；`ch32-rs/wchisp`（`devices/0x17,0x19,0x26-*.yaml`）[强]；`cnlohr/ch32fun`（`examples_v20x/eth_sfhip`、`extralibs/ch32v208_eth.h`）[强]
- Renesas RA6M5 数据手册 R01DS0366EJ0150 Rev.1.50 [强]；RFP V3.15 手册 R20UT5452EJ0100 [强]；FSP v6.6.0 [强]；`platform-renesas-ra` 1.9.0 [强]；`arduino/ArduinoCore-renesas` 1.6.0 [强]
- 雅特力 AT32 IDE UM0009 V1.1.1 [强]；`ArteryTek/platform-arterytekat32` [强]
- 博流 BL616/BL618 DS 1.5 [强]；`bouffalolab/arduino-bouffalo` [强]
- 分销快照：立创商城 so.szlcsc.com、世强、Future、LCSC（2026-10-10）[中/弱]
