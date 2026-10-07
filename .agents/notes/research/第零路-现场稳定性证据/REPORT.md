# 比赛现场「第零跳」蜂窝外网稳定性 —— 工程手段与实战证据

> 场景：会展中心 / 体育馆 / 高校体育馆，人群密集。一路极其稳定的蜂窝外网接入当第零跳，后接自备交换机/服务器。形态为 CPE 或随身 WiFi。
> 本报告所有结论均附原文引用 + 链接 + 时间。证据分级见文末第 5 节。

---

## 0. 先说结论：这个场景里「稳定」的物理上限在哪

**先说最反直觉的一条：在满场状态下，单路蜂窝想做「极其稳定」在物理上是不可能的，你能做的只是把失败概率从「必然」压到「小概率」，并且让失败可被兜住。**

硬证据（不是感觉）：

- 美国圣母大学 8 万人球场、中立主机 small-cell DAS（每运营商最多 **129 个不同 PCI**）实测，满场时：
  - 浏览会话失败率 —— Wi-Fi 6GHz **3.9%**、T-Mobile（SA）**25.0%**、Verizon **24.7%**、AT&T **36.6%**
  - Verizon 依赖 EN-DC（NSA），P90 首字节时延 **5,983 ms**，图片上传失败率 **46%**
  - 原文："AT&T and Verizon's reliance on EN-DC exposes latency bottlenecks inherent to shared, neutral-host LTE DAS under load, underscoring that **standalone 5G is essential for stadium latency stability**."
  - 来源：arXiv 2607.16008v1（2026-07-17）https://arxiv.org/html/2607.16008v1
- 同一球场的上行实测：100 MHz 的 n77 载波，比赛日**下行中位 11.46 Mbps，上行中位只有 0.58 Mbps**；10 MHz 的 b5 下行 0.90 Mbps，**上行 4.37 Mbps**。
  - 原文："high-frequency TDD bands in the uplink are severely bottlenecked in both the spectral and temporal domains. Despite transmitting near maximum 3GPP power limits, propagation loss inherent to high-frequency bands restricts UEs to low MCS indices and low PRB allocations, **even in unloaded networks**."
  - 来源：arXiv 2604.04371 https://arxiv.org/pdf/2604.04371

⇒ **场馆里最稀缺的资源不是下行带宽，是上行。** 第零跳的所有动作都应该围绕「上行」来做。

---

## 0.0 TL;DR —— 十条最有效的动作（按性价比排序）

1. **找运营商买「大型活动/直播专项保障」**，而不是堆硬件。2026 年中国移动有基于 5G-A 超级上行的「五重 VIP 保障」，官方口径「拥塞场景资源调度，单位时间有效数据发送量达**普通用户 2–4 倍**」；中兴在苏超和胡彦斌演唱会卖过「5G-A 场馆加速包」。这是唯一能真正改变「基站调度器怎么对待你」的手段。
2. **用 RJ45 有线，不要 WiFi。** 同设备实测：WiFi Ping 108.9 ms vs 有线 Ping 34.8 ms，**差 74 ms**。
3. **双运营商（务必不同运营商）双 CPE**，同运营商同基站会一起挂。
4. **把网络模式切到 SA 优先**（NSA 的 4G 锚点在场馆里通常是最先堵死的一环）。华为 CPE 官方支持，且官方建议"优先使用 SA"。
5. **锁频段/锁小区**防乒乓切换 —— 但要知道锁频段会**杀掉载波聚合**，锁单一 PCI 可能因基站夜间关站而失联。
6. **设备放窗边/制高点，别放人群里和金属上。** 判据用华为官方给的阈值：**SINR ≥ 16 dB、RSRP ≥ -85 dBm** 才算正常。
7. **准备「4G only」和「5G」两套配置**，人满后实测哪套好。满场时 4G 经常比 5G 稳。
8. **不要用内置电池的随身 WiFi 长期插电**（华为官方承认长期满电会鼓胀）。要么买无电池 CPE，要么花几十块改直供电。
9. **接受「切换必然断连」这个事实**，让业务层实现重连；要真的不断，只有包级聚合隧道（SpeedFusion / OpenMPTCProuter）。
10. **赛前一天搭建期是唯一的黄金测试窗口**，把锁频、切换、公网可达性全部实测一遍。

---

## 1. 「稳定」的可操作清单

### A. 蜂窝侧

#### A-1 【最重要】改 NSA → SA，或者干脆别用 mid-band 做上行锚点

**原理**：NSA（EN-DC）下控制面挂在 4G 上，用户面才能用 5G。场馆的 4G 锚点通常是共享的中立主机 LTE DAS，人一多就堵在锚点上，5G 载波再好也被拖死；SA 全程走 5G 核心网，绕开这层。

**怎么做**：
- 选 SA 覆盖好的运营商/卡；CPE 里把网络模式设为「5G 优先 / SA 优先」，别用「自动」。
- 如果只能 NSA：**锁 4G 锚点频段**（见 A-2），别让锚点在拥堵的 DAS 频段上。
- 极端情况下**主动降到 4G**：反例见 A-6。

**证据**：
- 圣母大学实测（同上）：T-Mobile 走 **5G SA 且绕开 legacy LTE small-cell DAS**，拿下最低中位 TTFB 504 ms、P90 浏览耗时劣化仅 1.3x；AT&T/Verizon 靠 EN-DC，P90 劣化 2.8x / 4.8x。
- 华为官方 FAQ 直接承认掉 4G：*"5G网络信号可能会受到距离、发射源位置、阻碍物、设备损耗等的影响，**信号不好时网络可能会掉到4G**"* —— https://consumer.huawei.com/cn/support/content/zh-cn00761694/

**怎么开 SA（华为 CPE 官方步骤）**：
> "CPE支持3种5G组网模式：NSA（非独立组网模式）、SA（独立组网模式）、SA+NSA。"
> 1. 浏览器进 `192.168.8.1` 或 `192.168.118.1`（具体看 CPE 铭牌）
> 2. 移动网络 > 移动网络搜索（或 网络设置 > 移动网络 > 移动网络搜索），勾选支持 5G 网络
> 3. 选择组网模式，保存
>
> **官方明确建议**：「**如果您确认您所处位置运营商已经开通SA（独立组网）网络，建议您优先使用SA网络。**」若不确定则选 SA+NSA。
> ⚠️ 官方也给出副作用：「SA+NSA 组网模式下，网络优先驻到 SA。**如果驻册 SA 成功，无法收发短信。**」
> https://consumer.huawei.com/cn/support/content/zh-cn00794553/

**中英差异提醒**：国内三家 2020 年底起大规模建 SA，一二线城区基本 SA 覆盖；但**你的 CPE 支不支持 SA、后台有没有开 SA，是另一件事**。很多随身 WiFi 默认 NSA，且部分型号（华为官方明确）不支持锁 5G 频段。

---

#### A-2 锁频段 / 锁小区 / 锁 PCI：防乒乓切换，但有两个大坑

**原理**：CPE 默认由基站的切换/重选算法决定驻留哪个小区。在多个小区信号接近的场馆里，这会导致频繁重选 —— 每次重选都是一次业务中断 + 时延尖峰。锁到单小区/单频点，等于把决策权从网络拿回自己手里。

**怎么做（按设备分）**：

| 品牌 | 路径 | 支持粒度 | 备注 |
|---|---|---|---|
| 烽火 LG6121F | 开发者选项 → 锁小区 | 填频点 + PCI | 评测原文："**如果你的CPE用于室内AGV小车，使用锁小区功能后CPE就可以稳稳留在室内小区，哪怕到窗边也不会跑到室外基站上去**" https://zhuanlan.zhihu.com/p/500984484 |
| 华为 5G CPE Pro / Pro 2 / Win | 开发者选项 → 锁频段（可锁 Pcell 的 Band/ARFCN/PCI + Scell 频段） | Band / ARFCN / PCI | 官方文档 https://consumer.huawei.com/cn/support/content/zh-cn15801749/ |
| 华为随行WiFi 5 / 5 eSIM | 高级设置 > 系统 > 系统设置 → 开发者选项 → 锁频段/锁频点/锁小区 | Band / ARFCN / PCI | 官方明确：**"5G产品不支持锁5G频段"**、*"建议依次选择1、3、5、8频段进行尝试对比测试"* https://consumer.huawei.com/cn/support/content/zh-cn15961842/ |
| 中兴 MU5001 等 | 192.168.0.1 → 高级设置→其他→开发者选项→网络调试 | 5G 锁频/锁小区 | ⚠️ **中兴填错参数有变砖风险**；烽火填错重启可恢复 |
| TP-Link Deco X50-5G | App → More > Internet > Cell Lock | EARFCN + PCI | 官方 https://www.tp-link.com/baltic/support/faq/4419/ |
| MikroTik ATL 5G R16 | `/interface lte cell-lock` | PCI + 多个 ARFCN | 论坛 https://forum.mikrotik.com/t/multiple-lte-cells-lock-atl-5g-r16/262382 |
| 移远模组（DIY 方案） | AT 指令 | 4G/5G 小区 | 见下方 |

**AT 指令（最底层，DIY/软路由方案用得到）** —— 移远官方中文社区 2024-08-19：
```
锁 4G 小区：AT+QNWLOCK="common/4g",<0关/1开>,<频点号>,<小区号>
            例：AT+QNWLOCK="common/4g",1,1650,386
锁 5G 小区：AT+QNWLOCK="common/5g",<小区号>,<频点号>,<SCS>,<频段>
            SCS: 0=15k 1=30k 2=60k 3=120k 4=240k
            例：AT+QNWLOCK="common/5g",815,627264,30,78
```
https://forumschinese.quectel.com/t/topic/5019

**坑 1：锁频段会杀掉载波聚合。** 英国 ISPreview 论坛的锁频指南把这点讲得最清楚：
> "If you use band locking, you get a cake or cakes picked by the baker, and none of them can be a colour you said you didn't want... **This is another downside to band locking.** If you were trying really hard to get given a lemon drizzle cake by saying 'I only want a yellow cake', you won't get any extras."
https://www.ispreview.co.uk/talk/threads/band-and-cell-locking-guide.42174/（2024-07-16）

作者本人的实战：*"I got my shiny new 5G home broadband and it worked great for a couple of days on the automatic settings, then downgraded to unusably slow (<2Mbit/s download) 4G broadband. **Cell locking has (touch wood) got me back to a fast and reliable 5G connection.**"*

**坑 2：锁小区可能把你自己锁死。** 同文：*"I did manage to soft-lock my router using cell locking, but taking the SIM out and then doing a factory reset sorted it out."*
移远论坛的提问者点出更实际的问题：**基站夜间会关掉部分 PCI**（"因为夜间基站会对PCI: 499进行关闭！"），锁单一 PCI 会直接失联。

**坑 3：NSA 下锁 5G 塔会导致无法注册。** GL.iNet 论坛：*"If I lock to a 5G tower, the SIM card won't register. **needs LTE to be enabled**. You should enable Open LTE and 5G NSA bands."* https://forum.gl-inet.com/t/x-3000-lock-to-5g-towers/44544

**实操建议**：锁频段（不锁 PCI）比锁小区安全得多；要锁 PCI 就锁「信号次好但负载低」的那个，别锁最强 —— InvisaGig 的实测口径：*"**Tower A (One 5G Band): 2x faster speeds despite weaker signal. Tower B (Two Aggregated LTE Bands): Stronger signal, but slower speeds.**"* https://invisagig.com/locking-onto-a-cell-tower-with-a-cellular-modem/

**顺带：N79 是拥堵场馆的隐藏解。** 少数派保姆级教程作者原文：*"如果环境中有 N79 的话，**可以使用支持 N79 的设备锁定 N79 频段（我就是这么使用的）**"* —— 因为 4.9GHz 只有少数旗舰机支持，**用户密度天然低**。代价是穿墙极差。
https://sspai.com/post/93255

---

#### A-3 外接天线：能做，但先看三个数

**原理**：CPE 内置天线是 2×2~4×4 的小尺寸全向天线；外接高增益定向天线 + 对称低损馈线可以改善 SINR。但**天线只改善链路，不增加基站容量**。

**怎么做的优先级顺序**（深圳海粤丰通讯的"三级台阶"，逻辑正确）：
1. **换位置**（成本 0）：设备挪到窗边、高处，前后各测一次
2. **外接天线**：CRC-9 / TS-9 转 SMA，外接全频段天线，天线放到窗玻璃上
3. **室外天线**：室外定向天线 + 低损馈线

原文："**每上一级台阶前，都用上一级的实测数据说话。跳级消费是天线行业最常见的技术性浪费。**"
https://hyfantenna.com/guides/cable-cpe-antenna-upgrade-path/

**关键数字 1 —— 增益预期别信广告**。Waveform（美国天线头部厂商，自己卖天线）的原话：
> "Many people see an increase in data rates of between **50% and 200%** with our MIMO Antenna Kits. **But some people see much less.**"
> "**We'd be surprised if you saw better data rates immediately upon connecting the antennas. Be prepared to spend an hour or two to find the right location and direction for your antennas!**"
> 前置条件：*"if the signal outside your building isn't usable to begin with, MIMO antennas might not help"*
https://www.waveform.com/guides/mimo-aiming-guide

**关键数字 2 —— 延长线损耗（这是最容易被忽略、也最致命的）**：

| 线材 | @2.4 GHz | @5 GHz / 3.5GHz | 实用长度上限 |
|---|---|---|---|
| RG316 | 1.46 dB/m | 2.15 dB/m | < 1 m |
| RG58 | 0.93 dB/m | 1.05 dB/m | ≤ 3 m |
| LMR-240 | 0.26 dB/m | 0.41 dB/m | ≤ 10 m |
| LMR-400 | 0.217 dB/m（6.6 dB/100ft @2.4G） | — | 长距首选 |
| LMR-100 | — | 1.58 dB/m @3.5GHz | — |
| 连接器 | 每对 0.1–0.3 dB | | |
来源：https://tejte.com/blog/mimo-antenna-port-mapping-alignment-cable-loss/ ；https://waveshed.io/tools/coax-loss

**两条铁律**：
- **每 3 dB 功率减半，且双工链路上损耗吃两次**（发射被砍 + 接收灵敏度被砍）。
- 经验法则原文："**if cable attenuation exceeds 3 dB per path, expect MIMO throughput to fall below 70% of spec**"

**关键数字 3 —— 两路必须对称**。TEJTE 口径：ΔSINR ≤ 3 dB 才算健康，等长误差 ±5 cm 内、损耗差 ≤ 0.5 dB。实测对比：*"a dual-Yagi setup with LMR-240 cables maintained a steady -72 dBm RSRP at 5 km, while an **RG58 run of equal length fell to -78 dBm. That 6 dB difference halved upload speed** despite identical antennas."*

**中文侧的实测经验值**：
- 少数派作者：*"我宿舍手机信号 -105，但**智选 381 可以最低干到 -88**"*（CPE 本身的天线/接收就比手机强 17 dB）
- 烽火 CPE 官方口径：8 根 4/5G 天线（中低频 4 + 高频 4），收发 2T4R
- 中兴原厂 5G 外接天线（适配 G5TS/G5Pro/MC801A1，**双 TS-9/SMA，5 米线**，IP65）¥299 —— 注意 5 米线本身的损耗

**⚠️ 外接天线的物理坑（少数派原文）**："有部分 CPE 是可以加外接天线的，比如烽火一代和二代。但**天线的馈线比较粗硬，且需要尽量避免弯折**，这对于空间较小的地方不太友好。"

**✅ 更工程化的正解：把射频搬到室外，室内走网线。**
- 少数派原文介绍鲲鹏 NBCPE："分为室外机和室内机，直接让室外机充当天线。通过 **POE 线为室外机供电并回传数据**，再由室内机将信号分发给终端设备。相对来说**网线比馈线便宜且更好布线**"
- 同一结论东西方一致。Waveform/TEJTE：*"At that point, **mount the modem closer to the antennas and run a longer Ethernet line instead.** The higher DC voltage drop of PoE is easier to manage than RF loss at 6 GHz."*

---

#### A-4 摆放位置、高度、朝向

**原理**：Sub-6GHz 的 2.6/3.5GHz 穿透损耗大。赛场上你要的不是"信号强"，是"信号干净"。

**怎么做**：
1. **先扫位置，别猜**。华为官方排查 5G 掉 4G 的第一步就是：*"请多检测几个地方，**检测地点之间要有距离**，选出最佳位置"* https://consumer.huawei.com/cn/support/content/zh-cn00761694/
2. **信号强度必须和信噪比一起看**。烽火评测原文：*"**如果信号强度很高，但是信噪比数值很低，那5G速率也跑不上去。**"* https://zhuanlan.zhihu.com/p/500984484
3. **远离人体**：人群本身就是 2.6/3.5GHz 的吸收体（含水量高）。把 CPE 架高（2 m+）比放在地上/桌面上好，架高同时躲开人体遮挡。
4. **避开金属**：机柜、金属货架、消防管道都是反射/屏蔽源。要放机柜里就**把天线引到机柜外**（用馈线或直接改用室外机+POE 方案）。
5. **定向天线要用指南针找基站方位**：一般经验"天线角度每调整 10 度，信号强度可能变化 5–10 dBm"（该来源为厂商 SEO 文，仅作参考）。
6. **面向窗外/朝向基站方向**，但注意 A-2 的锁小区问题：不锁小区时，靠窗反而可能被"吸"到室外宏站上去。

---

#### A-4b 场馆 DAS / 室分系统：它既是你的救命稻草，也是你的天花板

**你需要知道 DAS 的三个事实**：

**① 90% 以上的室内覆盖是传统无源 DAS，且上行是硬瓶颈。**
C114《5G室内覆盖性能及关键问题分析》（2020-10-09）实测：https://m.c114.com.cn/w164-1139936.html
| 室分形态 | 下行峰值 / 边缘 | 上行峰值 / 边缘 |
|---|---|---|
| 单路室分（4G） | 50 / 25 Mbps | 10 / **3** Mbps |
| 单路室分（升 5G） | 400 / 150 Mbps | 60 / **5** Mbps |
| 双路室分 2T2R（5G） | 800 / 200 Mbps | 120 / **10** Mbps |
| 4T4R 数字化室分 | 750 平均 / 350 边缘 | 90 平均 / 50 边缘 |

原文：*"单路系统直接升级至5G后，性能得到较大幅度的提升，**仅在上行边缘区域，受信号质量的影响，性能提升并不明显**"*；结论："**上行速率将成为室内覆盖中的瓶颈**"。
⇒ **看到场馆有室分别高兴太早，室分的上行边缘只有几 Mbps。**

**② 室内外同频干扰会吃掉你 30–44% 的容量。**
同一篇：室外宏站空载时室内下行 609 Mbps；**室外 50% 加扰时降到 438 Mbps，平均容量损失 28.1%**。
- 室内外电平差 -5dB 以上时，速率损失达 **44%**；0~5dB 时损失 **30%**；5~10dB 时损失 <20%
- 结论原文："**为保证室内用户性能，室内覆盖网络的信号强度要满足室内电平高于室外电平6dB，才能保证室内用户性能损失在20%以内**"
- 双通道不平衡：双路电平差 5dB → 性能损失约 20%；差 10dB → 约 30%

**③ DAS 的上行底噪取决于接头，不取决于你。** 
被动互调（PIM）是无源器件（松动的接头、氧化的连接器）产生的杂散，**表现为上行底噪抬升**：
- SafTehnika：*"**External PIM often appears as a raised or sloping uplink noise floor**, making it difficult to distinguish from general interference."*
- Anritsu：*"PIM shows up as a set of unwanted signals created by the mixing of two or more strong RF signals in a nonlinear device, such as a **loose or corroded connector**"*
- Engineering (2022) 综述：*"A slightly higher PIM level may **severely increase the noise floor**."*
⇒ 场馆 DAS 接头一氧化，基站上行灵敏度就掉，你的上行跟着掉 —— **这跟你买什么设备无关**。

**DAS 的"坑"总结**：信号满格 ≠ 有带宽（室分上行边缘仅 3–10 Mbps）；室外宏站越强，室内反而越差（同频干扰，要室内比室外高 6 dB 才行）；DAS 上行底噪不可控。

---

#### A-5 频段选择：n41 vs n78 在室内

**原理**：频率越高，穿透/绕射越差，但带宽越大。

**硬数据**：
- 圣母大学球场满场实测 NR RSRP 中位：**AT&T 低频 n5 = -75 dBm；T-Mobile n41(2.5GHz) = -92 dBm；Verizon n77(3.7GHz) = -106 dBm**（差 31 dB）
- 比赛日 MCS：**T-Mobile n41 DL 中位 11 / UL 5；Verizon n77 DL 8 / UL 3**
- 原文归因：*"favorable propagation characteristics of T-Mobile's 2.5 GHz n41 band compared to Verizon's higher-frequency 3.7 GHz n77 band"*
- 国内同类数据：2.6GHz 相比 2.3GHz，理论路损差 ~4.2 dB，**实测空口差异均值 ~4.6 dB**；1/2 馈线百米损耗 2.6G 比 2.3G 高 1.4 dB（C114 同上）

**结论（室内 + 人群密集）**：
- **n41（2.6GHz，移动/广电）在室内穿透上明确优于 n78（3.5GHz，电信/联通）**，约 4–5 dB 差距
- 但国内 **n78 单独有 100 MHz 室内专用频谱**，且联通/电信用户基数小于移动 → 少数派原文：*"N78 是非常均衡的频段…相对于移动来说用户也略少一些，不过高用户密集地区也会有 N41 那种拥堵情况"*
- **实战做法：两个都测，别信理论**。如果场馆有室分，n78 的室内 100 MHz 可能反而是最好的。

---

#### A-6 4G vs 5G：谁更稳？答案是「不一定，而且经常是 4G」

**这一条的结论和直觉相反，所以单独列。**

**证据 1（学术，拥塞场景 5G 的抖动更差）**：
> "Paradoxically, despite superior peak speeds, **5G can introduce severe uplink jitter and latency variance that degrades application-layer Quality of Experience (QoE) relative to stable LTE links**"
—— arXiv 2607.16008v1（引自 Chmieliauskas and Paulikas, 2025）

**证据 2（现场用户，中文）**：V2EX 演唱会帖（2024-06-26，13,394 浏览 / 90 回复）
- #62 holmesx：*"五月天演唱会的时候，5G 收微信都收不进来，**切换到 4G，就非常顺畅，视频都能发**。"*
- #48 jakes：*"iPhone 5G 是假信号，我经常满信号无网络。现在都**强制开 4G** 在用了，慢就慢点。"*
- #56 hybcl：*"**锁频锁更远的基站**"*
- #87 spacezip：*"高通的 root 用 cellular pro **锁一个稍远一点可以用基站** 锁一个传输远的频段 不过得试 比较麻烦"*
https://www.v2ex.com/t/1052699

**证据 3（机制）**：
- NSA 下控制面在 4G，5G 载波掉了你得回到 4G，这个回落过程本身就有中断
- 5G 的 TDD 上行时隙本来就少（arXiv 2604.04371 的核心结论），人群中调度器给你的上行时隙更少
- 少数派："**TDD…无法同时进行上传下载任务**…连上 TDD 频段开热点打游戏，同时发一个大文件出去，游戏大概率会卡得没法玩"

**实战做法**：
- **准备两套配置**：一套「5G 优先 / 锁 n41 或 n78」，一套「4G only / 锁 B3 或 B1」。开场前 30 分钟（人还没满）测一次，人满后测一次，哪套好上哪套。
- 华为官方给的 4G 锁频建议：**移动卡选 B3；联通卡 B1/B3/B8；电信卡 B1/B3/B5**（https://consumer.huawei.com/cn/support/content/zh-cn00761694/）

---

#### A-7 载波聚合 / QCI / 物联网卡 / 上行带宽

**载波聚合（CA）**：
- 反直觉结论（少数派原文）：*"由于各频段特性不同，各地区建设和各终端设备能力不同，**可能会出现多载波的表现不如单载波的情况，这是很正常的**…现阶段不建议大家过多纠结载波聚合与 5GA"*
- 且 A-2 已说明：**锁频段会阻止 CA 增加副载波**。锁频和 CA 是 trade-off。
- 上行 CA 在国内 CPE 上支持有限；真正有效的是运营商的**上行增强**（SUL / 超级上行）。

**QCI 等级（这是国内场馆最实际的一招）**：
- 中国移动/联通/电信对高价值套餐给 **QCI 6**，普通套餐 QCI 8/9。V2EX 网友整理：
  > "运营商网络上是有优先级的，**最高 QCI6 其次 QCI8 最底 QCI9** 优先保证 6，其次 8，最后 9。移动的 QCI6 是 5G 极速服务…联通的 QCI6 是 5G 网络服务 VVIP…电信 6 是白金"
  > —— AIXAI, V2EX 1052699, 2024-06-26
- **但有反例**，同帖 #19 leon0318：*"实际没啥用，该慢还是慢，**又不是单独的信道**"*
- **2025 年起出现了场馆级的真保障**（和套餐级 QCI 不是一回事）：
  - 中兴端到端体验保障方案在**苏超赛事**和**2025-09-20 广东胡彦斌演唱会**落地，"通过智能融合板或**建立 GBR 专有承载**实施精准保障"；演唱会现场"**5G-A 场馆加速包**…现场限量发售 100 份，一经发售便完成 70+ 份加速包售卖"
    https://www.zte.com.cn/content/zte-site/www-zte-com-cn/china/solutions_latest/5g-advanced/5g_advanced_news/_0（2025-10-10）
  - 中国移动 5G-A 超级上行 + 「随行WiFi X」（C114, 2026-05-28，https://m.c114.com.cn/w118-1311192.html）：
    - 实测"**上行峰值速率达 1Gbps、边缘速率达 20Mbps，分别提升 2 倍和 3 倍**"
    - 五重 VIP 保障，其中第三条最关键：*"**拥塞场景资源调度，单位时间有效数据发送量达普通用户 2–4 倍**"*；第四条 *"**VIP 专属通道，大型活动场景专属保障通道**"*
    - *"中国移动已在超 330 个城市部署…计划在今年二季度至三季度完成全国城区**直播聚集区千兆上行全覆盖**"*
  ⇒ **这是 2026 年"把第零跳做稳"最直接的一招：找运营商买大型活动/直播专项保障，而不是自己堆硬件。**
- **切片实价**（英国，u/No_Coffee4280, r/VIDEOENGINEERING 2026-04）：*"**In the UK we done a few major events using slices cost around £2500 per slice**"*
  https://reddit.com/r/VIDEOENGINEERING/comments/1sba8nd/
- ★★ **案例侧交叉验证**：唯一一个「密集场馆蜂窝完胜」的详细案例（Halfbrick Studios @ Las Vegas Box Fan Expo 2025-09-17），**唯一差异变量就是 QCI-7 优先级**：*"**QCI-7... felt like discovering a hidden cheat code for cellular data.**"*

**物联网卡会不会被降优先级？—— 会。**
OFweek 维科号（FIFISIM物联，2026-05-29）原文：
> "网络拥塞时优先级排序为：**语音通话信令＞手机用户视频流量＞手机普通上网流量＞物联网卡常规数据流量**。为保障大众民用通信体验，基站会优先挤占物联网卡的带宽资源"
> "普通手机SIM卡…QCI优先级更高…而常规物联网卡主打小流量、低频次、长连接的设备上报业务，**默认QCI优先级偏低**，基站设计逻辑为'保障基础在线、动态弹性降速'"
> "市面上非正规渠道的低价物联网卡，大多采用**公共低优先级流量池**，QoS调度权限更低、拥塞限速更严重"
https://mp.ofweek.com/iot/a256714313667
⚠️ 这是卖物联网卡的厂商软文，机制描述与 3GPP 一致，但"必须买我们的一级代理卡"是营销结论，请打折。
⚠️ 另一个必读的现实：V2EX 联通随身套餐用户是*"移植成实体 sim 插在烽火 5gcpe（**改成原官方设备的 imei，不然封卡**）上用"* —— 这类卡的合规风险要自己判断。

**上行带宽到底要多少**：
| 平台/画质 | 推流码率 | 需要上行 |
|---|---|---|
| B站 720p60 | ~4320 kbps | ~5 Mbps |
| YouTube 1080p60 | 4.5–9 Mbps | ≥ 9 Mbps |
| 抖音 1080p（直播伴侣高画质） | 10000 kbps | **10 Mbps** |
| YouTube 4K60 | 10–35 Mbps | ≥ 35 Mbps |
来源：https://support.google.com/youtube/answer/2853702?hl=zh-Hans ；http://onlinemanual.insta360.com/link/zh-cn/operating_tutorials/reframe_live/high_quality ；https://www.bilibili.com/read/cv19368113/

⇒ **上行要留 2–3 倍余量**。也就是 1080p60 推流，你要把「稳定 20–30 Mbps 上行」当目标，而上面圣母大学的数据说明满场时单路蜂窝常常给不到。

---

#### A-8 场馆里的 2.4G / 5G WiFi 干扰对随身 WiFi 的影响

**结论：如果你是「无网口随身 WiFi」，WiFi 侧基本是全场最脏的一段。**

- 展会 2.4G 是一团乱麻。Reddit r/CommercialAV（2023-01）用户 Adventurous-Ice9694：
  > "Usually the 5GHz band will be reserved for the exhibitions paid WiFi and the **2,4 GHz is a mess**. You will be assigned a Channel at the 2,4 GHz but if there are larger booths they will **disregard any regulations and transmission power** …and basically pollute the whole hall on their respective channel."
  > johnfl68："**The wireless spectrum at trade shows is the wild wild west with no one doing any control of who is using what frequencies.**"
  https://www.reddit.com/r/CommercialAV/comments/102527z/internet_connectivity_for_trade_shows/
- 更糟的是**所有人都在开热点**。Reddit r/wifi（2024-03）Tnknights：
  > "as people try to get around the Wi-Fi fee, they bring hotspots. **Now you have tons of SSIDs. It's miserable.**"
  https://www.reddit.com/r/wifi/comments/1bffebf/looking_for_wifi_solution_for_conference_exhibit/
- 华为官方排障也承认：无线设备掉线时"远离微波炉、冰箱、烤箱、蓝牙设备"；"如果搜索附近有多个WLAN，建议优化信道干扰"；**"建议您可以尝试将 WLAN 带宽设置为 20 MHz"**
  https://consumer.huawei.com/cn/support/content/zh-cn15927901/

**实战做法**：
- **能用有线就别用无线**。这个场景下 `CPE 的 RJ45 口 → 你的交换机` 是唯一可控的一段。
- 如果必须用 WiFi：**只开 5GHz，关掉 2.4G**；带宽设 20 MHz（抗干扰优于 40/80 MHz）；信道手工选，别用自动。
- **别用 WiFi 中继/桥接**（见第 4 节伪手段）。

---

---

#### A-9 现场判据：用官方给的 RSRP / SINR 阈值做决策，别靠"信号格"

华为官方支持文档直接给出了中国移动的测试判据（这是本报告里最可直接照抄的一张表）：

| 档位 | RSRP | SINR |
|---|---|---|
| 信号好 | > -80 dBm | > 25 dB |
| 信号一般 | -85 ~ -80 dBm | 16 ~ 25 dB |
| 信号较差 | -100 ~ -85 dBm | 3 ~ 16 dB |
| 信号极差 | < -100 dBm | < 3 dB |

原文："**一般 SINR（信噪比）在 16dB 以上为正常，若您截图中的 SINR 小于 16dB，说明干扰较大，请设备不要放在金属盒内，也不要放到微波炉等电子干扰物附近。**"
"一般 RSRP（信号值）在 -85dBm 以上为正常，若您截图中的 RSRP 小于 -85dBm，说明信号较差，**请更换位置重试**。"
https://consumer.huawei.com/cn/support/content/zh-cn00768304/

**这条最重要**：赛场上你大概率会遇到 "RSRP 很好（> -80）但 SINR 很低（< 16）" 的情况 —— 那是**干扰**（同频、人群、金属反射），换位置比买天线有用。

**顺带一个有线的量化收益**：充电头网实测华为随行 WiFi X（2026-06-11），同一位置同一设备：
- WiFi 连接：Ping **108.9 ms**，下行 430.8 / 上行 113.34 Mbps
- **有线（USB-C 有线网卡）连接：Ping 34.8 ms**，下行 300.09 / 上行 111.46 Mbps
https://www.chongdiantou.com/archives/1781171287326.html
⇒ **有线比 WiFi 少了 74 ms 往返时延**。上行几乎不变（瓶颈在蜂窝侧），但时延直接砍掉 2/3。这就是"必须用 RJ45/有线"的硬理由。

---


#### A-12 【新的关键数字】双卡 CPE 的「冷切换」中断时间实测

方为科技（FW-Linker）行业文章（2026-09-14，**厂商立场，C 级证据**，但数字具体且与 C-1 的社区实测自洽）：
> "绝大多数消费级双卡CPE，只是让你手动选择用哪张卡，或者信号差的时候手动切换…这类产品的切换表现大致分三种：**需要手动在后台点击切换的，切换期间直播中断约十几秒；支持信号触发自动切换的，切换逻辑是"先断后连"，中断约 6-8 秒；宣称"智能切换"的，实测仍然是冷切换逻辑，中断约 5 秒。** 对于直播场景，5 秒的中断，是不能容忍的。**这不是设备品质高低的问题，而是双卡冷切换的架构本身就会存在网络中断间隙。**"
> "少数搭载双模组、可**同时驻网并预激活数据通道**的双卡CPE，能够实现亚秒级故障切换，但这类产品需要单独甄别，并不是消费级CPE的常规能力。"
https://www.fwlinker.com/blog/cpe-router-live-stream/

**同文其他可用的量化数据（C 级，需交叉验证）**：
| 指标 | 数值 |
|---|---|
| 5G CPE 延迟（信号良好） | **17–25 ms** |
| 5G CPE 延迟（信号变差） | **60–120 ms** |
| 有线光纤延迟 | **8–12 ms** |
| 5G CPE 在 SA + 良好覆盖下上行 | **45–60 Mbps** |
| 直播行业通用红线 | **抖动 < 30 ms、丢包 < 0.5%** |
| 大型活动现场基站被挤爆时丢包率 | **3% – 11% 之间剧烈跳动** |
| 单机位 1080P 高码率推流 | **8–12 Mbps** |
| 单机位 4K（H.265） | **25–40 Mbps** |
| 三机位 4K 同时推流 | **80–120 Mbps** |
| **加装合适外接天线的增益** | **4–8 dB（RSRP/SNR），对应网速提升 50%–80%** |
| **消费级 CPE 散热实测** | 35℃ 室温、无额外散热、满载推流：**前 90 分钟上行稳定，之后波动，两小时后速率下降一半以上**；工业级同环境连续 4 小时无明显波动 |
| 基站拥塞时的典型表现 | CPE 显示 5G 满格、信号强度健康，但**上行只有 1–2 Mbps，丢包跳到 7% 以上**；同一位置开展前两小时上行还有几十 Mbps |
| 现场对比测试 | 单台 5G CPE 推流在信号衰减时码率大幅下降**持续 20 秒以上**；同一时刻聚合路由器把数据导向其他链路，码率始终稳定 |

**★ 一个几乎没人提的坑：运营商按 PCDN 限速**
> "运营商对**上行流量大的用户，可能按 PCDN（点对点内容分发网络）处理直接限速**…有主播直播一段时间后**上行被限制到 5Mbps**，"卡的连抖音都看不了"，**上门师傅检查后要求签保证书**。问题在于，直播本身是典型的大上行业务，**1080P 推流一小时消耗的上行流量可能在 3-5GB**，连续直播很容易触发运营商的"异常上行流量"判定。"
> "有些套餐标称不限量，但**上行超过阈值后会被限速到 128kbps**，连微信消息都发不出去。"
→ 这条对"连跑两三天直播"的赛事场景是**真实且高危**的。选卡时**必须问清上行策略**。

**★ 测试方法论（值得照抄）**：
> "开播前每隔十分钟测一轮上行，连测三到五次，**取最差的那个数字做容量规划**。三项必测指标：上行速率、抖动、丢包率。**不要看平均峰值，最差值才是你的安全线。**"
> "有用户在商场中庭同一位置连续测五次上行，峰值出现在第一次…最低值出现在第三次，只有峰值的一个零头。"

#### A-10 别用来源不明的"物联卡"当第零跳的卡

辽宁日报调查报道（2023-04-11，https://epaper.lnd.com.cn/lswbepaper/pc/con/202304/11/content_187580.html）：
- 案例：大连网友 899 元买"3 年送 1 年"随身 WiFi 套餐，**用了 1 个月就断网**；换"新产品"后套餐变成 180 天，再断网时客服已失联
- 机制原文："'物联卡'是通过**流量池共享**来获得流量额度的…**流量池的大小就是用卡数 × 卡流量，在同一批卡中，使用流量不能超过总池。如果超过总池，物联卡就面临限速和封卡的风险。**"
- "物联卡…**仅面向企业用户进行批量销售**…不面向个人用户"
⇒ 直播间卖的"1500G/月 27 元"卡，本质是一群人共用池子。**你在赛场上跑一整天直播，很可能是那个把池子用爆的人。**

---

#### A-11 一个具体可买的"针对场馆优化过"的终端（2026 年新形态）

华为 + 中国移动联合的「**随行 WiFi X**」（充电头网评测 2026-06-11）：
- **16 根蜂窝天线，360° 收发**；官方口径 **4 发 4 收（4T4R）**
- **上行峰值 1000 Mbps / 下行峰值 5.3 Gbps** —— 上行能力被专门拉高，正好对上"场馆缺上行"这个结论
- 12000 mAh，66 W 快充，"充电 10 分钟，直播 3 小时"，官方称连续直播 20 小时
- X 形可展开机身，"**更能大幅提升机身散热效率，避免长时间直播时设备过热卡顿**"
- 有 USB-C 口可**有线上网**（同时充电）
- ⚠️ **仅支持中国移动 SIM 卡**；插联通卡提示"卡无效"；插普通移动卡可用但会提示"请使用中国移动直播臻享卡"，**配直播臻享卡可"解锁更高频段，网速更快、稳定性更强"**
https://www.chongdiantou.com/archives/1781171287326.html
结合 A-7 的中国移动 5G-A 超级上行"五重 VIP 保障"，这是目前**唯一一个把「运营商网络侧保障」和「终端硬件」绑在一起卖的消费级方案**。对你的场景有直接参考价值：**能不能找运营商开大型活动保障，比纠结买哪台 CPE 重要得多。**


### B. 设备侧

#### B-7 无网口随身WiFi（WiFi 桥接/USB 共享）vs 有 RJ45 网口的 CPE

**结论：差距很大，且差异不在「速度」而在「三件事」——时延、并发连接数、以及能不能有线接你的交换机。**

**① WiFi 那一跳要吃掉几十毫秒，而且是半双工。**
充电头网实测华为随行 WiFi X（同位置同设备）：WiFi 连接 Ping **108.9 ms**；有线连接 Ping **34.8 ms**。**差 74 ms。**
https://www.chongdiantou.com/archives/1781171287326.html
Chiphell 3# pdvc 的原理补充：**"CPE如果只有WIFI，那都是半双工"**。
https://www.chiphell.com/thread-2509264-1-1.html

**② 随身 WiFi 的 NAT 连接数上限很低。**
Chiphell 12# shiangyeh（烽火 CPE 用户）：**"默认没有fullcone，加上连接数很菜导致pt/bt体验很一般"**。
6# Lentrody：**"运营商的移动网络禁入站的多…CPE本身好像也大多不能关防火墙。"**
⇒ 你的服务器/交换机后面如果有大量并发连接（监控流、WebSocket、数据库连接池），随身 WiFi 会先崩在 NAT 表上，而不是带宽上。

**③ 有 RJ45 的 CPE 才能直接接你的交换机，且能做到「蜂窝无线 + 本地有线」分离。**
- **中兴 MU5001 是随身 WiFi 里唯一带网口的**，作者评价：*"加上直供电电池，就是一台迷你 cpe…闲鱼只需 400 元"*
- **中兴 F50**：*"闲鱼甚至有很多专业的配件，比如散热、转网口的扩展坞、cudy 路由器等配件，但是这么折腾，感觉不如同样是中兴品牌的 mu5001，这个**自带网口和 WiFi6，不需要折腾，mu5001 长时间下载也不会降速，散热表现比 f50 要好**"*
https://zhuanlan.zhihu.com/p/1947434159720083635

**④ 一种被低估的好形态：室外机 + POE 回传。**
见 A-3：鲲鹏 NBCPE 把射频放室外、室内机分发，**"网线比馈线便宜且更好布线"**。这同时解掉「天线馈线损耗」和「设备要放在人群里」两个问题。

---

#### B-8 长时间连续工作：**电池鼓包是真实风险，且有厂商官方承认**

**★ 华为官方 FAQ 原文（这是最硬的证据）：**
> "华为随行WiFi设备长时间插着充电器进行充电，短期不会导致电池问题。因为华为随行WiFi设备具有电池保护策略，当电池充满后会自动停充，此时充电器直接为设备本身供电。**但如果电池长期处在满电状态，会提高电池发生鼓胀的可能性，故不建议将随行WiFi长期长时间充电，建议充满后取下充电器使用。**"
https://consumer.huawei.com/cn/support/content/zh-cn15962648/

⇒ **赛事第零跳要连续跑 2–3 天，绝不能买「内置电池、只能插电用」的随身 WiFi。** 选：
1. **不带电池的 CPE**（如烽火 LG6121F，12V 1.5A 直供；鲲鹏 C2000 "不带电池带网口"）
2. 或**改直供电**（把电池拆掉）

**★ 直供电改造的实操路径**（知乎作者原文）：
> "闲鱼搜索"中兴随身WiFi直供电电池"…可以找到**直供电方案，也就几十块钱**。"
> "可拆卸直供电电池，外出可以更换为原装电池，居家或者车载可以更换为直供电电池"
> "如果要**通电自启**，则只能改为这种直供电模块。其实**手机搞直供电也是这样操作**。"
https://zhuanlan.zhihu.com/p/1947434159720083635

**★ 热不只坏电池，还会烧 SIM 卡。**
Chiphell tkdm 原文：**"我用5GCPE在办公室上网，一年用坏了3张sim卡。就是7*24小时开机，单纯的sim卡坏了。"**
- 14# jgag 归因：**"估计是cpe太热把卡烧坏了，可以尝试接个sim卡延长线"**
- 37# BrainBUGs：**"SIM卡坏有可能是机器发热严重SIM卡热变形了。"**
- 21# jgag：飞猫智联**"用的是春藤510方案，用这个方案的都得自己加风扇不然夏天容易烧sim卡"**
- 19# jgag：**"如果预算不够可以考虑联通的VN007+，不过得做好散热，否则容易烧手机卡。"**
- 24# bosonx 反例：**"在用烽火CPE 每个月PT，分流刷个10T也没烧SIM卡。"**（说明是散热设计问题，不是必然）
https://www.chiphell.com/thread-2509264-1-1.html

**长时间连续运行的实测（正面证据）**：中兴 MU5001
- 移动卡连续高速下载 **2 小时 / 440 GB**，*"依然保持 500 兆网速，**全程未断网断流**"*
- 联通卡连续 **6 小时 / 586 GB**，*"网速一直稳定在 200 兆左右"*
- 2025-09 联通卡连续 **12 小时 / 1.72 TB**，*"网速 400–500 之间"*
https://zhuanlan.zhihu.com/p/1947434159720083635

**散热手段**：主动散热（小风扇、散热背夹）、SIM 卡延长线（把卡引到热源外）、选无风扇被动散热+金属壳的工业级设备。
厂商侧的正面设计：华为随行 WiFi X 的 **X 形可展开机身**"更能大幅提升机身散热效率，避免长时间直播时设备过热卡顿"。

---

#### B-9 供电：**这是「莫名其妙重启」最常见的根因**

**★ 直接证据（知乎作者原文）**：
> "**充电头必须支持 5v 3a，那些 5v 2a / 1a 的充电头会因供电不足而重启**"
https://zhuanlan.zhihu.com/p/1947434159720083635

**器件参数参考**：
- 烽火 LG6121F：**12V 1.5A**（评测实测"功耗并不高"，但必须给够）
- 5G 模组峰值电流大：**看门狗与供电设计上，厂商口径是"5G通信时的瞬时电流很大（峰值能到 4–5A）"**（该来源为 SEO 水文，量级参考）

**工程做法**：
1. 用**原厂电源适配器**，别用「万能充电头」
2. UPS 或 PD 移动电源：注意 **PD 诱骗线要有 12V 档位**；5V 充电宝带不动 12V CPE
3. 电源留 **≥50% 电流余量**（标称 12V 1.5A 就给 12V 3A）
4. 所有插头做防脱落（赛场人多，被踢掉电源是最蠢的故障）

---

#### B-10 看门狗 / 定时重启 / 断线自动重连

**现成方案**：

| 方案 | 做法 | 证据 |
|---|---|---|
| **OpenWrt `watchcat`** | 周期性 ping 目标，失败 N 次后重启接口/设备/执行脚本 | OpenWrt 官方包，比 mwan3 简单 |
| **mwan3 自身健康检查** | 见 C-1/C-2；可配 `check_quality`（`failure_latency`/`failure_loss`） | https://openwrt.org/docs/guide-user/network/wan/multiwan/mwan3 |
| **路由/CPE 自带定时重启** | 华为/中兴 CPE 后台一般有定时重启；iKuai 有定时重启任务 | — |
| **硬件看门狗** | 工业级 CPE 标配（独立计时器芯片，主控无响应就强制复位）；**消费级 CPE 基本没有** | 厂商技术文 |
| **SIM 卡/USB 共享自动恢复** | **`ericwang2006/AutoRNDIS`**（80★ / 30 fork）：*"OpenWrt路由器通过Android手机USB网络共享(RNDIS)方式联网时，手机有时会意外关闭网络共享(比如路由器断电)，脚本通过定时任务发现并自动打开手机的USB网络共享"*，还带一个「长时间断网就重启一次手机」的任务 | https://github.com/ericwang2006/AutoRNDIS |
| **定时重启任务（实测有效）** | Chiphell tkdm 的 7×24 用法虽烧了 3 张卡，但说明这类设备是设计成常开的；**建议每天凌晨定时重启一次** | — |

⚠️ **AutoRNDIS 只有 80★ / 2 次 commit** —— 属于「方案精髓可借鉴，代码自己写」的类型（`*/5 * * * * net_check.sh` + `*/50 * * * * wan_check.sh` 两行 cron 就够了）。

**⚠️ 一个必须知道的 RNDIS 现实**：手机 USB 共享在**很多套餐里会计入热点流量或被限速**（运营商通过 TTL 检测）。HN 上有人用 `iptables --ttl-inc 1` / `--ttl-set 64` 绕过（2026 年讨论），也有人指出运营商还有别的检测手段（User-Agent、Windows Update 域名等）。**把它当兜底可以，别当主力。**

---

---

#### B-7b 【新增·强证据】USB 共享（RNDIS）不是「通/不通」，而是**跑几小时后劣化，且必须断电才恢复**

**这是「手机 USB 共享当主链路」最致命的问题，且原因在闭源协议栈，不在线材。**

**原理**：RNDIS 的控制通道（状态查询）与数据通道共用一个 USB 端点，设备侧缓冲不足时状态查询被丢 → 主机超时后 reset 设备。这个 race 只在长时间运行后暴露。

**证据（四路独立）**：
- **OpenWrt `packages` issue #25771（2025-01-17 开，至今 OPEN）**：
  > *"While USB-tethering does work for me in v23.05, **the connection becomes unstable/unusable after a couple of hours of use: ping times increase to ~1s instead of ~50ms** I usually get, many dropped packets"*
  > `--- 1.1.1.1 ping statistics --- 16 packets transmitted, 13 received, **18.75% packet loss**`
  > *"Installing `kmod-usb-net-cdc-ncm` doesn't seem to improve stability. Installing `kmod-usb-net-cdc-eem` in addition to `kmod-usb-net-cdc-ncm` **also doesn't seem to improve stability**."*
  https://github.com/openwrt/packages/issues/25771
- **OpenWrt 论坛整帖 221685（2025-01-16）**：内核日志显示 USB 口不停重新枚举 —— `usb 1-1: USB disconnect, device number 50` … `new high-speed USB device number 51` … 一路涨到 62。
  https://forum.openwrt.org/t/cant-get-usb-tethering-to-work-in-24-10-rc5/221685
- **OpenWrt issue #12539（2023-05-05，已确认 bug）**：*"the system will **hang** after communicating with it for a period of seconds, the console becomes unresponsive for about 15 seconds and then **reboots**."*
- **微软官方给出的根因**（Microsoft Q&A，2021-02-23 答复）：
  > *"The root cause turned out to be **a problem in NuttX RNDIS driver. It only had a single buffer for RNDIS replies, causing them to be dropped if two requests occur close together**… when a query packet is dropped, **Windows will timeout the request 18 seconds later and issue a device reset**."*
  https://learn.microsoft.com/en-us/answers/questions/3777525/rndis-device-gets-randomly-disconnected-every-few
- Reddit r/openwrt（2020-12-14）u/chrisprice：*"**This is why I hate RNDIS being closed source.**"*
  https://www.reddit.com/r/openwrt/comments/kcq3qq/usb_tethering_results_in_very_unreliable_dns/
- 恩山 thread-8301528（2023-08）：*"**有些随身WiFi有多种协议，在windows上启用rndis协议，在Linux上启用其它协议**，就会出现你这种情况。"*
  https://www.right.com.cn/forum/thread-8301528-1-1.html

⇒ **USB 共享只能当兜底，不能当主链路。** 且看门狗恢复动作要下沉到 `ifdown/ifup` 甚至 **USB 口断电**（软件 reset 不够）。

---

#### B-8b 【新增·强证据】电池鼓包是**一年尺度的可预期事件**，不是意外

- **MIRC（Mobile Internet Resource Center，2026-02-03 更新）**：
  > *"**After a device has been out for about a year and in heavy use, that's when we start receiving reports of battery swelling. No particular mobile hotspot model seems to be exempt.**"*
  > 触发因素第一条就是：*"**Leaving a hotspot constantly plugged into power, and never allowing the battery to drain and re-charge**"*，其余为"poor signal areas (devices go into full transmit power)"、"**Lack of ventilation**"、"Leaving devices in a sunny spot"、"General battery aging"
  > 检查方法：*"**Sit the battery flat on a table. If it no longer sits flat on a table without a slight wobble, you are developing a problem**"*
  https://www.rvmobileinternet.com/guides/preventing-mobile-hotspot-battery-swelling-when-using-a-cradle-booster/
- **GL.iNet 官方论坛（2023-08-03）**——楼主："My Mudi's battery has recently swollen, **actually while the device was running.**"
  - 问能否限制充电上限 → 官方 hansome：*"**Sorry that's not supported.**"*
  - 问能否关闭充电 → 官方 Nicos：*"**There is no disabled method**… **It still works when connected to a power source.**"*
  https://forum.gl-inet.com/t/mudi-gl-e750-w-ep06-e-battery-swollen/32083
- **Reddit r/GlInet（2026-04-14）**——鼓包顶开外壳、**把 microSD 卡掰成两半**：*"**the battery swell snapped mine in half**"*；社区建议：*"you can always **pull the battery and run it off the usbc port**"*。
  https://www.reddit.com/r/GlInet/comments/1slhaz9/swollen_battery_on_a_mudi_gle750/
- **GL.iNet 官方 Facebook（2026-08-11）**——厂商自己把「去电池插电」当卖点：
  > *"Batteries age. Your Mudi 7 (E5800) doesn't have to. 🔋 **Remove the battery, plug it in, and keep your connection going**—built."*

**怎么做**：① 首选无电池型号；② 已有带电池设备就**拆电池插电运行**；③ 不能拆就用定时插座每天断电 1–2 小时；④ 每月物理巡检（电池平放桌面，晃 = 已开始鼓）。

---

#### B-8c 【新增·最硬的温度数据】温度墙在哪里

**YouTube《中兴F50完美改散热：换成中兴M3（降速温度80，断网温度100）》**（2025-04-21，3913 views，室温 21℃）实测：
> 开机后表面 ~24℃，CPU 33.98℃；测速 3 次后表面 ~27℃，CPU 43℃
> *"After downloading ten gigabytes… **CPU temperature just reached seventy-three degrees.**"*
> *"**Its temperature is around ninety degrees, indicating that the speed will decrease significantly.**"*（速度掉到 ~200Mbps）
> *"**It's one hundred and one degrees now.**… This state is actually a disconnection… **Its Wi-Fi disappears.**"*
> *"**its maximum temperature for disconnection is around one hundred degrees.**"*
> *"I put a heat sink clip on it… **The CPU temperature quickly dropped to eighty degrees. I immediately tested the speed, I found that the speed was normal now. It can run to 500Mbps relatively stably.**"*
> 对照：*"After the F50 runs 10G traffic the CPU temperature can reach **seventy-three** degrees. **M3 under the same conditions is only 52 degrees.**"*
https://www.youtube.com/watch?v=bDErvxfOXqY
高赞评论 @ruanluyou：*"**散热器功率8瓦左右，散热面大，刚好适合F50。长期使用，以防冷凝水，F50最好套一个保鲜袋再夹散热器。**"*

**B站《【改装散热】影腾5g随身WIFI加装散热，降温25℃》**（2024-04-08）：字幕原文"挂机路由器加上车后下降到 **35℃** / 回家之前的 **60℃**"；UP 回复成本 **40–50 元**，方案"内置有涡轮风扇"。
https://www.bilibili.com/video/BV14p421y73s/

**隐藏性能模式**：未来往事（2024-01-06）*"中兴F50随身WIFI是紫光展锐的CPU，**在高负载下发热比较严重，因为设备CPU存在温度墙，撞到温度墙CPU就会降频**"*；隐藏页面 `http://192.168.0.1/index.html#performance_mode`
https://www.xxshell.com/4171.html

⚠️ 这是**加热台加速实验**，不是真实环境数据。可迁移的结论是「同负载 F50 到 73℃、M3 只到 52℃」这个 **20℃ 量级的散热差异**。

---

#### B-9b 【新增·强证据】PD 诱骗线：拿不到 12V 会「退到下一档」，看似能用但电流翻倍

**Reddit r/UsbCHardware（2024-06-08）**：
> u/AdriftAtlas: *"**verify if it supports outputting 12V**. If it does, it should work fine. **If it doesn't, it will likely default to 9V, which may cause issues with your router.** Always test the output voltage coming out of the trigger cable with a multimeter before connecting it to your device. **Retest if you switch chargers or power banks**"*
> u/arienh4: *"Depending on the device, it may seem to work fine with such a lower voltage. But that would mean **it's drawing a lot more current**. Best case, that would eventually trip a resettable fuse. **Worst case, it could permanently damage the device or even start a fire.**"*
> u/Ziginox: *"**With these trigger cables, you'll get the next lowest voltage if the one they want isn't available.**"*
> u/AdriftAtlas: *"**The USB-IF should have made the 12V PDO mandatory. Most Anker chargers other than their newest ones lack a 12V PDO.**"*
https://www.reddit.com/r/UsbCHardware/comments/1davajm/powering_a_router_12v2a_from_a_usbc_powerbank/

**具体型号级反例（很值钱）**：
- **Cudy TR3000（¥115–136）USB 口只有 5V/1A，带不动中兴 F50**。知乎原文：*"❗缺点：闪存小，装不了几个插件，**USB接口供电不足5V1A，带不动中兴F50随身WiFi**"* https://zhuanlan.zhihu.com/p/14574477622
- **华为官方把供电列为掉线排查第 1 条**：*"**非配套电源适配器可能会导致路由重启、掉电、Wi-Fi 异常等风险。**"* https://consumer.huawei.com/cn/support/content/zh-cn16104663/
- **恩山 thread-194436**（2016-09-17）：*"**插上去后发现供电不足，不停的掉线。**"*；cixiclq：*"**如果真的是2A的电流，而你的网卡的导线电阻有1Ω，那么压降就是2V**"* https://www.right.com.cn/forum/thread-194436-1-1.html
- **淘系「12V UPS」有系统性猫腻**（GitHub `Staok/iUPS-12V`，2022-05）：
  > *"淘宝上在 100-200 价位之间的…其实是 **3S电池组直连输出**…说是两路 12V/3A 的输出，但是不稳定…**只有一次能两路同时输出**…**标的 12V/3A，实际到 1A多、2A左右可能…我的设备就直接关停了**"*
  > *"**不是一家这样，而是淘宝搜一下，成片成片的好多家都是这样**"*
  https://github.com/Staok/iUPS-12V

⇒ **CPE 侧常是 12V/1.5A–2A，不是 5V。** ① 确认充电宝 **PDO 列表明确有 12V**；② 每根线 × 每个电源都**万用表实测空载/带载电压**；③ 宁可买固定 12V 的 DC 电源/在线式 AC UPS；④ **任何 UPS 上场前做一次「拔市电」演练**。

---

#### B-10b 【新增·强证据】看门狗的具体坑与配方

| 层 | 组件 | 配置要点 | 坑 |
|---|---|---|---|
| **L0** | **procd 硬件看门狗 + `kernel.panic=3`** | **OpenWrt 默认已开**，PID 1 (procd) 驱动 `/dev/watchdog`，驱动超时 30 s、每 5 s 喂一次。**不要关，不要设 `magicclose`** | 源码级证据：`watchdog.c` 里 `wdt_drv_timeout = 30` / `wdt_frequency = 5` https://github.com/openwrt/procd/blob/master/watchdog.c |
| **L1** | **`watchcat`**（官方 feed，`PKG_RELEASE:=26`） | **用 OpenWrt 24.10.x，别上 25.12**；`pingperiod` 15–20 s / `period` 60 s；ping 目标 ≥2 个不同 AS 的 **IP**（`1.1.1.1` + `223.5.5.5`），**别用域名**；动作优先 `restart_iface`，L2TP/WireGuard 用 `run_script` + `ifup <network名>` | **#28667（2026-03-03 开，label `release/25.12`）**：*"Watchcat is not recognizing ping responses… **This issue was not present with 25.10.X and prior.**"*；用户 *"**I downgraded to 24.10.5 too and everything is working again.**"*<br>**#27927（2025-11 开，2026-08 仍在更新）**：*"It seems `if up/down` doesn't work with L2TP interfaces"*，且修完仍错 *"the updated script tries to restart the interface by running `ifup lan3`, when `ifup wanc` is actually needed."* |
| **L2** | **`mwan3` `track_ip` + `reliability`** | 每路上行 2–4 个 `track_ip`；**部署后必做完整冷启动测试**（拔电→上电→等 5 min→查每条 wwan 是否 online 且 tracking 未 paused） | **#16817（2021-10 开，2026-05 仍更新）**：*"**upon reboot, the LTE wwan interface is always marked as 'disabled'**… `tracking is paused`"* / *"**However, if restarting the mwan3 service after router boots up, everything works as expected.**"* → 启动脚本追 `sleep 30 && /etc/init.d/mwan3 restart` 兜底 |
| **L3** | **定时重启（while+sleep 守护 / watchcat periodic）** | **不要依赖 cron** | **恩山 #8396260（2024-09-13）**：*"**直到那次重启进入 initramfs 模式，我才意识到 OpenWrt 中的 cron 服务本身早已损坏，导致定时重启功能从未生效。**"* https://www.right.com.cn/forum/thread-8396260-1-1.html |
| **L4** | **`AT+CFUN=1,1` → GPIO 切断 USB 口供电** | 分级恢复 + 冷却时间 + 最大尝试次数（否则 reset 风暴） | ⚠️ **底层缺口：OpenWrt 的 ModemManager 不会自动重连**。OpenWrt 论坛 t/165025：*"**Right now on an ISP-triggered 4G/5G disconnection, ModemManager will not automatically reconnect. It merely reports the disconnection to netifd and that's it.**"* ModemManager 作者 aleksander0m 回复：*"…**Anyone up to the task of writing this logic in the netfid modemmanager protocol handler?**"* issue 已提（openwrt/packages#19794），至今未合入 |
| **L5** | **CPE 自带定时重启** | 华为/荣耀原生支持：华为《如何设置定时自动重启》、荣耀"查看更多 > 更多功能 > 路由设置 > 路由器重启" | 最后兜底 |

⚠️ **三个第三方 modem 看门狗项目不要直接部署**：

| 项目 | stars | 创建/最后 push | License | 判定 |
|---|---|---|---|---|
| peterpt/modem_manager_whatchdog | **1** | 2025-08-03 / 2025-08-15 | 无 | 只读设计；README 致谢里写着 **"Google's Gemini Pro Model: Code Generation"** |
| cescox/openwrt-modem-doctor | **0** | 2026-02-07 / 当天 | Apache-2.0 | 作者自陈 *"Developed and tested on **a single device** (GL-E750 Mudi V2 with Quectel EM060K-GL, OpenWrt 22.03)"* |
| mohyfahim/mm-watchdog | **1** | 2026-09-16 / 当天 | 无 | 只读设计 |

**分级恢复表（值得抄的设计）**：
| 级别 | 动作 | 代价 | 何时用 |
|---|---|---|---|
| L1 | `ifdown`/`ifup <network>` | 秒级 | 接口死但 modem 活着 |
| L2 | 重启 ModemManager | 十秒级 | L1 无效 |
| L3 | `mmcli -m any --set-current-bands=any` + `AT+CFUN=1,1` | 数十秒 | modem 挂死、注不上网 |
| L4 | GPIO 切断 USB 口供电再上电（`echo 0 > /sys/class/gpio/gpio21/value; sleep 1; echo 1 > ...`） | 分钟级 | L3 无效 |
| L5 | 整机 reboot | 分钟级 | 以上全无效 |
L3–L5 必须带**冷却时间 + 最大尝试次数**（参考 peterpt 的 `MAX_SOFT_RESETS 2` / `MAX_FULL_RECOVERIES 2` / `HIBERNATION_INTERVAL 3600`）。

### C. 冗余与兜底架构

> 本节由子调研完整展开，全文见 `/tmp/agents/cellresearch/redundancy.md`（90 KB，16 项证据薄弱处已标注）。以下是压缩后的可交付结论。

#### C-0 【全篇最硬的结论】除了「包级聚合隧道」，**没有任何多 WAN 方案能让已建立的 TCP 长连接不断**

原因是 netfilter conntrack：一条已建立的连接在 NAT 表里被钉死在某个 WAN 的出接口 + 源 IP 上，路由表换了它也不迁移。**四路独立证据**：

- **OpenWrt 论坛拔线实测（2023-05-31）**：拔掉主 WAN 后持续 ping 8.8.8.8 —— `icmp_seq 25` 到 `50` 全超时，「**51 packets transmitted, 25 packets received, 51.0% packet loss**」；**必须杀掉 ping 会话重建才会切**（延迟 11ms→35ms 可证）。
  https://forum.openwrt.org/t/multiwan-with-mwan3-in-22-03-5-not-working-properly/161784
- **OpenWrt packages issue #24973（2024-09-15，双 4G Teltonika RUTX12，至今 OPEN）**：*"it establishes a TCP connection with the cloud server through one of the interfaces it will **continue to use that interface even after the interface has been disconnected**."* 用户已配 `list flush_conntrack 'disconnected'`，**"but this does not resolve the issue"**。
  https://github.com/openwrt/packages/issues/24973
- **MikroTik 论坛资深用户 sindy（2022-09-18）**：*"if you run a continuous ping from the LAN side, it keeps updating the existing tracked connection so the packets keep getting translated to the IP address of the dead WAN **until you either stop pinging or remove that connection**"*；本质是 *"a failover to the secondary uplink means that **all existing sessions break down**"*。
  https://forum.mikrotik.com/t/most-effective-failover/160877
- **Waveform multi-WAN 指南（2026-03，厂商立场但与本条吻合）**：*"Why do VPNs and online games drop during failover? **Because those sessions are tied to the public IP they started on.**"* / *"Most products that advertise 'automatic failover' are cold failover. **The word 'automatic' does not mean your sessions survive** - it just means you do not have to flip a switch manually."*
  https://www.waveform.com/guides/multi-wan-guide

⇒ **双 CPE + 双 WAN 路由 = 故障时业务会断，客户端必须重连。** 若第零跳上跑 RTMP/SRT/WebSocket/SSH/DB/VPN，方案必须是「包级聚合隧道」或「应用层重连 + 快速故障检测」。

#### C-1 默认参数下三条主流方案的检测时间都是**几十秒级**

| 方案 | 默认检测/切换 | 依据（一手） |
|---|---|---|
| OpenWrt `mwan3` | **50 s（最好）～130 s（最坏）**；物理断载波则秒级 | 从 v2.12.2 源码 `mwan3track` 读出：`interval 10` / `timeout 4` / `down 5` / `up 5`；双阈值棘轮需**连续 5 轮失败**；每轮 = 4×timeout + interval |
| 爱快 iKuai | **约 30 s 起（30 s 的整数倍）** | 官方 FAQ 原文：「**线路检测是 30s 一检测**…线路检测失败与线路检测成功间隔为 30s 的倍数」 https://www.ikuai8.com/zhic/ymgn/lyym/rzzx/xtrz.html |
| RouterOS `check-gateway` | **约 20 s**（2 × 10 s） | 官方 IP Routing 文档：*"periodically (**every 10 seconds**)…After **two timeouts** gateway is considered unreachable."* https://help.mikrotik.com/docs/spaces/ROS/pages/328084/IP+Routing |
| RouterOS `netwatch` | **约 10–13 s**（可调至 1 s） | 官方默认 `interval 10s` / `timeout 3s` https://help.mikrotik.com/docs/spaces/ROS/pages/8323208/Netwatch （2025-10-08 更新） |
| 要亚秒级 | **只能 OSPF + BFD 到自建 CHR** | MikroTik 论坛 sindy 的方案 |

**关键区分**：**载波断了 → 快（秒级，netifd hotplug）；上游不通但载波还在 → 慢（50–130s）**。蜂窝场景最常遇到后者（基站还在、APN 还在，但上游拥塞/不通）。

**实测反例（必须看）**：Nelson Minar 2022-04-22 的 mwan3 部署，Starlink 凌晨固件升级重启后网络断了 **4 分钟**，*"**it did not fail over to the backup**"*，且日志里 *"Command failed: Permission denied"*。⚠️ 这是 22.03 的结果，后续版本有修复 —— 但说明**「配置看起来对」和「真出事时切了」是两件事，必须现场演练**。
https://nelsonslog.wordpress.com/2022/04/22/openwrt-rpi4-failover-and-load-balancing/

#### C-2 iKuai 两个致命坑（直接改变方案选择）

**坑 1：DHCP 方式的 WAN 在「端口分流/协议分流」下掉线不切换。**
官方原文：
> 「①、在爱快多外 Wan 环境的情况下…**端口分流、协议分流策略勾选了多条线路的情况下，只有 ADSL 拨号的线路掉线会分流到其他线路，其余方式上网的线路掉线只会走默认网关线路**」
> https://www.ikuai8.com/support/ymgn/lyym/wlsz/vaqw.html
★ **蜂窝 CPE 接 WAN 口，上网方式通常是 DHCP，不是 PPPoE。** 要用 iKuai 做蜂窝主备，**必须用「多线负载」策略**，不能用端口/协议分流。
（而 iKuai 官方教你挂 USB 4G 网卡/手机共享时，恰恰让你「**选择 DHCP 的上网方式**」 https://www.ikuai8.com/support/alzx/tsgn/usb-wan.html —— 自相矛盾。）

**坑 2：负载均衡 ≠ 带宽叠加。** 爱快官方：
> 「WEB 视频(网页,下载)是 HTTP **单点传输**。对于单点传输协议类，**起不到带宽叠加的效果，最大的速度就是一条线的带宽量**」
> https://www.ikuai8.com/support/ymgn/lyym/lkfl/ea195/c316b.html

**mwan3 的对应坑 —— issue #25487（★★ 精确命中「上游是蜂窝 CPE」的拓扑）**：
> 报告者（2024-12-04）：*"I have another router with a cellular connection connected to the WAN interface… I set the cellular interface of the second router to shutdown state. Then the pings no longer reach 8.8.8.8, but **the second router sends ICMP unreachable messages through the WAN. MWAN3 looks to understand this packets as ICMP responses** and the WAN interface … is shown as having connection to 8.8.8.8 when it is not real."*
https://github.com/openwrt/packages/issues/25487

**mwan3 其他必知**：
- **仍是 iptables 实现**，OpenWrt firewall4/nftables 下只能走 iptables-nft 兼容层（issue #16818，2021-10 开，**2026-08 仍 OPEN，189 条评论**）
- **#16817：USB LTE 作第二 WAN，重启后 wwan 永远 disabled**（2021-10 开，**2026-05 仍 OPEN**）
- **IPv6 是短板**：官方 wiki 原文 *"requires additional configuration such as **NETMAP, NPTv6 or NAT66**. **None of these methods are currently implemented in mwan3 directly**"*、*"**mwan3 cannot currently handle IPv4 and IPv6 configuration on a single interface**"*
- 源码规模：`mwan3track` 453 行 + `mwan3` 257 + `mwan3.sh` 1233 + `common.sh` 257 ≈ **2200 行 POSIX shell**（极轻，可读可改）
- 维护者 `Florian Eckert`（OpenWrt 核心开发者）；**2025-08-04 原主要维护者 Aaron Goodman 被移除**；截至 2026-08 仍每月有提交
- **40+ OPEN issue 积压**（横跨 2018–2026）
- **替代品 `dl12345/mwan3`**（nftables 移植，2026-04 创建，97★ / 14 fork，活跃）—— OpenWrt 24.10+/25.x 上最现实的路径，但**单人项目、未上游**（issue #2/#12 在问能否进官方源）

#### C-3 多链路聚合：**唯一能让会话存活的路线**

**Peplink SpeedFusion**
- ★★ **必须澄清一个致命误解**：**Peplink / Cradlepoint 默认是「按连接负载均衡」，单个流仍然只走一条链路，不叠加也不保会话。** 前 LiveU 生态从业者（u/isonotlikethat, r/VIDEOENGINEERING 2026-04-03）原文：
  > *"**Peplinks load balance individual connections... Your maximum throughput for a single connection is still only defined by the maximum throughput of your best connection.**"*
  > 而 LiveU 是 *"**split the stream into chunks and send those chunks individually over each modem/connection**"*
  **只有显式启用 SpeedFusion Bonding / Hot Failover，才是真正的包级聚合。** 买 Peplink 不等于买了聚合。
- 原理（SpeedFusion 模式）：所有流量进加密隧道，两端（路由 ↔ SpeedFusion Cloud / 自建 FusionHub）做**包级负载均衡 + 重组**，对外只有一个 IP
- 性能（Waveform 2026-03）：*"**Roughly 5-10 ms** through the SpeedFusion tunnel"*；*"the hard cap with encrypted SpeedFusion is roughly **200 Mbps**, with realistic working throughput around **150 Mbps**"*
- 独立佐证（Dillon Baird 2023-08-15）：*"**SpeedFusion has a 200 Mbps cap.**"* / *"you have to pay an additional **$1,000 per year** for SpeedFusion cloud service…**In the absence of the service add-on, your router is merely a load balancing device**"*
- **成本（一手价格页 2026-08-17）**：**FusionHub Solo = $0（1 peer，自建 VPS）**；Essential **$499（5 peers）**；Pro **$1,999（20）**。 https://buypeplink.com/product/fusionhub-license/
- 硬件 + PrimeCare（论坛 2025-08-06 用户实测）：B One 5G **$599 + $115/年**；Max BR1 Pro 5G **$150/年**。 https://forum.peplink.com/t/primecare-subscriptions-quite-expensive-for-private-usage/57346

**OpenMPTCProuter（开源）**
- 项目健康度：**2,513★ / 360 fork / 101 open issues**，GPL-3.0，2017-12-22 创建，**最后 push 2026-09-25**，9 年持续活跃
- ⚠️ **bus factor = 1**：所有提交都是 `Ycarus (Yannick Chabanois)`
- 原理：*"OMR uses: **ShadowSocks-libev for TCP**; **Glorytun for UDP and ICMP**"*
- **硬前置条件**：VPS「**as closest to you as possible (ping time matters!)**」，*"**Ping from your home to the VPS should be less than 15ms.**"*
- 实测（Dillon Baird，2×Starlink + 5G + 4G 混合）：*"**I get speeds in excess of 500Mbps download**"*，VPS *"**$6 per month**"*（2TB 流量）
- 踩坑：*"**Blocked Sites**: All internet flow…is encrypted using a VPN. **Your public IP becomes that of the VPS server.**"*
- ⚠️ **未找到任何国内现场用 OMR 的实测报告**；国内跨省 VPS 延迟 20–40 ms 常见，**可能达不到 <15ms**

**❌ 蒲公英 / 贝锐不是聚合方案**：它是 **SD-WAN 异地组网（Cloud VPN）**，解决的是「无公网 IP 也能互通」。acwifi 拆机实测：*「平均速度大约是 **225KB/秒**，也吻合**免费版所给的"中转带宽"上限：2Mbps**」* https://www.acwifi.net/27605.html

**国产多卡聚合路由器（蚂蚁聚合，公开价目表 2026-01-20）**
| 套餐 | 年费 | 带宽 | 聚合流量 | 超出 |
|---|---|---|---|---|
| 5G 专业版 | ¥1,120/年 | 100 Mbps 独享 | 10 GB/月 | ¥1.1/GB |
| 5G 企业版 | ¥3,100/年 | 200 Mbps 独享 | 50 GB/月 | ¥1.1/GB |
| 按量付费 | **¥2/小时 + ¥2/GB** | 100 Mbps | — | 最低 ¥12 起 |
| 私有化部署 | **¥20,000/台**（50 台路由器） | 自备服务器 | — | — |
https://55860.com/jiage
官方自述的三条关键限制：*「峰值定义：套餐所示带宽为"峰值公网带宽"…**不构成持续性或恒定带宽承诺**」*、*「我们执行**公平使用策略（FUP）**，对异常占用可采取限速或封号」*、*「按 8Mbps 码率估算，**50GB 约可持续传输 14 小时**」*
★ **50 GB 只够 14 小时推流**。两天赛事连续推流，流量费会失控。
**关于「冰狐」**：多轮中英文搜索（含精确短语）**完全未命中**任何产品页/评测/报价。无法结论。

#### C-4 星链 / 卫星（2026 现状）

**星链在中国大陆：不可用，且违法。** 核查（starlink-news.com 2026-09-19，附完整验证日志）：
- *"SpaceX has **no MIIT telecom licence of any class in mainland China**, and no pending application appears in MIIT's public records."*
- *"Starlink's own availability map shows **no service date for the mainland**, and the order flow **rejects mainland addresses**."*（验证日志：2026-09-11 查 MIIT 登记系统无结果；2026-09-12 用上海/成都地址下单均无法进入支付）
- *"Unlicensed satellite transmitting equipment is a **prohibited import**…terminals are **detained at the border with no compensation**."*
- *"The administrative fine ceiling…is **RMB 30,000**…on top of **confiscation**"*
- 技术层面：*"A Starlink user terminal is a **transmitter, not a receiver**…uplinking in the Ku-band, **14.0–14.5 GHz**…Provincial radio administration bureaus run monitoring stations and mobile direction-finding units precisely for this class of signal"*
https://starlink-news.com/2026/09/19/starlink-in-china-ban-price-and-legal-satellite-internet/

**中国星网 GW / 千帆 G60**：
| 星座 | 运营方 | 规划总量 | 2026 在轨 |
|---|---|---|---|
| 千帆（G60） | 上海垣信卫星 | 一期 1,296，最终 1.5 万+ | 2026-04-09 **126 颗**；2026-06-05 **200 颗**；目标年中 324、年底 648 |
| 中国星网 GW | 中国卫星网络集团 | A59 6,080 + A2 6,912 = **12,992 颗** | 截至 2026-08 **约 180 颗**；2026 全年计划约 300 颗 |
来源：21 世纪经济报道 2026-04-09 https://www.21jingji.com/article/20260409/herald/b20e158b221bffb82ea806e6b0a8da60.html ；新华网 2024-09-03 https://www.news.cn/science/20240903/5bf288c1f58a434f97e5b0cb16fb7f64/c.html
⚠️ **未找到面向国内消费者的卫星宽带套餐与实测时延**。2026 年**没有任何能买到的消费级卫星宽带**。

⇒ **「卫星当最后手段」在 2026 年的中国不现实。** 更现实的地面「最后手段」是**异构运营商多张 SIM**。Waveform 原文：*"The point is **path diversity**. **If both connections use the same infrastructure (for example, two cellular SIMs on the same carrier), a single tower issue can take out both.**"*

#### C-5 公网可达性

**蜂窝公网 IPv4：一般不给，默认 CGNAT（100.64.0.0/10）。** V2EX 25 楼实录（2023-08-15）：
> #2 yyzh：「那些叫**物联网卡**，前几年广东电信用户直接把 **apn 改成 card** 就能拿公网 ip(没有 ipv6)，当然现在就没戏了。至于那堆 **5G CPE 的倒是没见有给公网 IP 的**」
> #15 Benson1212：「现在改 card 也有公网 ip，只不过要**关 5g 用 4g 网。5g sa 不行**」
> #12 Archeb：「至于 5G 的…**公网 IP 就更是没有了**」
> #25 CBYellowstone（2023-08-28）：「**实测可行!坐标广东**」；#23：「**这方法应该不是全国通用的**」
https://www.v2ex.com/t/965626
→ 要稳定的公网 IPv4 得走「物联网卡 + 专用 APN + IP 白名单」的**企业渠道**。

**蜂窝 IPv6：基本默认开启，但地址动态。**
- 36Kr 实测（2021-08-01）：*「4G 或者 5G 网络，现在三大运营商也基本有支持，**基本默认状态下就能支持 IPV6**」* https://m.36kr.com/p/1336132478081289
- ⚠️ **蜂窝侧的前缀委派（PD）无任何一手数据** —— 找到的全部 PD 数据都是固网宽带。这是最大的证据缺口之一。

**固网 PD 对照（V2EX 99 楼调查，2023-04→2025-08）**：规律是**电信最宽松（/56–/60）、移动次之（/60，部分 /64）、联通最抠（大量 /64）**，全部动态。
> 楼主：「SLAAC 对 PD 前缀的最小要求就是 /64…**偏偏有些运营商（联通咳咳咳）扣扣搜搜的只给一段 /64**」
https://www.v2ex.com/t/930849
**企业专线反面案例**（V2EX 2024-06-09）：*「单位有一条企业专线，有公网 IPv4,IPv6…分配了一个 ::/56 的段，但**没有 PD 前缀**…打电话问他们说就是这样的**禁止下发前缀**」「每月 **6000 元**」*；高赞分析：*「**除了 ND Proxy 没有其他解法**…导致**只有同一个广播域上的设备才能够使用这些 IP**」* https://www.v2ex.com/t/1048099

**打洞成功率**：
- Tailscale 官方（2025-10-15）：*"**Internal metrics have indicated success rates for direct NAT traversal well north of 90% in typical conditions.**"*
- 但官方同篇明确点出蜂窝是最差场景：*"**Mobile networks and large ISPs often use carrier-grade NAT (CGNAT)**…These systems tend to be **very restrictive - they typically employ short port timeouts and symmetric mapping**…**If you have two mobile devices trying to connect peer-to-peer from different cellular networks, there's a good chance they'll have to use DERP.**"*
  https://tailscale.com/blog/nat-traversal-improvements-pt-1
- 中文实测（iKuai + CGNAT 双层 NAT）：*「**Double NAT: Home router (iKuai) + operator CGNAT stacking, UDP hole punching success rate drops to near 0.** Result: Tailscale forced to use DERP relay…**Latency increases from theoretical 20ms to 200ms+**」*
  | 维度 | IPv4 + CGNAT | IPv6 直连 |
  |---|---|---|
  | NAT 层数 | 双层 | 0 |
  | Tailscale | **经 DERP 中继** | **直连** |
  | 延迟 | **160–220 ms** | **20–40 ms** |
  https://gavinchen.cn/ipv6/

⇒ **结论**：❌ 别指望蜂窝给公网 IPv4；✅ **把 IPv6 直连当首选**（现场第一件事：`curl -6 ifconfig.co` + 从外网 ping 回来 + 确认运营商没封入站）；✅ 兜底 Tailscale（有 DERP 保底）；✅ 必须固定可入站公网 IPv4 时，最可靠是 **frp + 一台有公网 IP 的 VPS**。

（B / D 章节见下）

---

## 2. 冗余架构对比表（含切换时间与成本）

### 2.1 主备 / 分流类

| 架构 | 检测周期 | **切换时间** | 成本 | 复杂度 | 已建立 TCP | 适用 |
|---|---|---|---|---|---|---|
| **mwan3（默认参数）** | 10 s/轮，连续 5 轮 | **50 s（最好）～130 s（最坏）**；断载波秒级 | 免费 | 中 | **断** | 预算零、能接受分钟级中断 ❌不推荐用于赛事 |
| **mwan3（调参后）** `interval 2 / timeout 2 / down 3 / up 2` | 2 s/轮，3 轮 | **约 5–10 s** | 免费 | 中 | **断** | ✅ 调优后的可用基线 |
| **OpenWrt + `dl12345/mwan3`**（nftables 移植） | 同上 | 同上 | 免费 | 中 | **断** | OpenWrt 24.10+/25.x（firewall4）的现实路径；97★ 单人项目 |
| **爱快 iKuai（多线负载 + 自动切换）** | **30 s 一检测** | **约 30 s 起（30 s 整数倍）** | 路由系统免费 | 低（GUI） | **断** | 国内商用；**必须用「多线负载」策略**，不能用端口/协议分流 |
| **RouterOS `check-gateway`** | 硬编码 10 s，2 次超时 | **约 20 s** | 随硬件，无授权费 | 中 | **断** | 要可预测、文档清楚 |
| **RouterOS `netwatch`** | interval 默认 10 s（可到 1 s） | **约 10–13 s** | 同上 | 中 | **断** | 想快一倍 |
| **RouterOS recursive route + canary** | 取决于 check-gateway | **约 20 s**，但正确处理「网关通但没网」 | 同上 | 中高 | **断** | ✅ 上游是 CPE 的拓扑（避开该类误判） |
| **RouterOS OSPF + BFD 到自建 CHR** | BFD 亚秒级 | **亚秒级** | VPS 月费 | 高 | **断**（仍换 IP） | 有运维能力、要极致切换 |

### 2.2 兜底 / 聚合 / 卫星类

| 架构 | 原理 | 实测切换 / 延迟 | 成本 | 复杂度 | 连接存活 | 适用 |
|---|---|---|---|---|---|---|
| **手机 USB 共享（RNDIS）+ watchcat** | 手机当 WAN，DHCP | 取决于上层切换逻辑 | 手机 + 流量费（注意热点限速） | 低 | **断** | 最低成本应急兜底 |
| **USB 4G/5G dongle（QMI/MBIM）** | 纯 modem 直接拨号 | 同上 | dongle ¥200–2000 + 流量 | 中（驱动/模式切换有坑） | **断** | 比手机稳；**必须选纯 modem** |
| **手机热点 → WiFi STA（travelmate）** | 无线上行 | 重连需数秒 | 免费 | 低 | **断** | 应急；2.4G 干扰大 |
| **OpenMPTCProuter** | MPTCP + ShadowSocks/glorytun 到自建 VPS | 实测 **>500 Mbps**；延迟 = 到 VPS 的 RTT（**要求 <15 ms**） | 软件 $0 + **VPS $5–6/月** + x86 软路由 | 高 | ✅ **不断** | 有运维能力、能就近找到低延迟 VPS |
| **Peplink SpeedFusion（自建 FusionHub）** | 包级隧道 + Bonding / Hot Failover / WAN Smoothing | **+5–10 ms**；bonded **约 150 Mbps 实际 / 200 Mbps 硬顶** | **FusionHub Solo = $0（1 peer）**；Essential **$499（5 peers）**；Pro $1,999（20） | 中 | ✅ **不断**（persistent IP） | ✅ **性价比最高的「会话不断」方案** |
| **Peplink SpeedFusion Cloud** | 同上，用 Peplink 云 relay | 同上 | B One 5G **$599** + PrimeCare **$115/年**；BR1 Pro 5G **$150/年**；DIY 首年 TCO 约 **$2,865** | 低 | ✅ **不断** | 不想自己运维 |
| **国产多卡聚合路由器** | 厂商云聚合 | 无第三方实测；标称「峰值公网带宽」100/200 Mbps，**非持续承诺** | **¥1,120/年**（100M/10GB月）；**¥3,100/年**（200M/50GB月）；按量 **¥2/小时+¥2/GB**；私有化 **¥20,000**/50 台 | 低 | ✅ 不断（有独立固定公网 IP） | 要国内合规、固定公网 IP、能接受 FUP |
| **蒲公英 / 贝锐** | **SD-WAN 异地组网（Cloud VPN）** | — | 免费版中转 **2 Mbps** 上限 | 低 | N/A | ⚠️ **不是聚合方案** |
| **星链 Starlink** | LEO 卫星 | — | 硬件 US$299–599 + 月费 | 中 | — | ❌ **大陆违法，不可用** |
| **中国星网 / 千帆** | LEO 卫星 | — | 未知 | — | — | ❌ **2026 年尚无消费级服务** |

### 2.3 冷 / 温 / 热切换（概念澄清，来自 Waveform）

| 类型 | 备份 WAN | 切换时间 | 公网 IP | 会话 |
|---|---|---|---|---|
| Cold | 保持离线 | **10–30 秒** | 变 | 断（VPN/游戏/VoIP 直接被踢） |
| Warm | 保持在线 | 秒级 | 仍变 | 仍断 |
| **Hot**(包级聚合) | 与主链路**同时**承载 | 无感 | **不变** | ✅ **存活** |

### 2.4 三种推荐架构（按预算→可靠性）

**架构 A：最低成本（可接受分钟级中断）**
- 2 张**不同运营商**的 SIM，各插一个 CPE（**必须不同运营商**：同运营商同基站会一起挂）
- 一台 OpenWrt x86/ARM 软路由跑 mwan3
- **必须改默认参数**：`interval 2` / `timeout 2` / `down 3` / `up 2` / `reliability 2`
- track_ip 用 4 个**不同厂商**的（1.1.1.1 / 9.9.9.9 / 223.5.5.5 / 119.29.29.29），别单点用 Google DNS
- 第零跳后面**所有业务必须实现重连**（硬约束）
- 预期中断：**约 5–10 秒**

**架构 B：推荐（会话不中断）**
- 2 张不同运营商 SIM + 2 个 CPE（**纯 modem 型**，不要 HiLink/modemi+router 二合一）
- 一台 x86 软路由
- **Peplink SpeedFusion**：自建低延迟 VPS 跑 **FusionHub Solo（$0）** 或买 **Essential $499**
  - 换来：**persistent IP + 会话不断 + 5–10 ms 延迟 + ~150 Mbps 上限**
  - 或 **OpenMPTCProuter**：软件免费 + VPS $5–6/月，无 200 Mbps 上限，但运维成本高、需 <15 ms 的 VPS
- 仍建议业务实现重连（双保险）

**架构 C：预算充足 + 要国内合规固定公网 IP**
- 架构 B + 一路**国产多卡聚合路由器**（¥3,100/年档）：固定独立公网 IP + 端口映射
- ⚠️ 流量费：按 8 Mbps 码率，**50 GB/月只够约 14 小时**

**无论哪种，现场必须做 4 件事**
1. **实测切换**：真拔线/真让 CPE 断网，秒表 + 持续 ping 记录，**不要信文档**
2. **实测公网可达性**：`curl -6 ifconfig.co`、从外网 ping 回来、确认运营商 IPv6 入站是否被封
3. **实测 IPv6 前缀是否下发给下游**（若架构依赖 IPv6 直连）
4. **准备异构兜底**：至少一张不同运营商 SIM（甚至广电/虚拟运营商）

---

## 3. 真实场景案例摘要

> 本节由子调研展开，全文见 `/tmp/agents/cellresearch/cases.md`（75 KB；Reddit 完整帖 28 个 / 700+ 条带 score 与 UTC 时间戳的评论、中文页面 12 个、官方 PDF 2 份）。

### 3.1 赛事 / 活动直播

| 谁 | 什么场合 | 用了什么 | 结果 | 原文引用 |
|---|---|---|---|---|
| u/TatsumisDad (r/VIDEOENGINEERING) | 会展中心 press day 直播 | **10 modem 聚合设备** | ❌ **失败** | *"what limited cellular bandwidth made its way into the center of the convention center floor was eaten up by journalists... **Even a 10 modem bonded device failed on us.** ... we basically came to rely on the venues wired connection, which was shockingly expensive and also pretty flaky."* https://reddit.com/r/VIDEOENGINEERING/comments/ipwqxv/ (2020-09-10) |
| Halfbrick Studios | **Box Fan Expo, Las Vegas** (2025-09-17) | **Netgear Nighthawk M6 Pro（bridge）+ AT&T（US Mobile Dark Star）+ QCI-7**；备用 T-Mobile 从未启用 | ✅ **唯一详细记录的「密集场馆蜂窝完胜」** | *"**QCI-7... felt like discovering a hidden cheat code for cellular data.**"* / *"**The results felt like magic.** ... inside the kind of convention hall where best-effort connectivity usually collapses."* 评论补充：*"Las Vegas Convention Center uses a neutral host DAS... **You will likely get better cell service in the convention center during the event than what you would get outside.**"* https://reddit.com/r/USMobile/comments/1niymvb/ ⚠️ 该帖有软文属性（US Mobile CEO 亲自回复，有用户吐槽 "A double ad"） |
| 多帖共识（r/CommercialAV, 2023-01） | 展会摊位 | Cradlepoint / Peplink | ❌ 无线方案普遍失败 | u/VoidSnug(35赞)：*"**any wireless network will be negatively affected when the venue is filled with people**"*；u/ridefst(12赞)：*"**It'll work great until the doors open**"*；u/johnfl68(22赞)：*"if it is at all important at a trade show, **stick well clear of wireless anything**... The wireless spectrum at trade shows is the wild wild west"* https://reddit.com/r/CommercialAV/comments/102527z/ |
| u/ehhthing (r/sysadmin, 2025-12) | **LVCC** | **Verizon 5G Business Internet** | ✅ 成功 | *"I had success with Verizon 5G business internet at LVCC, but if the signal strength inside is poor you're in for a bad time"* https://reddit.com/r/sysadmin/comments/1pkamzw/ |
| u/Maximum_Camera_8716 (r/sysadmin, 2025-12-12) | 某会展中心 | 手机 | ❌ | *"**Had 5 bars on my phone but couldn't even load a webpage because literally thousands of people were hitting the same microcells**"* |
| u/meballard (r/sysadmin) | 常去的某个场馆 | 三家运营商 | 结论：「必须现场测」 | *"**You also can't really test in advance** - you might be just fine during setup, but as soon as the crowds are there things can change quickly. **At one venue I do stuff at regularly, Verizon works just fine on the floor, the others not so much.**"* |
| u/majornerd (r/sysadmin) | 同上 | **带外置天线的热点** | ✅ 赢过场馆官方网 | *"**My kit includes a hotspot with external antennas. Far better than the hundreds of dollars the venue wants.**"* |
| 赛车星冰乐（微博汽车博主，2026-04-24） | **2026 北京车展**，理想 L9 发布会 | 手机 | ❌ 网络拥堵 | *"现场人多导致的网络拥堵... **就像车企自己的直播，会专门拉一条网线，然后直播设备都连接自己的私用 Wi-Fi 就能避开公共的网络拥堵，这属于人多场景的多年经验和共识。**... **我目前发现，强制把手机限制在 4G 可能在展会时候是最佳方案。**"* https://www.sina.cn/news/detail/5291354618072391.html |
| 重庆优咖直播 | **2025 成都车展**（中国西部国际博览城） | **多套 TVU One 背包**（IS+ 协议聚合多运营商 5G/4G） | 现场"数万观众同时在场导致网络拥堵严重" | https://zhuanlan.zhihu.com/p/1953421934835528946 ⚠️ TVU 软文，无量化数字 |
| 摄行直播（十年活动直播团队） | 车展翻车自述 | 聚合路由 + 专线 | 四条原则 | *"**我有一年在车展翻车就是这么栽的——信号满格，画面却卡成 PPT。**"* / *"有次户外路演，**主专线中途被施工挖断，靠提前分好的聚合备用线三四秒就接上了**"* https://post.smzdm.com/p/al3p4prp/ |

### 3.2 户外 / 移动直播

**★ Artemis II 发射直播翻车（2026-04-03, r/VIDEOENGINEERING, 41 评论）** —— 这是最有技术含量的一帖：
- 配置：**Peplink 聚合 2 路蜂窝 + 1 路 Starlink** + 自制机箱 + 高功率天线 → **T-10 分钟画面严重劣化**
- ★★ **最硬的技术解释**（u/isonotlikethat）：
  > *"**Peplinks load balance individual connections... Your maximum throughput for a single connection is still only defined by the maximum throughput of your best connection.**"*
  > LiveU 则是 *"**split the stream into chunks and send those chunks individually over each modem/connection**"*，需要 *"sum of your connections...(plus **15-40% overhead for FEC and retransmissions**)"*
- ★★ u/davehenk（Haivision 员工）：**RTMP 仅容忍 <2% 丢包、<30ms 抖动**，需要换 SRT；*"**High-gain antennas can backfire if they're locked onto a saturated sector**"*
- ★ u/sims2uni：*"**Too many users on a tower will overload it and cause it to reboot. (In the early days of LiveU and MVP's we managed to take a tower down ourselves)**"*；野路子解：*"if there's a coffee shop down the road... **a hundred or so in cash for a cabled feed of internet for the day**"*
- ★ **5G 切片实价**（u/No_Coffee4280）：*"**In the UK we done a few major events using slices cost around £2500 per slice**"*
- 卫星车实价（u/rubrduk）：2 小时洛杉矶地区 **$6,000–10,000**
- u/PhotonEmpress：*"**Don't rely on cellular out there, it all gets deprioritized for critical ops**"*
https://reddit.com/r/VIDEOENGINEERING/comments/1sba8nd/

**Starlink 实测**：
- ★ **LiveU 官方白皮书**：*"**two terminals, even closely collocated, are not necessarily in sync in the 'burst and recede' bandwidth... bonding two creates a stable stream of bandwidth by allowing one's peak to fill in the other's valley.**"* https://get.liveu.tv/liveu-starlink/
- u/Prafe（25 赞）：*"**sub-second connection dropouts** causes issues for any latency setting below 3 seconds"*；*"**If you bond starlink plus cellular then it's actually pretty good.**"*
- Starlink Mini（2025-10-15）：*"**I haven't been able to get enough bandwidth up to support a 1080p60 stream using a mini**"*；*"We usually run **5 seconds** FEC (yes, seconds)"*
- 可行替代：**SRT → Castr，20 秒 buffer**，实测 20 分钟正常

**装备横评（r/VIDEOENGINEERING, 2022-08-18, 48 评论）**：
- 成本锚点：**RGB Link Bond 6 = $1,199 + $400/年**；**Peplink Max Transit Duo = $1,000–1,200**
- 地区实测（u/misterflappypants）：*"**In Boston/New England, I have found ATT + Peplink to be supremely reliable and usually hovers between 25-45mb/s sustained upload speeds**"*；*"2-3 hours with **ZERO dropped frames at 7-8Mb/s**"*
- 自建（u/domesticatedprimate，22 赞）：mini-PC + 6 NIC + 4 USB + **Speedify CLI**：*"**It hasn't failed me yet**"*
- Peplink SpeedFusion 三档调法（u/thisisausername67）：可「4 路同时发同一份数据，谁先到用谁，用 4 倍带宽换绝对稳定」

### 3.3 机器人比赛 · 电赛 · 黑客松

**⚠️ 关键边界**：机器人赛事的痛点**不在外网，而在场内 2.4/5GHz 射频干扰**。观众的手机热点本身就会打挂赛场控制链路。

**★ r/FRC「PSA: TURN OFF YOUR WIFI AND HOTSPOTS」（2019-04-19，368 赞，59 评论）+「Don't be these people」（352 赞，67 评论）**
- OP：*"some Championship fields having **a lot of replays**... due to **high ping times, which come from crowded WiFi networks**"*
- ★★ u/CrispyBacon1999（纠正误解）：*"**The field actually does run off the 5ghz bands**... People... use 5ghz for their hotspots thinking it'll make it clear but **it has the opposite effect**."*
- ★★ u/CardcaptorRLH85（**频谱仪实测**）：*"**I ran my analyzer at the Michigan State Championship and I noticed an uptick of hidden SSID's after they started naming-and-shaming the SSID's**"*
- u/tracyfm：*"**both of our alliance teammates robots were unresponsive. We dropped 11 spots!**"*
- ★★ 最强反驳 u/BlackoutIsHere（19 赞）：*"**You can't build a system that relies on everyone else on earth disabling all electronic devices instead of planning for interference.** ... **The fact that I've never seen an FRC field using directional antennas is pretty disappointing**"*
- 最高赞 u/DO-178C（90 赞）：*"figure out how to deal with crowded Wifi networks... over trying to get a bunch of teenagers to do the same"*

**★ FIRST 官方（2026-04-13, Chief Delphi）**：
> *"**2.4GHz and 5GHz wireless networks also interfere with the admin network used by Volunteers and Staff on the field.** ... 802.11a/b/g/n/ac/ax/be networks are disallowed by E301."*
https://www.chiefdelphi.com/t/do-wifi-hotspots-interfere-with-field-communications/518476

**★★ RoboMaster 官方文档（一手 PDF）**《RoboMaster 赛事引擎联网操作手册》2024-07，P4：
> *"使用 **2.4G（裁判系统局域网只支持 2.4G）** 带 WAN 口以及 LAN 口的无线路由器（**可以使用家用路由器**）。将路由器 IP 设置为 **192.168.1.1**... 密码设置为 **12345678**，加密方式选择 **WPA2**"*
> ⚠️ *"**不建议使用无线方式连接裁判端主机与无线路由器，可能存在信号干扰。**"*
双网卡方案：局域网网卡 IP **192.168.1.2**，跃点数 **20**；外网网卡跃点数 **10**
https://rm-static.djicdn.com/tem/70482/RoboMaster赛事引擎联网操作手册.pdf
**RoboMaster 2023 官方新增「冗余链路」公告**（2023-05-16）—— 大疆自己承认单链路图传不可靠：https://www.robomaster.com/zh-CN/resource/pages/announcement/1598

**❌ 电赛**：没找到场地网络实战帖。原因是**电赛评测现场全封闭无网络、禁手机**（https://wiki.lckfb.com/zh-hans/lspi/competition/competition-guide.html），场景不匹配。
**❌ 黑客松**：没找到有价值的现场复盘，搜索只返回通用的 home backup internet 讨论。

### 3.4 应急通信（本报告证据最弱的一节）

**★ 灾难响应从业者一手（u/Sane-FloridaMan, 12 赞, 2026-08-11）**：
> *"**I live in Florida and work with disaster response. And i can tell you that the carriers have very different resilience capabilities on a per-tower basis.**"*
> *"**you can have three tenants on a tower, with different battery backup capacities and only one carrier with a generator.**"*
> ★★ **DAS 是「时间胶囊」**：*"**most DAS systems are like time capsules. They are installed and left alone - not upgraded as new bands are available.**"*
https://reddit.com/r/USMobile/comments/1vlhb7c/

**★ COW（Cell on Wheels）的实战局限**（u/Logvin，自称 T-Mobile 侧）：
> *"**most stadiums are on DAS systems. They like to charge extraordinary amounts... Like let's say $5M to get on their DAS.**"*
> *"**We rarely use them for big stadium events, more for outdoor concerts and festivals.**"*
> ⭐ 反例（u/reedacus25）：Jazz Fest 的 COW *"**actually did almost more harm than good. COW was a single sector... it was underwater immediately for capacity. Couple that with it creating pilot pollution**"*
https://reddit.com/r/tmobile/comments/3ggdcp/

**★ FirstNet（美国公共安全专网，官方一手）**：可部署资产 = 便携基站 / **satCOLT**，覆盖 12 平方英里；AT&T 车队 **190+ 便携站点**。
https://firstnet.gov/network/TT/deployables
💡 **关键洞察**：应急场景的正解是「**把基站搬到现场**」，而会展场景没有这个权限 —— 两者结论方向相反。

**❌ 中文「消防/救援便携基站」实战复盘**：中文搜索多次返回 0 结果。

### 3.5 ★★ 多运营商 / 同场馆实测对比

**中国（具体场馆 + 运营商 + 数字）**

| 场馆 | 运营商 | 实测数字 | 时间 | 链接 |
|---|---|---|---|---|
| **南通体育会展中心**（3.2 万人） | **中国移动江苏南通** | **5G 下行平均 677.43 Mbps、上行 388.88 Mbps**；接通率 **99.86%**、掉线率 **0.01%**；单小时最高承载 **14,960 人**；上行峰值 **>500 Mbps**；小区扩至 **60 个**，容量 **+40%** | **2026-07-24** | [CCTIME](http://www.cctime.com/html/2026-7-24/1739692.htm) |
| **国家体育场「鸟巢」**（北京） | **联通 vs 移动** | **联通：n78+n78+n1 三载波聚合(3CC)，但 SINR 太低，速度只有 500 Mbps**；**移动：只有 N79，速度一般** | **2025-09-27** | [通信人家园 tid=1405669](https://www.txrjy.com/forum.php?mod=viewthread&tid=1405669) |
| **北京新工体** | **北京联通 + 华为**（5G-A 3CC） | **CPE 下行峰值 11.2 Gbps，上行峰值 4 Gbps**；手机现网下行峰值 9 Gbps 以上 | **2024-11-21** | [36氪](https://m.36kr.com/p/3045911267478146) |
| **贵阳·凤凰传奇演唱会** | 中国移动贵州 | 下行峰值 3.69 Gbps，**上行突破 355 Mbps**；新建 **25 个 5G 基站** + 车载应急通信 | 2025-2026 | [知乎](https://zhuanlan.zhihu.com/p/1983919435493447554) |
| **石家庄某音乐节** | 中国移动 | 下行峰值 >3 Gbps；高峰单用户**稳定 300 Mbps 以上**；时延 **<20 ms**；**铺 12 公里专用光缆** | 同上 | 同上 |
| **惠州·邓紫棋演唱会** | 中国移动惠州 | **新增 4G/5G 设备 78 个，扩容 4G 小区 169 个、5G 小区 61 个，可承载 3 万用户** | 同上 | 同上 |
| **烟台·邓紫棋演唱会** | 中国移动烟台 | 新增 4/5G 设备 60 台，扩容 152 个小区，应对 3 万人 | 同上 | 同上 |

**⚠️ 南通案例的重大意义 —— 本次调研最大的结论冲突点**
南通移动在 3.2 万人场馆做到**上行 388.88 Mbps 平均、掉线率 0.01%**，**直接反驳**了「场馆蜂窝必然崩」的绝对论。它的配方逐条可迁移（但都是**运营商侧**手段）：
1. **频率组网**：`2.6G 异频 + 4.9G 同频双载波 + 3.7G 应急扩容` 三层架构
2. **4.9G 窄波束矩形波天线**精准覆盖
3. ★★ **干扰治理：低成本 AAU 旁瓣物理遮蔽方案 —— 泡沫板 + 锡箔刚性遮挡装置，突出天线 30cm 阻断旁瓣干扰路径，底层看台干扰降低 2.5 dB**
4. ★★ **上行 2CC + 动态调整 4.9G 时隙配比 → 上行峰值突破 500 Mbps，4.9G 上行流量占比 +32 个百分点**
5. **潮汐式分阶段调控**：进场/观赛/退场六大阶段，动态调节场外宏站功率

> 💡 **场馆上下行瓶颈不在频谱总量，而在同频干扰与上行时隙配比。** 「用泡沫板+锡箔挡住天线旁瓣」这种几十块钱的做法，比多插几张 SIM 卡有效得多 —— 但这是运营商才能做的事。**这恰恰说明：找运营商谈保障 > 自己买设备。**

**关于鸟巢（重要反例）**：联通理论能力最强（3CC）但实测只有 500 Mbps，发帖人自归因 **"不过 sinr 太低"**。→ **「载波聚合能力强」≠「你在场馆里跑得快」，干扰（SINR）才是决定性的。**

**美国（具体场馆 + 运营商）**

| 场馆 | 运营商 | 结论 | 时间 |
|---|---|---|---|
| **LVCC** | **Verizon 5G Business Internet** | ✅ 成功 | 2025-12 |
| **LVCC** | Neutral Host DAS | ✅ "**the DAS is generally very hard to saturate**" | 2025-09 |
| **Box Fan Expo** | **AT&T + QCI-7** | ✅ 成功 | 2025-09-17 |
| **Red Bull Arena, NJ**（23,000 人） | **T-Mobile** | ❌ "**Congestion at the stadium :( couldn't send a text!**" | 2015-08-10 |
| **Michigan Stadium** | **Verizon** | ❌ "**5 bars and never once was able to make a call.**" | 2015-08-10 |
| **Disneyland (Anaheim)** | **Verizon / T-Mobile / AT&T** | **Verizon 有 n77 DAS**（2024-12 部署）；**T-Mobile 仍是老 b2/b66 DAS，"quite slow"，n41 DAS 升级中**；AT&T n77 计划 2025-04。证词：*"**I did not have a single problem on AT&T**... **T-Mobile seemed to be rather slow/congested, and I lost signal in a lot of ride queues.**"* | 2025-01-11 |
| **某常去场馆（未点名）** | Verizon vs 其他 | "**Verizon works just fine on the floor, the others not so much.**" | 2025-12 |

**★★ 「同场馆不同运营商差异巨大」的原因排序（按证据强度）**
1. **DAS 里有没有你这个频段**（最强）—— *"DAS systems are like time capsules... not upgraded as new bands are available"* + Disneyland 案例（Verizon 有 n77，T-Mobile 只有老 b2/b66）。**不可预测，必须现场测**
2. **DAS 是不是 neutral host**（LVCC 是 → 全场馆都好）
3. **QCI / 优先级** —— 可控（可买）
4. **你的号是不是 MVNO / 二级（被降级）** —— 可控
5. **频段穿透差异**（Verizon 700 MHz / AT&T 850+700 / T-Mobile 600）

**★★ 「信号满格但上不了网」的实操解法（多帖独立验证）：主动锁 4G / 关 5G**
- *"**As long as there is a carrier wave detectable on 5G, no matter how weak it is, your phone will refuse to seek better signal or switch to 4G.**"*（u/RevCyberTrucker2, 2025-01-01）
- *"**It's basically getting on the access road when the interstate is at a complete stop.**"*（u/MommaChem, 2024-12-31）
- 中文侧同结论：*"**强制把手机限制在 4G 可能在展会时候是最佳方案**"*（赛车星冰乐, 2026-04-24）

### 3.6 案例侧给出的 8 条循证建议
1. **场馆方有线专线做主链路，蜂窝只做备份** —— 跨 4 社区 20+ 条独立证词的**唯一共识**
2. **蜂窝侧最少 3 家运营商各一张** —— *"you need three carriers. **Two won't cut it**"*
3. **别指望通用聚合路由器救直播** —— Peplink/Cradlepoint 是负载均衡，单流仍走一条链路。要么上 LiveU/TVU/Dejero/Haivision，要么 **SRT + 20 s buffer + 云端 relay** 自建
4. **优先级 QCI / 网络切片 > 多插卡**
5. **天线要能选扇区** —— *"High-gain antennas can backfire if they're locked onto a saturated sector"*
6. **提前一天（布展/彩排期）验收，并留「开场后再测一次」的流程**
7. **协议层：RTMP → SRT**（RTMP/TCP 仅容忍 <2% 丢包、<30 ms 抖动）
8. **⚠️ 别在场内开 Wi-Fi 热点** —— FRC 频谱仪实测证明观众热点会打挂赛场控制链路；RoboMaster 官方手册明说「**不建议使用无线方式连接裁判端主机与无线路由器**」

---

## 4. 「看起来有用其实没用」的伪手段

按「危害程度」排序。

### ❌ 4-1 手机信号放大器 / 直放站（违法，且不增加容量）
**为什么看着有用**：产品宣传"信号从 1 格变满格"。
**为什么没用**：
1. **技术上不增加容量**。放大器只是把已有信号放大，基站侧的 RB 资源一个都没多。在拥塞场景下你抢到的还是那一份，而且抬高了上行底噪，害了同小区所有人（包括你自己）。
2. **在中国属于违法行为**。《中华人民共和国无线电管理条例》要求设置无线电台须经批准并领取执照；刑法第 288 条：*"违反国家规定，擅自设置、使用无线电台（站），或者擅自使用无线电频率，干扰无线电通讯秩序，情节严重的，处三年以下有期徒刑、拘役或者管制"*（新华网浙江，2024-06-05 http://zj.xinhuanet.com/20240605/ae11004ddfce43bc9299564b393cba94/c.html）
3. 上海无线电管理局原话：*"擅自安装手机信号放大器，干扰正常的移动通信，属于违反《中华人民共和国无线电管理条例》的违法行为"* https://www.shobserver.com/toutiao/html/125664.html
4. 查处案例：山东济宁 2023-12 查处开发商私装信号放大器并责令拆除（http://www.qinghai.gov.cn/qhww/gnxx/3880.jsp）

### ❌ 4-2 「5G 一定比 4G 好，强制开 5G」
满场时 5G 可能比 4G 更差（A-6）。现场实测反例：*"5G 收微信都收不进来，切换到 4G，就非常顺畅"*。学术侧也指出 5G 在高负载下的上行抖动/时延方差比稳定的 LTE 链路更差。

### ❌ 4-3 「买贵的套餐 QCI 就高了，就稳了」
有反例，且逻辑上站不住：V2EX #19 leon0318：*"实际没啥用，该慢还是慢，**又不是单独的信道**"*。套餐级 QCI 只提高**调度权重**，不给你专属资源。**真正有用的是运营商的场馆级 GBR / 专属通道**（A-7），那要单独买，不是"升级套餐"。

### ❌ 4-4 「锁频段锁死最快速率的那个频段」
会**阻止载波聚合**加副载波（ISPreview 原文明确）。本来就只剩 100 MHz，锁完可能只剩 20 MHz。锁频是「用峰值换稳定」，不是白赚。

### ❌ 4-5 「买根高增益天线插上就起飞」
- Waveform 原话：*"**We'd be surprised if you saw better data rates immediately upon connecting the antennas.**"*
- 前置条件：室外信号本身不可用时，天线救不了
- **MIMO 天线不增程只增稳**："two streams at -90 dBm don't magically become -87 dBm"
- 而且如果你用的是 5 米 RG316 转接线（1.46 dB/m @2.4GHz → **7.3 dB**），增益全赔在线上还倒亏

### ❌ 4-6 「路由器放在房间中央、离地一米」这类万能摆放口诀
**为什么看着有用**：搜"5G CPE 摆放"能搜出一大堆同题文章，都讲"放中间、放高处、别靠墙"。
**为什么没用**：那套口诀是给**家用 WiFi 路由器**（覆盖室内终端）讲的，不是给 **CPE 的蜂窝链路**（对准室外基站）讲的。CPE 的最优位置和家用路由器的"房间中央"经常**正好相反** —— CPE 应该靠窗、朝基站，哪怕这意味着它不在房间中央。
**证据**：什么值得买该主题排名第一的文章，页面自己标注"**内容由AI生成**"，40 条"精选参考来源"里 20+ 条是今日头条/微信公众号同题水文（https://post.smzdm.com/p/aggd2d8m/）。这类内容是这个领域最大的噪音源。

### ❌ 4-7 「WiFi 中继 / 桥接 把场馆 WiFi 接过来」
**为什么看着有用**：不用买卡、不用接触运营商。
**为什么没用**：
- 场馆 WiFi 本身就是全场最挤的一段，中继等于把最烂的一段再砍一半（中继通常吞吐腰斩）
- 场馆 2.4G 频谱是"wild wild west"，5GHz 通常被场馆方保留给付费用户
- 更要命：**很多展馆明文禁止私建网络**（见 4-8）

### ❌ 4-8 「我带自己的设备进去架网，谁管得着」
**这是工程上最容易翻车、也最少人提前查的一条。**
国内展馆的参展商手册普遍规定：
> "**展馆内全部有线、无线网络需求必须向展馆方申报，禁止私自建立有线和无线网络，一经发现，扣除保证金 2000 元/次。**"
—— 中国国际贸易促进委员会纺织行业分会参展商手册
https://www.cainet.org.cn/cms_files/filemanager/cainet/attach/0/334e9f6f6199407eb435f7045b6836a8.pdf

**所以第零跳的方案要在"报备/合规"层面也成立**：要么走场馆官方有线（国家会展中心（上海）明确"现场提供官方有线网络宽带和免费公共无线 Wi-Fi 接入两种上…"，https://worldskills2026.com.cn/WSS2026_EXPO_Exhibitor_Manual_V1.0_CN.pdf），要么用蜂窝（蜂窝严格说也属于"无线网络"，实操上低功率 CPE 一般不被视为"建网"，但**提前问一句主办方/场馆方**比事后被扣保证金便宜）。

### ❌ 4-9b 「买了 Peplink / Cradlepoint 就是聚合了」
**这是本案最贵的误解。** 这类设备的默认模式是**按连接负载均衡** —— 一条视频流/一个 TCP 连接仍然只走一条链路，带宽不叠加、故障时连接照断。前 LiveU 生态从业者原文：*"**Your maximum throughput for a single connection is still only defined by the maximum throughput of your best connection.**"*
要真正聚合必须：① 显式启用 **SpeedFusion Bonding / Hot Failover**（并用 FusionHub / SpeedFusion Cloud 做对端）；或 ② 用 **LiveU / TVU / Dejero / Haivision** 这类**视频专用协议**设备（它们是把视频流**分包**后分发到多条链路，代价是 **15–40% 的 FEC 与重传开销**）；或 ③ 自建 **OpenMPTCProuter**。
**另一条更省钱的路线**：不买聚合硬件，改用 **SRT + 20 秒大 buffer + 云端 relay**（有实测：20 分钟推流正常）。RTMP/TCP 只容忍 **<2% 丢包、<30ms 抖动**，换协议本身就是巨大的稳定性提升。

### ❌ 4-9c 「多插几张 SIM 卡就能扛住」
架构错了，插多少张都没用。反例：**10 modem 聚合设备在会展中心 press day 也翻车**（*"**Even a 10 modem bonded device failed on us.**"*）。真正改变结果的是**优先级（QCI / 切片）**，不是链路数量。最少 3 家不同运营商是底线（*"you need three carriers. **Two won't cut it**"*）。

### ❌ 4-9 「PT/测速软件跑出来的 500 Mbps 说明网络很好」
下行峰值在拥塞时毫无参考价值。圣母大学实测：空场 T-Mobile 中位下行 270.5 Mbps，满场所有制式都掉到 **53–60.8 Mbps** 并趋同。**你该测的是上行 + P90 时延 + 丢包，不是下行峰值。**

---

## 5. 证据可信度评估

| 等级 | 定义 | 本报告中的例子 |
|---|---|---|
| **A 级：一手实测 / 官方文档** | 有方法论、有数据、可复现；或厂商对自己产品的官方说明 | arXiv 2607.16008v1（134 万条 QualiPoc 采样、6 场比赛）；arXiv 2604.04371；C114 5G 室分实测；华为/TP-Link/移远官方 FAQ 与 AT 手册；Times Microwave 线材数据表；YouTube 官方码率表 |
| **B 级：可追溯的论坛实录** | 有具体场景 + 具体设备 + 时间；但无对照实验 | V2EX 演唱会帖（13,394 浏览 90 回复，逐楼可查）；Reddit r/CommercialAV、r/wifi（有具体场馆经验描述）；ISPreview 锁频指南（作者给出自己的 soft-lock 失败经历，诚实）；Chiphell 5G CPE 帖（36 楼，含 1 年使用与烧 SIM 卡经历）；Waveform 天线指南（厂商但给出了"有些人提升远低于预期"的反向信息） |
| **C 级：厂商技术文 / 软文** | 机制描述可能正确，但结论服务于销售 | OFweek FIFISIM 物联网卡 QoS 文（结论是"买我们的一级代理卡"）；烽火 CPE 评测（知乎，但内容质量高，有完整测试方法）；star-elink"万字深度解析"（SEO 水文，混入大量正确与推测内容）；China.com 聚合路由器"实测"（实为方为 Z5 的推广稿，但"3 路以上安全边际""展会搭建期测网"等实操建议有道理） |
| **D 级：AI 生成 / 同题水文** | 无一手信息，互相抄袭 | 什么值得买《5G CPE 网速翻倍指南》（页面标注"内容由AI生成"，40 条来源 20+ 条是头条/公众号同题文）；各类"路由器摆放玄学"文章 |
| **E 级：需要警惕的** | 有利益动机且给出了强烈结论 | smzdm 随身 WiFi 横评（带货）；B站"信号提升 30dB"UP 主（带货）；OFweek QoS 文；中文侧"多卡聚合路由器"内容（方为 Z5/C7、TVU One、美乐威、乾元通）——**绝大多数是厂商软文**，已逐条降级；Reddit r/USMobile 的 QCI-7 成功帖（US Mobile CEO 亲自回复，有用户直接吐槽 "A double ad on the subreddit"） |

**几条重要的"证据冲突"，我倾向于这样判**：
1. **QCI 有没有用**：V2EX 网民说"没用"，但中兴/移动的场馆 GBR 方案是运营商自己发布且有落地案例（苏超、胡彦斌演唱会卖加速包）。**判断：套餐级 QCI 效果存疑；场馆级 GBR/专属通道是真的。**
2. **锁频段值不值**：知乎/B站教程一律推荐锁小区，ISPreview 明确指出锁定会牺牲 CA。**判断：取决于你所在位置有几个可选小区。只有 1 个小区时锁频纯亏；小区多且乒乓时锁频净赚。必须现场测。**
3. **4G vs 5G**：运营商宣传一律 5G 更好，学术实测和用户实录都指出拥塞下 4G 可能更稳。**判断：以现场实测为准，别预设。**

---

## 附录：现场 72 小时作战清单（可直接照做）

### T-7 天：决策
- [ ] **打电话给三家运营商的大客户/政企经理，问有没有「大型活动保障」「直播专项保障」「场馆加速包」**。这是 2026 年最有效的一招（A-7、A-11）。中兴在苏超和胡彦斌演唱会卖过「5G-A 场馆加速包」，中国移动有「五重 VIP 专属网络保障」。
- [ ] **向场馆方书面报备你的网络方案**。国内展馆普遍规定「展馆内全部有线、无线网络需求必须向展馆方申报，禁止私自建立有线和无线网络，一经发现，扣除保证金 2000 元/次」（第 4-8 条）。
- [ ] 问清场馆方：**有没有官方有线网络可以买**、有没有 DAS 室分、有哪几家运营商的室内分布。
- [ ] 备 2 张**不同运营商**的卡 + 1 张广电/虚拟运营商应急卡。**别把两张卡放在同一家运营商**。

### T-2 天：设备与配置
- [ ] 设备选**纯 CPE（带 RJ45，不带电池或可拆电池）**；随身 WiFi 只做兜底。
- [ ] **不要用带电池的设备长期插电**（厂商官方已警告会鼓包，见 B 章）。
- [ ] 配 UPS 或大容量 PD 移动电源；确认 CPE 的**额定电压/电流**（如烽火 LG6121F 是 12V 1.5A），别用 5V 充电宝硬带。
- [ ] 装看门狗：OpenWrt `watchcat`，或 cron 脚本 ping 外网失败就重启接口（见 B 章）。
- [ ] 第零跳后面**所有业务必须能自动重连**（C-0 硬约束）。

### T-1 天（搭建期，人少）：**这是唯一的黄金测试窗口**
- [ ] **把 CPE 拿到场馆里，逐点测**：至少测 5 个位置（含窗边、制高点、你打算放的位置），每个位置记录 **RSRP / SINR / 上行 / 下行 / P90 时延**。
  - 判据（华为官方，中国移动测试要求）：**SINR ≥ 16 dB 才算正常；RSRP ≥ -85 dBm 才算正常**（A-9）
- [ ] **测 4G-only 和 5G 两套配置**，各记一遍。别预设 5G 更好（A-6）。
- [ ] **锁频实验**：枚举候选频段，每个组合测一次，记录 PCI / ARFCN / 速率。
- [ ] **锁小区实验**：如果附近有多个小区，逐个锁了测。**注意基站夜间会关部分 PCI**。
- [ ] **测切换**：拔掉主 CPE 的网线/断电，秒表记时 + 持续 ping 记录丢包数。**必须真做**（C-1 的 Starlink 4 分钟没切的教训）。
- [ ] **测公网可达性**：`curl -6 ifconfig.co`；从外网 ping 回来；确认 IPv6 入站是否被封（C-5）。
- [ ] **`iperf3` 长跑 30 分钟**，看有没有周期性的速率塌陷。

### T-0（开赛日）：固化 + 监控
- [ ] **开场前 30 分钟再测一次**（人开始进场，基站负载已经变了）。这一次的数据才是有效数据。
- [ ] 固化最优配置，**截图备份所有参数**（锁频/锁小区填错可能变砖）。
- [ ] 起一个持续监控脚本：每分钟记录 RSRP/SINR/上行/时延/丢包到本地文件。**出问题时有数据可查**。
- [ ] 有人能**物理接触到设备**（散热、重启、换位置）。

### 现场应急顺序（按这个顺序试，别乱）
1. 换位置（成本 0，见效最快）—— 挪到窗边/制高点/远离人群金属
2. 切 4G-only / 切另一个运营商
3. 换频段（锁频）
4. 切备份 CPE（双 WAN 自动或手动）
5. 切手机热点兜底
6. 降低推流码率 / 降分辨率（保住"不断"，放弃"高清"）

---

## 附录 B：型号速查表（本报告证据中出现过的具体设备）

| 型号 | 形态 | 关键特性 | 出处/证据强度 | 备注 |
|---|---|---|---|---|
| **中兴 MU5001** | 随身WiFi **带 RJ45 网口** | 闲鱼约 ¥400；WiFi6；可改直供电 | 知乎实测（B级）：连续 2h/440GB、6h/586GB、12h/1.72TB 未断流 | **性价比最高的"迷你 CPE"** |
| 中兴 MU5002 | 同上 + AP 功能（网口可作 WAN） | | 知乎同作者 | |
| 中兴 F50 | 名片大小，不带电池网口 | T760 | 知乎："**需要改散热**"；"散热表现比 mu5001 要差" | 需折腾 |
| **烽火 LG6121F** | 桌面 CPE，2×RJ45 | 联发科 T750/MT6890，NSA/SA，200Mb CA；8 根 4/5G 天线，2T4R；12V 1.5A；**支持锁小区/锁频段** | 知乎硬核评测（B级）；官方参数 | 支持外接天线；填错锁小区参数重启可恢复 |
| 烽火 CPE Pro / Air | 桌面 CPE | | V2EX 用户："买回来到现在半年多了 没管过 很稳" | |
| **华为 5G CPE Pro / Pro 2 / Win** | 桌面 CPE | **官方支持锁 Band/ARFCN/PCI + SA 模式切换** | 华为官方文档（A级） | 掉 4G 官方解法就是锁频 |
| **华为随行 WiFi X**（E6898） | 随身WiFi，**带电池 + USB-C 有线上网** | **16 根天线 / 4T4R；上行峰值 1000 Mbps；12000mAh；66W** | 充电头网评测（B级） | ⚠️ **仅支持中国移动卡**；配"直播臻享卡"解锁更高频段 |
| 华为智选 Brovi 5G CPE 5 | 桌面 CPE | | Chiphell 推荐（B级） | |
| 华为智选 381 | 桌面 CPE | 弱信号能力强 | 少数派："手机 -105dBm，**381 可以最低干到 -88**" | |
| 中兴 MC801A / MC889A Pro | 桌面/户外 CPE | MC889A Pro：高通 X65，**定向天线**，无 WiFi | 知乎/Chiphell | 户外款对摆放极敏感 |
| 通则 VN007+ | 桌面 CPE | 紫光展锐 V510，≤800Mbps | 少数派入门推荐；Chiphell："**得做好散热，否则容易烧手机卡**"；知乎："**联通 vn007 会断网断流**" | ⚠️ **有反面证据** |
| 通则 X30 | 桌面 CPE | **支持来电自启** | 知乎 | 适合无人值守 |
| 鲲鹏 C8-600 / 美碳 571/601 | 桌面 CPE | V510，~¥500 | 少数派 | 入门 |
| 鲲鹏 C2000 / C2000 MAX | 便携 CPE | V510，**不带电池带网口** | 少数派 | |
| 鲲鹏 NBCPE | **室外机 + 室内机，POE 回传** | 室外机当天线 | 少数派 | ✅ **工程上最优形态之一** |
| 三星 SCR01 | 便携 | 电池续航好 | 知乎 | |
| 阿乐卡 | 便携 | 高通 X55，**需要改** | 少数派 | |
| TP-Link Deco X50-5G | 桌面 CPE | **官方支持 Cell Lock（EARFCN+PCI）** | TP-Link 官方 FAQ（A级） | |
| MikroTik ATL 5G R16 | 桌面 CPE | **支持 cell lock PCI + 多 ARFCN** | MikroTik 论坛（B级） | |
| 移远 RM520N-GL 模组 | 模组 | **AT+QNWLOCK 锁 4G/5G 小区** | 移远官方社区（A级） | DIY 方案底座 |
| Peplink B One 5G / MAX BR1 Pro 5G | 商用多 WAN 路由 | **SpeedFusion 包级聚合** | Peplink 论坛/价格页（B级） | 硬件 $599 起 + PrimeCare $115–150/年 |
| Cradlepoint E300 | 商用多 WAN 路由 | 多运营商 SIM 自动选优 | 英文行业报道（C级） | 美国市场常用 |

### ⚠️ 明确被实测「会断网断流」的型号（负面清单）
知乎作者原文：**"鲲鹏cc8、翼青春jc09随身WiFi、华星时空随身WiFi 这3者出现了断网断流，不推荐，另外联通vn007也会断网断流（网友测试）"**
https://zhuanlan.zhihu.com/p/1947434159720083635
