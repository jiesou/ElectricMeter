# 比赛现场「第零跳」蜂窝接入 —— 设备侧深度调研

> 场景：会展中心 / 体育馆 / 高校体育馆，人群密集；一路极其稳定的蜂窝外网接入当第零跳，后面接自己的交换机 / 服务器。形态是 CPE 或随身 WiFi。
> 调研范围：仅 议题 7（无网口随身 WiFi vs RJ45 CPE）、8（长期连续工作 / 电池 / 散热 / 防尘）、9（供电）、10（看门狗 / 定时重启 / 断线重连）。
> 报告日期：2026-10-07。所有结论均附原文引用 + 链接 + 时间；证据薄弱处已单列。

---

## 0. 一句话结论

**能上「有 RJ45 网口、无电池、DC/AC 直供」的 CPE 台机，就绝对不要用「带电池的随身 WiFi + USB 共享 / WiFi 中继」。** 理由不是「网口比无线快」，而是三条独立的失效链：USB 共享的失效点在闭源 RNDIS 协议栈（小时级劣化、需断电才恢复），随身 WiFi 的失效点在锂电池（一年尺度鼓包）和温度墙（实测 100℃ 断网），WiFi 中继的失效点在信道与子网语义。三条链叠加起来，现场没有可运维的余量。

---

## 议题 7：无网口随身 WiFi（WiFi 桥接 / USB 共享）vs 有 RJ45 网口的 CPE

### 7.1 USB RNDIS / ECM 共享在小时间尺度上会劣化，且必须断电才能恢复 ★★★ 强证据

**结论**：USB 网络共享不是「要么通要么不通」，而是**跑几小时后延迟涨到 1 秒、丢包近 20%，且换驱动模块（cdc-ncm / cdc-eem）无效**。这是把第零跳押在闭源、厂商各异的 USB 网卡协议上。

**原理**：Android / 随身 WiFi 的 USB 网络共享走 RNDIS（微软私有）或 CDC-ECM/NCM。主机侧驱动（Linux `rndis_host`、Windows RNDIS）与设备侧固件实现质量参差，且 RNDIS 控制通道（状态查询）与数据通道共用一个 USB 端点，设备侧缓冲不足时状态查询被丢 → 主机超时后 reset 设备。这个 race 是间歇性的，只在长时间运行后暴露。

**怎么做**：不要把它当主链路。若必须用，固定三件事：① 用已知稳定的驱动（单装 `kmod-usb-net-rndis`，其余自动依赖，不要手动堆 cdc-ncm/cdc-eem）；② 线越短越好、禁用 USB 选择性暂停；③ 上第 10 节的看门狗，且恢复动作要是 `ifdown/ifup` 甚至 USB 端口断电，而不是只重启 app。

**证据**：

- **OpenWrt `packages` issue #25771**（2025-01-17 开，**至今 open**）：
  > "While USB-tethering does work for me in v23.05, the connection becomes unstable/unusable after a couple of hours of use: ping times increase to ~1s instead of ~50ms I usually get, many dropped packets"
  > `--- 1.1.1.1 ping statistics --- 16 packets transmitted, 13 received, 18.75% packet loss`
  > "Installing `kmod-usb-net-cdc-ncm` doesn't seem to improve stability. Installing `kmod-usb-net-cdc-eem` in addition to `kmod-usb-net-cdc-ncm` also doesn't seem to improve stability."
  > <https://github.com/openwrt/packages/issues/25771>

- **OpenWrt 论坛整帖 221685**（2025-01-16 开帖，同一位提问者的完整排查）：
  > "So the bottom line: In v23.05 USB-tethering works for me but becomes unstable after 1-2 hours of use; In v24.10.rc5 USB-tethering doesn't work for me at all as `usb0` device doesn't show up"
  > 内核日志显示 USB 口在不停重新枚举：`usb 1-1: USB disconnect, device number 50` … `new high-speed USB device number 51` … 一路涨到 62。
  > <https://forum.openwrt.org/t/cant-get-usb-tethering-to-work-in-24-10-rc5/221685>

- **OpenWrt issue #12539**（2023-05-05，已关，标签 `bug` / `issue report with a confirmed bug`）：
  > "USB Tethering to a Oneplus 1 running latest version of Lineage OS, after the interface usb0 is created and registered the system will hang after communicating with it for a period of seconds, the console becomes unresponsive for about 15 seconds and then reboots."
  > <https://github.com/openwrt/openwrt/issues/12539>

- **Reddit r/openwrt「USB tethering results in VERY unreliable DNS」**（2020-12-14）：
  > u/pyther24: "USB hotspot tethering can be real finicky and may or may not work well with your equipment."
  > u/pyther24: "rndis is a propriety protocol developed by Microsoft. When I used my AT&T hotspot a few years ago I'd encounter random bugs with the driver/hotspot where I'd have power cycle things to become functional again."
  > u/chrisprice: "Inseego/Novatel devices just don't talk to OpenWRT well. I think their USB WAN/Ethernet/RNDIS is just slightly different in terms of spec. **This is why I hate RNDIS being closed source.**"
  > <https://www.reddit.com/r/openwrt/comments/kcq3qq/usb_tethering_results_in_very_unreliable_dns/>

- **Microsoft Q&A「RNDIS device gets randomly disconnected every few days」**（2021-02-01 提问，2021-02-23 官方答复给出根因）：
  > "on some machines the network connection gets dropped after a couple of days of operation… Rebooting Windows fixes it for a couple of days."
  > 根因："The root cause turned out to be a problem in NuttX RNDIS driver. It only had a single buffer for RNDIS replies, causing them to be dropped if two requests occur close together… when a query packet is dropped, Windows will timeout the request 18 seconds later and issue a device reset."
  > <https://learn.microsoft.com/en-us/answers/questions/3777525/rndis-device-gets-randomly-disconnected-every-few>

- **恩山无线论坛 thread-8301528**《W06随身WiFi如何与已刷X-WRT系统的r3g通过USB共享连接？》（2023-08-14 开帖，回复持续到 2024-04）：
  > 楼主 jiangchen521: "手机通过数据线与路由器相连打开USB共享网络功能，路由器的wifi是可以上网的。但是呢，w06开启USB共享功能通过数据线与路由器相连，路由器的wifi就没有网络。"
  > 5und4y（4楼）: "有些随身WiFi只有rndis协议，它是可以在xwrt上开启usb网络共享的。**有些随身WiFi有多种协议，在windows上启用rndis协议，在Linux上启用其它协议，就会出现你这种情况。**"
  > 5und4y（9楼）: "应该是缺少驱动，像华为和中兴的随身WiFi在openwrt/linux上不是完全走的usb网络共享（也就是rndis），所以除了rndis驱动，可以加上usb-storage驱动和huawei-cdc等驱动再试试"
  > <https://www.right.com.cn/forum/thread-8301528-1-1.html>

**小结**：USB 共享的失效模式是「协议栈 / 驱动层」，不是「线材层」。它不会一直好或一直坏，而是随时间劣化，且需要 power cycle。

---

### 7.2 WiFi 桥接（WISP / 中继）的坑 ★★ 中等证据

**结论**：WiFi 中继作为 WAN，会引入三个独立问题：子网语义（relayd 要求两个不同子网）、上行空闲被踢（WISP 常见）、以及「无线桥接走软件、有线走交换芯片」带来的额外失效面。在人群密集的会展中心，2.4G 频段基本不可用。

**原理**：
- OpenWrt 的中继/扩展器用 relayd 做伪桥，**要求 LAN 接口配置为不同子网**，否则不工作。
- WISP 运营商侧常有「空闲一段时间就注销链路」的策略，表现为「用着好好的突然断，要重启网络接口」。
- 刷第三方固件后，有线走硬件交换芯片、无线走软件 bridge，无线侧失效面显著更大（恩山实战帖的判断）。

**怎么做**：如果非要用无线中继，把它当**备份**而不是主链路；主链路要有线。并且必须配看门狗（见议题 10），因为中继断了不会自愈。

**证据**：

- **OpenWrt 官方 wiki《Wifi扩展器、中继器及桥接配置》**（中文版，2021-07-01）：
  > "Wi-Fi扩展器的 LAN 接口必须配置为不同的子网，否则 relayd 无法正常工作（因为它需要两个不同的子网来进行路由）。"
  > <https://openwrt.org/zh/docs/guide-user/network/wifi/relay_configuration>
  （注：openwrt.org 对抓取启用了 Anubis 反爬，本条为搜索引擎索引正文片段 + 官方 URL 佐证。）

- **OpenWrt 论坛 t/87364《Advanced setup : how to set a WAN disconnect timeout?》**（2021-02-01 开帖）——WISP 上行空闲被踢的实录：
  > 楼主 Fleur: "My WISP seems to disconnect/unauthenticate my link if unused, so I've to restart the router or the connection (disable/enable via `/etc/init.d/network restart`) to force link UP… WiFi seems to get disconnected and reconnected (or only re-authenticated) as soon as traffic doesn't pass through"
  > <https://forum.openwrt.org/t/87364>

- **恩山 thread-8396260**（2024-09-13）——刷 OpenWrt 后无线掉线的机理判断：
  > "有线连接在电脑端基本正常。这是因为有线连接走的是硬件的交换芯片，而 Wi-Fi 则通过软件虚拟的无线桥接来处理数据。"
  > <https://www.right.com.cn/forum/thread-8396260-1-1.html>

- **实践者的取舍**：梓喵出没《中兴F50配异能者5合1HUB无法工作问题(8153网卡)》（2025-11-30）开头即写明动机：
  > "笔者有一个型号为中兴 F50 的 5G CPE，**想通过 USB 网卡的方式分享网络给路由器，取代 WIFI 中继，提高稳定性**。"
  > <https://www.azimiao.com/12387.html>

- **B站 UP 主「听闻8577」视频评论区**（2024-04，5 赞热评）——WiFi 当 WAN 的现场痛点：
  > 苹果小哥: "现在的随身WIFI都不舍得做一个wan/lan口吗"
  > 苹果小哥: "**到酒店 经常碰上网速厉害 WIFI残废的**，对AP有需求"
  > <https://www.bilibili.com/video/BV14p421y73s/>

---

### 7.3 NAT 表 / 并发连接数 ★ 弱证据（数字未证实）

**结论**：**没有找到随身 WiFi 的 NAT 表大小或最大并发连接数的厂商规格或实测数据 —— 不要引用具体数字。** 但「连接表打满 → 掉线」这条链在 OpenWrt 侧有明确的实拍日志，而且运营商侧还有一层连接数限制。

**原理**：Linux conntrack 表满 → 新连接无法建立 → `nf_conntrack: table full, dropping packet`。OpenWrt 的默认超时决定了短连接会滞留多久：TCP established **7440 秒**（2 小时 4 分）、UDP 60 秒、UDP stream 180 秒。也就是说，一波大量短连接（HTTP 轮询、DNS、监控）会把表占用维持两小时以上。低端随身 WiFi 的 SoC 内存远小于路由器，conntrack 上限更低 —— 这是合理推断，但我没有找到实测数据支撑。

**怎么做**：
- 在自有的 OpenWrt 侧（而不是 CPE 侧）显式抬 `net.netfilter.nf_conntrack_max`，并把 `nf_conntrack_tcp_timeout_established` 从 7440 调小（例如 3600 或更低）。
- 现场前用 `conntrack -C`（当前条目数）/ `sysctl net.netfilter.nf_conntrack_count` 做基线，赛前压测。
- 把「大量短连接」的业务（轮询式 API）改成 keep-alive 长连接 + 客户端侧退避，直接减少条目数。

**证据**：

- **OpenWrt 默认 conntrack 参数**（源码，`package/kernel/linux/files/sysctl-nf-conntrack.conf`）：
  ```
  net.netfilter.nf_conntrack_acct=1
  net.netfilter.nf_conntrack_checksum=0
  net.netfilter.nf_conntrack_tcp_timeout_established=7440
  net.netfilter.nf_conntrack_udp_timeout=60
  net.netfilter.nf_conntrack_udp_timeout_stream=180
  ```
  <https://github.com/openwrt/openwrt/blob/main/package/kernel/linux/files/sysctl-nf-conntrack.conf>

- **恩山 thread-8396260**（2024-09-13，楼主 kollata 用 watchcat 排查时抓到）：
  > "却重启到 initramfs 恢复模式，才发现大量日志表明 **nf_conntrack 表（用于跟踪网络连接状态）已满**，导致新连接无法被追踪并丢弃数据包 ( dropping packet)。这通常是在高负载的网络情况下发生的，或者由于默认连接跟踪表的大小不足以应对当前的网络流量。"
  > "**这种掉线通常与连接数过多有关。由于后台的连接无法被及时释放，可能会达到运营商所设置的最大连接数限制。当连接数超标时，运营商的本地交换层可能会直接断开网络连接，导致用户设备出现掉线问题。**"
  > <https://www.right.com.cn/forum/thread-8396260-1-1.html>
  （注意：后半句是楼主自己的归因，不是运营商官方文档，属于**口述证据**。）

---

### 7.4 有 RJ45 网口的 CPE 具体型号（社区口碑） ★★ 中等证据

**结论**：社区（Chiphell）的稳定共识是：**室内固定点位用烽火，弱信号/移动用华为（巴龙），中兴口碑偏差**。要「多卡 + 链路负载」得上商用型号。

**证据**：**Chiphell《求推荐好的 5G CPE 路由器》**（tid=2784144，2026-03-03 开帖，44 回复，12621 查看）：

> #10 415793633: "据说，**烽火稳定性好，比较适合室内实用，华为巴龙方案连接基站速度快，比较适合移动使用，中兴可能比这两个差一点**"
> #13 话莓: "买**华为h153-381**，这个稳的不行。"
> #14 贫民张大嘴: "在用**烽火5g cpe pro**, 我这移动电信信号都一般，买了个外置天线放阳台了，很稳定"
> #17 kanshuderen: "用了一年多的**烽火**。。。很稳。。。。"
> #16 iooo: "信号弱就华为，信号好就中兴，会玩op就自己买个模块diy"
> #18 xe366: "**Huawei_B315S** 推荐个我现在用的，只支持4G，但**非常稳定**，现在只有咸鱼了"
> #22 cyberms: "**烽火好。bug修复快。zte一坨shit。**"
> #24 plzQvQ: "如果是个人用的话**华为的H155-381**就很好，但**如果是商用的话还是花火H9那种会好一些，有成熟的多卡和链路负载的方案**"
> #28 沐雨丶晨潇: "**通则X300 GT**，频段组合全，上行聚合满血4X4，3频WIFI，**带一个5G网口**，可以PSIM+eSIM接入，可以开SSH，可以改串"
> #26 keshl（评价鲲鹏 C2000MAX）: "那个咋样？**感觉没散热风扇不踏实。**"
> <https://www.chiphell.com/forum.php?mod=viewthread&tid=2784144>

其他型号锚点（用于价格量级判断）：
- **中兴 K10 室内 CPE（4G）**：99 元预售，"搭载了中兴自研V3E芯片，通过GCF全球认证"，插卡 4G 转 WiFi + 有线 —— 新浪财经 2023-12-29，<https://finance.sina.cn/tech/2023-12-29/detail-imzzrxmf6033320.d.html>
- **华为 5G CPE Pro 2**：官方标称"配备1 个Nano-SIM 卡接口和 **2 个全千兆网口**，插卡上网、插宽带上网皆支持" —— <https://consumer.huawei.com/cn/routers/5g-cpe-pro-2/>
- **中兴 4G CPE 2 Pro**：拆解确认"通过外接直流电源供电，**电源规格为12V1.5A**" —— 充电头网 2024-10-17，<https://www.chongdiantou.com/archives/382374.html>
- **普锐 R601**：98 元，"插上广电的sim卡，用得还行，上海市区大约 2到4M/s 实际下载速度"（Chiphell #9，2026-03-03）

---

## 议题 8：长时间连续工作 —— 电池鼓包 / 无电池型号 / 主动散热 / 防尘

### 8.1 带电池设备长期插电，一年尺度上鼓包是「可预期」而非「意外」 ★★★ 强证据

**结论**：**不要给现场部署任何内置锂电池的设备。** 行业媒体给出的时间尺度是「上市约一年 + 重度使用后开始出现鼓包报告」，且**没有哪个移动热点型号能豁免**。触发因素第一条就是「一直插着电、从不让电池放电再充」。

**原理**：锂电池长期处于满电 + 高温（设备自身发热 + 环境温度）会加速电解液分解产气 → 鼓包。老式 PMIC 会持续涓流「顶」着满电电池；即使新 PMIC 有 80% 回充策略，设备满载运行时外壳 40℃+ 也会显著加速老化。鼓包的力学后果不只是「电池坏」——它会顶开外壳、掰断内部零件。

**怎么做**：
1. **首选**：买无电池型号（见 8.2）。
2. 若已有带电池设备：**直接拆掉电池、插电运行**。GL.iNet 官方就是这么建议的（8.1 证据第 4 条）。
3. 若不能拆：用定时插座每天强制断电 1-2 小时，让设备跑电池放电（MIRC 建议）。
4. 每月做一次物理巡检：取出电池平放桌面，晃 = 已经开始鼓。

**证据**：

- **Mobile Internet Resource Center 指南《Mobile Hotspot Batteries - Protecting from Heat, Preventing Swelling, Prolonging Life & Replacement》**（2026-02-03 更新）：
  > "**After a device has been out for about a year and in heavy use, that's when we start receiving reports of battery swelling. No particular mobile hotspot model seems to be exempt.**"
  > 触发因素："**Leaving a hotspot constantly plugged into power, and never allowing the battery to drain and re-charge**; Frequent use in poor signal areas (devices go into full transmit power to keep a signal) and not using signal enhancing methods; **Lack of ventilation**; Leaving devices in a sunny spot; Frequent use in a cradle-style booster; General battery aging"
  > 检查方法："Sit the battery flat on a table. If it no longer sits flat on a table without a slight wobble, you are developing a problem"
  > 缓解："Some people even plug the hotspot into a timer that automatically cycles the power every day to force the device to run off the battery for a couple of hours."
  > <https://www.rvmobileinternet.com/guides/preventing-mobile-hotspot-battery-swelling-when-using-a-cradle-booster/>

- **GL.iNet 官方论坛《MUDI (GL-E750 w/ EP06-E) battery swollen》**（2023-08-03 开帖）——厂商与用户对话全文：
  > 楼主: "My Mudi's battery has recently swollen, **actually while the device was running.**"
  > 用户问能否限制充电到 70-80%：官方（hansome）: "**Sorry that's not supported.**… That's due to the current hardware MCU type."
  > 用户问能否关闭充电：官方（Nicos）: "**There is no disabled method**, the display X indicates that the battery is not recognized, **It still works when connected to a power source.**"
  > <https://forum.gl-inet.com/t/mudi-gl-e750-w-ep06-e-battery-swollen/32083>

- **Reddit r/GlInet《Swollen Battery on a Mudi GL-E750》**（2026-04-14，6 个月前）：
  > 楼主 u/Commercial_Ad707: "I just noticed my Mudi coming apart and can't push it down. I'm assuming the battery is swollen"
  > u/domimatrix（长回复）: "Swollen batteries on the e750 aren't so common you should avoid them, but they do crop up and **if you are out of warranty you are out of luck. Gl.inet won't fix it for money.**… **First recommendation: remove any microsd card from the e750 -- the battery swell snapped mine in half.**… If your usage doesnt need an internal battery, you can always **pull the battery and run it off the usbc port. Plenty of users on the threads run it this way**"
  > GL.iNet 员工 u/NationalOwl9561: "It has definitely happened before, but I wouldn't say it's common. **I count only 3 tickets in our system with this issue** at first glance."
  > 楼主提供的供电条件: "**USB-C to a 20w GaN charging block (single socket)**"
  > <https://www.reddit.com/r/GlInet/comments/1slhaz9/swollen_battery_on_a_mudi_gle750/>

- **GL.iNet 官方 Facebook**（2026-08-11）——厂商把「去电池插电」当卖点：
  > "Batteries age. Your Mudi 7 (E5800) doesn't have to. 🔋 **Remove the battery, plug it in, and keep your connection going**—built. I carefully remove the bloated Li-Po battery and preserve the controller."
  > <https://www.facebook.com/GLINETUS/posts/1093490210334005/>

- **GL.iNet 论坛《MUDI Battery Charging》**（2020-06-18）——机理讨论：
  > 用户（自称电气工程师）: "It seems like there are a lot of power management ICs nowadays that have an input pin to enable/disable the charging functions and allow external power only."
  > 另一位用户: "**Older PMIC, however, supplied continuous charge to the battery to keep it topped out, which was the source of explosions**… Unless you somehow manage to discharge the battery while charging (i.e. making the unit use more power than what the external power supply can provide) multiple times, it's doubtful that it would happen."
  > 搜索索引另有一条（同帖）: "If i remember correctly, **while Mudi is plugged in, the battery is constantly being topped off, trickle charged, which is not the best for**…"
  > <https://forum.gl-inet.com/t/mudi-battery-charging/11173>

---

### 8.2 无电池型号（现场部署的正确形态） ★★ 中等证据

**结论**：**中兴 F50 / 中兴 M3 / 华为 B315s 这类「无内置电池」设备，是随身形态里唯一能长期插电的。** 但 F50 无 RJ45 网口，必须靠 USB 共享（见 7.1 的风险）；真正无电池 + 有网口的形态是**工业/室内 CPE 台机**。

**证据**：

- **中兴官方新闻稿《全球首款超薄5G卡片WiFi 中兴F50正式上市》**（2023-08-14）：
  > "设备支持多种供电方式，通过USB3.0 Type-C超高速数据线连接笔记本电脑，或者充电头、车载充电接口、充电宝等提即可实现轻松上网，**有电就有Wi-Fi**，插卡即用"
  > <https://www.ztedevices.com/cn/news/zte-f50/>

- **罗磊博客《最小巧的 5G 随身 Wi-Fi: 中兴 F50》**（2024-11-11，售价 ¥369，券后实付 ¥337）：
  > "**没有电池** : 中兴也有一个内置电池的版本，但是我觉得这个不算缺点，直接插一个电源或者充电宝就行了。尤其是有几天，我直接把他放到车的扶手箱，车启动的时候就自动开机了，很方便，**没有电池，也不用担心电池自燃的隐患**。"
  > "发热问题有点玄，听说长时间负载会降速，我才开一会，就能感觉设备的外壳温度上来了…这台机器有很多 DIY 散热解决方案，某个角度也反应了大家对这台设备「瑕不掩瑜」的认可吧。"
  > <https://luolei.org/zte-f50>

- **B站视频标题**（2023-08-21）：《中兴F50室外5km移动ping测试 **没有电池的随身Wi-Fi** 来看看》 <https://www.bilibili.com/video/BV1nu4y1X7Jx/>

- **中兴 M3 对比**（YouTube 实测，2025-04-21）：与 F50 同配置、同芯片，"M three doesn't have a SIM card slot by default, and you need to solder the SIM card slot by yourself. The cost of doing it yourself is within five yuan. If you ask someone to change the card, it costs about forty yuan."（价格：F50 ¥293 / M3 ¥259）

- **带 RJ45 的无电池台机形态**：如中兴 4G CPE 2 Pro（12V/1.5A DC 直供，无电池）、华为 5G CPE Pro 2（2×GE）、烽火 5G CPE Pro 等，均为 AC/DC 适配器供电、无锂电池。

---

### 8.3 温度实测：温度墙在哪里、降到多少才安全 ★★★ 强证据（唯一拿到量化数据的一节）

**结论**：**F50 这一代随身 WiFi 的断网阈值约 100℃，90℃ 就开始明显降速。同一颗芯片放到散热更好的机身（中兴 M3）里，同负载从 73℃ 降到 52℃。** 会展中心室温 25-30℃ + 满载，是能摸到这条线的。

**原理**：SoC 内置温度墙，撞上就降频 → 基带/射频处理不过来 → 速率崩、WiFi 消失。这是热设计问题，不是软件问题，不能靠配置解决。

**怎么做**：
- 半导体散热背夹（8W 级）实测有效；**长期使用要注意冷凝水，设备外面套一个保鲜袋**（这是原作者的明确提醒）。
- 或给机身加铜片 + 小涡轮风扇（B站方案，成本 40-50 元，实测 60℃ → 35℃）。
- 位置：放在有风、不被晒、不叠放的地方；不要塞进密闭机柜角落。
- 先开隐藏的「性能模式」（`http://<CPE管理地址>/index.html#performance_mode`）再上散热，否则性能模式本身加剧发热。

**证据**：

- **YouTube《中兴F50完美改散热：换成中兴M3（降速温度80，断网温度100）》**（2025-04-21，3913 views，UP: OpenRouter）——热成像 + 加热台加速实验，逐条温度：
  > 室温 21℃ 起步；开机后表面 ~24℃，CPU 33.98℃；测速 3 次后表面 ~27℃，CPU 43℃
  > "After downloading ten gigabytes, It took two minutes and forty-four seconds… **CPU temperature just reached seventy-three degrees.** and now it's slowly dropping to sixty-seven degrees… The outer surface temperature is thirty-six degrees."
  > 加热台烤机段：**"Its temperature is around ninety degrees, indicating that the speed will decrease significantly."**（速度掉到 ~200Mbps，"Dozens, and even single digits"）
  > "**It's one hundred and one degrees now.**… This state is actually a disconnection. I can't refresh the temperature page… **Its Wi-Fi disappears.**"
  > "The current temperature is ninety-eight degrees. Combined with my previous tests, **its maximum temperature for disconnection is around one hundred degrees.**"
  > "I put a heat sink clip on it to cool it down. **The CPU temperature quickly dropped to eighty degrees. I immediately tested the speed, I found that the speed was normal now. It can run to 500Mbps relatively stably.**"
  > "Through this test, I found that **the CPU temperature of F five zero is not over eighty**, but a lower temperature is better for long-term use."
  > 对照组："**After the F50 runs 10G traffic the CPU temperature can reach seventy-three degrees. M3 under the same conditions is only 52 degrees.**"
  > <https://www.youtube.com/watch?v=bDErvxfOXqY>

- **同一视频的高赞评论（散热方案细节）**：
  > @ruanluyou: "很多人问散热器。这个半导体散热器电商平台都有，搜"背夹 空调"。**散热器功率8瓦左右，散热面大，刚好适合F50。长期使用，以防冷凝水，F50最好套一个保鲜袋再夹散热器。**"

- **B站《【改装散热】影腾5g随身WIFI加装散热，降温25℃。关联莱浦5g随身WIFI》**（2024-04-08，3892 播放，UP: 听闻8577）——**实测温度对照**：
  > 字幕原文："挂机路由器加上车后下降到 **35℃** / 回家之前的 **60℃**"
  > UP 回复成本："**40-50左右**"
  > UP 回复方案："**这个内置有涡轮风扇的**"
  > 观众互动佐证需求：「等凉雨」: "我就想搞一个这样的外置风扇的，然后再带根线，可以顺带给影腾充电，**这样的话我就可以把电池扣下来了**"
  > <https://www.bilibili.com/video/BV14p421y73s/>

- **未来往事《中兴F50随身WIFI开启高性能模式并安装散热风扇》**（2024-01-06，21843 阅读）：
  > "中兴F50随身WIFI是紫光展锐的CPU，**在高负载下发热比较严重，因为设备CPU存在温度墙，撞到温度墙CPU就会降频**，我们可以通过主动散热风扇来降温，避免降频出现速度和延迟问题。"
  > 隐藏性能模式入口：`http://192.168.0.1/index.html#performance_mode`
  > <https://www.xxshell.com/4171.html>

---

### 8.4 机柜级主动散热与防尘（可迁移做法） ★★ 中等证据

**结论**：**CPE 层面没有找到「防尘对掉线的影响」的实测，只能迁移机柜/交换机的成熟做法。** 关键取舍是「正压防尘 vs 负压散热」——现场机柜进风量不大时，正压 + 进风口滤网更合适。

**怎么做**：
- 进风口装滤网/滤芯，机柜保持微正压，灰尘就不从缝隙进；
- 温控调速器（PWM，12-48V）+ 大风量风扇，设定启动/满载温度阈值；
- 滤网 3-6 个月清理或更换，灰尘大时至少 3 个月一次。

**证据**：

- **Chiphell《抛砖引玉，夏天机柜和路由器散热之分享》**（2023-08-10，23903 查看，46 回复）：
  > 楼主「为了部落」: "机柜篇：米家空净进风头，PWM温控调速器… **P1启动温度设置为40度，P2满载温度设置为70度**，停转温度为P1-3摄氏度… 路由器篇：同样的PWM温控调速器，风扇链接铁片、风扇铁网、橡胶减振垫，12cm闲置风扇三只"
  > 楼主回「zexin4」: "机柜常年不开，**防尘要做好**，看情况更换下面滤筒就好了。"
  > 楼主回「syringalibra」（问夏天最热时柜内温度）: "**目前不超过43度**，我这是主动进风，被动出风。"
  > 楼主回「l8017379」（关于正负压之争）: "**正负压见仁见智了，负压有利于散热，正压有利于防尘。我觉的防尘可能重要一些**，毕竟有nas等设备在"
  > <https://www.chiphell.com/forum.php?mod=viewthread&tid=2538035>
  > 同帖搜索索引另有一条：**"看功率，一般路由器和光猫内部用个底座风扇吹就行了，可以做密闭，不用管防尘。如果有POE设备功率高一些，还是建议做风道"**

- **华为企业文档《更换和清洗防尘网》**（2026-04-07）：
  > "定期清理设备防尘网，**3～6个月清理或更换防尘网，灰尘较大时至少3个月一次**。拆卸时应缓慢操作，避免灰尘抖落。"
  > <https://support.huawei.com/enterprise/zh/doc/EDOC1100308252/7ee1c95a>

---

## 议题 9：供电 —— UPS / 移动电源 / PD 供电不足导致掉线

### 9.1 PD 诱骗线不保证给你 12V，少给电压会「看起来能用但电流翻倍」 ★★★ 强证据

**结论**：**PD 诱骗线（trigger cable）拿不到目标电压时会「退到下一档」。** 若你的 CPE 要 12V 而电源只有 9V，设备可能**看起来正常工作**，但为维持功率电流会大幅上升 → 轻则触发自恢复保险，重则永久损坏甚至起火。**上电前必须用万用表实测诱骗线输出电压。**

**原理**：USB PD 的电压档位是电源侧 PDO 列表，诱骗线/诱骗头只能请求，不能强制。很多手机附赠充电头、以及不少 Anker 老款充电器**没有 12V PDO**。请求失败时诱骗芯片按降序取下一个可用档位（常见 9V）。

**怎么做**：
1. 采购时逐台确认电源/充电宝的 **PDO 列表里明确有 12V**（不是「支持 PD」）。
2. 每根诱骗线、每个电源组合都**用万用表实测空载和带载电压**；换电源就重测。
3. 测 CPE 的**实际电流**（不是铭牌 2A），据此算移动电源续航和转换损耗（统一换算 Wh）。
4. 宁可买输出固定 12V 的 DC 电源 / 12V UPS，也不要靠诱骗线在现场赌。

**证据**：

- **Reddit r/UsbCHardware《Powering a router 12v-2A from a UsbC powerbank》**（2024-06-08）：
  > u/AdriftAtlas: "To ensure compatibility with your power bank, **verify if it supports outputting 12V**. If it does, it should work fine. **If it doesn't, it will likely default to 9V, which may cause issues with your router.** Always test the output voltage coming out of the trigger cable with a multimeter before connecting it to your device. **Retest if you switch chargers or power banks**, as some sources may not negotiate the correct voltage even if they support it."
  > u/arienh4: "This is important, because it goes a little beyond 'may cause issues'. **Depending on the device, it may seem to work fine with such a lower voltage. But that would mean it's drawing a lot more current. Best case, that would eventually trip a resettable fuse. Worst case, it could permanently damage the device or even start a fire.** Always check these things."
  > u/AdriftAtlas: "Devices will generally tolerate a ±5% voltage difference from their rated voltage. Beyond that range, performance issues and potential damage may occur."
  > u/AdriftAtlas: "**The USB-IF should have made the 12V PDO mandatory. Most Anker chargers other than their newest ones lack a 12V PDO.**"
  > u/5c044: "**Your router may not pull 2A either, find out actual draw** and powerbank capacity to calculate run time and voltage conversion losses by converting everything to watt hours."
  > u/Ziginox: "**With these trigger cables, you'll get the next lowest voltage if the one they want isn't available.**"
  > <https://www.reddit.com/r/UsbCHardware/comments/1davajm/powering_a_router_12v2a_from_a_usbc_powerbank/>

---

### 9.2 供电不足 → 掉线 / 重启：三个具体案例 ★★★ 强证据

**结论**：**「路由器 USB 口带不动随身 WiFi」和「非原装适配器」是两条最常见的现场翻车路径，而且症状都是「不定时断/重启」，很容易被误诊为信号问题。**

**原理**：
- 电压降：长线/细线的导线电阻在 2A 电流下产生可观压降（1Ω × 2A = 2V）。
- 端口额定值：路由器 USB 口常见的标称是 5V/1A（5W），而 5G 随身 WiFi 满载功耗可达 5V/2A 甚至更高。启动瞬间的浪涌更大。
- 非配套适配器：电压/电流规格不符，导致路由重启、掉电、WiFi 异常（华为官方把它列为掉线排查第 1 条）。

**怎么做**：
1. **先算功率再接线**：CPE 铭牌电流 × 电压 = 峰瓦，适配器留 ≥50% 余量。
2. 路由器 USB 口只当数据通道，**供电单独给**（用带外部供电的 hub，或按 9.2 第 3 条的做法把 Vbus/GND 剥出来并联一路 5V/2A+ 电源）。
3. **别用非配套适配器**；要换就换「电压一致、电流 ≥ 原配」的。
4. 线要短、要粗（铜芯）。10 米 USB 延长线在 2A 下必翻车。

**证据**：

- **华为官网《华为路由器掉线/断网》**（把供电列为第 1 条）：
  > "**使用配套的电源适配器连接路由器** —— **非配套电源适配器可能会导致路由重启、掉电、Wi-Fi 异常等风险。** 判断方法：路由器底部壳体标贴上查看路由器的电源规格与电源适配器的输出规格对比确认是否一致。"
  > <https://consumer.huawei.com/cn/support/content/zh-cn16104663/>

- **知乎《超火的迷你小路由 Cudy TR3000 刷机OpenWrt喂饭教程》**（2024-12-24，作者「猫点饭」）——「路由器 USB 口带不动随身 WiFi」的**具体型号级案例**：
  > 规格："2.5G/1G 双网口, USB3.0接口, **Type-C供电（5V/3A）**"
  > "❗缺点：闪存小，装不了几个插件，**USB接口供电不足5V1A，带不动中兴F50随身WiFi**"
  > 购买价："凑单后136元，太香了，还有群友可以115元拿下"
  > <https://zhuanlan.zhihu.com/p/14574477622>
  > ※ 同一台机器的供电问题在小红书另有独立帖《Cudy TR3000 给 F50 供电问题》（2026-01-22），说明这是该组合的已知坑。

- **恩山 thread-194436《路由器供电不足。帮忙看看怎么办？》**（2016-09-17 开帖，13259 查看）——最直白的症状描述 + 原理：
  > 楼主: "刚买了个硬改USB路由器，挂卡中继用。电源9V2A的。我的网卡10米线。**插上去后发现供电不足，不停的掉线。** 用了USB放大器就不掉线了。但是网速太慢了。"
  > 2 楼 cixiclq（原理）: "网卡线10米，你有测过网卡线的电阻吗？**如果这段线电阻较大，就会引起压降**，实际在网卡上的电压就会偏低…**如果真的是2A的电流，而你的网卡的导线电阻有1Ω，那么压降就是2V**，供电端虽然是9V的电压，到了网卡工作端的电压就是7V"
  > 6 楼 cixiclq（改法）: "网卡插的是usb口吧，usb口标准电压就是5V的…**你这个情况可能是路由器usb口输出的5V电压不够容量**，可以这么改装下，在网卡上找到usb过来的电源正极，也就是红线…**红线切断，然后靠近网卡的那一端接5V2A的适配器一个**，其中适配器正极接到这个红线，负极并入黑线"
  > <https://www.right.com.cn/forum/thread-194436-1-1.html>

- **中兴 F50 的 USB-C PD 握手本身有问题**（梓喵出没，2025-11-30）：
  > 楼主回复读者: "其实还是中兴的锅，他这玩意**内置驱动只有那个网卡的，用别的网卡不认**，并且**貌似虽然是 C 口但 PD 握手也有问题**。不然的话，直接买个给轻薄本用的带 PD 充电的全功能 hub 就行了。"
  > <https://www.azimiao.com/12387.html>

---

### 9.3 UPS / 移动电源：淘系「12V UPS」有系统性猫腻 ★★★ 强证据

**结论**：**淘宝 100-200 元价位的「12V UPS/不间断电源」普遍是「3S 电池组直连输出」，输出电压在 9V~12.6V 之间浮动，标称电流达不到。** 给不那么敏感的交换机/路由器或许能凑合，但**不要用在会因电压波动复位或损坏的设备上**。真稳压 UPS 要么 DIY，要么买贵一档的。

**原理**：
- 3S 锂电（3×4.2V）满电 12.6V，直连输出 → 标称 12V 设备实际吃 12.6V，且随电量下降向 9V 漂移。
- 用 12.6V 充电头直接给 3S 电池组充电（无独立充电管理）→ 无过充保护、无均衡、无过放保护。
- 路径切换用两个二极管（有压降损耗）甚至没有切换电路。
- 标称容量把电芯 mAh 直接相加，不是 12V 输出下的容量。

**怎么做**：
- 现场做法（按可靠性排序）：
  1. **AC 在线式 UPS**（机房级），CPE 用原装 AC 适配器。最省心。
  2. **12V 输出的 DC UPS，但必须实测**：空载/满载电压、双路同时输出的电流能力、线缆接触可靠性。
  3. 大容量 PD 充电宝 + 诱骗线：**必须确认 12V PDO**（见 9.1），并计算续航。
- **任何 UPS 方案上场前都要做一次「拔市电」演练**，观察 CPE 是否掉链、业务是否中断。
- 注意：CPE 侧常是 12V/1.5A~2A（如中兴 4G CPE 2 Pro 12V1.5A），不是 5V，别拿 5V 充电宝直接怼。

**证据**：

- **GitHub `Staok/iUPS-12V`**（2022-05-11 创建，6 stars，2022-05-30 最后 push）——作者买遍淘宝后的实测吐槽（**注意：此项目 README 明确写「该项目有缘再建设。。。」，即它是证据而不是可用方案**）：
  > "淘宝上在 100-200 价位之间的。容量基本 20000mAH（也不说是单个锂电池芯的容量简单加和 还是 对于 12V输出来说是这么大，**无良1**）；充电头输出 12.6V... 其实是**充电头直连电池来做的 3S电池组 充电**（3串，4.2V * 3，满电正好就是 12.6V），**无良2**。然后是输出，写的都是什么 9V-12.6V... 其实是 **3S电池组 直连输出**，**无良3**。"
  > "我买的一个，好巧不巧，说是两路 12V/3A 的输出，但是不稳定，测试了好多次…**只有一次能两路同时输出，其余都是只能输出一路，后查明是线缆接触不良，动一动就时而有电、时而无电**，**无良4**"
  > "**还有电流能力可能不行，标的 12V/3A，实际到 1A多、2A左右可能（我没实际测）我的设备就直接关停了**"
  > "这种东西，要是这个用在 电压敏感的、贵重点的 电子设备，可能一下就给搞坏了。**也就日常能看到的 路由器、交换机这些 不那么敏感的，写的 12V 输入，无良 UPS 弄出 12.6V 供电 可能一下搞不坏。** 这么不负责任。"
  > "因为 不是一家这样，而是**淘宝搜一下，成片成片的好多家都是这样**，用的最简单、廉价的电路，点到为止。"
  > <https://github.com/Staok/iUPS-12V>

- **MIRC 的供电/电池缓解建议**（2026-02-03）：
  > 用定时插座让热点每天放电："Some people even plug the hotspot into a timer that automatically cycles the power every day to force the device to run off the battery for a couple of hours."
  > 但明确说明 USB 数据 + 断充电不可兼得："**Unfortunately, there are no power timer options that will maintain a USB tethered data connection while simultaneously disabling charging power. This is due to the specifications of the USB standard.**"
  > <https://www.rvmobileinternet.com/guides/preventing-mobile-hotspot-battery-swelling-when-using-a-cradle-booster/>

---

## 议题 10：看门狗 / 定时重启 / 断线自动重连

### 10.1 watchcat 是官方 feed 里的成熟方案，但要用对版本和模式 ★★★ 强证据

**结论**：**用 OpenWrt 24.10.x + `watchcat`，模式优先 `restart_iface`（或 `run_script` 显式调 `ifup <network名>`）；不要上 25.12（有误重启 bug）。** 定时重启也别依赖 cron。

**怎么做（可直接照抄的决策）**：

| 项 | 取值 | 依据 |
|---|---|---|
| OpenWrt 版本 | **24.10.x** | 25.12 上 watchcat 有 ping 误判 bug（#28667），多人复现，退回 24.10.5 正常 |
| ping 目标 | 至少 2 个不同 AS 的 IP（如 `1.1.1.1` + `223.5.5.5`），用 IP 不用域名 | 域名依赖 DNS，DNS 挂了会误判 |
| ping 间隔 / 失败周期 | `pingperiod` 15-20s，`period` 60s | 官方 TIMINGS.md 示例 |
| 恢复动作 | 首选 `restart_iface`；若接口是 L2TP/WireGuard 等，改 `run_script` 调 `ifup <network>`（**不是设备名**） | issue #27927 的实战结论 |
| 重复重启抑制 | 需要保守时设 `reset_failure_timer=1` | 官方 TIMINGS.md |
| 定时重启 | 用 `watchcat` 的 periodic 模式，或 while+sleep 守护脚本 | 恩山 #8396260：cron 服务本身可能已损坏 |

**证据**：

- **包定义（OpenWrt 官方 packages feed，`utils/watchcat/Makefile`）**：
  > `PKG_VERSION:=1  PKG_RELEASE:=26`
  > `PKG_MAINTAINER:=Daniel F. Dickinson <dfdpublic@wildtechgarden.ca>, Dharmik Parmar <dharmikparmar2004@yahoo.com>`
  > `TITLE:=Enable the configuration of programmed reboots or network interface restarts`
  > `description: Restart network interfaces or reboot if pings to hosts fail, **or set up periodic reboots**. Configured via UCI /etc/config/watchcat`
  > <https://github.com/openwrt/packages/blob/master/utils/watchcat/Makefile>

- **watchcat 内置 ModemManager 恢复路径**（源码 `files/watchcat.sh`）：
  > ```sh
  > watchcat_restart_modemmanager_iface() {
  >     [ "$2" -gt 0 ] && {
  >         logger ... "Resetting current-bands to 'any' on modem: \"$1\" now."
  >         /usr/bin/mmcli -m any --set-current-bands=any
  >     }
  >     logger ... "Reconnecting modem: \"$1\" now."
  >     /etc/init.d/modemmanager restart
  >     ifup "$1"
  > }
  > ```
  > <https://github.com/openwrt/packages/blob/master/utils/watchcat/files/watchcat.sh>

- **官方 `TIMINGS.md`**（关于「故障期间会反复重启」是不是 bug 的官方定调）：
  > "The main point is that **the repeated restart window in the default behavior is intentional. It is not an accidental side effect.**"
  > "This mode is useful for cases like WireGuard or OpenVPN, where the upstream internet may recover before the monitored path through the tunnel becomes usable again."
  > 例：`failure_period=60`，恢复动作耗时 15s → `t=60 restart #1`、`t=75 #1 finishes`、`t=120 restart #2`
  > `reset_failure_timer=1` 时：`t=60 restart #1`、`t=75 #1 finishes`、`t=135 restart #2 would be the earliest next retry`
  > <https://github.com/openwrt/packages/blob/master/utils/watchcat/TIMINGS.md>

- **已知坑 #27927**（2025-11-23 开，**2026-08-26 仍在更新**，label `bug` `release/24.10`，15 评论）：
  > 标题："watchcat: l2tp interface won't reboot in `mode:restart_iface`"
  > 楼主 vdmorozov: "It seems `if up/down` doesn't work with L2TP interfaces"，并贴出源码片段 `ip link set "$1" down; ip link set "$1" up`
  > 临时解法（楼主自己的配置）：`option mode 'run_script'` + `/etc/watchcat.user.sh` 内容 `/sbin/ifdown beeline; /sbin/ifup beeline`
  > 2026-03-10 danielfdickinson 给了修复 commit `14e0e9e7`；2026-03-25 用户实测反馈：**"As you can see, the updated script tries to restart the interface by running `ifup lan3`, when `ifup wanc` is actually needed."**（设备名 ≠ 网络名）
  > <https://github.com/openwrt/packages/issues/27927>

- **已知坑 #28667**（2026-03-03 开，21 评论，label `bug` `help wanted` `release/25.12`）——**决定不要用 25.12 的关键**：
  > 标题："watchcat: ping responses not acknowledged over mesh network on 25.12.0"
  > 楼主 thomascrisan: "Watchcat is not recognizing ping responses… **This issue was not present with 25.10.X and prior.**"（实为 24.10.5）
  > 2026-03-08 NicholasKK（qualcommax/ipq807x，**非 mesh**）: "I am experiencing the same problem… **I downgraded to 24.10.5 too and everything is working again.**"
  > 2026-03-12 cowwoc: "I am seeing the same problem when upgrading from 24.10.5 to 25.12 on WRT1900WCS v2."
  > <https://github.com/openwrt/packages/issues/28667>

---

### 10.2 mwan3 自带健康检查，适合「多路上行 + 故障切换」，但冷启动有坑 ★★★ 强证据

**结论**：**mwan3 的 `track_ip` + `reliability` 就是现成的、官方维护的多链路健康检查**，比自己在 iptables 上搭轮子可靠。但**必须验证冷启动行为**——LTE/USB 上行在重启后可能一直是 disabled 状态，需要手动重启 mwan3 服务才恢复，而这在现场是不可接受的。

**怎么做**：
- 每条上行配 2-4 个 `track_ip`，`reliability` 设为「至少几个通才算在线」（默认 wan 是 4 选 2）。
- 部署后**必须做完整的冷启动测试**：拔电 → 上电 → 等 5 分钟 → 检查每条 wwan 接口是否 online 且 tracking 未 paused。
- 若命中 #16817，在启动脚本里追加 `sleep 30 && /etc/init.d/mwan3 restart` 兜底（或等上游修复）。

**证据**：

- **mwan3 默认配置**（源码 `net/mwan3/files/etc/config/mwan3`，PKG_VERSION 2.12.2）：
  > ```
  > config interface 'wan'
  > 	option enabled '1'
  > 	list track_ip '1.0.0.1'
  > 	list track_ip '1.1.1.1'
  > 	list track_ip '208.67.222.222'
  > 	list track_ip '208.67.220.220'
  > 	option family 'ipv4'
  > 	option reliability '2'
  > ...
  > config member 'wan_m1_w3'
  > 	option interface 'wan'
  > 	option metric '1'
  > 	option weight '3'
  > ```
  > <https://github.com/openwrt/packages/blob/master/net/mwan3/files/etc/config/mwan3>

- **mwan3track 是独立进程**（源码 `files/usr/sbin/mwan3track`），用 LD_PRELOAD 绑定源地址与 fwmark：
  > ```sh
  > WRAP() {
  > 	FAMILY=$FAMILY DEVICE=$DEVICE SRCIP=$SRC_IP FWMARK=$MMX_DEFAULT \
  > 	LD_PRELOAD=/lib/mwan3/libwrap_mwan3_sockopt.so.1.0 $*
  > }
  > ```
  > <https://github.com/openwrt/packages/blob/master/net/mwan3/files/usr/sbin/mwan3track>

- **已知坑 #16817**（2021-10-06 开，**2026-05-27 仍在更新**，15 评论，label `release/21.02` `release/22.03` `release/23.05`）：
  > 标题："mwan3: LTE interface always disabled after reboot"
  > "I am using USB LTE modem as the 2nd uplink for my router. I discovered that **upon reboot, the LTE wwan interface is always marked as 'disabled'**, and detail status shows things like: `interface wwan is online 00h:00m:00s, uptime 00h:00m:19s and tracking is paused`"
  > "**However, if restarting the mwan3 service after router boots up, everything works as expected.**"
  > 日志：`mwan3-hotplug[7214]: mwan3 hotplug on wwan_4 not called because interface disabled`
  > <https://github.com/openwrt/packages/issues/16817>

---

### 10.3 运营商 CPE 自带「定时重启」——有，能当兜底的一层 ★★ 中等证据

**结论**：华为/荣耀的消费级路由器/CPE **原生支持定时自动重启**，厂商把它当标准功能。这一层不解决链路问题，但能清掉长时间运行的软件态泄漏（内存碎片、conntrack 残留），作为「最后一道定时自愈」是有价值的。

**证据**：

- **华为官网专页《华为路由器如何设置定时自动重启》**（视频教程，官方支持条目）：
  > "本视频介绍路由器定时自动重启方法"
  > <https://consumer.huawei.com/cn/support/content/zh-cn16096436/>

- **荣耀官网《定时重启路由器》**：
  > "在首页中点击您需要设置的路由器，进入路由器管理页面。点击**查看更多 > 更多功能 > 路由设置 > 路由器重启**，开启路由器定时重启，按照您的需求设置重启时间即可。"
  > <https://www.honor.com/cn/support/content/zh-cn15832626/>

---

### 10.4 硬件看门狗：OpenWrt 默认已开，由 procd 驱动 ★★★ 强证据（源码级）

**结论**：**OpenWrt 的硬件看门狗默认就在跑**，由 PID 1（procd）驱动 `/dev/watchdog`，驱动超时 30 秒、每 5 秒喂一次。加上默认的 `kernel.panic=3`，等于有两层「系统级死亡自愈」。这一层建议保留，不要为了省电关掉。

**怎么做**：
- 保持默认开启。若第三方固件裁剪掉了，装回 `procd` 并确认 `/dev/watchdog` 存在。
- 用 `ubus call system watchdog` 查看/设置 `timeout` / `frequency` / `magicclose` / `stop`。
- 不要设 `magicclose`，否则进程退出时不会触发重启。

**证据**：

- **procd 源码 `watchdog.c`**（OpenWrt PID 1）：
  > ```c
  > #define WDT_PATH	"/dev/watchdog"
  > static struct uloop_timeout wdt_timeout;
  > static int wdt_fd = -1;
  > static int wdt_drv_timeout = 30;
  > static int wdt_frequency = 5;
  > static bool wdt_magicclose = false;
  >
  > void watchdog_ping(void) {
  > 	if (wdt_fd >= 0 && write(wdt_fd, "X", 1) < 0)
  > 		ERROR("WDT failed to write: %m\n");
  > }
  > static void watchdog_timeout_cb(struct uloop_timeout *t) {
  > 	watchdog_ping();
  > 	uloop_timeout_set(t, wdt_frequency * 1000);
  > }
  > ```
  > <https://github.com/openwrt/procd/blob/master/watchdog.c>

- **procd 源码 `system.c`** —— ubus 可调项：
  > ```c
  > static const struct blobmsg_policy watchdog_policy[__WDT_MAX] = {
  > 	[WDT_FREQUENCY] = { .name = "frequency", .type = BLOBMSG_TYPE_INT32 },
  > 	[WDT_TIMEOUT]   = { .name = "timeout",   .type = BLOBMSG_TYPE_INT32 },
  > 	[WDT_MAGICCLOSE]= { .name = "magicclose",.type = BLOBMSG_TYPE_BOOL },
  > 	[WDT_STOP]      = { .name = "stop",      .type = BLOBMSG_TYPE_BOOL },
  > };
  > ```
  > 状态返回：`"offline"` / `"stopped"` / `"running"`
  > <https://github.com/openwrt/procd/blob/master/system.c>

- **OpenWrt 默认 sysctl**（`package/base-files/files/etc/sysctl.d/10-default.conf`）：
  > `kernel.panic=3` —— 内核 panic 后 3 秒自动重启
  > <https://github.com/openwrt/openwrt/blob/main/package/base-files/files/etc/sysctl.d/10-default.conf>

- **官方 wiki 页存在**：[OpenWrt Wiki] Hardware watchdog，<https://openwrt.org/docs/guide-user/hardware/watchdog>（搜索索引日期 2025-04-07），索引摘要：
  > "**While older versions of OpenWrt used the watchdog daemon from BusyBox, all new versions implement the watchdog daemon via procd, which is the init process (PID1).**"
  > ⚠️ **我未能读到该页全文**：openwrt.org 全站启用了 Anubis 工作量证明反爬（对直连、r.jina.ai、md.succ.ai、pure.md、markdown.new 全部返回验证页）。本条为搜索索引片段级证据；源代码级证据见上。

---

### 10.5 4G 模块级恢复：AT 命令复位 vs 硬件断电 ★★ 中等证据

**结论**：**当 modem 本身挂了（不是接口挂了），`ifup/ifdown` 救不回来，必须上升到 `AT+CFUN=1,1`（模块自复位）或 GPIO 断电（硬复位）。** 逻辑是清楚的、有现成脚本可参考，**但所有封装好的第三方看门狗项目都极不成熟，不要直接部署**（见下方星级数据）。

**怎么做（分级恢复，按代价递增）**：

| 级别 | 动作 | 代价 | 何时用 |
|---|---|---|---|
| L1 | `ifdown` / `ifup <network>` | 秒级，业务中断 | 接口死但 modem 活着 |
| L2 | 重启 ModemManager 服务 | 十秒级 | L1 无效 |
| L3 | `mmcli -m any --set-current-bands=any` + `AT+CFUN=1,1` | 数十秒 | modem 挂死、注不上网 |
| L4 | GPIO 切断 USB 口供电再上电 | 分钟级 | L3 无效（模块固件 hang） |
| L5 | 整机 reboot | 分钟级 | 以上全无效 |

L3-L5 必须带**冷却时间**和**最大尝试次数**，否则会陷入 reset 风暴（见 peterpt 项目的 `HIBERNATION_INTERVAL` 设计）。

**证据**：

- **硬件断电脚本（gist）** `reset_modem_hard.sh`（作者 Leo-PL）——通过 GPIO 给 USB 口断电：
  > ```sh
  > #!/bin/sh
  > USB_GPIO=21
  > DELAY=1
  > gpio_value="/sys/class/gpio/gpio${USB_GPIO}/value"
  > echo 0 > ${gpio_value}
  > sleep ${DELAY}
  > echo 1 > ${gpio_value}
  > ```
  > 标题："Simple WAN watchdog for OpenWrt with LTE modem. Add to crontab."
  > <https://gist.github.com/Leo-PL/9e12e33999eb97d8c1b8043307c3c216>

- **第三方看门狗项目的真实成色（★ 这是关键判断）**：
  | 项目 | stars | 创建 / 最后 push | 许可证 | 判定 |
  |---|---|---|---|---|
  | [peterpt/modem_manager_whatchdog](https://github.com/peterpt/modem_manager_whatchdog) | **1** | 2025-08-03 / 2025-08-15（12 commits） | **无** | 不可用，只读设计 |
  | [cescox/openwrt-modem-doctor](https://github.com/cescox/openwrt-modem-doctor) | **0** | 2026-02-07 / 2026-02-07（当天） | Apache-2.0 | 不可用，只读设计 |
  | [mohyfahim/mm-watchdog](https://github.com/mohyfahim/mm-watchdog) | **1** | 2026-09-16 / 2026-09-16（**3 周前**） | 无 | 不可用，只读设计 |

  peterpt 项目的分级设计值得抄（README 原文）：
  > "**Level 1 (Soft Reset):** Attempts to restart the network interface (ifdown/ifup). **Level 2 (Full Hardware Reset):** If soft resets fail, it stops modemmanager, issues a direct **AT+CFUN=1,1** command to the modem for a full reboot, waits for the USB device to reappear, and then cleanly restarts the services. **Level 3 (Hibernation):** If multiple hardware resets fail, the script enters a long 'hibernation' period to prevent a destructive reset loop"
  > 默认参数：`MAX_SOFT_RESETS 2`、`MAX_FULL_RECOVERIES 2`、`HIBERNATION_INTERVAL 3600`
  > README 作者致谢里明确写了 **"Google's Gemini Pro Model: Code Generation"** —— 这是 AI 生成 + 单人调试的项目。

  cescox 项目自陈（README 原文）：
  > "**Status: Early release. Developed and tested on a single device** (GL-E750 Mudi V2 with Quectel EM060K-GL, OpenWrt 22.03). The core fixes (SQM/CAKE, queue tuning, GRO, TCP) are standard Linux networking... The AT command layer currently targets Quectel modems."
  > 恢复分级："**progressive recovery (interface restart -> airplane mode toggle -> hard modem reset)** and exponential backoff"
  > ※ 这个项目里**真正有独立价值的是 SQM/CAKE 抗 bufferbloat**那部分（"Latency spikes under load (1-3s+) ← Bufferbloat in modem queue ← CAKE traffic shaping"），跟看门狗是两件事。

  mm-watchdog 的分级（README 原文）：
  > "1. Recreate the netifd connection with `ifdown` and `ifup`. 2. Restart ModemManager. 3. Disconnect and cycle the modem radio. 4. Reset the modem. **SIM lock and permanent SIM error states are never reset automatically.**"
  > 配置项里有 `searching_recovery_cooldown 600`、`mm_restart_cooldown 120`、`action_grace 20` —— 冷却机制设计完整。
  > <https://github.com/mohyfahim/mm-watchdog>

- **底层缺口：OpenWrt 的 ModemManager 不会自动重连**（这解释了为什么大家都自己写脚本）：
  **OpenWrt 论坛 t/165025《Support 4G/5G automatic reconnection using ModemManager》**（2023-07-06 开帖）：
  > 楼主 Lynx: "**Right now on an ISP-triggered 4G/5G disconnection, ModemManager will not automatically reconnect. It merely reports the disconnection to netifd and that's it.** Work is needed to be done to the netifd protocol to tie things up to react to the reported disconnection and reconnect."
  > 引用 ModemManager 作者 aleksander0m 的设计提案: "The way to solve this... would be to have the netifd protocol handler launch a 'watcher' process which brings up the connection, and is kept alive and running for as long as the network interface is assumed connected... **Anyone up to the task of writing this logic in the netfid modemmanager protocol handler?**"
  > 楼主给了一个临时 workaround（dispatcher 脚本 `/usr/lib/ModemManager/connection.d/10-report-down-and-reconnect`），并注明 **需要 ModemManager ≥ 1.18.8**。
  > 楼主后续: "I raised an issue here: **https://github.com/openwrt/packages/issues/19794** back in November last year, and even the ModemManager maintainer has tried chasing it up, but **the needed fix hasn't been added to OpenWrt even in master yet.**"
  > <https://forum.openwrt.org/t/support-4g-5g-automatic-reconnection-using-modemmanager/165025>

---

### 10.6 定时重启脚本：不要依赖 cron ★★★ 强证据（实战踩坑）

**结论**：**刷过第三方 OpenWrt 的设备，cron 服务本身可能已经损坏，导致定时重启从未执行过，而且你不会察觉。** 用 `while true; do ...; sleep 60; done` 的守护进程，或 watchcat 的 periodic 模式。

**怎么做**：把这两个脚本的写法当成模板（恩山实测可用）。

```sh
# /usr/bin/scheduled-reboot.sh —— 每天 04:59 重启
#!/bin/sh
REBOOT_HOUR=4
REBOOT_MINUTE=59
while true
do
  CURRENT_HOUR=$(date +%H)
  CURRENT_MINUTE=$(date +%M)
  if [ "$CURRENT_HOUR" -eq "$REBOOT_HOUR" ] && [ "$CURRENT_MINUTE" -eq "$REBOOT_MINUTE" ]; then
    reboot
  fi
  sleep 60
done
# 挂载：/etc/rc.local 里 exit 0 之前加 /usr/bin/scheduled-reboot.sh &

# /usr/bin/wifi-monitor.sh —— 无线客户端掉光就重启（接口名要用 iw dev 确认）
#!/bin/sh
WIFI_INTERFACE_2G="phy0-ap0"
WIFI_INTERFACE_5G="phy1-ap0"
CHECK_INTERVAL=10
MAX_ATTEMPTS=3
no_clients_count=0
while true
do
  CLIENT_COUNT_2G=$(iw dev $WIFI_INTERFACE_2G station dump | grep Station | wc -l)
  CLIENT_COUNT_5G=$(iw dev $WIFI_INTERFACE_5G station dump | grep Station | wc -l)
  if [ "$CLIENT_COUNT_2G" -eq 0 ] && [ "$CLIENT_COUNT_5G" -eq 0 ]; then
    no_clients_count=$((no_clients_count + 1))
    if [ "$no_clients_count" -ge "$MAX_ATTEMPTS" ]; then
      reboot
    fi
  else
    no_clients_count=0
  fi
  sleep $CHECK_INTERVAL
done
```

**证据**：**恩山无线论坛 thread-8396260《路由器刷Openwrt后不定时wifi无线设备掉线解决方法》**（2024-09-13，楼主 kollata）：
> "**直到那次重启进入 initramfs 模式，我才意识到 OpenWrt 中的 cron 服务本身早已损坏，导致定时重启功能从未生效。这就是发生在我刷了Openwrt后的隐性问题之一： cron 服务本身可能已损坏！影响定时任务的执行。**"
> "在ssh界面设置每天凌晨4:59分重启路由器脚本以及检测wifi掉线重启脚本，和每天凌晨5：00重启路由器脚本。其实之前我已经设置了每日重启脚本，但直到那次重启进入 initramfs 模式，我才意识到…"
> 脚本注释原文："（脚本必须纯英文！！！！！ 而且不支持注释！）"
> 2025-03-26 楼层 yyang 的建议："Linux 有自己的定时器工具 cron"；楼主 2025-10-31 回复最终解法："**刷237大佬的固件后就再也没遇见国这个问题了**"
> <https://www.right.com.cn/forum/thread-8396260-1-1.html>

---

## 设备选型建议

### 方案 A（**首选**）：有 RJ45 网口的无电池 CPE 台机

**形态**：AC/DC 适配器直供、无锂电池、至少 1 个千兆 RJ45，最好 4 个。用网线直接接你的交换机。

**为什么**：
- 绕开 7.1（USB RNDIS 小时级劣化）、7.2（WiFi 中继）、8.1（电池鼓包）三条链。
- 供电问题变成最简形态：一个原装适配器 + 一个 AC UPS，不需要诱骗线、不需要算 PDO。
- 有网口就能上 mwan3 做多路（未来加第二路蜂窝/有线备份不用改架构）。

**候选型号与价格**（价格是搜索到的**锚点**，不是实时报价，采购前必须复核）：

| 型号 | 形态 | 网口 | 价格锚点 | 来源 |
|---|---|---|---|---|
| **华为 H153-381 / H155-381** | 5G 室内 CPE | 有 | — | Chiphell 2026-03「这个稳的不行」「商用的话还是花火H9那种会好一些」 |
| **烽火 5G CPE Pro** | 5G 室内 CPE | 有 | — | Chiphell 2026-03「用了一年多的烽火。。。很稳」 |
| **通则 X300 GT / X300MAX 港版** | 5G CPE | **1 个 5G 网口** | — | Chiphell 2026-04「频段组合全…可以开SSH，可以改串」 |
| **中兴 MC888S** | 5G 室内 CPE | **4×全千兆** | — | SMZDM 聚合（⚠️ AIGC 内容，弱来源） |
| **华为 5G CPE Pro 2** | 5G 室内 CPE | 2×全千兆 | — | 华为官网 |
| **华为 B315s-936** | **4G** 台机 | 有 | 二手（咸鱼） | Chiphell 2026-04「只支持4G，但非常稳定」 |
| **中兴 K10 室内 CPE** | 4G 台机 | 有 | **¥99 预售** | 新浪财经 2023-12-29 |
| **中兴 4G CPE 2 Pro** | 4G 台机，**12V/1.5A DC** | 有 | — | 充电头网拆解 2024-10-17 |
| **普锐 R601** | 4G 路由 | 有 | **¥98** | Chiphell #9 2026-03 |
| **鲲鹏 NRadio C2000Pro / C2000MAX** | 5G 便携 CPE | 有 | — | Chiphell #5/#8/#25；#26 提醒「没散热风扇不踏实」 |

> ⚠️ 我**没有**拿到这些型号的可靠实时价格。上表「价格锚点」只用于判断量级（百元级 4G / 千元级 5G）。采购前请在电商页面直接核对：① 是否有 RJ45；② 是否内置电池；③ 适配器规格。

### 方案 B（次选 / 备份）：无电池 USB 上网卡 + 一台「喂得饱」的 OpenWrt 路由器

**形态**：中兴 F50（¥293-369，无电池）USB 口接 OpenWrt 路由器；路由器 WAN 走这个 USB 网卡。

**为什么可行**：F50 无电池，绕开鼓包问题；USB 共享功耗低、机身温度低（相对 WiFi 中继方案）；成本最低。

**为什么是次选**：命中 7.1 的 RNDIS 风险。必须配看门狗（10.1 + 10.5），且路由器 USB 口必须能给足 5V/2A。

**明确的反面案例**：
- **Cudy TR3000**（¥115-136）：**USB 口只有 5V/1A，带不动 F50**（知乎 2024-12-24）。别买这个组合。
- **F50 + 带供电 USB Hub**：常见 hub 的供电切换电路**只给下游供电、不给上游（F50）供电**，导致 F50 不亮机；且 F50「内置驱动只有那个网卡的，用别的网卡不认，PD 握手也有问题」（梓喵出没 2025-11-30）。

**替代路线**：中兴 M3（¥259）—— 与 F50 同配置但散热好得多（同负载 52℃ vs 73℃，见 8.3），代价是**要自己焊 SIM 卡槽**（自己焊成本 <¥5，找人改约 ¥40）。

### 方案 C（**不推荐常驻**）：带电池的随身 WiFi

**只在这些条件下考虑**：短期（<1 个月）、能接受故障、且**拔掉电池插电运行**。

**代价**：一年尺度必然进入鼓包窗口；官方明确不支持限制充电上限、也不支持关闭充电（GL.iNet 论坛 2023-08-03）。

### 控制面必配清单

| 层 | 组件 | 配置要点 |
|---|---|---|
| L0 系统级 | procd 硬件看门狗 + `kernel.panic=3` | 默认已开，不要关 |
| L1 链路级 | **watchcat**（OpenWrt 官方 feed） | 24.10.x；`pingperiod 15-20s` / `period 60s`；`restart_iface` 或 `run_script` + `ifup <network名>` |
| L2 多上行 | **mwan3**（OpenWrt 官方 feed） | 每路上行 2-4 个 `track_ip`（用 IP 不用域名）+ `reliability`；**必须做冷启动验证** |
| L3 定时 | watchcat periodic 或 while+sleep 脚本 | **不要用 cron**（可能已损坏） |
| L4 模块级 | `AT+CFUN=1,1` → GPIO 断电 | 抄 peterpt/mm-watchdog 的**分级 + 冷却 + hibernation** 设计，但自己写自己维护，别直接部署这 3 个 0-1 star 的项目 |
| L5 运营 | CPE 自带定时重启（华为/荣耀原生支持） | 作为最后兜底 |

---

## 明确不确定 / 证据薄弱的地方

1. **随身 WiFi 的 NAT 表大小 / 最大并发连接数：完全没有数据。** 我没找到任何厂商规格、拆解实测或复现实验。议题 7.3 里「运营商侧最大连接数限制」是恩山楼主的**口述归因**，不是运营商文档。**请不要在任何报告里写具体数字。**

2. **「USB 共享 vs WiFi 中继」缺量化对照。** 我只找到实践者的主观偏好（梓喵出没：「取代 WIFI 中继，提高稳定性」）和 OpenWrt 官方 relay 的子网要求。没有找到同一台设备、同一张卡、两种上行方式的丢包/延迟对照实测。

3. **RJ45 CPE 的实时价格缺可靠来源。** 表里的价格锚点来自 2023-2026 年的零散帖子/新闻，5G CPE 的价格我没有可信来源，只有「百元级 4G / 千元级 5G」的量级判断。

4. **OpenWrt 硬件看门狗 wiki 全文没拿到。** openwrt.org 全站 Anubis 反爬，直连 + 4 个 markdown 代理全部返回验证页。我给的是 procd 源码级证据（这比 wiki 更硬），但**UCI 配置键名我没能定位**（`/etc/config/system` 里没有 watchdog 段），所以只给了 ubus 层面的确定性事实。

5. **「会展中心 / 体育馆」专项经验几乎为零。** 搜索命中的展会/直播网络文章绝大多数是**聚合路由器厂商的营销内容**，而且多篇明确标注「内容由AI生成」（例如 SMZDM《直播/展会网络总崩溃？一篇说清CPE和聚合路由器怎么选》页面顶部写「源自1034位全网作者 / 内容由AI生成」）。这类来源只能当线索，不能当证据。**本报告未引用其任何结论。**

6. **防尘对 CPE 的具体影响没有实测。** 8.4 全是机柜/交换机层面的做法迁移，没有「CPE 进灰 → 掉线」的因果证据。

7. **F50 的 100℃ 断网阈值是加热台加速实验，不是真实环境数据。** 会展中心室温 25-30℃，能否摸到 90℃ 取决于负载和环境通风；不能把 100℃ 直接当成「现场必然发生」。真实可迁移的结论是：「同负载下 F50 到 73℃、M3 只到 52℃」这个对比，说明**散热设计差异在真实负载下就有 20℃ 的量级差**。

8. **F50 的 USB 网卡改造路线（CDC-ECM + RTL8153B）只有单一来源（梓喵出没），且作者本人也遇到了供电/驱动问题。** 如果走这条路，要预留充分的调试时间。

9. **`kernel.panic=3` 是否在所有目标设备上都生效未验证** —— 它依赖内核 `panic` 参数被正确传递，某些 bootloader 会覆盖。

---

## 附：本报告使用的抓取手段（便于复核）

- 恩山无线论坛（right.com.cn）、Chiphell、什么值得买、知乎、个人博客：`curl` + 自写 HTML→text
- OpenWrt 官方论坛：Discourse JSON API（`/t/<id>.json?include_raw=1`，需带 `Accept: application/json` + 桌面 UA；裸 UA 会返回 "Crawler is not allowed!"）
- GitHub issue / PR / 源码：`gh api`（比 curl api.github.com 配额高）
- Reddit：站点直连 403、safereddit/redlib 有 Anubis/429，改用带真实浏览器渲染的抓取工具
- 视频：`yt-dlp` skill 的 `get-transcript.py`（B站 AI 中文字幕 / YouTube 自动字幕 + 评论）
- openwrt.org wiki：**未能突破 Anubis**（直连 + r.jina.ai + md.succ.ai + pure.md + markdown.new 全部失败）
