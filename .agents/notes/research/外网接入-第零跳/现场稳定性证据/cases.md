# 会展中心/体育馆「第零跳」蜂窝外网 —— 真实场景实战帖调研

> 调研范围：赛事直播 / 户外移动直播 / 应急通信 / 机器人比赛·电赛 / 黑客松·漫展·车展
> 调研时间：2026-10（帖子时间跨度 2015-08 → 2026-08）
> 方法：中英文多轮并发搜索 → 命中即 fetch 全文。Reddit 全帖走 **pullpush.io**（`reddit.com` 直连 403，safereddit 被 Anubis 挡，redlib 全实例被 Anubis/限流）；知乎正文走 **md.succ.ai**（直连 403）。

---

## 结论速览（先看这个）

**一句话：在人群密集的场馆里，蜂窝网络作为「第零跳」的失败率极高，且失败原因不是信号强度而是上行拥塞；业界收敛出来的唯一解是「多运营商 + 多物理链路」，且「有线 ≥ 卫星 > 蜂窝」。**

1. **最硬的结论（跨 6 个社区、10 年、反复验证）**：场馆内「信号满格 ≠ 能上网」。Reddit r/sysadmin 一条 32 赞的回复总结得最干：
   > "Had 5 bars on my phone but couldn't even load a webpage because literally thousands of people were hitting the same microcells" —— [u/Maximum_Camera_8716, 2025-12-12](https://reddit.com/comments/1pkamzw)
2. **10 modem 聚合设备也翻车**。这是本次调研里对「多卡聚合 = 银弹」最有力的反例：
   > "Even a 10 modem bonded device failed on us." —— [u/TatsumisDad, 2020-09-10](https://reddit.com/comments/ipwqxv)
3. **场馆方有线（house internet）依旧是压倒性的最佳选择**，尽管贵得离谱（$800/周末/3Mbps）。这是 r/CommercialAV、r/sysadmin 两个大帖（28 + 36 条评论）的主流共识，压倒性多数回复是「交钱」。
4. **单卡 CPE / 手机热点 = 必翻车**。多帖一致的实测：setup 期（开展/开演前一天人少）能用，门一开立刻崩。
5. **一个反直觉的成功案例**：US Mobile + **QCI-7 优先级**在拉斯维加斯 LVCC 的 Box Fan Expo 上全程零问题（VR 对战 + 直播）。说明「**优先级 QCI / 网络切片**」比「多插几张卡」更关键。
6. **同一场馆不同运营商差距可以极大**，且原因经常是 **DAS（室内分布系统）而不是基站**。DAS 是「时间胶囊」——建成后极少升级，导致某些运营商在场馆里有 n77/n41，另一些只有老 B2/B66。

---

## 一、按场景分组的案例清单

### 场景 A：赛事 / 活动直播（展会、车展、漫展、发布会）

---

#### A1. Arthur「10 modem bonded device failed」—— 会展中心 press day（英文，最经典反例）

| 项 | 内容 |
|---|---|
| **谁** | u/TatsumisDad（r/VIDEOENGINEERING） |
| **场合** | 多个会展中心的 press day（未点名具体展会） |
| **用了什么** | **10 modem 的 bonded 蜂窝设备**（未给型号）+ 场馆有线 |
| **结果** | **失败** |

**原文引用（2020-09-10，score 2）**：
> "I've done a lot of streams inside crowded convention centers on "press day," and consistently found that the minute the presentation started, what limited cellular bandwidth made its way into the center of the convention center floor was eaten up by journalists trying to live tweet or whatever. **Even a 10 modem bonded device failed on us.** In those scenarios we basically came to rely on the venues wired connection, which was shockingly expensive and also pretty flaky."

🔗 https://reddit.com/r/VIDEOENGINEERING/comments/ipwqxv/question_using_bonded_cellular_venue_internet_or/ ｜ 整帖 4 条评论，2020-09-10

**同帖其他关键回复**：
- u/AllTheKingsHorses（2020-09-10）："Venue internet can be shockingly expensive. **I've used bonded cellular in lots of places simply as a matter of cost.** That being said you really need to make sure you're going to get a good signal which requires a **site visit and equipment**."
- u/marshall409（2020-09-10）："Especially when you're using it for Pro AV you'll be shocked at what a venue will ask just for one internet drop."

---

#### A2. r/CommercialAV「Internet Connectivity for Trade Shows」—— 28 条评论的行业共识（英文）

| 项 | 内容 |
|---|---|
| **谁** | OP: u/mattrhale（英国，演示云协作系统）；33 条评论 |
| **场合** | 2023 年各类英国 trade show |
| **用了什么** | 拟用 **Netgear MR5200 + 5G SIM**（原计划）；上一年用 4G 手机 tethering |
| **结果** | **社区一致劝退；OP 实测 4G tethering 峰值仅 ~20Mbps** |

**原文引用（2023-01-03）**：

- u/johnfl68（**score 22**）：
  > "if it is at all important at a trade show, **stick well clear of wireless anything**. ... The wireless spectrum at trade shows is the wild wild west with no one doing any control of who is using what frequencies. You may get lucky and have something wireless work ok, but **don't ever count on it with a venue filled with thousands of phones** all broadcasting WiFi, Cellular, and Bluetooth signals into the same cramped space."
- u/VoidSnug（score 35）："Unfortunately any wireless network will be negatively affected when the venue is filled with people."
- u/ridefst（score 12）："**It'll work great until the doors open** and everybody brings their cell phone/mifi/etc in with them."
- u/nivek_c（score 2）："You're gonna be sub 56kbps speeds when the whole trade shows worth of mobile traffic is routed through the single nearest cellphone tower."
- **OP 反驳**：u/mattrhale（2023-01-03）："I used 4G phone tethering last year and was getting **around 20mbps at peak time**. I think 56k is a bit of an exaggeration."
- u/EightOhms（score 3，**重要的反方视角**）："Carriers are not stupid and many of them deploy mobile sites for large crowd events like this. ... many large convention centers have **in-building systems that have many many many sites installed** and high capacity connections to the carriers network on the backend."
- u/stevensokulski（score 3）："my go-to brand is **Cradlepoint**. They make great routers that can accept multiple cellular radios... That said, if ping is your issue cellular is not going to help you much, especially in a crowded trade show floor."
- u/Adventurous-Ice9694（score 2）："**Usually the 5GHz band will be reserved for the exhibitions paid WiFi and the 2,4 GHz is a mess.** ... regarding 5G Routers I can strongly recommend **Peplink**, especially because you can remotely manage and trouble shoot them."
- u/dmxwidget（score 1）："Someone I know provides external cellular based wifi/internet at trade shows as part of his services. They use **Cradlepoint** cellular routers. They get them optimized per show based on the location and environment and will adjust settings once the show floor is full of people... but **if it's a critical connection, a venue hardline is going to be the best move. It all comes down to client risk tolerance.**"
- u/halfwheeled（score 5）：现场见过有人用 deauther 打 deauth 把全场上网的人踢下线（安全风险）。

🔗 https://reddit.com/r/CommercialAV/comments/102527z/internet_connectivity_for_trade_shows/ ｜ 2023-01-03，28 条评论（抓到 33）

---

#### A3. r/sysadmin「$800 for 3mbps」—— 最新、最长的场馆网络大讨论（英文，36 条评论）

| 项 | 内容 |
|---|---|
| **谁** | OP: u/LeBanonJames69；42 条评论 |
| **场合** | 2025-12，多个美国会展中心 |
| **用了什么** | 拟用运营商 hotspot 替代场馆网络 |
| **结果** | **社区压倒性「交钱」** |

**原文引用**：

- **OP（2025-12-11）**：
  > "several of the convention centers they're scheduled to exhibit at are **charging $800 plus for a weekend of 3mb speeds**. I'm sure I could get better speeds for cheaper using a hotspot from a mobile provider, I just want to make sure it's reliable"
- u/randommonster（**score 32**）：
  > "First consider the location of the table. If you are in a convention center, then all that **Steel and concrete** will be between your table and the Carrier's antenna. Then add all the other convention goers and people trying to do the same thing ... **Plus most convention centers have small LTE pico routers to intercept and allow only limited voice traffic inside the buildings.**"
- u/ilevelconcrete（**score 12**）："**Suck it up and pay.** They are charging this much because they know there are zero viable alternatives. You aren't not the first IT guy to be asked this question, the prices would be much more reasonable if you could undercut them yourself with a mobile hotspot. **The buck will stop at you when your sales team can't do anything after the hotspot fails.**"
- u/Entegy（**score 19**）："They're charging that much because they know it sucks and you're a captive audience. Add just how shit 5G is penetrating buildings compared to LTE and you'll be a fool to rely on a hotspot."
- u/heliosfa（score 8）："Be warned that mobile data throughput in convention centres with lots of visitors absolutely sucks."
- **⭐ u/Maximum_Camera_8716（score 6，最生动的失败实录）**：
  > "Yeah this is spot on - **learned this the hard way at a big healthcare expo a few years back. Had 5 bars on my phone but couldn't even load a webpage** because literally thousands of people were hitting the same microcells. The venue internet is highway robbery but at least it usually works when you need to demo something to a potential client."
- **⭐ u/meballard（2025-12-12，单运营商差异的直接证词）**：
  > "**You also can't really test in advance** - you might be just fine during setup, but as soon as the crowds are there things can change quickly. ... **It can also depend on the carrier. At one venue I do stuff at regularly, Verizon works just fine on the floor, the others not so much.**"
- **⭐ u/ehhthing（2025-12-12，唯一明确的成功案例 + DAS 情报）**：
  > "This depends on the specific convention center. Some convention centers have indoor antenna networks that make 5G pretty reliable, but it's hard to research this stuff. **I had success with Verizon 5G business internet at LVCC**, but if the signal strength inside the convention center is poor you're in for a bad time."
- u/majornerd（2025-12-12，**唯一明确「热点赢过场馆网」的人**）：
  > "I often get a booth at comic cons. **My kit includes a hotspot with external antennas. Far better than the hundreds of dollars the venue wants.** The people next to me almost always pay for internet and just complain."
- u/txe4（2025-12-12）："I've been absolutely done-over by a Vegas venue for internet at a stand, **when 5G turned out to be fine**. But if it hadn't been on the day, we'd have been completely fucked."
- u/Matt_NZ（2025-12-12）：户外活动改用 **Starlink mini** 做 WAN 共享给全部设备。
- u/silent3（score 2）："Years ago we tried hotspots, cellular modems, several different schemes, and **they all consistently fail**."

🔗 https://reddit.com/r/sysadmin/comments/1pkamzw/tradeshow_internet_options_can_i_get_away_with_a/ ｜ 2025-12-11 → 2026-05-15，36 条评论（抓到 42）

---

#### A4. ⭐ Halfbrick Studios @ Box Fan Expo（拉斯维加斯）—— **唯一一个「人群密集场馆里蜂窝完胜」的详细成功案例**

| 项 | 内容 |
|---|---|
| **谁** | Halfbrick Studios（《水果忍者》开发商，《The Thrill of the Fight 2》VR 拳击），CMO Eli Hodapp |
| **场合** | **Box Fan Expo, Las Vegas**，2025-09 中（Canelo vs Crawford 拳赛配套活动），数千人会展厅 |
| **用了什么** | **Netgear Nighthawk M6 Pro**（bridge 模式）+ **US Mobile Dark Star（AT&T 网络）SIM**，**QCI-7 优先级**（US Mobile 特批 + 专属支持对接人）；局域网 **UniFi Dream Router 7** 走 Wi-Fi 7；备用 **US Mobile Light Speed（T-Mobile）** SIM（M6 不支持 Warp/Verizon 所以没上） |
| **结果** | **成功**。全程 0 卡顿、0 rubber-banding；直播（iPhone → YouTube）成为展台亮点；备用 SIM 从未启用 |

**原文引用（2025-09-17，score 44）**：
> "once thousands of people show up, **even venues with small cells or a distributed antenna system often can't keep the spectrum from collapsing**."
> "**QCI-7, for anyone not deep in the weeds, is the highest priority lane US Mobile can give regular customers. Using it at a crowded event felt like discovering a hidden cheat code for cellular data.**"
> "**The results felt like magic.** The demo rings ran flawlessly from open to close... The live headset behaved exactly like it would on a good home connection — fast matchmaking, no lag, no rubber-banding — **inside the kind of convention hall where best-effort connectivity usually collapses.**"
> "**Our WAN was a Netgear Nighthawk M6 Pro in bridge mode with a Dark Star SIM.** ... Dark Star with QCI-7 was so solid we never swapped."

**评论区补充的关键情报 —— u/alttabbins（2025-09-30）**：
> "**Las Vegas Convention Center uses a neutral host DAS (Distributed Antenna System) for cell coverage. You will likely get better cell service in the convention center during the event than what you would get outside.** QCI is still a factor, but the DAS is generally very hard to saturate to the point where anyone is deprioritized."

⚠️ **注意**：这是发在 r/USMobile 的、由 US Mobile 官方热烈回应的帖子（CEO u/ankhattak 亲自回复），**有软文属性**。但设备型号、QCI-7 机制、LVCC DAS 事实都可交叉验证。评论里有用户直接质疑 "Wow. A double ad on the subreddit. Not wanted."（u/DooNotResuscitate, score -2）。

🔗 https://reddit.com/r/USMobile/comments/1niymvb/ ｜ 2025-09-17，16 条评论（抓到 22）

---

#### A5. ⭐ 2026 北京车展：理想 L9 发布会因网络拥堵失败（中文，最贴切「第零跳」的案例）

| 项 | 内容 |
|---|---|
| **谁** | 微博汽车博主「赛车星冰乐」（微博新知博主/汽车博主）评理想 L9 Livis 直播 |
| **场合** | **2026 北京车展**（文中称「刚才才刷到理想 L9 Livis 的直播录像」），2026-04-24 |
| **用了什么** | 车企侧：未做网络规划，依赖公共移动网络；**对比：车企自己的直播会专门拉一条网线 + 私用 Wi-Fi** |
| **结果** | **失败**（发布会现场网络拥堵） |

**原文引用（2026-04-24）**：
> "现场人多导致的网络拥堵，导致车的自动功能失败，其实是可以避免的。**就像车企自己的直播，会专门拉一条网线，然后直播设备都连接自己的私用 Wi-Fi 就能避开公共的网络拥堵，这属于人多场景的多年经验和共识。** 这个事情搞直播的公司都明白，但车企的员工可能没这个经验，就没想到。其实去过演唱会的都知道原理，**为什么要增加运营商信号保障车**，如果工作细致点还是可以预判的。"
> "**我目前发现，强制把手机限制在 4G 可能在展会时候是最佳方案。**"

🔗 https://www.sina.cn/news/detail/5291354618072391.html ｜ 2026-04-24 22:25

> 💡 **这条极有价值**：它同时给出了「车企/专业直播团队的既定做法（专线 + 私用 Wi-Fi）」、「运营商信号保障车的存在意义」、以及「展会上强制锁 4G 更优」三条可操作经验。

---

#### A6. 2025 成都车展（中国西部国际博览城）—— TVU One 多卡聚合背包（中文）

| 项 | 内容 |
|---|---|
| **谁** | **重庆优咖直播**（川渝地区直播服务商） |
| **场合** | **第二十八届成都国际汽车展览会**（中国西部国际博览城），22 万 m²、近 120 个品牌、1600 余款车型，2025-08/09 |
| **用了什么** | 多套 **TVU One** 背包（专利 IS+ 协议聚合多运营商 5G/4G；HEVC 编码；FEC 前向纠错；热插拔电池） |
| **结果** | **成功**（多机位：展位核心区 / 产品体验区 / 媒体访谈区） |

**原文引用（2025-09-21）**：
> "面对成都车展现场环境的复杂挑战——**数万观众同时在场导致网络拥堵严重，大量电子设备运行造成信号干扰频繁**，加上展台布局多样化对设备移动性要求极高，优咖直播团队经过技术评估，选择了 **TVU One** 背包设备作为核心解决方案。"
> "**TVU One 搭载的专利 IS+ 协议能够智能聚合多家运营商的 5G/4G 网络资源**，通过多路信号的动态调配和智能切换，有效规避了单一网络拥堵导致的传输中断问题。"

**同事件的第三方（有驾）描述**：
> "**在展馆里，光 5G、4G 信号就有三家运营商混战**，观众人人手机、手环、平板，网络带宽跟展台上挂的横幅一样'人人可见，人人争抢'。加上各摊位自带的 Wi-Fi 互相'碰头'，信号会不会掉？只要你在现场转一圈，比停车场找车还刺激。TVU One 用自己的专利 IS+ 协议，把多家运营商的网络流量智能聚合，**遇到突发拥堵就游刃有余地切换。说直白点，就是谁家网快就主攻谁**。"
> —— https://www.yoojia.com/article/9581868327062679876.html （2025-09-23）

🔗 知乎 https://zhuanlan.zhihu.com/p/1953421934835528946 （2025-09-21，0 评论）
⚠️ 这是 **TVU 官方/服务商软文**，但设备型号、场合、技术机制具体，可作为「多卡聚合背包在车展的实际用法」参考。无量化数字。

---

#### A7. 美乐威 Pro Router One 5G @ 「悦来河全民K歌」（中文，厂商 case study）

**原文引用**：
> "**One 5G 聚合路由器最多可同时聚合 10 路网络链路**，包含 **1 路 5G、1 路 4G、2 路 USB 共享网络、2 路有线网络、2 路 Wi-Fi 6 无线网络和 2 路 LAN**，为本次直播提供了极为灵活的网络聚[合方案]"

🔗 https://www.magewell.cn/case-studies/61/detail ｜ 厂商 case study
⚠️ 厂商材料，无独立验证，无失败数字。

---

#### A8. 丛林 15 机位户外探险赛事直播（上海松江）—— 中文，专线 + 聚合双备份

| 项 | 内容 |
|---|---|
| **谁** | 某影视制作/导播团队（抖音「幕后纪录片」帖，20 人团队） |
| **场合** | 2026-02-25（正月初九），**上海松江原始丛林户外探险赛事**，赛道 300-500m，15 机位，5+ 小时双平台推流 |
| **用了什么** | **现场拉专线 + 多卡聚合路由器双重备份**；长距离电缆 + 全区域 UPS；光纤回切 → SDI；BMD ATEM 2 M/E 切换台 + vMix；6×Z280 / 4×索尼 FX3 / 5×GoPro |
| **结果** | **成功（文中称「零失误」）** |

**原文引用（2026-05-07）**：
> "为了把百米外的 15 路信号稳定传回导播台，我们在前期勘景时反复推演。解决供电？那就硬拉长距离电缆，全区域接入 UPS 电源，哪怕插头松掉也能无缝衔接。**解决网络？现场拉专线，外加多卡聚合路由器双重备份。**"

🔗 抖音帖（经什么值得买聚合页转载）：https://post.smzdm.com/p/al3p4prp/ ｜ 2026-05-07

---

#### A9. 摄行直播（十年活动直播）—— 车展翻车 + 四条实战原则（中文）

**原文引用（2026-07-12，抖音；经什么值得买转载）**：
> "先说个很容易踩的坑：很多人以为'有 4G 信号就能直播'。其实完全两码事。**直播靠的是上行带宽**，而户外一旦人群密集，比如产品发布现场几百上千人同时刷手机，基站被挤爆，你的上行速度可能瞬间掉到几乎推不动流。**我有一年在车展翻车就是这么栽的——信号满格，画面却卡成 PPT。**"

**给出的四条原则**：
1. "聚合路由要当标配 ... 一张卡掉速，其他几张顶上，等于把鸡蛋放进好几个篮子。**户外我基本不裸奔单卡。**"
2. "**有条件一定拉专线**。如果场地能提前布网，我会让主办方协调一条有线专线做主用，聚合 4G 做备用。"
3. "**卡要提前测、错开运营商**。到现场先分别测每张卡的上行速度，哪家强用哪家打主力，同时故意混用移动、联通、电信。"
4. "**码率要肯让步**。户外网络不稳时，我宁可把推流码率调低一档，保证'不断'比追求'清晰'更要紧。"

**实战细节**：
> "有次户外路演，**主专线中途被施工挖断，靠提前分好的聚合备用线三四秒就接上了**，直播间几乎没人察觉，就是因为预案早就演练过。"
> "是不是链路堆得越多越保险？**其实不然。备用线路太多，切换判断反而变复杂，现场一乱容易切错。**"

🔗 https://post.smzdm.com/p/al3p4prp/ ｜ 2026-07-12（原始抖音）

---

#### A10. 漫展移动直播方案：索尼 FP1 + 壹唯视 UR100（中文）

**原文引用（2026-05-04，抖音）**：
> "**漫展现场人太多，手机 5G 信号根本发不出高清画面怎么办？** 今天分享一套我常用的户外移动直播方案，主打一个'高画质'、'不断网'、'推着走'！这套核心方案利用了 **壹唯视 UR100 多卡聚合路由器**解决会场网络拥堵痛点，**网线直连索尼 FP1 直播终端**，保障推流稳定。画面端采用了索尼 ZV-E10 II 搭配适马大光圈广角镜头，加上散热器保驾护航... 整套设备仅需一个 **酷态科 4 万毫安充电宝**集中供电，架在带滑轮的三角架上。"

🔗 抖音（经什么值得买聚合页转载）：https://post.smzdm.com/p/al3p4prp/ ｜ 2026-05-04

---

#### A11. 天津奥体中心户外看台信号弱（中文，具体场馆）

**原文引用（2026-09-24，知乎专栏）**：
> "天津的户外直播首先要排查信号覆盖情况，**像天津奥体中心的户外看台、滨海东疆港的亲海公园部分区域移动信号弱，需要提前配多卡聚合路由器保障推流稳定。**"

🔗 https://zhuanlan.zhihu.com/p/2083915491790282923 ｜ 2026-09-24

---

#### A12. 苏超扬州主场 / 南京交博会 / 长三角应急博览会展（中文，厂商实测）

**原文引用（2026-07-09，中华网）**：
> **场景1：长三角国际应急减灾和救援博览会（2026年5月）**——"该展会人流密集、多家媒体同时推流，某媒体方部署了机架式设备 **C7** 和便携设备 **Z5** 配合使用。现场多机位画面推送至直播平台，**实测聚合带宽稳定在 400Mbps 以上**，推流全程未出现因网络原因导致的画质降级或中断。"
> **场景2：南京交博会（2026年4月）**——"某媒体团队使用 **Z5** 同时支撑展会直播间推流和现场无人机巡检画面回传。无人机视频通过单独占用一路聚合通道，直播间推流使用另一路聚合通道，两路业务相互隔离。"
> **场景3：苏超扬州主场赛事（2026年4月）**——"**体育场馆弱信号区域历来是直播痛点。**媒体方使用 Z5 在信号覆盖较差的看台区域部署，利用 **3 路 4G + 1 路 5G** 的组合模式，为移动转播机位提供稳定上行带宽。实测在基站频繁切换的区域，聚合链路全程维持正常推流。"

**厂商给出的选型建议（有实操价值）**：
- "**SIM 卡管理需要提前规划。** 多网聚合设备通常需要插入多张不同运营商的 SIM 卡（**移动、联通、电信各备一张是常见做法**）。"
- "**推流平台的上行限速是隐性瓶颈。** 即便聚合路由器提供了 500Mbps 带宽，**多数直播平台对单个直播间的上行码率有上限限制（常见为 8-16Mbps）**。在这种情况下，过高的聚合带宽并无实际意义。"
- "**现场测试必须做，但测试时机有讲究。** **展会搭建期间（通常是开展前一天）是测试网络的最佳窗口**，此时人员密度低，网络环境接近真实状态。**正式开展后再做测试，一旦发现卡顿问题往往已错过优化窗口。**"
- "**建议至少保留 3 路以上的可用链路作为安全边际。**"

🔗 https://mtz.china.com/touzi/2026/0709/247721.html ｜ 2026-07-09
⚠️ **方为（FW-Linker）厂商软文**，场景描述无第三方佐证，数字为厂商自报。**证据等级：低**。

---

### 场景 B：户外 / 移动直播

#### B1. ⭐ Artemis II 发射直播翻车 —— 2026 年最详细的「拥挤场地聚合失败」复盘（英文，41 条评论）

| 项 | 内容 |
|---|---|
| **谁** | u/pablofuente（r/VIDEOENGINEERING） |
| **场合** | **Artemis II 发射**，Kennedy Space Center press center，2026-04-03 |
| **用了什么** | **Peplink 路由器**聚合 **2 路蜂窝 + 1 路 Starlink**，自制机箱 + **高功率蜂窝天线**，SIM 来自 mobilemusthave |
| **结果** | **失败**（T-10 分钟画面严重劣化）；OP 称「multiple similar failed streams in the past and I am done」 |

**原文引用（2026-04-03，score 20）**：
> "I was using a **Peplink router bonding 2 cell signals and a starlink**, and my streaming got super degraded at T-10. I have a custom built case with a **high power cell antenna** and the router, no matter what… **I have had multiple similar failed streams in the past and I am done.**"

**评论区最有价值的几条**：

- ⭐ **u/sims2uni（score 2）—— 塔被打挂的真实机制**：
  > "Any event with lots of public there will have cell tower dropouts... **It's unfortunately not cost effective for carriers to improve the infrastructure around event spaces so as an industry we just have to accept it and sit across as many carriers as you can to avoid it.**"
  > "Starlink is also terrible for upload. We used to push our backup lines down a starlink and we'd get **constant dropouts at predictable intervals as the dish dropped a satellite and tracked the next one**."
  > "**Too many users on a tower will overload it and cause it to reboot. (In the early days of LiveU and MVP's we managed to take a tower down ourselves from too many units pushing too much data).**"
  > "**For example, if there's a coffee shop down the road with some friendly owners, a hundred or so in cash for a cabled feed of internet for the day will be the easiest money they've ever made, but also a guaranteed way to keep your show on air.**"

- ⭐ **u/davehenk（Haivision 员工，score 4）—— 技术性隐患排查清单**：
  > "**Protocol:** If you're using RTMP or another TCP-based protocol, even minor loss hurts. They typically tolerate <2% packet loss and <30 ms jitter. Switching to a UDP-based protocol like **SRT** can make a big difference in congested environments."
  > "**Bitrate agility:** A fixed 6 Mbps stream might be fine until the network degrades. Being able to quickly step down when congestion spikes (without restarting the stream) is critical."
  > "**Starlink:** At major public events, the bottleneck is often **uplink congestion at Starlink ground stations** (similar to an overloaded cell tower)."
  > "**Antennas: High-gain antennas can backfire if they're locked onto a saturated sector.** Tools like https://surfscan.app/ can help identify the best carriers and bands to use."
  > "**Cell plans / priority:** Traffic-prioritized plans (and eventually 5G slicing) can help."

- ⭐ **u/No_Coffee4280（score 3）—— 网络切片是「真·第零跳」**：
  > "Did you have just normal sims or did you pay the phone company for **dedicated 5G slices** for big events the phone companies will sell you dedicated slices so you not competing with other customers. **In the UK we done a few major events using slices cost around £2500 per slice.** https://www.vodafone.co.uk/business/case-studies/vodafone-itn-5g-network-slicing-at-coronation"

- ⭐ **u/isonotlikethat（score 3）—— Peplink 类「负载均衡路由器」为什么不适合直播（本次调研最硬的技术解释）**：
  > "**A peplink will never compare in performance to a true bonded video encoder like a LiveU. Peplinks load balance individual connections in order to achieve an "aggregated" speed selling point. This doesn't benefit your single video encoder, as it's still just going to send all of its data over only one connection, or if you have smoothing enabled, it'll send the same data over every connection. Your maximum throughput for a single connection is still only defined by the maximum throughput of your best connection.** Then there's adaptive bitrate feedback mechanisms which simply don't exist in a peplink workflow."
  > "A LiveU is able to **split the stream into chunks and send those chunks individually over each modem/connection**, using connection quality measurement to make use of each individual connection's current capacity. If you want to send a 6mbps stream, **you only need the sum of your connections to be able to send that traffic (plus 15-40% overhead for FEC and retransmissions)**."

- **u/benmakestv（LiveU 员工，score 27，利益相关）**：
  > "You can add up to **three starlinks to our LiveU 800** (two Ethernet ports and one over WiFi) - in addition to the cellular modems. **That'll give you eleven bandwidth sources - and with carrier diversity from five different providers**... we have a brand new feature called **LiveU IQ. It uses eSIMs instead of fixed sims** - which means we can change which carrier is on which sim in real time."

- **u/rubrduk（score 2）—— Peplink 部署的真实限制**：
  > "**Peplink on it's own will use the strongest cell carrier of the sim cards you have active for streaming and will theoretically switch seamlessly to the next best carrier on detection of service loss (it's never seamless)**,... Pepink's SpeedFusion offers ISP bonding via multiple carriers or sources, but **you will need a SpeedFusion supported unit like the BR Pro 5G or BR2 in the field and a SpeedFusion router on the other end**... or the cloud based FusionHub"

- **u/MRNETbyMotionRay（服务商，score 1）**：
  > "On the cellular bonding side, two things: **1) you need three carriers. Two won't cut it 2) you need the correct data plans**. If this is not enough, bonding dual Starlink may work."

- **u/Embarrassed-Gain-236（score 2）**：卫星专线成本——"Expensive like **$1000/min** or so for the reserved satellite spectrum plus the DSNG van and operator rate."
- **u/rubrduk（score 2）**：卫星车租赁实际价格——"A 2 hour event in the Los Angeles area for example will run you about **$6000-10,000**"
- **u/PhotonEmpress（score 2）**："**Don't rely on cellular out there, it all gets deprioritized for critical ops and overloaded by the kabillion people trying to watch launch.**"

🔗 https://reddit.com/r/VIDEOENGINEERING/comments/1sba8nd/reliable_live_streaming_in_crowded_spots/ ｜ 2026-04-03 → 2026-08-10，41 条评论（抓到 59）

---

#### B2. Starlink 用于直播回传 —— 两次大讨论的实测数字（英文）

**帖 1：r/VIDEOENGINEERING「Has anyone used Starlink or Starlink RV for an uplink solution」**（2023-02-27，score 42）

- ⭐ **u/Prafe（score 25，做了 LiveU + Dejero 对比测试）**：
  > "So I've actually done some testing using **Starlink business and Dejero/LiveU**. The relatively frequent **sub-second connection dropouts** causes issues for any latency setting below 3 seconds... If the dish has any obstructions (it needs a dome of no obstructions up to 110° wide towards the north...) it's much much worse. **If you bond starlink plus cellular then it's actually pretty good.**"
- u/remlapca（score 2）："I did 2 parades with a **LiveU 600** using Starlink to help share the load of the bonded cellular. **The bonded cellular usually drops pretty low when everyone fires up their cellphones at large events.**"
- u/SCorvo（score 1）："I've been **bonding starlink plus cellular for over eight weeks now with Dejero, latency preset is 3s.** Any sub-second signal loss doesn't affect at all."
- u/excitatory（score 6）：两场 30 小时直播，需 **90 秒 buffer** 才跑得动；"**We also noticed our upload speeds were dramatically better in the day and almost unusable between 2-4 AM. Speed tests were 150/25**"
- u/Skrubrekr420（score 3，澳洲）："**it was a nightmare. Constant drop outs and the stream was ruined.**"

🔗 https://reddit.com/r/VIDEOENGINEERING/comments/11dpaag/ ｜ 2023-02-27，20 条评论

**帖 2：r/VIDEOENGINEERING「Starlink Mini for remotes」**（2025-10-15，score 11）

- u/kicksledkid（score 5）："Larger unit also works well for me in the city in a **"everyone here is on their phones and the cell towers are melting"** situation. **Just enough upload to keep the Dejero happy**"
- u/slasher013（score 3）："I'm using a starlink mini in tandem with a **Dejero engo 260**... **Starlink mini doesn't have great upload speeds**... every so often it will lose connection to the satellite while it's looking for a new one. I've had limited success getting around that with **2 starlinks connected to a router**."
- u/rubrduk（score 2）："we have used starlinks for 10mb stream IP backhauls. **They fluctuate pretty wildly and have long ping times. You will need to add a couple seconds of FEC (we usually run 5 seconds....yes, seconds, not milliseconds)**"
- u/GrassFedDirector（score 1）："**NO!** ... **Now with that being said… I have 3 for this same reason. But I use them in an SD-WAN configuration mixed with 5G SA cellular modems and everything is bonded back to my office**"
- u/listen_jack（score 3）："**I haven't been able to get enough bandwidth up to support a 1080p60 stream using a mini.**"
- u/Greener1618（score 2）：2025 年用全尺寸 Starlink 跑 Facebook Live，"**Only dropped about 60 frames in the course of about 4 hours**"（720p30 1.5Mbps）

🔗 https://reddit.com/r/VIDEOENGINEERING/comments/1o6zmt2/ ｜ 2025-10-15，11 条评论

---

#### B3. ⭐ 双 Starlink 绑定的官方白皮书数据（LiveU）

**原文引用（u/INS4NIt 引用 LiveU 白皮书，2023-05-23）**：
> "**Bonding two Starlink terminals:** Some users have reported similar excellent bandwidth from bonding two Starlink terminals. **It appears that two terminals, even closely collocated, are not necessarily in sync in the "burst and recede" bandwidth discussed above. Thus, bonding two creates a stable stream of bandwidth by allowing one's peak to fill in the other's valley.**"

🔗 白皮书：https://get.liveu.tv/liveu-starlink/ ｜ 引自 https://reddit.com/r/VIDEOENGINEERING/comments/13ppng9/ （2023-05-23）

同帖还给出了 **SRT + 大 buffer** 的可行解，OP 实测：
> "OK, I'm currently testing **SRT to Castr (already had an account) with a 20000 msec (20 sec) buffer in vMix**... But after 20 minutes so far it *seems* to be working great. **VMix -> SRT -> Starlink -> Castr -> YouTube**"

---

#### B4. 装备横向对比：Teradek / Peplink / Cradlepoint / Speedify / OpenMPTCProuter（英文，48 条评论）

**帖：r/VIDEOENGINEERING「Is anyone else using network bonding devices? Currently trying the RGB Link Bond 6」**（2022-08-18，score 46）

- u/domesticatedprimate（**score 22**，自建方案）：
  > "**I rolled my own.** I bought a mini-pc kit, basically a heat sink with **6 discrete NICs and 4 USB ports**, and installed Linux and the **Speedify command line service**. I plug all my data/network devices into it for Speedify to use, or LAN if available... **It hasn't failed me yet.** And I can plug unlimited network connections into it: smartphones, mobile routers, dongles, LAN cables, anything."
- u/thisisausername67（**score 12**）：
  > "**PepLink routers are top notch with their SpeedFusion bonding technology.** ... Have a couple **Cradlepoints** as well but **they don't bond, they only load balance.**"
  > 关于 SpeedFusion 的三档调法："if you have 4 modems, you can **send the same data out all 4 modems simultaneously and it will piece together the first packets to arrive and discard the rest. Will use 4x your streaming bandwidth but will be an absolutely rock solid connection.**"
- u/misterflappypants（score 2，**给出了地区性实测数字**）：
  > "**PEPLINK. fuck. Wish I had discovered them 6-8 years earlier.** ... I've streamed for 2-3hours with **ZERO dropped frames at 7-8Mb/s** on single modems all day long. The **Peplink Max Transit Duo is the best deal under the sun at $1000-1200**"
  > "My use case scenario: **In Boston/New England, I have found ATT + Peplink to be supremely reliable and usually hovers between 25-45mb/s sustained upload speeds**"
- u/audible_narrator（score 5）："Im surprised you're using all ATT. **Usually they recommend combining 2 providers.** I use the **Cradlepoint** bonding router. It works great, but was a bitch to setup with a static IP address."
- u/DumbSkulled（score 1）："Using this too, specifically a **Cube 655 TX and a Bond. Only two connections a 1xVerizon & 1xAT&T.** They have been thankfully dumping a great deal of time into it w/ fixes/updates/features. **I have been using this since they rolled it out and it has gone from buggy/glitchy/droppy/I-am-going-somewhere-else to damn this works really well.**"
- **成本数据（u/jackajm, OP, score 3）**："**$1199 MSRP + modems ($60 each used) + Bonding cloud service which is $400/year and required.**"
- u/audible_narrator：Peplink SpeedFusion 定价坑——"there is a subscription cost for Peplink's speedfusion bonding and you need to run your own server or pay for their cloud service"
- u/finnjaeger1337（score 6）："I use both, **openmptcprouter on rutx routers** and at home and **speedify** for more compact solutions"

🔗 https://reddit.com/r/VIDEOENGINEERING/comments/wrhl5s/ ｜ 2022-08-18，48 条评论

---

#### B5. 户外音乐节 / 学校体育馆的临时网络（英文，r/networking）

**帖 1：r/networking「High density WiFi networking for a single event」**（2025-04-02，0 分但 28 条评论）
- u/giacomok（**专业活动网络公司 tournet.de**）：
  > "our Accesspoints cost **2-3k plus licenses each**. Depending on the venue size, you would need - minimum **5 enterprise high capacity APs (Ruckus R760, Arubas, Ciscos** or therelikes) - **1-2G Backbone** - A Router capable to serve **~80.000 concurrent connections** ... - **redundancy, because if the wifi stops working you won't raise money** ... **UPS, a secondary uplink, two routers, at least two switches**"
- u/Humpaaa（score 1）："**High density wifi at events is about as complex as it gets in networking.** You do NOT want to try this alone."
- u/asp174（score 1）："**Femto/pico cells in my country are often limited to ridiculously low subscriber counts like 16 or so. Since it's a non-profit, maybe you could go the sponsor route, where network operators sponsor a mobile cell for the event.**"
- u/Techie2Investor（score 1）："We do this every year for **Super Computing conference with Aruba 655 APs. Set them on tripods throughout the venue.** Works well"
- u/iMark77（长评论）：
  > "**You're probably going to be looking at bonding multiple cellular providers both for redundancy and speed.**"
  > "**If it's Wireless you're going to need to locate the unit somewhere where it's going to get good signal high up and away from everybody's cell phones so they don't steal it's service signal.**"
  > 真实翻车记录："**I found this out the night before the event in the park was going to happen.** ... I ended up with an access point travel router and hotspot... **it worked great until the battery died as I wasn't able to get it into the power outlet without a ladder.**"

🔗 https://reddit.com/r/networking/comments/1jpu23d/ ｜ 2025-04-02，28 条评论

---

#### B6. 中国 V2EX：野外无供电区域组网（中文，最接近的自建方案讨论）

**原文引用**（V2EX 帖 1108185）：
> "现在的预想方案是 **中兴 F50 之类的 5G 移动 wifi 插流量卡，接一个 openwrt 路由器组一个局域网**，移动 wifi 和路由器也用太阳能电池板供电，以上所有摄像头录像机接入这个小局域网。"

🔗 https://www.v2ex.com/t/1108185
⚠️ 这是**野外组网**不是场馆，但给出了国内常见的「**中兴 F50 + OpenWrt**」低成本组合，与场馆场景的设备选型同源。

---

### 场景 C：机器人比赛 · 电赛 · 黑客松（**这一节是本次调研里最「工程化」的证据**）

> ⚠️ **重要边界说明**：机器人赛事的网络痛点**不在「外网」，而在「场内 2.4/5GHz 射频干扰」**。多支队伍和官方文档都证实：**观众的手机热点本身就会打挂赛场控制链路**。这对「第零跳」是个关键提醒——你在场馆里增加的每一台无线设备，都在恶化别人的链路。

---

#### C1. ⭐ FRC（FIRST Robotics Competition）：手机热点把赛场打到重赛（英文，两帖共 126 条评论）

**帖 1：r/FRC「PSA: TURN OFF YOUR WIFI AND HOTSPOTS. YES, YOU.」**（2019-04-19，**score 368**，59 条评论）

OP u/BillfredL 原文：
> "You may have noticed some Championship fields having **a lot of replays**. A chunk of them are due to **high ping times, which come from crowded WiFi networks, which come from people thinking their one little GoPro or hotspot or whatever isn't going to hurt anything.** With six fields running together just at the competition fields (plus practice fields and FTC), **yes, it probably does hurt something. There just aren't enough non-overlapping channels for that.**"

**评论区关键证词**：
- u/CrispyBacon1999（score 7，**纠正了一个常见误解**）：
  > "**The field actually does run off the 5ghz bands to communicate with your robots. People assume otherwise and then use 5ghz for their hotspots thinking it'll make it clear but it has the opposite effect.**"
- u/LightSpeedIII（score 10）："The **open mesh router does both 2.4GHz and 5, but the FMS specifically uses 5GHz for robot communication, the 2.4 band is reserved for FTAs** for field monitoring on their phones/tablets"
- u/CardcaptorRLH85（score 30，**用频谱仪实测**）：
  > "**I ran my analyzer at the Michigan State Championship and I noticed an uptick of hidden SSID's after they started naming-and-shaming the SSID's of active hotspots.**"
- u/tracyfm（score 14，**实际损失**）：
  > "These replays are crap. We had to replay one form yesterday just now and **both of our alliance teammates robots were unresponsive. We dropped 11 spots!**"
- u/Feath3rblade（score 5）："At one point, my team was experiencing **100% packet loss and input latencies of over a second.** We could barely drive correctly."
- u/BlackoutIsHere（**score 19，最专业的一条，反驳了「禁热点」路线**）：
  > "There are so many 20 MHz wide 5GHz channels that interference should not be a huge issue. Yes hotspots and WiFi clients create traffic but 802.11 is designed to deal with that and those devices are not transmitting at a very high power. **The fact that I've never seen an FRC field using directional antennas is pretty disappointing to me. Using 802.11n instead of 802.11ac can't be helping as each new version of the 802.11 spec is designed for higher density.** ... **You can't build a system that relies on everyone else on earth disabling all electronic devices instead of planning for interference.**"
- u/pbfy0（score 5）："**Power doesn't matter. Unless it's low-power enough that you can't pick it up at all, it's high-power enough to interfere.** And even if it's low power enough that it won't be picked up, it still contributes to noise, which contributes to dropped packets"
- u/DO-178C（**score 90**，最高赞，现实主义）：
  > "I would love to bring a network analyzer and see what all is out there. From an old person in industry: *"Wish in one hand, shit in the other."* **My advice would be to figure out how to deal with crowded Wifi networks and slow pings over trying to get a bunch of teenagers to do the same.**"

🔗 https://reddit.com/r/FRC/comments/bezu5y/ ｜ 2019-04-19，**score 368**，59 条评论

**帖 2：r/FRC「Don't be these people, don't turn on hotspots while at competition」**（2019-09-14，**score 352**，67 条评论）
- u/hgriswold89（score 46）："**FIRST either needs to move away from Wireless or needs to figure out how to enforce zero hotspots. If it would take down hotspots, I'll volunteer to scan for them at the events I attend.**"
- u/yottalogical（score 10）："**The problem of hotspots comes from direct interference on the radio bands that WiFi uses, which can cause connectivity problems with the robots.**"
- u/tenten8401（score 33）："What they need to do is just **switch to a different band for controlling the robots, like 900mhz using the inexpensive LoRa radios**, that way you can have as much wifi interference as you want and it wouldn't affect the competition."

🔗 https://reddit.com/r/FRC/comments/d454ru/ ｜ 2019-09-14，**score 352**，67 条评论

---

#### C2. FIRST 官方立场：2.4GHz **和** 5GHz 热点都会干扰赛场管理网（英文，2026）

**原文引用（Chief Delphi，2026-04-13）**：
> "**2.4GHz and 5GHz wireless networks also interfere with the admin network used by Volunteers and Staff on the field. TL,DR: Yes, and regardless, 802.11a/b/g/n/ac/ax/be networks are disallowed by E301.**"

🔗 https://www.chiefdelphi.com/t/do-wifi-hotspots-interfere-with-field-communications/518476 ｜ 2026-04-13

**FIRST 的应对做法（官方 Wi-Fi Event Planning Guide）**：
> "This document offers some basic suggestions on how to prepare for and support the wireless control system at any FIRST Tech Challenge competition."
> 🔗 https://ftc-resources.firstinspires.org/ftc/event/wi-fi-guide

---

#### C3. FTC 社区：场地干扰导致机器人失控（英文，2024-01-14）

**原文引用**：
> "We had a meet today, and **there was a lot of interference. We had several times when our robot went out of control in teleop, which doesn't happen when we practice.**"

🔗 https://ftc-community.firstinspires.org/t/remote-control-goes-haywire-at-meets-with-lots-of-interference/945 ｜ 2024-01-14

**另一个 FIRST 生态的同类报告（xrp.discourse.group，2025-06-17）**：
> "During all these workshops and competitions, the common constraint has been **robots and controllers losing WiFi Connectivity. The ultimate problem seems to be the 2.4GHz frequency that the robots operate on.**"

🔗 https://xrp.discourse.group/t/wifi-connectivity-issues-when-running-competitions/787 ｜ 2025-06-17

---

#### C4. ⭐ RoboMaster：官方文档明确「只支持 2.4G」+ 明确的「别用无线」建议（中文，官方一手）

**来源 1：《RoboMaster 赛事引擎联网操作手册》，RoboMaster 组委会编制，2024 年 7 月发布**

**原文引用（P4，基础配置指引 方案1）**：
> "使用 **2.4G（裁判系统局域网只支持 2.4G）** 带 WAN 口以及 LAN 口的无线路由器（**可以使用家用路由器**）。将可访问互联网的端口网线插入 WAN 口。将路由器 IP 设置为 **192.168.1.1**，SSID 自定义，**密码设置为 12345678**，加密方式选择 **WPA2**，开启 DHCP 功能。"

**原文引用（P4，注意事项）**：
> "**不建议使用无线方式连接裁判端主机与无线路由器，可能存在信号干扰。**"

**方案 2：双网卡方案**（P4-P9）——推荐「**一张网卡走局域网（有线，192.168.1.2），一张网卡走广域网（WiFi 或有线）**」，若互联网不可用需手动设置**接口跃点数：局域网网卡 20，外网网卡 10**。

🔗 PDF: https://rm-static.djicdn.com/tem/70482/RoboMaster%E8%B5%9B%E4%BA%8B%E5%BC%95%E6%93%8E%E8%81%94%E7%BD%91%E6%93%8D%E4%BD%9C%E6%89%8B%E5%86%8C.pdf

**来源 2：《RoboMaster 裁判系统》官方手册**

> "使用一个 **2.4G（裁判系统只支持 2.4G）** 带 LAN 口的无线 AP（**可以使用家用路由器**）。将其 IP 设置成 **192.168.1.1**，SSID 自定义，密码设置成 **12345678**，加密方式选择 WPA2，开启 DHCP"

🔗 PDF: https://cdn-hz.robomaster.com/tem/f8e6e17215ba41516766718085138567.pdf

**来源 3：RoboMaster 2023 新增「冗余链路」公告**（组委会 2023-05-16）
> "相机图传模块（发送端）的安装位置不受限制，**为了保证图传和冗余链路正常工作**，其他安装要求同《RoboMaster 2023 机甲大师高校系列赛机器人制作规范手册》的'3.9.2 安装要求'"

🔗 https://www.robomaster.com/zh-CN/resource/pages/announcement/1598 ｜ 2023-05-16
💡 这说明 **D 大疆自己也知道单链路图传不可靠，2023 赛季就加了「冗余链路」**。

---

#### C5. RoboMaster 社区：队伍实战经验帖（中文）

- **《【分享帖】比赛常见问题解决办法》**（bbs.robomaster.com/article/904）
  > "1) 电脑显示 connecting，但是无图像，说明接收机工作正常，这时问题在发射端（战车）"
- **《老图传使用经验》**（bbs.robomaster.com/article/812950，2025-10-04）
  > "叠甲 这里说的 VT02&VT12 老图传 写这个文档在目的是为了解决有些新队伍第一次接触裁判系统可能会因为文件过多无从下手导致老图传不太会使用"
- **CSDN《RoboMaster备赛避坑指南：裁判系统服务器搭建中常见的5个网络与MySQL问题》**（2026-04-19）
  > "从**双频路由器配置**到 MySQL 连接失败排查，再到数据同步优化和环境隔离，帮助参赛团队快速搭建稳定服务器环境，**将搭建时间从 8 小时缩短至 30 分钟**内"
  🔗 https://blog.csdn.net/weixin_42531710/article/details/160304117
  ⚠️ CSDN 长文，有 AI 生成嫌疑，但提到的问题域（双频路由器、MySQL）与官方手册一致。

- **RM2026 雷达站无线链路（GitHub，港科大广州）**：
  > "RM2026 Wireless Link 是 RoboMaster 2026 雷达站无线链路解析模块，用于接收**官方空口干扰波和信息波**，解析干扰密钥、机器人坐标、血量、经济、剩余发弹量等信息"
  🔗 https://github.com/PnX-HKUSTGZ/RoboMaster-2026-Radar-Wireless
  💡 **官方在赛场主动发射「干扰波」** —— 这是赛事本身的对抗机制，不是外网问题，但佐证了赛场是个极恶劣的射频环境。

---

#### C6. 电赛（全国大学生电子设计竞赛）：**没找到**场地网络实战帖

**明确说明：这一块证据薄弱。**

- 搜索到的电赛内容都是**题目/备赛/获奖**类，没有「现场网络方案」的实战帖。
- 唯一相关的一条，是**评测阶段根本不给网络**：
  > "评测时间，一般是上午 8 点开始，下午 3 点结束，中间无休息时间**采用的是全封闭的评测方式，包括现场无网络，并且不能使用手机等电子设备**"
  > 🔗 https://wiki.lckfb.com/zh-hans/lspi/competition/competition-guide.html ｜ 2024-08-27
- 换句话说，**电赛不存在「现场保网络」的问题，因为现场就不让联网**。这与「第零跳」需求不匹配。
- 中文「电赛 4G 模块 信号差」类搜索只返回 4G 模块的**RSSI 通用阈值表**（-90dBm 为临界点），无场景实战。

---

#### C7. 黑客松：**没找到**有价值的实战帖

搜索 `hackathon venue wifi died cellular hotspot backup` 只返回了**通用**的备用网络讨论（r/firewalla 的 cellular backup modem、eero Internet Backup 等），**没有一条是黑客松现场的第一手复盘**。明确判定为 **没找到**。

---

### 场景 D：应急通信（消防/救援/便携基站）

> ⚠️ **这一节整体证据最弱**。中文「消防 应急通信 便携站 实战」类搜索**多次返回空结果**（tinyfish 返回 `total_results: 0`）。以下是我能拿到的最好材料，其中只有一条是现场实战。

---

#### D1. ⭐ Reddit 从业者一手：灾难响应中的运营商韧性差异（英文，最硬的一条）

u/Sane-FloridaMan（**score 12**，2026-08-11，r/USMobile）：
> "**I live in Florida and work with disaster response. And i can tell you that the carriers have very different resilience capabilities on a per-tower basis.**"
> "...it's important to note that it is very common for **tenants on a tower to have completely different power infrastructure. Both the feeds from the grid and backup capabilities. The generators (if they exist) are not shared. So you can have three tenants on a tower, with different battery backup capacities and only one carrier with a generator.**"

**同一条评论里关于 DAS 的「时间胶囊」机制（对「第零跳」选址极关键）**：
> "**indoor coverage in large commercial buildings is often dependent upon BDA/DAS systems installed in the building. If you've been in a hotel, convention center, mall, or large retail building where the carriers had similar outdoor performance, but it is vastly different indoors - this is the reason. This is where Verizon wins hands-down. DAS systems are not universal. You must install the appropriate equipment for each carrier and band you want to amplify. And depending upon when the DAS was installed, specific bands may not have been in use by the carriers or the band could not be used with the repeater. ... But most DAS systems are like time capsules. They are installed and left alone - not upgraded as new bands are available.**"
> "Also, to clarify backhaul... **it would be very rare for them to share the actual connection**... **It is possible for a fiber outage to cause an outage for multiple cellular carriers because a fiber cut impacts all the fiber in that path**"
> "...it is extremely common in populated areas for the carriers to **diversify their fiber** coming into a tower... a fiber cut would reduce capacity, but not completely being down service."

🔗 https://reddit.com/r/USMobile/comments/1vlhb7c/ ｜ 2026-08-11

---

#### D2. Cell on Wheels (COW) 的实战局限 —— 运营商内部人视角（英文）

u/Logvin（自称 T-Mobile 侧，**score 11**，2015-08-10）：
> "In my experience, **most stadiums are on DAS systems. They like to charge extraordinary amounts... Like let's say $5M to get on their DAS. If tmobile were to build it themselves it would be 2M, so we say no. We would love to be everywhere, but you can't go paying ransoms.**"
> "**Cell On Wheels. Basically a mobile cell tower. We rarely use them for big stadium events, more for outdoor concerts and festivals.**"
> "**Because the stadium controls what equipment goes in, so they control who does what. A stadium DAS has many antennas... Upwards of 30 in an NFL stadium. A tower across the street is why your data speeds suck ;)**"
> "UoP stadium, where the last superbowl was, had both an internal AND an external DAS to cover both areas. **All 4 carriers participated, and there was over 100+ antennas just INSIDE the stadium.**"

u/reedacus25（score 2，**COW 反而帮倒忙的实测**）：
> "In New Orleans T-Mobile will use COWs for Jazz Fest and VooDoo Fest. **However at Jazz Fest this year it actually did almost more harm than good. COW was a single sector, and even though the market was 10 MHz wide now, it was underwater immediately for capacity. Couple that with it creating pilot pollution, thus not allowing neighboring macro cells pick up some of the slack, it led me to having a nice expensive clock in my pocket.** Hoping they can start doing multi-sector COWs with narrow beam widths..."

u/blaziecat1103（score 3）："**Michigan Stadium has some sort of distributed antenna system, but it can't handle everyone. Neither can Verizon's COWs.**"

🔗 https://reddit.com/r/tmobile/comments/3ggdcp/ ｜ 2015-08-10，58 条评论

---

#### D3. FirstNet 可部署资产（美国公共安全专网，官方一手）

- **FirstNet Deployables 官方页**："FirstNet deployables boost coverage in the aftermath of disasters, during large planned events or incidents, or in remote areas"
  🔗 https://firstnet.gov/network/TT/deployables ｜ 距今 6 天更新
- **FirstNet Mobile Connectivity Hub**："**portable cell tower. Rugged, satellite-ready and built for any emergency, this asset covers 12 square miles**"
  🔗 https://www.firstnet.com/coverage/deployables.html
- **AT&T 车队规模**："This dedicated fleet includes **190+ portable cell sites** that can be positioned to help enhance connectivity during natural disasters, emergency"
  🔗 https://www.attconnects.com/stories/keeping-first-responders-connected-firstnet-showcases-emergency-connectivity-solutions-in-georgia/ ｜ 2026-05-20
- **实战部署记录**：2022-03-18 Cranford（NJ）警局在模拟全域蜂窝中断演练中调用 FirstNet，部署了一台 **satCOLT**（卫星回传 Cell on Light Truck）
  🔗 https://www.facebook.com/CranfordPD/posts/... ｜ 2022-03-18

**关键洞察**：应急通信的正解是「**satCOLT / CRD 这类把基站搬到现场**」，而不是「用一堆 CPE 抢公网」。**这跟会展场景的结论方向相反** —— 应急场景有权限「自己建基站」，会展场景没有。

---

#### D4. Hurricane Melissa 后的 Starlink（英文，2026）

> "The company continues to have **Starlink terminals at cell sites as a backup solution**. Starlink's **direct-to-cell** service also helped get individual Jamaicans online."

🔗 https://www.pcmag.com/news/how-starlink-helped-get-jamaica-back-online-after-hurricane-melissa ｜ 距今约 4 天

---

## 二、⭐ 多运营商 / 同场馆实测对比（单列一节）

### 2.1 中国：具体场馆 + 具体运营商 + 具体数字

| # | 场馆 | 运营商 | 实测数字 | 时间 | 链接 / 出处 |
|---|---|---|---|---|---|
| **CN-1** | **南通体育会展中心**（容量 3.2 万观众） | **中国移动江苏南通分公司** | **5G 下行平均 677.43 Mbps、上行 388.88 Mbps**；接通率 **99.86%**、掉线率 **0.01%**；单小时最高承载 **14,960 人**；上行峰值 **>500 Mbps**；小区扩容至 **60 个**，容量 **+40%** | **2026-07-24** | [CCTIME 飞象网](http://www.cctime.com/html/2026-7-24/1739692.htm) |
| **CN-2** | **国家体育场「鸟巢」（北京）** | **中国联通**（对比：中国移动） | **联通：n78+n78+n1 三载波聚合（3CC），但 SINR 太低，速度只有 500Mbps**；**移动：只有 N79，速度一般** | **2025-09-27** | [通信人家园 tid=1405669](https://www.txrjy.com/forum.php?mod=viewthread&tid=1405669) |
| **CN-3** | **北京新工体（工人体育场）** | **北京联通 + 华为**（5G-A 3CC） | **CPE 下行峰值 11.2 Gbps，上行峰值 4 Gbps；手机现网下行峰值 9 Gbps 以上** | **2024-11-21** | [36氪](https://m.36kr.com/p/3045911267478146) ／ [新浪](https://news.sina.com.cn/sx/2024-11-27/detail-incxnrzn6805444.shtml) |
| **CN-4** | **贵州贵阳（凤凰传奇演唱会）** | **中国移动贵州** | **实测下行峰值 3.69 Gbps，上行突破 355 Mbps**，较普通 5G 提升 **200%+**；新建 **25 个 5G 基站** + 车载应急通信系统 | 2025-2026 | [知乎](https://zhuanlan.zhihu.com/p/1983919435493447554) |
| **CN-5** | **石家庄某音乐节** | **中国移动** | 下载峰值 **>3 Gbps**；高峰期单用户速率 **稳定在 300 Mbps 以上**；关键业务时延 **<20 ms**；**铺设 12 公里专用光缆** | 2025-2026 | 同上 |
| **CN-6** | **惠州（邓紫棋演唱会）** | **中国移动惠州** | **场馆内新增 4G/5G 设备 78 个，扩容 4G 小区 169 个、5G 小区 61 个，可承载 3 万用户同时上网** | 2025-2026 | 同上 |
| **CN-7** | **烟台（邓紫棋演唱会）** | **中国移动烟台** | **新增 4/5G 设备 60 台，扩容 152 个小区**，应对 3 万人通信压力 | 2025-2026 | 同上 |
| **CN-8** | **宿迁（「声声回响」演唱会）** | **中国移动宿迁** | 内场及看台区**紧急扩容周边基站 + 新增应急通信车和微型基站，核心区域网络容量翻倍** | 2025-2026 | 同上 |

#### ⚠️ 关于 CN-1 的重要解读（本次调研的核心冲突点）

**南通移动在 3.2 万人场馆里做到了上行 388.88 Mbps 平均、掉线率 0.01%** —— 这**直接反驳**了英文社区「场馆蜂窝必然崩」的绝对论。

它的做法值得逐条拆解（**这才是「第零跳」的可复制配方**）：
1. **频率组网**：`2.6G 异频 + 4.9G 同频双载波 + 3.7G 应急扩容` 三层架构
2. **4.9G 窄波束矩形波天线** 精准覆盖（不去覆盖不该覆盖的地方）
3. **⭐ 干扰治理：低成本 AAU 旁瓣物理遮蔽方案 —— 泡沫板 + 锡箔刚性遮挡装置，突出天线 30cm 阻断旁瓣干扰路径，场馆底层看台干扰降低 2.5 dB**
4. **⭐ 上行 2CC 特性 + 动态调整 4.9G 时隙配比 → 上行峰值突破 500Mbps，4.9G 上行流量占比提升 32 个百分点**
5. **潮汐式分阶段调控**：划分进场/观赛/退场六大运维阶段，动态调节场外宏站功率，场内外负载联动均衡

> 💡 **可迁移的一课**：场馆上下行能力的瓶颈**不在频谱总量，而在同频干扰与上行时隙配比**。「物理遮蔽旁瓣」这种几十块钱的做法，比多插几张 SIM 卡有效得多。这套是**运营商侧**的手段，跟「自己带一堆 CPE」完全不是一条路。

#### 关于「鸟巢」那条的解读（CN-2）

**极有价值的一个反例**：联通在鸟巢是 **3CC 三载波聚合（n78+n78+n1）**，理论能力最强，**但实测只有 500Mbps**，发帖人自己归因：**"不过 sinr 太低"**。评论区 u/ddxxzz 也指出：
> "手动修改配置文件解锁的 CA 组合，与运营商商用配置可能存在 **PCI 冲突或功率控制差异**。"

而**移动在鸟巢只有 N79，速度一般不**。这说明：**「谁家的载波聚合能力更强」与「你在场馆里实际能跑多快」是两码事**，干扰（SINR）才是决定性的。

---

### 2.2 美国：具体场馆 + 具体运营商

| # | 场馆 | 运营商 | 结论 / 数字 | 时间 | 出处 |
|---|---|---|---|---|---|
| **US-1** | **Las Vegas Convention Center (LVCC)** | **Verizon 5G Business Internet** | **成功**。原话："I had success with Verizon 5G business internet at LVCC, but if the signal strength inside the convention center is poor you're in for a bad time." | 2025-12-12 | [u/ehhthing, r/sysadmin](https://reddit.com/comments/1pkamzw) |
| **US-2** | **LVCC** | **Neutral Host DAS（全运营商）** | "**LVCC uses a neutral host DAS for cell coverage. You will likely get better cell service in the convention center during the event than what you would get outside.** QCI is still a factor, but the DAS is generally very hard to saturate to the point where anyone is deprioritized." | 2025-09-30 | [u/alttabbins, r/USMobile](https://reddit.com/comments/1niymvb) |
| **US-3** | **Box Fan Expo, Las Vegas**（拳赛配套） | **AT&T（经 US Mobile Dark Star）+ QCI-7**；备用 T-Mobile（Light Speed） | **成功**。全程零卡顿，VR 在线对战 + YouTube 直播均正常；备用 T-Mobile 从未启用 | **2025-09-17** | [Halfbrick Studios, r/USMobile](https://reddit.com/comments/1niymvb) |
| **US-4** | **某经常去的场馆（未点名）** | **Verizon vs 其他两家** | "**At one venue I do stuff at regularly, Verizon works just fine on the floor, the others not so much.**" | 2025-12-12 | [u/meballard, r/sysadmin](https://reddit.com/comments/1pkamzw) |
| **US-5** | **Red Bull Arena, Harrison, NJ**（23,000 人） | **T-Mobile** | **失败**。OP："Congestion at the stadium :( **couldn't send a text!**"；另有评论："even if we draw 18k the signal isn't much better" | **2015-08-10** | [r/tmobile](https://reddit.com/comments/3ggdcp) |
| **US-6** | **Michigan Stadium（Big House）** | **Verizon** | **失败**。"**Most game days on Verizon I would get 5 bars and never once was able to make a call.** ... As soon as LTE became more prevalent, it became impossible." 另一人："**Michigan Stadium has some sort of DAS, but it can't handle everyone. Neither can Verizon's COWs.**" | 2015-08-10 | 同上 |
| **US-7** | **Sports Authority Field / Busch Stadium** | **Verizon / T-Mobile** | "I deal with this at every Bronco game I go to at Sports Authority field, **with a full LTE signal**." ／ "I get the same at Busch Stadium." | 2015-08-10 | 同上 |
| **US-8** | **Disneyland (Anaheim)** | **Verizon / T-Mobile / AT&T** | **Verizon**：n77 DAS 于 2024-12 部署，140-160 MHz；**T-Mobile**：仍是老的 b2/b66 DAS，"quite slow"，n41 DAS 在升级中（园区内大多收不到 n41）；**AT&T**：n77 DAS 计划 2025-04 部署。**实测证词（u/stormageddon55, 2025-01）**："I went this past November using US Mobile Darkstar (AT&T MVNO) and T-Mobile (Magenta Postpaid). **For real world usage I did not have a single problem on AT&T**... **T-Mobile seemed to be rather slow/congested, and I lost signal in a lot of ride queues.**" | 2025-01-11 | [r/cellmapper](https://reddit.com/comments/1hz3dhz) |
| **US-9** | **Austin（SXSW / ACL / EDC NYC / Jazz Fest）** | **多运营商通用经验** | "**I use this trick in Austin during SXSW and ACL**"（把手机强制降到 3G/2G）；"**Even 3G is unusable at ACL these days.**" ／ "I went to EDC NYC this year and the data speeds sucked really hard. It was outside in the parking lot of MetLife..." | 2015-08-10 | [r/tmobile](https://reddit.com/comments/3ggdcp) |

---

### 2.3 ⭐ 跨场馆的通用结论（多家社区交叉验证）

**1. 「同一场馆不同运营商差异巨大」的原因排序（按证据强度）**：

| 原因 | 证据 | 可预测性 |
|---|---|---|
| **DAS 里有没有你这个频段**（最强） | u/Sane-FloridaMan："DAS systems are like time capsules... not upgraded as new bands are available" + Disneyland 案例（Verizon n77 有，T-Mobile 只有老 b2/b66） | 差（需现场测） |
| **DAS 是不是 neutral host** | LVCC 是 neutral host DAS → 全场馆都好；多数场馆不是 | 需查场馆资料 |
| **QCI / 优先级** | Halfbrick 案例：QCI-7 = "cheat code" | **可控（可买）** |
| **你的号是不是被降级（MVNO / 二级运营商）** | u/ultimatehonky："I use QCI-7 on AT&T Turbo, its no joke, speeds are top notch" | **可控** |
| **频段穿透差异（低频 vs 中频）** | u/Sane-FloridaMan：Verizon 靠 700MHz，AT&T 有 850 + 700(FirstNet)，T-Mobile 有 600 | 可查 |
| **基站是否共站/共回传** | u/auq78 主张共站共回传；被 u/Sane-FloridaMan 反驳："**it would be very rare for them to share the actual connection**" | — |

**2. 「场馆内信号满格但上不了网」的机制解释（u/Sane-FloridaMan）**：
> "Most phones will stay on an LTE connection if they have good reception, despite the actual throughput being bad. **If you drop to 3G or sometimes 2G you'll find that it's much more usable.**"（u/dcdttu）
>
> 多条独立证词都推荐**主动锁 4G / 关 5G**：
> - r/comiccon："**switching off the 5G capabilities of my phone can speed up texts immensely.** By using the 'slower' connection, there's less traffic and higher overall speeds. **It's basically getting on the access road when the interstate is at a complete stop.**"（u/MommaChem, 2024-12-31）
> - "**I've disabled 5G so I can actually switch towers even in crowded areas. As long as there is a carrier wave detectable on 5G, no matter how weak it is, your phone will refuse to seek better signal or switch to 4G.**"（u/RevCyberTrucker2, 2025-01-01）
> - 中文侧同结论：赛车星冰乐"**强制把手机限制在 4G 可能在展会时候是最佳方案**"（2026-04-24）
>
> 🔗 https://reddit.com/r/comiccon/comments/1hqkul3/ ｜ 2024-12-31

**3. 场馆方是不是故意卡你（争议）**：
- 主张：u/randommonster："**most convention centers have small LTE pico routers to intercept and allow only limited voice traffic inside the buildings**"
- 反驳（更可信）：u/Serialtorrenter（score 12）："**Wouldn't interfering with a licensed cellular data service be highly illegal in most jurisdictions?** The licensed LTE picocells I've seen, which are distributed by carriers all establish an IPsec tunnel with the carrier, and I don't think you could selectively block them from outputting data without also blocking voice."
- 折中：u/LokeCanada（score 5）："**The phone company is probably leasing space from the convention centre. They can limit it at the source which is not legal [sic] issue. That can be part of the lease.**"
- 🔗 https://reddit.com/r/sysadmin/comments/1pkamzw/

---

## 三、设备 / 方案清单（按证据强度排序）

| 方案 | 型号 | 证据等级 | 关键数字 | 来源 |
|---|---|---|---|---|
| **场馆有线专线** | 任意 | ⭐⭐⭐⭐⭐ | $800/周末/3Mbps（美国）；上海国展 4M 专线 | r/sysadmin ×2 大帖共识 |
| **QCI-7 优先级 SIM** | US Mobile Dark Star / AT&T Turbo | ⭐⭐⭐⭐ | LVCC 全程零问题 | [Halfbrick 案例](https://reddit.com/comments/1niymvb) |
| **5G 网络切片** | Vodafone UK | ⭐⭐⭐⭐ | **£2500/slice** | [Vodafone 案例](https://www.vodafone.co.uk/business/case-studies/vodafone-itn-5g-network-slicing-at-coronation) |
| **视频专用聚合编码器** | **LiveU LU800**（11 路带宽源，5 家运营商）/ LU600 / LU300；**TVU One**；**Dejero EnGo 260**；**Haivision Falkon/Pro** | ⭐⭐⭐⭐⭐ | LU800 = 8 内置 modem + 3 Starlink | r/VIDEOENGINEERING 多条 |
| **通用聚合路由器** | **Peplink** Max HD4 / Max Transit Duo / Balance 30 / BR Pro 5G；**Cradlepoint**（只负载均衡不 bond）；**Teradek Link Pro / Cube 655 + Bond**；**RGB Link Bond 6** | ⭐⭐⭐⭐ | Peplink Max Transit Duo **$1000-1200**；Boston 地区 **AT&T + Peplink 稳定 25-45 mb/s 上行**；RGB Link Bond 6 **$1199 + $400/年云服务** | [r/VIDEOENGINEERING](https://reddit.com/comments/wrhl5s) |
| **软件聚合** | **Speedify**（Linux CLI）/ **OpenMPTCProuter** | ⭐⭐⭐⭐ | 自建 mini-PC（6 NIC + 4 USB）"**hasn't failed me yet**" | [r/VIDEOENGINEERING](https://reddit.com/comments/wrhl5s) |
| **国产多卡聚合** | 方为 Z5（9路）/C7（11路1U）/T3（6路）；壹唯视 UR100；乾元通 QYT-X1S；TVU One；美乐威 Pro Router One 5G（10路） | ⭐⭐（多为厂商软文） | Z5 实测聚合带宽 400Mbps+（厂商自报） | [中华网](https://mtz.china.com/touzi/2026/0709/247721.html)、[美乐威](https://www.magewell.cn/case-studies/61/detail) |
| **Starlink** | Mini / 标准版 / 高性能版 | ⭐⭐⭐⭐ | Mini **跑不动 1080p60**；标准版 720p30 4 小时丢 60 帧；**FEC 需 5 秒 buffer**；**双 Starlink 绑定可互补** | [r/VIDEOENGINEERING](https://reddit.com/comments/1o6zmt2) |
| **CPE（单卡）** | 5G CPE / 随身 WiFi（中兴 F50 等） | ⭐⭐ | 单链路，场馆内基本必翻车 | 中文×多条 |

---

## 四、明确「没找到」的部分

| 主题 | 状态 | 说明 |
|---|---|---|
| **电赛（全国大学生电子设计竞赛）现场网络实战帖** | ❌ **没找到** | 电赛现场**全封闭无网络、禁用手机**（[wiki.lckfb.com](https://wiki.lckfb.com/zh-hans/lspi/competition/competition-guide.html)），场景不匹配 |
| **黑客松现场蜂窝备用实战帖** | ❌ **没找到** | 搜索仅返回通用的「home backup internet」讨论，无第一手黑客松复盘 |
| **中文「消防/救援便携基站」实战复盘** | ❌ **基本没找到** | 中文搜索多次返回 `total_results: 0`。仅拿到 FirstNet（美国）官方材料 |
| **B站视频字幕** | ⚠️ **未完成** | 搜索未命中与「场馆保网络」直接相关的 B 站视频（`site:bilibili.com` 检索被 LPL/电竞内容污染）。yt-dlp 与 uvx yt-dlp 已就绪（v2026.08.19），但**没有值得拉字幕的目标视频** |
| **V2EX 关于「展会/演唱会保网」的专门讨论** | ❌ **没找到** | V2EX 只找到野外组网帖 [t/1108185](https://www.v2ex.com/t/1108185) |
| **Chiphell 相关帖** | ❌ **没找到** | 未命中 |
| **「XX会展中心 三大运营商 实测」这类同场馆三网横评** | ⚠️ **只拿到部分** | 中国：鸟巢（联通 3CC vs 移动 N79）、南通体育会展中心（仅移动）；美国：LVCC（Verizon 成功 + neutral host DAS）、Disneyland（三网对比）。**没有找到「上海国家会展中心三网横评」或「深圳国际会展中心三网横评」的第一手帖** |

---

## 五、给「第零跳」的循证建议（基于以上证据）

**这 8 条每一条都有上面的原文支撑：**

1. **场馆方有线专线必须作为主链路**，蜂窝只能做备份。这是 10 年来跨 4 个社区、20+ 条独立证词的唯一共识。**别赌「C 餐」级有线质量，直接买场馆方的最高档。**
2. **蜂窝侧不要用单卡**。最少 **3 家运营商各一张**（u/MRNETbyMotionRay："you need three carriers. Two won't cut it"）。
3. **不要指望通用聚合路由器能救直播**。Peplink/Cradlepoint 是**负载均衡**，单个视频流仍只走一条链路。要么上 **LiveU/TVU/Dejero/Haivision** 这类**视频专用协议**（分包 + FEC + 自适应码率），要么用 **SRT + 大 buffer（20s）+ 云端 relay** 自己搭。
4. **优先级（QCI）/ 网络切片 > 多插卡**。会场里你的对手不是"信号弱"，而是"被降级"。这是 Halfbrick 案例的唯一差异变量。
5. **天线要能选扇区**。u/davehenk："**High-gain antennas can backfire if they're locked onto a saturated sector**"。用 `surfscan.app` 一类工具先扫哪个运营商/频段最好。
6. **提前一天（布展/彩排期）做完整网络验收，并把它写成「再测一次」的流程**。u/meballard："**You also can't really test in advance** - you might be just fine during setup, but as soon as the crowds are there things can change quickly."
7. **协议层面：RTMP 换 SRT，码率要能动态降**。RTMP/TCP 仅容忍 <2% 丢包、<30ms 抖动。
8. **⚠️ 别在场内开 Wi-Fi 热点**。FRC 社区用**频谱仪实测**证明观众热点会打挂赛场控制链路（Michigan 州赛隐藏 SSID 激增）；RoboMaster 官方手册也明说「**不建议使用无线方式连接裁判端主机与无线路由器，可能存在信号干扰**」。你自己的 AP 就是下一个别人的故障源。

---

## 六、方法与可达性备注（供复现）

| 站点 | 直连 | 可用路径 |
|---|---|---|
| reddit.com | ❌ 403 | ✅ **api.pullpush.io**（`/reddit/search/submission/?ids=<id>` + `/reddit/search/comment/?link_id=<id>&size=100`，可拿全帖含分数与时间戳） |
| safereddit.com | ❌ Anubis PoW 挡 | — |
| redlib 全实例（privacyredirect / catsarch / artemislena …） | ❌ Anubis / 429 | — |
| md.succ.ai | — | ✅ 可拿 Reddit **仅 OP 正文**，不含评论 |
| zhihu.com | ❌ 403 | ✅ **md.succ.ai**（`https://md.succ.ai/https://zhuanlan.zhihu.com/p/...`） |
| txrjy.com（通信人家园） | ✅ | ⚠️ **GBK 编码**，需 gb18030 解码；用 `?action=printable` 参数可拿全文 |
| r.jina.ai | ❌ 401（AS30058 被 block） | — |
| old.reddit.com | ❌ 403 | — |
| bbs.robomaster.com / rm-static.djicdn.com | ✅ | PDF 用 `pdftotext` |

**抓取统计**：Reddit 完整帖 **28 个**（含评论 700+ 条，全部带 score + UTC 时间戳）；中文页面 **12 个**；官方 PDF **2 份**（RoboMaster 联网手册 13 页 + 裁判系统手册）。

