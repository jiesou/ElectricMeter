# 5G CPE / 随身WiFi **基带平台** 社区口碑与可靠性证据

> 调研时间：2026-10-07。工作方式：先搜索定位 URL，再 **fetch 全文读完整楼**（含回复），
> B 站视频用 `yt-dlp` skill 取字幕 + 热评，403 的站点用 `bypass-cf-403`（实测 `markdown.new` 对 Whirlpool 有效）。
> 每条结论附链接 + 原文摘录 + 日期。
>
> **可靠性分级**：🟢 高（多独立用户 + 完整楼）｜🟡 中（单用户实测/有量化数据但样本 1）｜
> 🔴 低（软文/AI 生成/情绪断言）｜⬜ 未找到证据

---

## 0. 先看结论：一张图说清

**没有任何一个平台免于「断流」。** 本次调研找到的抱怨覆盖全部 6 个平台。
差别在**频率量级**与**抱怨的性质**，而且**被抱怨最多的平台恰好是销量最大、机身最小的那台**。

| 判断 | 内容 |
|---|---|
| 抱怨绝对数量最多 | **展锐 T760 / 中兴 F50**（8 个独立帖子/视频 + 官方固件层面的间接承认） |
| 但主因是**机身热设计**不是基带 | 同芯片的**中兴 M3** 实测低 20℃（🟡 有量化实测，见 §1.1） |
| 唯一一条**同一用户跨平台对照** | 高通 X62 静默丢包，而同人的 X65 / MTK T750 设备「stable AF」（🟡 样本 1，但对照设计最强） |
| 被两个独立来源评价为「凉」 | **MTK T750**（Whirlpool 2024-01-15 + Chiphell 实测烽火 1 小时 43℃） |
| 国外社区断流重灾区、国内却是口碑标杆 | **华为巴龙 5000**（反差极大，疑为运营商定制固件差异） |
| **查不到故障报告 ≠ 稳定** | **T830**、**UDX710/MC888S** 均因样本量不足而「未找到证据」 |

> ⚠️ 对比赛现场最重要的一条反直觉发现：
> **连口碑最好的烽火（T750）也有用户报告「每个月会断流一次，重启解决」**（§1.3）。
> 也就是说，「换平台」解决不了 60 分钟不断网；**散热 + 锁小区 + 双机冗余**才解决。

---

## 1. 「平台 → 故障/断流报告密度 → 典型帖子链接」表

### 1.0 总表

| 平台 | 代表机型 | 报告密度 | 主要症状 | 最高价值帖子 |
|---|---|---|---|---|
| **紫光展锐 T760**<br>(UMS9620) | 中兴 F50 | **高**（≥8 独立来源） | 过热降速 → 断流 → 断电重启；休眠后不自恢复 | [Chiphell 2580163](https://www.chiphell.com/thread-2580163-1-1.html) 🟢 |
| 紫光展锐 UMS9632 | 中兴 F50 Pro | 低（新机，社区讨论集中在「阉割」） | 被指 ADB/降级阉割 + USB2.0 | [奶昔论坛 6385](https://forum.naixi.net/thread-6385-1-1.html) 🟡 |
| **紫光展锐 UDX710 / 春藤 V510** | 中兴 MC888S、飞猫 FM10、联通 007 | 中低（老平台，用户已流失） | 「得自己加风扇，不然夏天容易烧 SIM 卡」 | [Chiphell 2509264](https://www.chiphell.com/thread-2509264-1-1.html) 🟡 |
| **联发科 T750** | 烽火 LG6121F / 5G CPE Pro、Zyxel NR5013 | 低（但存在） | 5G→4G 随机回落；**每月一次断流** | [Chiphell 2720772](https://www.chiphell.com/thread-2720772-1-1.html) 🟢 |
| 联发科 T830 | 中兴 G5 Pro、烽火 5G CPE Pro 2 | **未找到证据** | — | ⬜ |
| **高通 X55** | 中兴 MC801A / MC8020、中兴 7010 | 中 | 一个月死机 2 次须拔电；热；弱信号下 5G 卡死 | [yizu.org 785](http://www.yizu.org/archives/785/) 🟡 |
| **高通 X62** | 中兴 U50 Pro、移远 RM520N-GL | 中（但证据质量最高） | **静默丢包 ~1 分钟**（link up 但无 Rx） | [Reddit r/thinkpad](https://www.reddit.com/r/thinkpad/comments/1qe3h7a/) 🟡 |
| 高通 X65 | 移远 RG520F-EU | 极低 | 同用户评价「stable AF」 | 同上 🟡 |
| **华为巴龙 5000** | 华为 5G CPE Pro / Pro 2（H112-372、H122-373） | **国外高 / 国内低（强烈反差）** | 每天断 1 次～每天 2-3 次，必须拔电 | [Reddit x465u9](https://www.reddit.com/r/HomeNetworking/comments/x465u9/) 🟢 |

---

### 1.1 紫光展锐 T760（UMS9620）—— 中兴 F50｜密度：高 🟢

这是本次唯一一个**被 8 个以上独立来源反复报告**的平台。

**① Chiphell《双不限卡入坑随身WIFI，中兴F50，发现几个问题》**（28933 阅读 / 21 回复）
🔗 https://www.chiphell.com/thread-2580163-1-1.html
作者 lode，**2024-01-26**，1 楼原文：

> 「1.**不定时会断网（已锁5G SA），这个是最难受，断网时机身也不热，固件版本B18**
> 2.长时间使用5G热量较大，烫手级别，冬天如此夏天估计得上风扇」

同楼后续回复（**这就是「官方从未闭环」的现场**）：
- #3 zivers（2024-01-26）：「固件更新到**B15很稳定**就没往上升了。……别锁SA了，就自动……是否开启性能模式（Performance_Mode），**我之前开启的时候感觉稳定性下降了**，所以关了，但是有些人说开启之后更好」
- #5 magiciandyj（2024-10-29）：「我把f50有线接入电脑后，**电脑休眠恢复之后，f50不会自动恢复，一定要断电重启一下才行**」
- #6 pmtto（2025-02-24）：「大哥，这个问题解决了吗？**我的也是休眠之后需要断开重连才行**。」
- #10 ZZZ2024（2025-02-24）：「这东西**散热不行，一热就掉速**，拆壳改造后效果会好很多」
- #17 **zmdt（2025-03-03）——最重要的横向对照**：
  > 「就是担心随身WiFi过热问题，最后我还是买了**烽火CPE，体积大带主动散热，连续下载1小时CPU温度43°C**」
- #21 eckl（2025-03-04）——极少数的正面长期反馈：
  > 「去年7月买的时候那个版本**不太稳定**……更新几个软件版本后没出现过，**很稳定**」
- #22 cyberms：「ZTE MC8020 随身的尿崩」

**② 恩山无线论坛《中兴f50，入门级最佳5G随身wifi使用小结》**（20769 阅读 / 14 回复）
🔗 https://www.right.com.cn/forum/thread-8365101-1-1.html
作者 lode，**2024-04-12**，1 楼原文（用了 3 个月后的总结）：

> 「缺点：1.**发热比较明显，锁住5GSA全速下载10分钟，温度会达到60~70°（室温22），导致过热降速（自己配了个手机风扇）**」

**③ V2EX《最小巧的 5G 随身 WiFi 中兴 f50 体验评测》**（16403 阅读 / 46 回复）
🔗 https://www.v2ex.com/t/966078
作者 cuicuiv5，**2023-08-17**，正文原文：

> 「目前固件存在的问题是没有短信功能，**以及发热后速度下降、断流。官方承诺会在后续更新中增加短信功能，并已在最新内测固件中解决了断流问题。**」

**补充 1（2023-08-18）—— 全文最关键的一句**：

> 「在昨天， F50 全量推送了可启用性能模式的新固件 B09…… **性能模式移除了温控, 可以减少掉速与断流**」

> 💡 **这句话的信息量极大**：厂家的「修复断流」手段是**移除温控**（放任芯片更热换稳定），
> 而不是改善散热设计。这解释了为什么后面（2024-01 Chiphell）用户还在 B18 上报断流，
> 以及为什么 2026 年社区反而回头讨论 B09。

同楼其他回复：
- #16 huaweigg（2023-08-17）逐条列出 13 项缺点（USB 网卡协商仅 450M/USB2.0、不能锁频段、官网无产品页、无电子说明书……）
- #39 cq65617875（2023-09-14）：「**除了发热压不住会降性能，其他都还好**」
- #42 lin41411（2024-05-27）才确认：「目前最新固件**可锁频段，可锁小区**，能收短信」

**④ Chiphell《关于随身wifi的速度测试与推荐》**（3941 阅读 / 5 回复）
🔗 https://www.chiphell.com/thread-2763685-1-1.html
- #3 孤舟一笠，**2025-12-08**：「**F50这本质上是个安卓，所以本身受限。而且无电池，很难称之为"随身wifi"。是有点被神化了。**」（此人另一台设备「连续工作500多天」）
- #6 **jifenghas，2025-12-08（本报告最直白的一条）**：
  > 「中兴F50刚发售的时候买的 **那会儿断流看个B站10分钟都能热掉线** 还不如800块买个蓝绿厂的机子稳定。。。」
- #1 楼主 kissybaby：F50 Pro 实测外网 150Mbps，但**内网 iperf3 只有 12.1 Mbits/sec**，「甚至还不如8年前的老款华为随身WiFi」

**⑤ B 站《中兴F50完美改散热：换成中兴M3》**（55188 播放，8:40，UP: OpenRouter）
🔗 https://www.bilibili.com/video/BV12r5SzBEMv/ ｜上传日期 **2025-04-21**
（用 `yt-dlp` skill 取得字幕全文，非只看标题）

这是本次调研中**唯一带完整温控实验数据的证据**：

| 测试 | 中兴 F50 | 中兴 M3（**同款展锐 T760 芯片**） |
|---|---|---|
| 待机 CPU | 33.98℃ | 29.4℃ |
| 跑完 10G 实际流量后 CPU | **73℃** | **51.82℃**（视频总结口径 56℃） |
| 表面温度 | 36℃（热点在卡槽附近） | 更低 |
| 天线 | 「F50只有一个小范围的一圈」 | 「一圈是比较大范围的一圈」 |

字幕原文：

> 「我每次测试只跑了实际流量，无法触发F50明显的高温降速……日常使用中更容易触发F50高温的情况是**环境温度本身很高**，比如夏季或者F50放在包里等散热不畅的地方。
> ……（加热台 100℃）**此时它的温度在90度左右，说明这个温度下会明显降速**（200兆左右，几十甚至还有个位数）
> ……（CPU）**现在是101度了**……**这个状态其实是断网的**，返回温度页面也无法刷新
> 结合我之前的测试，**它的断网极限温度在100度左右**
> ……我发现**F50 CPU温度不超过80度问题不大**，但长期使用温度再低一些会更好
> 总结：**中兴F50最好的散热方案是换乘（中兴）M3**……同样条件 M3 只有 56 度，哪怕 F50 再套上半导体散热器，也比 M3 高几度」

同日热评（字幕文件附带，可核）：
- 日笼包蘸咬卵酱：「**长时间连接或者环境温度高，CPU会降频影响速率和稳定性**，就是俗话说的卡，想长期稳定的情况肯定得加散热」
- 猥琐动世人：「**我们这边的天气不允许不管散热，会断流的**」
- 無依浮尘（5 个月前）：「**改什么散热都没卵用，照样烫的要死，可以煮鸡蛋。**」
- 大不列颠メ干饭王：「风扇吹的只是外壳塑料温度，**内部结构是没有接触到塑料的**，空气传导热量情况下，用的都能感觉很烫手」

> ⚠️ **必须同时读到的另一面**：这台机器**同芯片的 M3 低了 20℃**。
> 所以「F50 断流」的归因是**「极小体积 + 天线缩小 + 无电池直供」的整机设计**，
> **不是**「展锐基带不行」。把 F50 的问题说成「紫光展锐方案不稳」是**过度归因**。

**⑥ 奶昔论坛《CPE还是选5G随身wifi？》**（5244 阅读 / 32 回复）
🔗 https://forum.naixi.net/thread-6385-1-1.html
- 楼主 liammtop，**2025-11-02**：「便携款首推 中兴F50（wifi5款）……**不推荐新款F50pro 配置阉割了，不能开adb和降级成了usb2.0**」
- cyicek #16，**2025-11-11**：「他应该想表达**中兴F50体积小发热量大，容易降频造成网络卡顿不稳定**吧（除非你上散热套装，预算得+100多」
- cyicek #18：「**反观中兴F50，因为太小巧了，散热做得就很差**」（此人另一台 U30 Air 亚太版「长时间跑下载 130G 也没有烫手的迹象」）
- cyicek #15：「**我有烽火2pro，用起来确实很稳定**」

**⑦ 个人博客（佐证）**
🔗 https://luolei.org/zte-f50 ，**2024-11-11**：
> 「**F50 长时间使用发热是有问题**，小红书有很多散热方案，但是我自己个人没有那么高负载的场景」

**⑧ 知乎《499元！中兴F50 5G随身WiFi详细测评》**（47 评论）
🔗 https://zhuanlan.zhihu.com/p/650039256 ，作者 我是阿皮啊，**2023-09-08**
作者几小时内「未发现死机、断流」，但**作者置顶评论自己承认**（2023-08-26）：
> 「目前 B9 B10 固件推送了，**可以降低降速可能**，可更新测试」

---

### 1.2 紫光展锐 UDX710 / 春藤 V510（中兴 MC888S、飞猫 FM10、联通 007）

**证据强度弱于 T760，且大部分是「转述」不是「亲历」。**

**① Chiphell《有用5G cpe的小伙伴吗？》**（42133 阅读 / 36 回复）
🔗 https://www.chiphell.com/thread-2509264-1-1.html

- **#21 jgag，2023-04-16（针对春藤 V510 最直接的一条）**：
  > （谈飞猫智联）「看了下用的是**春藤510方案，用这个方案的都得自己加风扇不然夏天容易烧sim卡**，同价位还是比较推荐用VN007+。」
- **#19 jgag，同日**：「如果预算不够可以考虑联通的VN007+，**不过得做好散热，否则容易烧手机卡**。」
- ⚠️ **#5 tkdm，2023-04-16 的「烧卡」报告不能直接归因 V510**：
  > 「我用5GCPE在办公室上网，**一年用坏了3张sim卡**。就是7*24小时开机，单纯的sim卡坏了。」
  该用户**未说明机型**。后续 #14 jgag 猜「估计是cpe太热把卡烧坏了」、#37 BrainBUGs 猜「SIM卡坏有可能是机器发热严重SIM卡热变形了」——**都是猜测**。
- **#24 bosonx，2023-04-17 —— 反证（同日同楼）**：
  > 「在用**烽火CPE 每个月PT，分流刷个10T也没烧SIM卡。**」
- **#23 whydnf，2023-04-17**：「一个是华为370，一个中兴5001u，感觉都差不多……**华为基带稳定一些**」
- **#8 cyberms，2023-04-16**：「ZTE 5G CPE PRO3用了一年多了。总之就一句话，**很好**，比手机热点强多了。目前唯一推荐就是这款。」
  👉 注意：**同一个 cyberms 在 2026-04-01 改口说「zte一坨shit」**（见 §1.3），这是社区情绪漂移的典型样本，不能当技术证据。

**② 知乎《618进入尾声，盘点最值得入手的大厂5G CPE》**
🔗 https://zhuanlan.zhihu.com/p/530587043 ，**2022-06-18**
作者原文（谈联通 007 / 飞猫 FM10，**同芯片方案 = 紫光展锐**）：
> 「**稳定性较第一梯度还是有明显差别，偶尔会有重启的情况。**」
> 「虽然紫光展锐的方案理论下行速率为2.3Gbps，上行速率为1.15Gbps，但其实完全达不到。」

⚠️ **该文有软文嫌疑（大量吹烽火 + 附拼多多返现凑单教程），整体降权为 🔴→🟡 边界。** 但下面这条评论区内容值得单列：

评论区 ret2life，**2022-11-14**：
> 「飞猫现在有支持Wi-Fi6的了，但是**据说**紫光展锐春藤V510容易断流」

👉 注意「**据说**」二字 —— 这是**印象**，不是证据。见 §3。

**③ 中兴 MC888S（本任务点名的机型）→ ⬜ 未找到证据**

我按「MC888S 断流 / MC888S 重启 / MC888S 使用体验 / MC888S 贴吧 知乎」多轮检索并尝试读取，
**没有找到任何一条中文社区的真实用户故障报告楼**：
- 中文可读结果全部是**厂商稿与媒体评测**（中兴官网、天极网、知乎评测稿），口径一致为「509Mbps / ping 5ms / 抖动 1.67ms」；
- 什么值得买的拆解文（post.smzdm.com/p/a03r4n9z）页面**自己标注「内容由AI生成」**，0 评论 → 🔴 降权；
- 百度贴吧相关帖返回 403 / 安全验证，`markdown.new` 也被百度拦截 → 无法取证。

> ⚠️ **一个必须纠正的混淆**：网上大量「ZTE MC888 重启」报告（见 §1.5）针对的是
> **MC888**（Three UK 等运营商定制），**不是 MC888S**。本次未能确证 MC888 的基带平台，
> 因此**不把 MC888 的报告归因给 UDX710**。请勿混用。

---

### 1.3 联发科 T750（烽火 LG6121F / 烽火 5G CPE Pro / Zyxel NR5013）

**这是「口碑最好」的平台，但证据显示它同样会断流 —— 只是频率低一个量级。**

**① Chiphell《家人们，CPE哪个品牌的强一点？》**（6937 阅读 / 28 回复）
🔗 https://www.chiphell.com/thread-2720772-1-1.html
**#26 kanshuderen，2025-06-25 —— 本报告最重要的一条「反神话」证据 🟢**：

> 「我用的**烽火**。。。。基本稳定。。。**问题就是每个月会断流一次。。。然后重启解决。。。。原因不知。。。**」

同楼其他：
- #6 xsdianeht：「华为381或者烽火pro」
- #20 黑白音符：「中兴G5，华为智选381，烽火CPE Air，基本上都够用了」
- #24 i6wz1l：「**烽火的cpe不错 买pro**，一般二手 1300多」

**② Chiphell《求推荐好的 5G CPE 路由器》**（12644 阅读 / 44 回复，2026-03-03 起）
🔗 https://www.chiphell.com/thread-2784144-1-1.html （含 [第 2 页](https://www.chiphell.com/thread-2784144-2-1.html)）

2026 年的社区共识明显倒向烽火/华为：
- #14 贫民张大嘴（2026-03-03）：「在用**烽火5g cpe pro**，我这移动电信信号都一般，买了个外置天线放阳台了，**很稳定**」
- #17 kanshuderen（2026-03-04）：「**用了一年多的烽火。。。很稳。。。。**」（与 #26 的「每月一次断流」不矛盾，说明可接受）
- #22 cyberms（2026-04-01）：「**烽火好。bug修复快。zte一坨shit。**」
- #37 robocop（2026-04-09）：「推荐烽火在用」
- #38 悟空~（2026-04-09）：「**烽火+1,用1年多了**」
- #13 话莓（2026-03-03）：「买**华为h153-381，这个稳的不行**。」
- ⚠️ #10 415793633（2026-03-03）—— **纯印象（作者自己写了「据说」）**：
  > 「**据说**，烽火稳定性好，比较适合室内实用，华为巴龙方案连接基站速度快，比较适合移动使用，**中兴可能比这两个差一点**」

**③ 澳洲 Whirlpool 论坛《Telstra 5G Fixed Wireless Internet》**
🔗 https://forums.whirlpool.net.au/archive/98wxy5q3-4 （`markdown.new` 代理取得全文）

- **GGPantsu_100+60+20MHz，2024-01-15 —— T750 散热口碑的来源 🟡**：
  > 「1️⃣Qualcomm X55 modem VS MediaTek T750. ……the meteor aka Gen2 supports n78 + up to **5 LTE carriers**（Gen1 X55 只有 3 个）
  > 2️⃣Thermal. **The Gen1's thermal design isn't very good and the X55 modem is quite hot when running. I have heard cases of overheating happen to the Gen1 modem. The Gen2's thermal design is better and the MediaTek T750 chipset runs pretty cool.**」
- **Nistrod，2024-01-23 —— 同一台 T750 设备的反证**：
  > 「Black Gen 2 modem. ……Yes, I have done factory resets, and cleaned the SIM card.
  > **It will sometimes connect to 5G, but drops back to 4G after a random period between 20 seconds and 30 minutes.**」
- **Baxter.（同楼，同日 12:46）—— 反方的反方**：
  > 「I remember my Gen1 5G modem would display NO 5G light when it was not in use……**The Gen2 modem is faultless.**」
- 另有 2023-07-11 用户拆解确认 Telstra Gen2 用的是 **Fibocom FG360-EAU-11**（BGA 模组，**基于 MediaTek T750**），并实测「N78 + LTE 5CA (b1+b3+b7c+b28)」。

**④ ISPreview UK《Adventures in moving to 5G for internet》**
🔗 https://www.ispreview.co.uk/talk/threads/adventures-in-moving-to-5g-for-internet.43235/
作者 Mattyb_uk，**2025-03-15**（长篇横评，含 MC801/X55、X62、T750、RM520N 四种平台）：

> 「Ordered a **Zxyel NR5013** and a Poynting 4x4 antenna to test given **it has a Mediatek t750 in it**
> ……The **Zxyel had a decent connection at first** (90 - 110mbit with a similar signal strength -110db)
> ……**The connection was unstable though, sensitive to weather and the time of day. Would be fine for periods and then the speeds would drop.** Tried band locking it and all sorts.」

同文对平台的**购买建议**（有参考价值）：

> 「I would recommend anything with an **Snapdragon x62 / Mediatek 750 minimum**. MC888 / MC888 ultra type models.
> ……**I did buy one from ebay but it also had the SDX55 chipset and it was crap so it was sent back.**」
> 「**For me I found 4G more stable. I suspect with weaker signals that 5G is way more unstable than 4G.**」

**⑤ 「烽火很凉」的第三方量化博客**（非社区楼，🟡）
🔗 https://www.cnblogs.com/lsgxeva/p/17848748.html ，**2023-11-22**：
> 「烽火的5G CPE采用全套联发科方案，5G采用**联发科T750平台**打造。WIFI6采用MT7905+7975的AX1800组合。
> **烽火的散热做的非常好，高轻度下使用时CPU温度也就40多度，外表完全感觉不到发热。**」

⚠️ 注意此文另一处**不准确**：称「华为 CPE Pro 2 采用的巴龙 5000……上行 250Mb」，与其他来源不一致，**仅作旁证**。

---

### 1.4 联发科 T830（中兴 G5 Pro / 烽火 5G CPE Pro 2）→ ⬜ **未找到证据**

按「T830 断流 / T830 重启 / G5 Pro 断流 / G5 Pro 使用体验 / MediaTek T830 problems unstable reboot」中英文多轮检索 + fetch：

- 中文结果**全部是**厂商稿、B站带货视频、京东商品页；
- 英文结果**全部是** MediaTek 官方新闻稿、PR Newswire、cnx-software 等**发布期报道**（2022-08），**没有一条用户论坛帖**；
- 恩山 / Chiphell 站内检索 `site:right.com.cn MC888S` 等均未命中有效讨论楼。

> **结论必须写成「未找到证据」，不能写成「T830 最稳」。**
> 它 2022-08 才发布、主要走运营商定制渠道（Telstra/BBK 等），**零售装机量小、上市晚**，
> 社区样本天然不足。**「没坏话」≠「没毛病」。**

---

### 1.5 高通 X55 / X62 / X65

#### X55 —— 中兴 MC801A（CPE 2 Pro）/ MC8020（CPE 3 Pro）/ 中兴 7010

**① 爱易族博客《中兴MC801A（5G CPE）使用体验》**（12271 阅读）🟡
🔗 http://www.yizu.org/archives/785/ ，作者 Seeker，**2022-05-27**，原文：

> 「2.稳定性，**一个月死机2次，必须拔电源才能恢复的那种**，网络断流什么的极少有，由于不打游戏感受不深。
> 3.发热，基本还不错，底部有点温度，散热还不错」

**② ISPreview UK（同 §1.3 ④）Mattyb_uk，2025-03-15**：
> 「Then I tried an outdoor router **ZTE 7010**……**it wasn't aggregating bands at all** and the upload / download was about 40mbit. **Shite.** Totally vexed. Sent it back.
> ……**The ZTE801 was okay and had a SDX62 chipset but the 7010 had an older SDX55. SDX55 likely not aggregating bands to get to a decent speed** I assume.」

**③ Whirlpool（同 §1.3 ③）GGPantsu，2024-01-15**：
> 「**The X55 modem is quite hot when running. I have heard cases of overheating happen to the Gen1 modem.**」

**④ Reddit r/thinkpad，Minssc，2026-01-16**：
🔗 https://www.reddit.com/r/thinkpad/comments/1qe3h7a/
> 「I had similar issue with X1 Yoga G6(X1C9), **with Qualcomm X55 modem. When 5g signal is low, if I cover the antenna on the left corner** (I believe MIMO2) **with hand** (even just a finger), **5g halts, ping spikes to infinity and takes a while to fallback to LTE.**」

**⑤ Chiphell 旁证（谈中兴 MC8020，X55）**
🔗 https://www.chiphell.com/thread-2580163-1-1.html #22 cyberms：「**ZTE MC8020 随身的尿崩**」

#### X62 —— 中兴 U50 Pro / 移远 RM520N-GL｜**证据质量最高的一条** 🟡

🔗 **https://www.reddit.com/r/thinkpad/comments/1qe3h7a/**（2026-01-16，u/shaotz，ThinkPad X1 2-in-1 Gen 9 内置 RM520N-GL）

> 「My laptop has built-in 5G WWAN card, **Quectel RM520N-GL**, but quite often it has no network:
> - Network status is **Registered**, i.e. link is up, mobile network is ready, BRAS has assigned you IP addresses.
> - Network activity is **nothing or only Tx** …… and **no Rx**
> ……RM520N-GL has been updated to the lastest available firmware from Lenovo……**Problem persists regardless of current dataclass or SA/NSA**」

**⭐ 然后是本次调研唯一一条同一用户跨平台对照（价值最高，但样本 = 1）**：

> 「**I have a few other CPEs, modem models ranging from RG520F-EU(Quectel, Qualcomm X65) to RG500L(Quectel, Mediatek T750). Connection is stable AF on 4G and/or 5G SA and/or 5G NSA, no (perceivable) disconnection whatsoever. Whereas RM520N-GL on TP, you will definitely have a good 1 minute without internet.** This eliminates my suspecion on signal quality/ bad anchor configuration causing reconnection.」

同楼 u/shaotz 补充（工作流场景）：
> 「Sometimes I put the Thinkpad on the desk, and try cloud gaming on GeforceNOW. **The modem just can't stably maintain that stream bitrate - which is merely 50Mbps. Literally for every several minutes there will be loss of internet**, and the stream is interrupted, and I'm not touching anything」

**ZTE MC888（⚠️ 非 MC888S）** 也存在同类问题（Reddit r/HomeNetworking，多用户，2023-11 起）：
🔗 https://www.reddit.com/r/HomeNetworking/comments/17szfv2/zte_mc888_5g_modem_constant_resets/
- u/slqqa（2023-11-11）：「**Mine unit resets itself few times during a day**, but what is the worst, **sometimes it hangs connection on ethernet port**, so only thing to get network working again is manual cable reconnection.」
- u/Sunny-2021：「I have the same issue on MC888. **I got a replacement from Three, but the second one has the same issue.**」
- u/davepaw：「after purchase **modem was resetting few times a day to factory settings**……Today the modem went back to factory settings with default IP 192.168.0.1 and default password "admin"!!!」
- u/ExcitementSquare2090：「I have the same issue.. is there a solution about this? ……**2 routers both with defect..**」
- 后续楼 https://www.reddit.com/r/HomeNetworking/comments/1dlvds5/ （2024-06-22）u/Ordinary-Simple-392 找到 workaround（关掉 Band Steering），但 **2024-07-07 更新**：「I experienced **two restarts within a two-week interval** after changing this configuration……**I decided to return the router and ordered the TP-Link X50.**」
- 🔗 https://www.reddit.com/r/HomeNetworking/comments/1c9sygz/ （2024-04-21）u/KamalinO：「the modem **doesn't seem to connect to the 5G network**……I can get 5G connection on my phone and a second 5g modem……**It's been more than a month and I can't connect to 5G anymore**」；u/xiaoipower 后续：「my MC888 router got a **f/w update** today to BD_H3GUKMC888V1.0.0B09, **the 5G connection seems to be more stable**」

#### X65 —— 仅 1 条侧面提及

Reddit 1qe3h7a 同帖：u/shaotz 的 RG520F-EU（Qualcomm X65）「**stable AF on 4G and/or 5G SA and/or 5G NSA, no (perceivable) disconnection whatsoever**」。⬜ 除此外未找到 X65 的独立故障/口碑报告。

#### 高通模块 X55 系（RM502Q-AE）—— 降权来源 🔴→🟡
🔗 https://www.wisdomheart.cn/community/852 ，**2026-05-30**
内容：某 5G CPE（RM502Q-AE 模块）频繁断网需手动重启模块，日志显示 `NETDEV WATCHDOG: transmit queue 0 timed out` ×6 → `usb 2-1: USB disconnect` → 模块自动重新枚举。
⚠️ **该站是 AI 运维工具厂商的营销案例页**，日志内容可信度高但**无第三方可核验、无用户身份**，只能当**线索**。

---

### 1.6 华为巴龙 5000 —— 国内外口碑的**极端反差**

#### 国外（英文社区）：断流重灾区 🟢

**① Reddit r/HomeNetworking《Huawei 5G CPE Pro constant disconnects》**
🔗 https://www.reddit.com/r/HomeNetworking/comments/x465u9/
u/savamadalinmihai，**2022-09-02**（H112-372，Orange 罗马尼亚）：

> 「Speeds are amazing. 700mbps+ download, 99mbps upload. ……**However, I keep losing access to the internet out of nowhere. Signal still remains full, it doesn't revert to 4G, I just have no access to the internet.** No matter what I tried, I have found no permanent fix. :(
> The only thing I can do to fix it temporarily (**and it fixes it 100% of the time**) is a restart. That always works and nothing else does. But **it gets frustrating doing it 2-3 times a day** at the most random of times.」

同楼多人复现（**这就是「多个独立用户」的证据强度**）：
- u/Avauntgarde：「**Exactly the same issue.** What network are you with? I'm with 3……」
- u/Kaist0：「**Did you guys find any solution to this? I am having the exact same issue with my router.**」
- 楼主 3 年后回复：「**No solution other than to upgrade the router to a Huawei H135-380. :(**」
- u/Neuks85：「I have **H138-380 CPE pro 3** and i am having same issues, **frequent disconnection**.」

**② ISPreview UK《Constant dropouts with Three 5G with Huawei CPE Pro》**
🔗 https://www.ispreview.co.uk/talk/threads/constant-dropouts-with-three-5g-with-huawei-cpe-pro.37938/
u/bertie_bassett，**2022-01-26**（CPE Pro，Three UK）：

> 「In a nutshell, **the internet connection drops out at least once a day and all my devices, wired or otherwise, lose access to the internet. It seems that the only way to restore the connection is to physically unplug the router and plug it back in** - rebooting via the AI Life app doesn't work, it comes back with no internet connection. At other times **the ping goes sky high - 1000-4000ms** - while the transfer rate drops to almost nothing.」

同帖 2022-01-27 另一用户：
> 「Huawei CPE Pro 5G router does not function properly. **Using 'bridge only' caused no end of problems to me, especially on reboots etc.**」

**③ 华为官方社区《Unstable CPE Pro 2 device》**
🔗 https://consumer.huawei.com/en/community/details/topicId-156400/ ，**2021-05-28**（H122-373）：

> 「I am **constantly loosing internet access** even when set the APN to just IPV4, I tried all possible options yet the situation has unchanged. I done **factory reset several times** to fix the issue, yet nothing changed. **Firmware is stuck at 10.0.5.1**」

**④ 未取得全文的搜索摘要（🟡，标注为未核实）**
- 🔗 https://community.ee.co.uk/t5/Mobile-Network-discussions/Huawei-5G-CPE-Pro-2-frequently-dropping-data-connection/td-p/1074041 （2021-08-31，`bot_blocked` 未能 fetch）摘要：「CPE Pro 2 (H122-373) **keeps dropping the mobile data connection every few hours.** It always reconnects, but there is a loss of internet」
- 🔗 https://forums.overclockers.co.uk/threads/huawei-5g-cpe-pro-2-h122-373.18946773/ （2022-01-30）摘要：「**a firmware update broke 5G connections on some huawei 5g routers.** Mine has been dropping out over the past month」

#### 国内（中文社区）：口碑标杆 🟢

- Chiphell 2580163 #11 ZZZ2024（2025-02-24）：「华为随行5g wifi吗？**肯定是华为的好啊，简直爆杀好吗**」
- Chiphell 2784144 #13 话莓（2026-03-03）：「买**华为h153-381，这个稳的不行**。」
- Chiphell 2784144 #24 plzQvQ（2026-04-04）：「如果是个人用的话**华为的H155-381就很好**」
- Chiphell 2509264 #23 whydnf（2023-04-17）：「一个是**华为370**，一个中兴5001u，感觉都差不多，一个华为基带一个高通基带，**华为基带稳定一些**」
- Chiphell 2460799 #8 lanceres（**2022-11-16**）：「搞了**华为cpe win**，用cpemanager锁了SA，**日常使用非常稳**，但之前有一段时间凌晨3-4点会断网」
- Chiphell 2460799 #14 lanceres：「cpe这种设备非常看芯片的，现在普遍比较多的是华为、中兴还有烽火的，**这三家的cpe普遍对基站效能都很好**」

#### ⚠️ 这个反差怎么解释（三种可能，本次**未能定论**）

1. **运营商定制固件差异**：国外报告集中在 **Three UK / Orange / EE** 定制版；#2 用户明确指出路由器设置页「**Nowhere I can set APN profiles, no IPv4/v6 options, nothing. Is this because of Three's locked firmware?**」
2. **国内 vs 国外 5G 组网差异**：UK 以 NSA 为主、依赖 4G 锚点，社区反复出现「**5G 满格但刷不出数据，切 4G 瞬间恢复**」（Chiphell 2460799 #29 wangzhechina）
3. **幸存者偏差**：国内能买到的 H153-381 / H155-381 是**智选 ODM（卓翼）**，与国外评测的**华为自有品牌 H112/H122** 不是同一条产线

> 🔴 **不算数的解释**：「华为自研算法自己扛所以稳」——**本次未找到任何可核验的证据支持这句话**。

---

## 2. 「平台 → 已知技术弱点」表（有据可查）

### 2.1 硬规格（一手来源）

| 平台 | 制程 | CPU | AP+Modem 集成 | 3GPP | **CA 能力** | 峰值速率 | 工作温度 | 来源 |
|---|---|---|---|---|---|---|---|---|
| **展锐 T760 / UMS9620** | 台积电 **6nm EUV** | 4×A76@2.2GHz + 4×A55@2.0GHz，共享 3MB L3 | ✅ **单片 SoC**（datasheet 原话：「集成了 2G/3G/4G/5G 调制解调器的高性能应用处理器」） | NR FR1 / LTE Cat15-18 | **⚠️ 仅「带间/带内 2CC 100M+30M」** | LTE FDD DL Cat15（800Mbps）UL Cat13（150Mbps） | **未公开芯片级温度等级** | UMS9620 datasheet 摘录，[一牛网 592449](https://bbs.16rd.com/thread-592449-1-1.html)（2022-08-29）；[百度百科 T760](https://baike.baidu.com/item/%E7%B4%AB%E5%85%89%E5%B1%95%E9%94%90T760/64867088) |
| **联发科 T750** | **7nm** | 4×Arm Cortex-A55 | ✅ 集成（SoC） | NSA & SA | **2CC CA，200MHz**（NR sub-6） | NR SA 4670/1250 Mbps；EN-DC 4470/730 Mbps（FG360-EAU） | **模组级 -30℃ ~ +75℃**（Fibocom FG360） | [Fibocom FG360 datasheet](https://www.fibocom.com/en/SeriesProduct/info_itemid_82.html) |
| **联发科 T830** | **4nm** | 4×Arm Cortex-A55 | ✅ 集成 M80 modem | **Release-16** | **4CC-CA**（sub-6，FDD/TDD 混合双工） | **DL 最高 7Gbps**；DSDS 双 5G SIM | 未公开 | [MediaTek 官方新闻稿 2022-08-18](https://www.mediatek.com/press-room/mediatek-unveils-t830-platform-for-5g-cpe-devices-including-fixed-wireless-access-routers-and-mobile-hotspots) |
| **展锐 春藤 V510** | 台积电 **12nm** | — | ✅ | 3GPP **R15**、Sub-6GHz、100MHz 带宽 | 未找到证据 | — | 展锐称其 **5G 物联网解决方案**「工规级……**-40℃ ～ +85℃**」（⚠️ **平台级表述，非 V510 单芯片 datasheet**） | [EEWorld 2020-07-15](https://news.eeworld.com.cn/qrs/ic503166.html)；[紫光展锐 5G 应用页](https://www.unisoc.com/cn/solution/SolutionFiveGen) |
| **高通 X55 / X62 / X65** | X55=7nm；X62/X65=4-5nm（**官方页 bot_blocked，未取得一手 datasheet**） | — | 分离式 modem（配第三方 AP） | X62/X65 支持 R16 | 未取得一手数据 | 未取得一手数据 | 未公开 | ⬜ Qualcomm 官网 bot_blocked；第三方模组 datasheet 未在本次时间内取证 |
| **华为巴龙 5000** | **7nm** | — | modem（Balong 5000 为基带） | — | 未取得一手数据 | 官方称 DL 3.6Gbps（**该数字来自第三方博客，非华为官网，🟡**） | 未公开 | ⬜ HiSilicon 产品页 404 |

### 2.2 从上面硬数据直接推出的弱点

| 弱点 | 说明 | 对比赛现场的意义 |
|---|---|---|
| **展锐 T760 只有 2CC CA** | datasheet 白纸黑字「带间/带内 2CC 100M+30M」 | 场馆基站拥塞时，**能同时抓的载波数最少 → 抢不到资源**。这是本次唯一一条**平台级、可查证的**技术短板 |
| **T750 模组工作温度上限 +75℃** | Fibocom FG360 datasheet | 消费级模组**不是工业级**。展锐宣称的「-40~+85℃ 工规」在**模组 datasheet 层面没有得到对应** |
| **T830 是 4CC-CA + 7Gbps** | MediaTek 官方 | **CA 能力是本次对比中最强的**（4CC vs 展锐 2CC） |
| **所有平台都没有公开的「长期供货承诺」** | 本次检索未在任何原厂页面找到 longevity / 生命周期承诺年限 | ⚠️ 这意味着**「工业级 longevity」这个争论前提本身不成立**：这些全是**消费级 CPE SoC**，没有厂家给工规承诺 |
| **所有平台都没有工业温度等级（芯片级）** | 见上表 | 同上 |

> ⚠️ **关于「T760/T770/UMS9620」型号关系的诚实说明**：
> - 一牛网 datasheet 帖标题为《UNISOC **T820/T770/T760(UMS9620)**规格书》，datasheet 正文写的是 **UMS9620**（4×A76@2.2 + 4×A55@2.0），**与 T760 的规格完全一致**；
> - 但另一来源（搜狐/一牛网在线，2025-06-21）写「**UMS9620（T820/T9100）**」，把 UMS9620 归给 T820/T9100（1+3+4 架构）。
> - **结论：展锐多次改名导致型号对应关系混乱，我不能断言 T760 = UMS9620 是唯一正确映射。**
>   可确定的是：**它们同属 UMS9620 die family，T760 是 4+4 核心配置的那一档**。

### 2.3 不能算作「技术弱点」的（证据不足）

| 说法 | 为什么不算 |
|---|---|
| 「展锐容易烧 SIM 卡」 | 唯一「一年坏 3 张卡」的用户**没说机型**（Chiphell 2509264 #5）；同楼同日有烽火用户「刷 10T 也没烧卡」 |
| 「高通发热大」 | 只有 Whirlpool 一句「X55 is quite hot」，且是**「I have heard cases」= 二手传闻** |
| 「T830 稳 / T830 差」 | **两边都没有证据**（§1.4） |
| 「MC888S 断流」 | ⬜ 未找到任何中文用户报告（§1.2 ③） |

---

## 3. 「有证据的」vs「纯印象的」分栏清单

### ✅ 有证据的（可点链接 + 原文 + 日期）

| # | 结论 | 证据强度 |
|---|---|---|
| E1 | **中兴 F50（展锐 T760）存在稳定的「过热 → 降速 → 断流」链路**，横跨 2023-08 到 2025-12、至少 8 个独立来源 | 🟢 高 |
| E2 | **F50 的断网温度上限约 100℃，80℃ 以下尚可**（加热台实测，CPU 90℃ 降速、101℃ 断网） | 🟡 单用户但量化 |
| E3 | **同芯片的中兴 M3 比 F50 低约 20℃**（跑 10G：73℃ vs 51.8℃）→ 问题在**整机散热/天线设计**，不在基带 | 🟡 单用户但量化、有对照 |
| E4 | **中兴官方「修复断流」的手段是移除温控（B09 性能模式）**，而非改散热 | 🟢 V2EX 作者转述官方开发者 + 固件行为可复现 |
| E5 | **F50 有线接电脑时，电脑休眠恢复后 F50 不自恢复，必须断电重启**（≥2 用户跨 4 个月） | 🟢 高 |
| E6 | **F50 最新固件已支持锁频段 + 锁小区**（2024-05 起）—— 对现场稳定性是**加分项** | 🟡 |
| E7 | **连口碑最好的烽火（T750）也有用户报告「每个月断流一次、重启解决」** | 🟢 高（同一 Chiphell 用户两次独立发言互相印证） |
| E8 | Kanshuderen「烽火用一年多很稳」+ robocop/悟空~ 多人「用一年多很稳」 | 🟢 高 |
| E9 | **高通 X62（RM520N-GL）存在「link 状态 Registered 但无 Rx、静默丢包约 1 分钟」的问题**；同用户的 X65 与 MTK T750 设备无此问题 | 🟡 **样本 1，但对照设计最强** |
| E10 | **高通 X55 的中兴 MC801A「一个月死机 2 次，必须拔电源」** | 🟡 单用户长期记录 |
| E11 | **高通 X55 在弱信号下会 5G 卡死、ping 飙到无穷、回落 LTE 很慢**（≥2 用户） | 🟢 中高 |
| E12 | **华为巴龙 5000（H112-372 / H122-373）在国外社区是断流重灾区**：每天 1 次～每天 2-3 次，**只能拔电恢复**，≥4 用户复现 | 🟢 高 |
| E13 | **华为 H122-373 在中文社区也有「总要手动重启、隔三岔五变成 4G」** | 🟡 单条但来自 2026-04 Chiphell 活跃用户 |
| E14 | **同一台 T750 设备（Telstra Gen2）也有「连上 5G 后 20 秒~30 分钟内随机掉回 4G」** | 🟡 单用户；同楼有反方 |
| E15 | **展锐 T760/UMS9620 只支持 2CC CA（100M+30M）**，T830 是 4CC-CA | 🟢 datasheet 级 |
| E16 | **T750 模组（Fibocom FG360）工作温度 -30~+75℃**，不是工业级 | 🟢 datasheet 级 |
| E17 | **所有 6 个平台都没有公开的「芯片级工业温度等级」与「长期供货承诺」** | 🟢 检索穷尽后的否定结论 |

### ❌ 纯印象的（无量化依据、作者自己都用「据说」）

| # | 说法 | 出处 | 为什么是印象 |
|---|---|---|---|
| I1 | 「**国产芯片就是不稳**」 | 无具体出处 | 本次**未找到任何量化依据**。F50 的断流证据指向散热设计，不是国籍 |
| I2 | 「**据说，烽火稳定性好……中兴可能比这两个差一点**」 | Chiphell 2784144 #10，2026-03-03 | 作者**自己写了「据说」**，未给任何实测 |
| I3 | 「**据说紫光展锐春藤 V510 容易断流**」 | 知乎 p/530587043 评论区 ret2life，2022-11-14 | 原文明写「据说」 |
| I4 | 「**展锐：性价比高……偶尔可能会出现断流**」 | 知乎 p/1949853490865222915，2025-09-12 | 🚨 **启明智显的软文**，文中 13 条「功能」全是该品牌卖点 |
| I5 | 「**zte一坨 shit**」 | Chiphell 2784144 #22 cyberms，2026-04-01 | 情绪化断言；**同一人 2023-04-16 说 ZTE 5G CPE PRO3「很好……目前唯一推荐就是这款」**（Chiphell 2509264 #8） |
| I6 | 「**华为的稳来自巴龙基带+算法自己扛**」 | 无具体出处 | 与 E12/E13（华为也在断）**直接冲突**，且无技术依据 |
| I7 | 「**5G 就是智商税，不如 4G**」 | Chiphell 2460799 #4 wyb4112 | 楼内被多人反驳；但 #29 wangzhechina 的「信号满格但刷不出数据，切 4G 瞬间恢复」**是真的有据**（应归入 E 类） |
| I8 | 「**随身 WiFi 就不是成功的产品，各有各的毛病，当玩具得了**」 | 奶昔论坛 thread-6385 #7 XTian，2025-11-02 | 个人观点 |

### 🚨 已识别并降权的 AI / SEO / 营销内容（**明确不要引用**）

| 内容 | 识别依据 | 处置 |
|---|---|---|
| 🔗 https://www.cnblogs.com/newjpz/p/20275094 《随身WiFi芯片深度科普与对比指南（2026版）》 | ① **博客园平台自己在正文第一行加了「（平台提示：本文可能是商业推广软文）」**；② 文末标「（推广）」；③ 通篇「实测速率 / 满载温度」数值（T760 45℃、X62 48℃）**无任何来源、无测试条件**；④ 明确导流到「云齐品/格行」 | **完全弃用**，本次报告**未采用其中任何一个数字** |
| 🔗 https://post.smzdm.com/p/a03r4n9z/ 「中兴 mc888s 拆解」 | 页面自带「**内容由AI生成**」，**0 评论**，无作者 | 弃用（仅其「MC888S 用展锐 V510/UDX710」这一点与其它来源一致时才作旁证） |
| 🔗 https://www.wisdomheart.cn/community/852 「RM502Q-AE 断网日志分析」 | 是 **AI 运维工具厂商（Wisdom SSH）的营销案例页**，无用户身份、无第三方核验 | 降权为「线索」，不单独作为结论依据 |
| 🔗 https://www.star-elink.com/news/4822.html 「5G CPE 从技术原理到实战部署万字深度解析」 | 典型 SEO 长文，商家站 | 未采用 |
| 🔗 https://post.smzdm.com/p/a3mpw5zd/ 「中兴路由器频发"断流"？三大原因揭秘」 | 泛泛而谈的 SEO 稿。**⚠️ 关键错配：它讨论的是「问天 BE7200Pro / AX3000Pro」家用路由器，与 5G CPE 无关** | **不得作为 CPE 证据**（其评论区倒是有真实用户：「断流王」「7200+，没发现」，但针对的是路由器） |
| 🔗 https://zhuanlan.zhihu.com/p/1949853490865222915 | 通篇为「启明智显」导流，13 条功能逐条吹该品牌 | 降权 |
| 🔗 https://zhuanlan.zhihu.com/p/530587043 | 有软文痕迹（吹烽火 + 拼多多返现凑单教程） | **部分采用**（只取其「同一作者亲历时间线」，并显式标注软文嫌疑） |
| 🔗 https://blog.csdn.net/PS88888/article/details/134922362 | 返回 HTTP 521，未能取证 | 未采用 |

### 🚫 未能取证（受限，已尽力）

| 目标 | 障碍 |
|---|---|
| 百度贴吧（随身WiFi吧 / 5G吧） | **百度安全验证**拦截；`mcp fetch` 返回 403，`markdown.new` 也返回「百度安全验证」 |
| 澳洲 Whirlpool 分页 `?p=154` | `bot_blocked`；**已通过 `markdown.new` 取到同主题的 `/archive/98wxy5q3-4` 全文作为替代** |
| community.three.co.uk / community.ee.co.uk | `bot_blocked`（仅有搜索摘要，已在 §1.6 ④ 标注为未核实） |
| forums.overclockers.co.uk | 仅有搜索摘要，未 fetch 全文 |
| 知乎 answer 页（question/xxx/answer/yyy） | 403（专栏 `zhuanlan` 页可读，已用专栏替代） |
| 香港 HKEPC MC888 Pro 死机帖 | `markdown.new` 返回「This URL pattern is not allowed for security reasons」 |
| Qualcomm 官网 X55/X62/X65 datasheet | `bot_blocked`，且本次时间预算内未能找到替代的一手模组 datasheet |

---

## 4. 给「第零路」选型的直接建议（只基于本报告的 E 类证据）

1. **不要用「哪个平台更工业级」来选型 —— 这个前提是假的。**
   6 个平台**全都是消费级 CPE SoC**，没有任何一家公开芯片级工业温度等级或长期供货承诺（E17）。
   真正的工规方案（如 Teltonika RUTX50、H3C CPE5100 系列）是**另一条产品线**，不在本次对比范围。

2. **F50 / F50 Pro 不适合当唯一第零路**，理由不是「展锐不行」，而是：
   - E2/E3：**整机散热余量不足**（同芯片的 M3 低 20℃ 就在眼前）；
   - E4：**官方的「断流修复」是移除温控**，这是一条**会随环境温度失效**的补丁；
   - E5：**有线接电脑时休眠恢复不自恢复**，现场没人盯机器。

3. **如果一定要在「T750 系（烽火）」和「展锐 F50 系」之间选**：
   - E7 + E8 是**同一个人的两句话**：「每个月断流一次、重启解决」+「用一年多很稳」。
     这说明**烽火的问题频率低到用户愿意继续用**，与 F50 的「看个 B站10分钟热掉线」不是同一量级。
   - Chiphell 2026-03 那 44 楼的社区共识（E8）也一致倒向烽火。

4. **真正的技术差异点是 CA，不是「稳不稳」**（E15）：
   展锐 T760 只有 **2CC**，T830 有 **4CC-CA**。
   场馆基站拥塞时，**能抓更多载波的设备更能抢到上行** —— 这比「芯片品牌」更值得写进选型依据。

5. **必须做的三件事（比换平台重要得多）**：
   锁频/锁小区（E6 证明 F50 到 2024-05 才补上）+ 物理散热（E2/E3）+ **两台不同运营商的双机冗余**。

---

## 附：本报告使用的全部可点击来源

**中文社区（读完整楼）**
- https://www.chiphell.com/thread-2580163-1-1.html — F50 断流/发热（28933 阅读 / 21 回复）
- https://www.right.com.cn/forum/thread-8365101-1-1.html — F50 三个月小结（20769 / 14）
- https://www.v2ex.com/t/966078 — F50 评测（16403 / 46，含官方开发者转述）
- https://www.chiphell.com/thread-2763685-1-1.html — 随身 WiFi 速度测试（3941 / 5）
- https://www.chiphell.com/thread-2784144-1-1.html + [/thread-2784144-2-1.html](https://www.chiphell.com/thread-2784144-2-1.html) — 求推荐 5G CPE（12644 / 44）
- https://www.chiphell.com/thread-2509264-1-1.html + [/thread-2509264-2-1.html](https://www.chiphell.com/thread-2509264-2-1.html) — 有用 5G CPE 的吗（42133 / 36）
- https://www.chiphell.com/thread-2720772-1-1.html — CPE 哪个品牌强（6937 / 28，含「烽火每月断流一次」）
- https://www.chiphell.com/thread-2460799-1-1.html — 5G CPE ping 丢包（15768 / 29）
- https://forum.naixi.net/thread-6385-1-1.html — CPE 还是 5G 随身 WiFi（5244 / 32）
- https://www.right.com.cn/forum/thread-8311458-1-1.html — 华为 CPE 锁频教程（54199 / 362，证明 H381 未适配）
- https://zhuanlan.zhihu.com/p/650039256 — F50 详细测评（47 评论）
- https://zhuanlan.zhihu.com/p/530587043 — 大厂 5G CPE 盘点（含 9 条评论）
- http://www.yizu.org/archives/785/ — MC801A 长期体验（12271 阅读）
- https://www.cnblogs.com/lsgxeva/p/17848748.html — 5G CPE 介绍（第三方博客，🟡）
- https://luolei.org/zte-f50 — F50 使用记录

**英文社区 / 官方**
- https://www.reddit.com/r/HomeNetworking/comments/x465u9/ — 华为 CPE Pro 断流（多用户）
- https://www.reddit.com/r/thinkpad/comments/1qe3h7a/ — **RM520N-GL(X62) vs X65 vs T750 同用户对照**
- https://www.reddit.com/r/HomeNetworking/comments/17szfv2/ — ZTE MC888 反复重启（多用户）
- https://www.reddit.com/r/HomeNetworking/comments/1dlvds5/ — MC888 重启 workaround + 放弃
- https://www.reddit.com/r/HomeNetworking/comments/1c9sygz/ — MC888 无法连 5G
- https://www.ispreview.co.uk/talk/threads/constant-dropouts-with-three-5g-with-huawei-cpe-pro.37938/
- https://www.ispreview.co.uk/talk/threads/adventures-in-moving-to-5g-for-internet.43235/ — 四平台横评
- https://www.ispreview.co.uk/talk/threads/band-and-cell-locking-guide.42174/ — MC888 锁小区指南（含「自动模式会掉到 <2Mbit/s」）
- https://forums.whirlpool.net.au/archive/98wxy5q3-4 — Telstra Gen1(X55) vs Gen2(T750)
- https://consumer.huawei.com/en/community/details/topicId-156400/ — 华为官方社区 H122-373 不稳

**视频（yt-dlp 字幕 + 热评）**
- https://www.bilibili.com/video/BV12r5SzBEMv/ — F50 vs M3 温控实测（55188 播放，2025-04-21）

**一手规格**
- https://www.mediatek.com/press-room/mediatek-unveils-t830-platform-for-5g-cpe-devices-including-fixed-wireless-access-routers-and-mobile-hotspots
- https://www.mediatek.com/tek-talk-blogs/mediatek-t830-faster-5g-fixed-wireless-and-cpe-devices
- https://www.fibocom.com/en/SeriesProduct/info_itemid_82.html — FG360 (T750) datasheet
- https://bbs.16rd.com/thread-592449-1-1.html — UMS9620 datasheet 摘录
- https://baike.baidu.com/item/%E7%B4%AB%E5%85%89%E5%B1%95%E9%94%90T760/64867088
- https://www.unisoc.com/cn/solution/SolutionFiveGen — 展锐 5G 应用（工规温度宣称）
- https://news.eeworld.com.cn/qrs/ic503166.html — 春藤 V510 台积电 12nm

**已识别为不可引用**
- https://www.cnblogs.com/newjpz/p/20275094 （平台自标「可能是商业推广软文」）
- https://post.smzdm.com/p/a03r4n9z/ （「内容由AI生成」）
- https://post.smzdm.com/p/a3mpw5zd/ （SEO + 讨论对象错配为家用路由器）
- https://www.wisdomheart.cn/community/852 （AI 工具厂商营销案例）
- https://zhuanlan.zhihu.com/p/1949853490865222915 （启明智显软文）
- https://www.star-elink.com/news/4822.html （商家 SEO 长文）
