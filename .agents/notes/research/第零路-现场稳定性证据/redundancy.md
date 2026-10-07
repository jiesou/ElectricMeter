# 赛事现场蜂窝「第零跳」冗余与兜底架构调研

> 场景：会展中心/体育馆，人群密集，蜂窝网络拥塞。要架一路极其稳定的蜂窝外网接入当「第零跳」，后面接自己的交换机/服务器。
> 调研范围：双 CPE + 双 WAN 路由器、手机热点/USB 4G 兜底、多链路聚合、卫星最后手段、公网可达性。
> 调研时间：2026-10（所有引文与链接均标注原始页面时间）

---

## 0. 最重要的三条结论（先看这个）

### ① 除「包级聚合隧道」外，**没有任何多 WAN 方案能让已建立的 TCP 长连接不断**

这是全篇最硬的结论，中英文证据完全一致。原因是 netfilter conntrack：一条已建立的连接在 NAT 表里被钉死在某个 WAN 的出接口 + 源 IP 上，路由表换了它也不会迁移。

- OpenWrt 论坛实测（2023-05-31），用户拔掉主 WAN 的同轴电缆，PC 上持续 ping 8.8.8.8：

  > `Request timeout for icmp_seq 25` … 一直到 `icmp_seq 50`，全部超时，
  > `51 packets transmitted, 25 packets received, 51.0% packet loss`
  > 「I kill the ping session … Now I restart the ping session … the restarted ping session is now going via the backup WAN_FAILOVER (eth0)」——**必须杀掉连接重建，才会切到备用 WAN**（延迟从 11ms 变 35ms 可证）。
  > 链接：https://forum.openwrt.org/t/multiwan-with-mwan3-in-22-03-5-not-working-properly/161784

- OpenWrt GitHub issue #24973（2024-09-15，双 4G 模块 Teltonika RUTX12，**至今 OPEN**）：

  > 「once we start the application on our computer and it establishes a TCP connection with the cloud server through one of the interfaces **it will continue to use that interface even after the interface has been disconnected**.」
  > 用户已配 `list flush_conntrack 'disconnected'`，**「but this does not resolve the issue」**。
  > 链接：https://github.com/openwrt/packages/issues/24973

- MikroTik 官方论坛，资深用户 sindy（2022-09-18）：

  > 「if you run a continuous ping from the LAN side, it keeps updating the existing tracked connection so the packets keep getting translated to the IP address of the dead WAN **until you either stop pinging or remove that connection**」
  > 链接：https://forum.mikrotik.com/t/most-effective-failover/160877

- 行业厂商 Waveform 的 multi-WAN 指南（2026-03）说得很直白：

  > 「Why do VPNs and online games drop during failover? **Because those sessions are tied to the public IP they started on.** Cold failover changes the IP, and the remote server treats the session as broken.」
  > 「Most products that advertise "automatic failover" are cold failover. The word "automatic" does not mean your sessions survive - it just means you do not have to flip a switch manually.」
  > 链接：https://www.waveform.com/guides/multi-wan-guide
  > ⚠️ 注意：Waveform 是 SpeedFusion 托管服务销售方，存在利益倾向；但此条与上述开源社区实测完全吻合，可交叉验证。

**对本场景的含义**：双 CPE + 双 WAN 路由 = **故障时业务会断，客户端必须重连**。如果第零跳上跑的是长连接（RTMP/SRT 推流、WebSocket、SSH、数据库连接、VPN 隧道），方案必须是「包级聚合隧道」或「应用层重连 + 快速故障检测」，不能指望主备切换无感。

### ② 默认参数下，三条主流方案的故障检测时间都是**几十秒级**，不是毫秒级

| 方案 | 默认检测/切换时间 | 依据 |
|---|---|---|
| OpenWrt mwan3 | **约 50s（最快）～130s（最坏）**；物理断载波则近即时 | 源码算法推算，见 §2 |
| 爱快 iKuai | **约 30s 起**（30s 一检测） | 官方文档，见 §3 |
| RouterOS `check-gateway` | **约 20s**（2 次 × 10s） | 官方文档，见 §4 |
| RouterOS `netwatch` | **约 10～13s**（可调到更低） | 官方文档，见 §4 |

想要毫秒级切换，只能靠 **BFD**（RouterOS 支持，需自建 CHR/VPS）或**包级聚合的 hot failover**。

### ③ 国内蜂窝链路基本拿不到公网 IPv4；IPv6 有但不一定有 PD

见 §8。这直接决定了「后面接自己的服务器」这件事能不能被外网访问到。

---

## 1. 通用：主备 vs 负载均衡 vs PCC 多线分流的区别与适用场景

这三个词经常被混用，实际是三个不同的层。

### 1.1 三种模式

| 模式 | 原理 | 单条 TCP 流能否跑满两条线之和 | 故障时已建立连接 |
|---|---|---|---|
| **主备（failover / cold standby）** | 策略路由 metric 优先级，主挂才用备 | 否（同一时刻只用一条） | **断**，需重连 |
| **负载均衡 / PCC 分流** | 按 hash（源 IP、五元组）把**不同连接**分到不同 WAN | **否**（单流仍只走一条） | 那条流所在的 WAN 挂了就断 |
| **包级聚合（bonding，MPTCP/SpeedFusion）** | 把一条流拆成多个子流/包，经隧道从多条 WAN 同时发送，对端重组 | **是** | **不断**（隧道保持，IP 不变） |

### 1.2 关键澄清：负载均衡 ≠ 带宽叠加

- 爱快官方文档（多线负载页，2026 抓取）明确写：

  > 「WEB 视频(网页,下载)是 HTTP **单点传输**。对于单点传输协议类.**起不到带宽叠加的效果，最大的速度就是一条线的带宽量**」
  > 链接：https://www.ikuai8.com/support/ymgn/lyym/lkfl/ea195/c316b.html

- iKuai 另一页（多线环境线路配置详解）重复：

  > 「负载均衡主要作用是负载，也就是协议流按线路循环分配，P2P 类协议相对好些，叠加的效果明显。**但对于单点传输协议类，起不到带宽叠加的效果**，比如 HTTP 访问网站或者 HTTP 下载，最大的速度就是一条线的带宽量。」
  > 链接：https://www.ikuai8.com/support/cjwt/dxhj/2c343.html

- 官方还明确：**不同运营商一般不支持叠加带宽**（同上多线负载页）。

**对本场景**：如果第零跳后面是「一群客户端各走各的连接」（观众/工作人员上网），负载均衡非常合适，总容量 ≈ 各线之和。如果是「一台服务器推一路 4K 流」，负载均衡**一点用没有**，只会用到一条线。

### 1.3 冷/温/热切换的工程定义

Waveform 给出了最清晰的三分法（前引链接）：

| 类型 | 备份 WAN 状态 | 切换时间 | 公网 IP | 会话 |
|---|---|---|---|---|
| **Cold（冷备）** | 保持离线 | **10–30 秒** | 变 | 断（VPN/游戏/VoIP 直接被踢） |
| **Warm（温备）** | 保持在线，随时可用 | 更快（秒级） | 仍变 | 仍断 |
| **Hot（热备，需聚合隧道）** | 与主链路**同时**承载流量 | 无感 | **不变（隧道 IP）** | 存活 |

> 引文：「Cold failover keeps your backup WAN offline until the primary fails, then switches - **typically in 10-30 seconds**.」

---

## 2. 方案 A：OpenWrt `mwan3`

### 2.1 原理

来自 OpenWrt 官方 wiki（2024-01 快照，Anubis 前的最后可用版本）：

> 「mwan3 is triggered by hotplug-events. When an interface comes up, it creates a custom routing table and iptables rules… It then sets up **iptables rules and uses iptables MARK** to mark certain traffic… A monitoring script (**mwan3track**) runs in the background checking if each WAN interface is up using a connectivity test (default is ping). If an interface goes down, the script issues a hotplug event to cause mwan3 to adjust the routing tables…」
> 链接：https://openwrt.org/docs/guide-user/network/wan/multiwan/mwan3 （经 web.archive.org 2024 快照获取，2026 年该站已加 Anubis 反爬）

即：**iptables fwmark 策略路由 + 后台 ping 探测 + hotplug 调表**。内核做转发决策，mwan3 进程只在事件时介入。

### 2.2 关键参数（源码实测值，非二手转述）

直接从 `openwrt/packages` 仓库 `net/mwan3/files/usr/sbin/mwan3track` 读出（v2.12.2）：

```sh
config_get reliability $INTERFACE reliability 1
config_get count       $INTERFACE count       1
config_get timeout     $INTERFACE timeout     4
config_get interval    $INTERFACE interval    10
config_get down        $INTERFACE down        5
config_get up          $INTERFACE up          5
config_get failure_interval $INTERFACE failure_interval $interval
config_get recovery_interval $INTERFACE recovery_interval $interval
```

对应 wiki 表格：

| 参数 | 默认 | 含义 |
|---|---|---|
| `interval` | 10 s | 每轮测试间隔 |
| `timeout` | 4 s | 单次 ping 等回应超时（wiki 明确：「A timeout value of less then 2 seconds is not recommended」） |
| `count` | 1 | 每个目标发几个包 |
| `reliability` | 1（**出厂 `/etc/config/mwan3` 里 wan 段写死 2**） | 需要几个 track_ip 回应才算这轮成功 |
| `down` | 5 | **连续失败 5 轮**才判定链路 down |
| `up` | 5 | 连续成功 5 轮才判定链路 up |
| `track_ip` | 1.0.0.1 / 1.1.1.1 / 208.67.222.222 / 208.67.220.220（4 个） | 探测目标 |
| `check_quality` | 0 | 默认关闭；开启后可用 `failure_latency`(1000ms) / `failure_loss`(40%) 判劣化 |
| `flush_conntrack` | 无 | 可在 ifup/ifdown 事件清 conntrack 表 |

### 2.3 ★ 实测/推算切换时间

`mwan3track` 的计分器是**双阈值棘轮**：初始 `score = down + up = 10`；每失败一轮 `score--`，`score == up(5)` 时触发 `disconnecting → disconnected`（标记 offline）；每成功一轮 `score++`，`score == up(5)` 时 `connected`。

因此**从 online 到 offline 需要连续 5 轮失败**。每轮耗时 = （对本轮要 ping 的 track_ip 逐个 ping 的总耗时）+ `failure_interval`（默认 = `interval` = 10 s）。

- **最好情况**（链路已没路由，ping 立即返回错误或 ICMP unreachable）：4 × ~0s + 10s ≈ 10s/轮 → **约 50 秒**
- **最坏情况**（包被黑洞，每个 ping 都等满 4s 超时）：4 × 4s + 10s = 26s/轮 → **约 130 秒**

Nelson Minar 的实测博客（2022-04-22，Starlink + 固定无线的真实部署）描述了他观察到的默认行为，与源码一致：

> 「The package uses the docs' defaults except reliability is set to 2. I think that means the behavior is it tests every 10 seconds. A test is it pings each of 4 hosts once with a 4 second timeout; if 2 of the pings succeed then the test passes. **If 5 tests fail in a row the link is considered dead.** 5 successes and the link is alive again.」
> 链接：https://nelsonslog.wordpress.com/2022/04/22/openwrt-rpi4-failover-and-load-balancing/

**同一篇博客给出了一个极重要的反面实测**（他 update 里写的）：

> 「Around 4am Starlink got a firmware update and rebooted itself. My monitoring tells me my house couldn't ping 8.8.8.8 for about **4 minutes** afterwards. Looking at the syslog it's clear mwan3 was aware of the outage; it detects that the network lost carrier … But there's no logging about failed pings (which I would expect) and judging by my monitoring, **it did not fail over to the backup**. There's also several log lines with errors in them like "netifd: WAN1 (10264): **Command failed: Permission denied**" which does not inspire confidence.」

⚠️ 这是 2022 年、22.03 时代的结果，后续版本有修复；但它说明**「配置看起来对」和「真出事时切了」是两件事**，必须现场演练。

**另一个「快」的路径**：物理断载波时，netifd 会发 ifdown hotplug，`mwan3track` 的 `trap if_down USR1` 会立刻 `stop_subprocs` + 下一轮 `disconnected`——**这种情况是秒级**。所以：

> **载波断了 → 快；上游路由/互联网断了但载波还在 → 慢（50–130s）**。
> 蜂窝场景恰好最常遇到后者（基站还在、APN 还在、但上游不通 / 拥塞到丢包）。

**调优建议**：把 `interval` 降到 1–2s、`timeout` 2s、`down` 2–3、`up` 2，配合 `check_quality` + `failure_latency`/`failure_loss`。代价是误判率上升（wiki 原话警告低带宽/繁忙接口上改小 timeout 会造成 false positive）。注意 wiki 也提醒：**公共 DNS 可能限速 ICMP**，「This has been seen with Google public DNS」——所以要配多个不同厂商的 track_ip。

### 2.4 IPv6 支持情况（重要短板）

mwan3 官方 wiki 说得非常直白：

> 「Using mwan3 with load balancing or failover routing policies for IPv6 requires additional configuration such as **NETMAP, NPTv6 or NAT66**. **None of these methods are currently implemented in mwan3 directly** and hence requires additional configuration.」
> 「You will need to split your WAN network interfaces, so one interface has your IPv4 WAN and another for the IPv6 WAN… **mwan3 cannot currently handle IPv4 and IPv6 configuration on a single interface.**」
> 「**it is up to you to implement the IPv6 configuration required.** mwan3 does not currently implement any IPv6 masquerading by itself.」

相关未闭 issue：
- #15434（2021-04-15，OPEN）`mwan3: Ping -I <interface>: ping: sendto: Permission denied on IPv6`
- #26690（2025-06-04，OPEN）`MWAN3 with IPv6 don't come back IPv6 interface after address change`
- #26849（2025-06-28，OPEN）`DHCPv6 on wan does not recognise routable IPv6 address as "directly connected"`
- #13088（2020-08-11，OPEN）`mwan3: allow mixture of ipv4/ipv6 addresses in src/dest_ip fields`
- 修复记录：2026-03-04 `mwan3: fix IPv6 support for httping command`；2026-03-04 `mwan3: warn about unsupported IPv6 in arping track method`（**arping 明确不支持 IPv6**）
- 2025-09-02 `mwan3: common.sh: fix src_ip detection for ipv6-PD`

**结论：mwan3 的 IPv6 是「能跑但要自己搭 NAT66/NPTv6，且单接口不能同时管 v4/v6」。做双栈双 CPE 时这是显著的工程负担。**

### 2.5 已知 bug / 坑（点名 issue + 时间）

| Issue | 标题 | 状态 | 创建 | 最后更新 | 对本场景的相关性 |
|---|---|---|---|---|---|
| [#16818](https://github.com/openwrt/packages/issues/16818) | Certain upstream switch to `firewall4` aka `nftables` instead of `iptables` | **OPEN** | 2021-10-06 | **2026-08-11** | mwan3 至今**仍是 iptables 实现**，在 firewall4 上「only via iptables-nft」。189 条评论 |
| [#16817](https://github.com/openwrt/packages/issues/16817) | mwan3: **LTE interface always disabled after reboot** | **OPEN** | 2021-10-06 | **2026-05-27** | ★ 直接命中本场景。USB LTE 作第二 WAN，重启后 wwan 永远 disabled，需重启 mwan3 服务才好 |
| [#24973](https://github.com/openwrt/packages/issues/24973) | Existing connection does not switch to other interface after disconnected event | **OPEN** | 2024-09-15 | 2024-09-16 | ★ 见 §0① |
| [#25487](https://github.com/openwrt/packages/issues/25487) | **does not detect connection failure when receives ICMP destination unreachable** | **OPEN** | 2024-12-04 | 2024-12-05 | ★★ **直接命中「上游是蜂窝 CPE」的拓扑**：第二台路由器（带 5G 模组）关机后回 ICMP unreachable，mwan3 把它当成「有回应」，WAN 一直显示 online |
| [#23527](https://github.com/openwrt/packages/issues/23527) | Multiwan switches to only 1 WAN only | **OPEN** | 2024-02-24 | 2025-12-05 | 双 WAN 随机塌缩成单 WAN |
| [#14332](https://github.com/openwrt/packages/issues/14332) | 2.10.x branch **50% ping loss with L2TP IPv6** | **OPEN** | 2020-12-24 | 2025-11-14 | 49 条评论，跨 19.07→21.02 复现，隧道场景丢包 50% |
| [#18087](https://github.com/openwrt/packages/issues/18087) | interface cannot detect link problems after mwan ifdown/up | OPEN | 2022-03-18 | 2025-11-15 | 手动 ifdown/up 后探测失效 |
| [#20571](https://github.com/openwrt/packages/issues/20571) | route updates ignored unless tracking is enabled | OPEN | 2023-02-27 | 2025-06-28 | 不开 tracking 就不更新路由 |
| [#23480](https://github.com/openwrt/packages/issues/23480) | Potential race condition between mwan3 and tailscale | OPEN | 2024-02-20 | 2024-06-28 | mwan3 + Tailscale 同用有竞态 |
| [#29714](https://github.com/openwrt/packages/issues/29714) | **mwan3track hangs with 100% CPU usage after reboot** (v2.12.1) | CLOSED | 2026-06-11 | 2026-06-12 | busybox ash bug（openwrt/openwrt#23745）触发，x64&arm64 SNAPSHOT，**吃满所有 CPU 核** |
| [#29055](https://github.com/openwrt/packages/issues/29055) | default route src ip should be preferred over interface ip when get_src_ip | OPEN | 2026-04-03 | 2026-08-26 | 新 |
| [#29653](https://github.com/openwrt/packages/issues/29653) | rpcd ucode status handler emits invalid JSON | OPEN | 2026-06-05 | 2026-08-18 | LuCI 状态页坏了 |

**#25487 值得展开**，因为它精确描述了「蜂窝 CPE 挂在 WAN 口」的拓扑：

> 报告者（2024-12-04）：「I have another router with a cellular connection connected to the WAN interface… To simulate the loss of connection through the WAN, I set the cellular interface of the second router to shutdown state. Then the pings no longer reach the 8.8.8.8 destination, but **the second router sends ICMP unreachable messages through the WAN. MWAN3 looks to understand this packets as ICMP responses** and the WAN interface … is shown as having connection to 8.8.8.8 when it is not real.」

另一位用户补充了另一个变体（同 issue）：

> 「**Scenario One: Cable Disconnected** — Unplug ethernet from switch. Observe that `ip link` still reports the interface UP,LOWER_UP. **Failover fails** traffic still tries to route out of the `eth0` interface. `ip route` shows that the default route for `eth0` is still present.」

### 2.6 项目健康度与可持续性（阶段二 vibe）

- **仓库位置**：`openwrt/packages` → `net/mwan3`（**不在独立仓库，代码量小**）
  - 文件：`mwan3track` 453 行、`mwan3` 257 行、`mwan3.sh` 1233 行、`common.sh` 257 行 —— 全部是 **POSIX shell 脚本**，非常轻，总计约 2200 行
- **版本**：`PKG_VERSION:=2.12.2`（`PKG_RELEASE:=2`），2026-07-06 bump
- **维护者**：`Florian Eckert <fe@dev.tdt.de>`（OpenWrt 核心开发者）
  - 2025-08-04 `mwan3: remove Aaron Goodman as PKG_MAINTAINER` —— **原主要维护者离场**
  - 现在主力是 Etienne Champetier（OpenWrt 知名维护者，"champtar"）和 Florian Eckert
- **最近提交**（`gh api repos/openwrt/packages/commits?path=net/mwan3`）：

  | 日期 | 作者 | 提交 |
  |---|---|---|
  | 2026-08-27 | Gleb Pesin | `mwan3: strip dead flag from copied routes` |
  | 2026-07-06 | Florian Eckert | `mwan3: bump PKG_VERSION to 2.12.2` |
  | 2026-06-09 | Florian Eckert | `mwan3: add log message if l3 interface is not up` |
  | 2026-03-11 | Harin Lee | `mwan3: bump PKG_VERSION to 2.12.1` |
  | 2026-03-04 | Harin Lee | `mwan3: fix IPv6 support for httping command` |
  | 2025-09-02 | Fabian Groffen | `mwan3: common.sh: fix src_ip detection for ipv6-PD` |
  | 2025-06-27 | Etienne Champetier | `mwan3: reimplement rpcd plugin using ucode` |

  → **活跃度没问题**（每月都有提交），但**架构没变**（还是 iptables + shell）。
- **开放 issue 数量**：单是搜 "mwan3" 就命中 **40+ 条 OPEN**，横跨 2018–2026。这是一个「能用但长期欠债」的包。
- **钱从哪来**：OpenWrt 社区项目（无商业实体），无 SLA、无支持合同。

### 2.7 社区 nftables 移植：`dl12345/mwan3`（2026 新选项）

GitHub 上出现了非官方 nftables 原生移植：

```
repo:    dl12345/mwan3
描述:    mwan3 nftables port for openwrt-25.12
创建:    2026-04-02
最后推送: 2026-08-11
stars:   97      forks: 14      open issues: 2
版本:    3.6.12
```

- **项目活跃度很高**：issue #2 ~ #31 全部集中在 2026-05 ~ 2026-09，大部分已 CLOSED，作者响应快
- 有一份很详细的 `README`（「mwan3 nftables User and Developer Reference」，覆盖 mark bitmask、`table inet mwan3` 架构、packet flow、ip rule 三层、conntrack 管理、atomic reload、diagnostic 命令、LuCI app 全章节）
- issue 里能看到它**继承了上游的同名 bug**（`mwan3track hangs with 100% CPU usage` #5、`rpcd ucode status handler emits invalid JSON` #4、`an interface stays offline after reload` #31）
- issue #2 `Addition to OpenWRT repos?` 和 #12 `Create Custom Feed for OpenWRT?` 说明**尚未上游化**
- **判断**：这是目前 mwan3 在 OpenWrt 24.10+/25.x（firewall4/nftables 默认）上最现实的路径，但**单人项目、97 stars、未上游、无 SLA**。按 solution-research 的标准，可用，但不要把它当生产关键基础设施，除非你愿意自己维护/锁定版本。

### 2.8 mwan3 结论：推不推荐？

**推荐度：中等偏低（作为「关键赛事第零跳」的主方案）**

- ✅ 免费、开源、代码极少（2200 行 shell，可读可改）、OpenWrt 生态成熟
- ✅ 负载均衡 + 主备 + 策略路由一站式，配置模型清晰（interface → member → policy → rule）
- ❌ **默认切换 50–130s**，必须手工调参才可用
- ❌ **已建立连接不迁移**（设计如此，非 bug —— 见 §0①）
- ❌ IPv6 需自建 NAT66/NPTv6，单接口不能 v4+v6 共存
- ❌ 与 firewall4/nftables 靠兼容层，历史上是**最大债**
- ❌ LTE 作第二 WAN 有专门的坑（#16817，重启后 disabled）
- ❌ 对「ICMP unreachable」误判为在线（#25487），**恰好在蜂窝 CPE 拓扑下会踩**
- ❌ 40+ OPEN issue 长期积压，原维护者 2025 离场

比 mwan3 更简单的替代：如果**只要主备不需要负载均衡**，社区常用 `wan-failover` 类脚本 / `watchcat` + 自定义脚本；或者直接用 `mwan3` 但把 policy 设成严格的低 metric 主 + 高 metric 备。

---

## 3. 方案 B：爱快 iKuai

### 3.1 原理

iKuai 是国产 x86/ARM 软路由系统（全讯汇聚网络科技（北京）有限公司），核心卖点是「DPI 七层流控 + 多线负载 + 分流」。多线部分提供两个能力：**负载均衡**（同运营商多线叠加）与**多线路由**（按目的 IP 归属运营商选出口）。

### 3.2 关键配置

**优先级（官方明确，从高到低）**：

> **静态路由 > 域名分流 > 端口分流 > 协议分流 > 多线负载 > 默认网关**
> 链接：https://www.ikuai8.com/support/cjwt/dxhj/2c343.html

**负载模式（7 种）**：
实时连接数 / 新建连接数 / 实时流量 / 源IP+目的IP / 源IP+目的IP+目的端口 / 源IP / 源IP+源端口

> 官方建议：「一般建议外网线路为拨号方式时使用**实时连接数**方式，大多数运营商会对这种拨号线路限制连接数」
> 「如果想访问某个协议、某个网站、某个 IP 的时候只会走一条线路，那一定要使用**源IP+目的IP分配**或者**源IP+目的IP+目的端口分配**的模式」
> 「负载之后测速效果不理想，建议使用**源IP**或**源IP+源端口**的方式」

**自动切换开关（WAN 高级设置）**：

> 「【自动切换】：勾选自动切换后，多线 ISP 线路掉线后自动切换,1 条 ISP 线路时无需使用。」
> 链接：https://www.ikuai8.com/support/ymgn/lyym/wlsz/vaqw.html

**线路检测机制**：

> 「【线路检测】：支持线路自定义检测功能。通过 **PING/HTTP/PING+HTTP** 的方式自定义检测外网线路是否正常。」
> 「1.http+ping www.baidu.com：外网线路**默认检测机制**，通过百度回送的 http 信息以及 ping 百度的信息来检测线路。」
> 链接同上 + https://www.ikuai8.com/support/ymgn/lyym/ztjk/cda78.html

### 3.3 ★ 实测切换时间：**30 秒级**

官方「系统日志」FAQ 里给出了唯一的硬数字：

> 「问题：线路检测失败与线路检测成功间隔一分钟，正常吗？
> 回：是正常的，**线路检测是 30s 一检测**，当出现线路检测失败，除第一次检测失败显示外，到检测成功其他的检测结果不显示。**线路检测失败与线路检测成功间隔为 30s 的倍数。**」
> 链接：https://www.ikuai8.com/zhic/ymgn/lyym/rzzx/xtrz.html

同页还写了检测方式：

> 「目前线路的检测机制是基于每条外网线路（WAN 口线路或 VPN 拨号线路）的**网关和 114.114.114.114** 这两个地址做的检测。基于 ICMP 的方式做的检测，**只有两个都 PING 不通或丢包严重的情况下，才会提示线路检测失败**。」

**含义**：
- 最快检测 ≈ **30 s**（一次检测周期就失败）
- 若需要多次失败才判死，则是 **30 s 的整数倍**（官方原话）
- 且必须「网关 + 114.114.114.114 **两个都**不通」——**这是一个很钝的判定**，中间态（能 ping 通网关但没网）会被判为正常

⚠️ **未找到** iKuai 官方给出的「毫秒级切换」数字。市面上说 iKuai「毫秒级切换」的营销文，与官方自己写的「30s 一检测」矛盾。**本报告的立场：以官方文档为准，iKuai 的检测是 30s 级。**（证据薄弱处已标出，见 §11）

### 3.4 掉线切换的行为差异（★ 本场景的关键坑）

iKuai 官方文档明确区分了不同功能下的掉线行为：

> 「①、在爱快多外 Wan 环境的情况下。线路掉线切换机制在不同功能下实现的效果：
> 　**多线负载策略的情况下，有一条线路掉线了，流量会走其他几条正常的线路**
> 　**端口分流、协议分流策略勾选了多条线路的情况下，只有 ADSL 拨号的线路掉线会分流到其他线路，其余方式上网的线路掉线只会走默认网关线路**」
> 链接：https://www.ikuai8.com/support/ymgn/lyym/wlsz/vaqw.html

★★ **这是本场景最容易踩的坑**：蜂窝 CPE 接到 WAN 口，上网方式通常是 **DHCP（动态获取）**，不是 **ADSL/PPPoE**。按官方这条规则，如果你用的是「端口分流/协议分流」而不是「多线负载」，**DHCP 方式的蜂窝线路掉线后不会分流到其他线路，只会走默认网关**。要用 iKuai 做蜂窝主备，**必须用「多线负载」策略**（或者把蜂窝线路配成 PPPoE 拨号，如果运营商支持）。

另一个官方注记：

> 「②、ADSL 拨号的线路，可以正常获取 IP 地址，但线路检测失败；这种情况下针对这条线路所做的线路配置，**将不会触发线路切换功能**」

### 3.5 USB 4G 网卡 / 手机 USB 共享（官方支持）

iKuai 官方有一页专门讲这个：

> 「现在有两种设备可以实现通过 USB 口转化为 wan 口上网，
> 一是 **4G 上网卡（已知支持型号：华为 E8372, 华为 E5573s-853, 中兴 MF79S）**，
> 二是**手机 USB 共享**
> …这样连接之后爱快上就会多出来一块网卡，**将此网卡绑定成为 wan 口，选择 DHCP 的上网方式**，获取到地址之后即可正常通过此 wan 口上网」
> 链接：https://www.ikuai8.com/support/alzx/tsgn/usb-wan.html

注意这里**又验证了 §3.4 的坑**：官方让你「选择 DHCP 的上网方式」，那按 §3.4 的规则，这条线在「端口分流/协议分流」下就不会切换。要么只用多线负载，要么用别的路由器。

另外 iKuai 支持 **WiFi 中继为 WAN**（把手机热点的 WiFi 当中继上行）：

> 「目前仅 Q50、Q80、Q3000、Q3S、Q1800、Q90、Q6000、Q1800L 在最新版本上支持 WiFi 中继… 点击空闲的 WiFi 接口，选择**中继为 wan**，wan 作为 wan 口去关联 WiFi，能够进行中继。」
> 链接：https://www.ikuai8.com/support/ymgn/lyym/wlsz/vaqw.html

### 3.6 授权 / 收费

- iKuai 路由系统本身**免费**（官网标题即「免费路由|爱快云|云系统」）
- 从官方功能文档看，**多线负载、分流、掉线自动切换、线路检测、USB WAN、WiFi 中继都在免费版文档里**，未见「需授权」标注
- 存在**企业版**：线路监控页提到「点击 WAN 口详情…（**3.7.16 企业版支持使用此功能**）」——即部分监控/图表功能限企业版
- 官网另有「爱快硬件」「爱快云」「OEM 定制」等商业化产品线
- ⚠️ **未找到一份公开的、完整的免费版 vs 企业版功能对照表与价格表**。这属于证据薄弱处（见 §11）

### 3.7 iKuai 结论

**推荐度：中等（做蜂窝主备要注意 3.4 的坑）**

- ✅ 免费、中文、GUI 友好、官方对 USB 4G / 手机共享有明确支持
- ✅ 多线负载策略下线断自动续走其他线，行为符合预期
- ✅ 线路检测可自定义 PING/HTTP/PING+HTTP
- ❌ **检测周期 30s 级**，切换慢，且判定钝（网关 + 114 两个都不通才判死）
- ❌ **DHCP 线路（蜂窝 CPE 的典型方式）在端口分流/协议分流下不参与切换**，只走默认网关
- ❌ 「单点传输协议」无叠加效果
- ❌ 闭源，出问题只能靠官方或论坛，不能自己改代码
- ⚠️ 授权边界不透明

---

## 4. 方案 C：MikroTik RouterOS (ROS)

### 4.1 三种机制的官方参数（这是硬数据）

**① `check-gateway`（路由自带网关探测）**

官方 IP Routing 文档：

> 「Gateway check can be extended by setting `check-gateway` parameter. Gateway reachability can be checked by sending ARP probes, or ICMP messages or by checking active BFD sessions. **The router periodically (every 10 seconds) checks the gateway by sending either an ICMP echo request (ping) or an ARP request (arp). If no response from the gateway is received for 10 seconds, the request times out. After two timeouts gateway is considered unreachable.** After receiving a reply from the gateway it is considered reachable and the timeout counter is reset.」
> 链接：https://help.mikrotik.com/docs/spaces/ROS/pages/328084/IP+Routing

同页给出默认值（`/routing/settings`）：

```
  check-gateway-ping-interval: 10s
   check-gateway-ping-timeout: 1s
     check-gateway-ping-count: 2
```

→ **检测时间 ≈ 2 × 10 s = 20 秒**

**② `netwatch`**

官方文档默认值：

| 属性 | 默认 |
|---|---|
| `interval` | **10 s** |
| `timeout` | **3 s** |
| `type` | `simple`（v7.4 起支持 `icmp` / `tcp-conn` / `http-get` / `https-get` / `dns`） |
| `start-delay` | 3 s |
| `startup-delay` | 5 min |
| ICMP `packet-interval` | 50 ms |
| ICMP `packet-count` | 10 |
| ICMP `thr-max` | 1 s |
| ICMP `thr-avg` | 100 ms |
| ICMP `thr-loss-percent` | 85.0% |
| ICMP `early-failure-detection` | **no** |

> 链接：https://help.mikrotik.com/docs/spaces/ROS/pages/8323208/Netwatch （页面 by Artūrs C.，last updated by Mārtiņš S. on **Oct 08, 2025**；顶部提示该文档站已冻结，新站在 manual.mikrotik.com）

→ **检测时间 ≈ interval + timeout ≈ 10–13 秒**；`interval` 可调到 1s 甚至更低，代价是探测流量与误判。
→ `early-failure-detection=yes` 可以让它「已经确定是 down 就不等剩下的包」，进一步缩短。

**③ recursive route（递归路由 + canary IP）**

原理：默认路由指向一个 canary 公网 IP（如 1.1.1.1），canary 本身再通过真实网关解析。网关挂了 → canary 路由失效 → 默认路由跟着失效。这是 RouterOS 社区最推崇的做法，但它**本身不提供更快的探测**，探测速度仍取决于 `check-gateway` 的 10s 周期。

### 4.2 实测/社区确认的切换时间

MikroTik 官方论坛版主级用户 anav（2024-04-14）：

> 「The advantage of netwatch, primarily, is that you can vary some variables here to ascertain connectivity with more fidelity!!
> For example, **gateway-ping checks every 10 seconds, after two repetitive nil responses, the connection is deemed not active. For many that is too long and thus netwatch if set at 10 seconds, is half that response time** etc....」
> 链接：https://forum.mikrotik.com/t/simpler-failover-for-two-gateways-i-found-working/169108 （topic 169108，创建 2023-08-27，54 楼）

→ **check-gateway ≈ 20s；netwatch(interval=10s) ≈ 10s**。与官方文档完全一致。**这是我在中英文社区找到的最可信的一致性交叉验证。**

用户 cyayon（2024-07-23，同帖）给出的替代做法：

> 「Personally I am using a script which run each minute and ping multiple IP from interface and if all ping failed, then disable primary default route (but keep another primary with a longer distance).」

资深用户 sindy（2022-09-17，topic 160877）：

> 「the only thing you can do is to speed up the failure detection using the method described by means of some scripts pinging the canary addresses **more frequently than in those hardcoded 10s intervals**.
> If you trust the availability of your favourite data center much more than the one of your ISP's uplinks, you can run a CHR in that datacenter, use **OSPF and BFD** to connect one tunnel per each WAN to that CHR, and do the NAT there.」
> 链接：https://forum.mikrotik.com/t/most-effective-failover/160877

→ **想要亚秒级切换，官方的正解是 OSPF + BFD 到自建 CHR。** 这是本报告里唯一一条能给出「毫秒/亚秒级」的合法路径。

### 4.3 脚本写法

**A. netwatch + 脚本改路由 distance**（论坛常见写法，Amm0 提醒的坑已修正为 `find`）：

```routing
# 1) 主备 default route，主 distance=1，备 distance=2
/ip route
add dst-address=0.0.0.0/0 gateway=192.168.1.1 distance=1 comment=WAN1
add dst-address=0.0.0.0/0 gateway=192.168.2.1 distance=2 comment=WAN2

# 2) 用 netwatch 探 canary，down/up 时切换 distance
/tool netwatch
add host=1.1.1.1 interval=10s timeout=2s \
    down-script="/ip route set [find comment=WAN1] distance=10" \
    up-script="/ip route set [find comment=WAN1] distance=1"
```

⚠️ Amm0 在 topic 169108 #3 明确警告：

> 「You should not use the numbers from "/ip/route/print" to disable an interface (step 6 in OP). **The numbers are transitory**, so you need to either use the .id for route or use `[find something=that]`」

⚠️ 同帖 anav 警告 netwatch 探测会「泄漏」：

> 「one has to be careful about ICMP probes from netwatch as they will **leak and try to go out any available route**」

**B. recursive route + canary（更优雅，推荐）**：

```routing
# canary 1.1.1.1 走 WAN1 网关，scope/target-scope 保证递归正确
/ip route
add dst-address=1.1.1.1/32 gateway=192.168.1.1 scope=10 target-scope=11 check-gateway=ping
add dst-address=0.0.0.0/0  gateway=1.1.1.1     scope=10 target-scope=12 distance=1

# 备用
add dst-address=9.9.9.9/32 gateway=192.168.2.1 scope=10 target-scope=11 check-gateway=ping
add dst-address=0.0.0.0/0  gateway=9.9.9.9     scope=10 target-scope=12 distance=2
```

（此写法来自 forum topic 160877 #8 anav 的示例，并强调「Pay attention to all of the scope entries!!!」）

关于 `check-gateway` 不能用在接口型 gateway 上，官方文档明确：

> 「Also it is not possible to use `check-gateway` parameter on such gateways for obvious reasons, there is no known destination IP.」

**C. netwatch + `src-address`（v7 新特性）**

用户 cyayon（2024-07-17）：

> 「I think using mangle mark packet is no more necessary since recent version of ROS. **Netwatch is able to define a src-address, then simply use it to ping from the DSL interface.** Moreover, I think that using mangle/mark can cause issue with fasttrack firewall rules.」

但 Amm0 反驳：`src-address` 需要你知道源地址（静态 IP 才好用），动态拨号场景不如 mangle 表直接。

### 4.4 TCP 长连接会不会断？

**会断。** 见 §0① sindy 的原话。而且他给了更细的机制解释：

> 「That was just an example of long-term UDP connections that need to be treated specially to properly migrate to the backup WAN. **A continuous ping is yet another example of the same - if you run a continuous ping from the LAN side, it keeps updating the existing tracked connection so the packets keep getting translated to the IP address of the dead WAN until you either stop pinging or remove that connection**」

并且他直接点出 SOHO 场景的本质：

> 「So the typical SOHO scenario with no own AS number and with two ISPs, i.e. the public addresses from which you connect to servers in the internet are different and thus **a failover to the secondary uplink means that all existing sessions break down**.」

### 4.5 ROS 结论

**推荐度：较高（如果接受 10–20s 切换）**

- ✅ 官方文档把三个机制的默认参数写得很清楚，可预测
- ✅ recursive route + canary 是处理「网关通但没网」的正解
- ✅ 想更快可以 OSPF+BFD 到自建 CHR（唯一能到亚秒级的路径）
- ✅ RouterOS v7 对有线和蜂窝（LTE/5G 模组）都支持好，硬件选择多（hEX / RB5009 / Chateau LTE / SXT LTE6 …）
- ✅ 不需要授权费（RouterOS 授权随硬件，L 级）
- ❌ **默认 20s（check-gateway）/ 10s（netwatch）**，比毫秒级期望差 3–4 个数量级
- ❌ `check-gateway` 探测周期是**硬编码 10s**，只能靠脚本绕过（sindy 原话："hardcoded 10s intervals"）
- ❌ netwatch 探测包会「泄漏」到其他路由，配置要注意
- ❌ 会话仍会断（除非上 BFD/隧道方案）

---

## 5. 方案 D：手机热点 / USB 4G 网卡兜底

### 5.1 手机 USB 网络共享（Android RNDIS / iPhone）

**OpenWrt 侧需要的包**（社区一致的清单）：

```
kmod-usb-net
kmod-usb-net-rndis        # Android
kmod-usb-net-cdc-ether    # 部分 Android / iPhone(ipheth)
kmod-usb-net-ipheth       # iPhone
usb-modeswitch            # 需要切模式的 dongle
usbutils
kmod-usb-storage          # 部分随身 WiFi
```

中文实操参考（2024-01-22，loganjin.cn）：

> 「准备手机(IOS / Android / USB 随身 Wi-Fi) + 带 USB 插口的 openwrt 路由器，安装 **kmod-usb-net-rndis、kmod-usb-storage** 依赖包」
> 「连接手机或者随身 WiFi, 确保已经启动 USB 网络共享, 然后打开 openwrt 首页, 网络 - 接口 - 添加新接口, **协议依然是 DHCP 客户端**, 点击设备栏, 观察是否有新设备」
> 链接：https://loganjin.cn/article/openwrt-5g-cpe/

恩山论坛（2020-02-21）：

> 「如果手机上没有开启 USB 共享网络, 必须开启手机的 usb 共享。并开启 usb 共享网络, 接口少驱动 **kmod-usb-net-rndis**」
> 链接：https://www.right.com.cn/forum/thread-2882013-1-1.html

零配置做法参考 gist：https://gist.github.com/rlan/7b6189896923a35ff6cedf69ab0bcc5f

⚠️ 已知坑（OpenWrt wiki, Smartphone USB tethering 页，2026-05-31 索引）：

> 「If your Android phone does not seem to detect that there is something attached to the USB port and refuses to switch to USB tethering, you might want to install **DriveDroid** and try to enable various methods of using USB guest for its own functionality.」
> 链接：https://openwrt.org/docs/guide-user/network/wan/smartphone.usb.tethering

⚠️ **运营商热点限制**：Reddit r/openwrt 有专门帖子讲怎么绕过蜂窝套餐的 hotspot 限制（需 root 的 Android）：https://www.reddit.com/r/openwrt/comments/z6myl5/full_guide_to_setting_up_a_tethered_usb/ —— 说明**「手机 USB 共享」在很多套餐里会走 tethering 计费或限速，不是白嫖的**。

### 5.2 USB 4G/5G 网卡（dongle）

OpenWrt 官方 wiki 有三页对应：
- `Use USB QMI or CDC-MBIM capable cellular USB modems` — https://openwrt.org/docs/guide-user/network/wan/wwan/ltedongle （索引时间 2026-09-06）
- `Use RNDIS USB Dongle for WAN connection` — https://openwrt.org/docs/guide-user/network/wan/wwan/ethernetoverusb_rndis （索引时间 2026-04-19）
- `Use USB serial modem dongles for WWAN` — https://openwrt.org/docs/guide-user/network/wan/wwan/3gdongle （索引时间 2026-04-19）

**一个完整的实拍配置清单**（ambientnode.uk，2024-05-08，真实项目：Raspberry Pi 4B + LTE dongle 作 UDM Pro 的第二 WAN）：

> 需要额外加入的包：
> ```
> kmod-usb-net-qmi-wwan uqmi kmod-usb-net-cdc-mbim umbim
> luci-proto-qmi luci-proto-mbim
> kmod-usb-serial-option kmod-usb-serial-qualcomm
> usb-modeswitch picocom kmod-usb-net-cdc-ether
> ```
> 「I bought an unlocked Vodafone K5161z dongle from Amazon, which turned out to be **a modem and a router**. This caused an issue later on, as I could not make my existing VPN service work behind a **double-NAT**, and the dongle is extremely limited in terms of configuration settings (**no way to port forward**, for example)」
> 最终他只能把接口协议选成 **DHCP client**（因为 dongle 自己已经在路由），而不是 QMI/MBIM 直连。
> 链接：https://ambientnode.uk/raspi-router

★ **这是「亏在选型」的经典案例**：买到了「modem+router 二合一 dongle」→ 双层 NAT → 无法端口映射 → 后面所有「自己架服务器」的诉求都受影响。**选型时必须选「纯 modem」（HiLink 模式关掉，走 QMI/MBIM）**。

**iKuai 官方验证可用的 dongle 型号**（另一条独立证据链）：

> 「4G 上网卡(已知支持型号：**华为 E8372, 华为 E5573s-853, 中兴 MF79S**)」
> 链接：https://www.ikuai8.com/support/alzx/tsgn/usb-wan.html

（注意：华为 E8372 也是 HiLink「modem+router」型，同样有双层 NAT 问题。）

### 5.3 手机热点走 WiFi STA（travelmate）

OpenWrt 有 `travelmate` 包，官方 wiki 页：https://openwrt.org/docs/guide-user/network/wifi/wifiextenders/travelmate （索引 2024-12-23）

> 「Travelmate lets you use a small "travel router" to connect all of your devices at once while having total control over your own personal…」

iKuai 侧对应的是「WiFi 中继为 WAN」（见 §3.5）。

**WiFi STA 兜底的优劣**：
- ✅ 不需要驱动，任何手机都能当上行
- ✅ 手机可以随时换位置找信号（人群密集时这点很值钱）
- ❌ 2.4/5GHz 本地干扰大（会展中心尤其）
- ❌ 每次关联要几秒，重连慢
- ❌ 手机热点的 NAT 又是一层

### 5.4 稳定性与踩坑

综合社区反馈：
- **供电不足**是 USB 网卡最常见的失效原因（尤其是 5G 模组峰值电流大），建议带供电的 USB Hub
- **发热**：长时间满载的 4G/5G dongle 会热降速甚至掉线
- **`usb-modeswitch` 失败**：dongle 卡在 CD-ROM 模式没切成 modem，重启后偶发
- **接口名不稳定**（真实实测，Nelson 的博客）：

  > 「as far as I can tell OpenWRT has **no built-in provision for naming devices consistently**. When I was plugging and unplugging things I would see one of my adapters go from being "eth1" to being "eth2" despite it always being plugged into the same port and the MAC address not changing.」
  > 「I ran into a problem because I named my interfaces WAN1/WAN2. **The mwan3 scripts default to assuming these names are "wan" and "wanb"** and I regret not using those names for simplicity.」

  → **命名建议：直接叫 `wan` / `wanb`，别自创。** 这是省时间的细节。

### 5.5 自动化：主链路断就切

三条路径：

**① 交给 mwan3 的 hotplug（推荐，但要调参）**
- mwan3 已经有 down/up 事件 → hotplug-call iface
- 在 `/etc/hotplug.d/iface/16-mwan3-user`（或 `/etc/mwan3.user`）里挂自定义动作
- 注意：**mwan3 从「安装那一刻」就接管路由**，默认会按 `wan`/`wanb` 负载均衡，装之前先想清楚

**② `watchcat`（更轻，只做「断网就重启接口」）**
- `watchcat` 是 OpenWrt 上的「看门狗」包，周期性 ping 目标，失败就重启指定接口 / 重启设备 / 执行脚本
- 比 mwan3 简单，适合「我只想主链路断了把备用口拉起来」的场景

**③ 自己写脚本（最可控）**
- 事件源：`/etc/hotplug.d/iface/` 目录里的 hotplug 脚本（网口 up/down 事件）
- 或 `crontab` 周期检测 + `ubus call network.interface.<x> status`
- Nelson 的博客提到 mwan3 有 notify 钩子：`/etc/hotplug.d/iface/16-mwan3-user` 是模板

**④ iKuai 侧**：勾「自动切换」即可，但要满足 §3.4 的策略前提。

---

## 6. 方案 E：多链路聚合（真正的「不断线」方案）

这是本报告里**唯一能让已建立连接存活**的路线。

### 6.1 SpeedFusion（Peplink）—— 商业方案

**原理**：所有流量进一条加密隧道（SpeedFusion VPN），隧道两端（Peplink 路由器 ↔ SpeedFusion Cloud / 自建 FusionHub）做**包级负载均衡 + 重组**。对外只有一个 IP（隧道出口 IP），所以切换 WAN 时业务无感。

**实测性能与延迟开销**（Waveform，2026-03，官方产品页）：

> 「What is the difference between cold, warm, and hot failover? … **Hot failover runs a bonding tunnel across multiple WANs simultaneously, with a persistent IP. When a WAN fails, the tunnel absorbs it. Your IP never changes. Sessions survive.**」
> 「What is the latency overhead from bonding? — **Roughly 5-10 ms** through the SpeedFusion tunnel, depending on how far you are from the relay server.」
> 「What is the throughput cap on bonded traffic? — On the Peplink B One 5G hardware and SpeedFusion Cloud relay… **the hard cap with encrypted SpeedFusion is roughly 200 Mbps, with realistic working throughput around 150 Mbps.**」
> 链接：https://www.waveform.com/guides/multi-wan-guide

另一份独立佐证（Dillon Baird，2023-08-15，updated 2024-06-06）：

> 「Also, **SpeedFusion has a 200 Mbps cap.** As a result, it is best for users who don't need more than 200 Mbps of high-speed connection.」
> 「In addition to spending thousands on your Peplink box, you have to pay an **additional $1,000 per year for SpeedFusion cloud service** to access cloud servers and to enable real channel bonding. **In the absence of the service add-on, your router is merely a load balancing device**, so you can't actually utilize the increased bandwidth」
> 链接：https://dillonbaird.io/articles/mptcpbonding/

**成本（一手价格页，2026-08-17）**：

- **FusionHub 自建（在你自己 VPS 上跑 SpeedFusion 服务端）** —— 一次性授权，按 peer 数：

  | 授权 | SpeedFusion peers | 价格 |
  |---|---|---|
  | **FusionHub Solo** | 1（**免费**） | **$0** |
  | Essential | 5 | **$499** |
  | Pro | 20 | **$1,999** |
  | FusionHub 100 | 100 | $2,999 |
  | FusionHub 500 | 500 | $5,999 |
  | FusionHub 1000 | 1,000 | $7,999 |
  | FusionHub 2000 | 2,000 | $9,999 |
  | FusionHub 4000 | 4,000 | $14,999 |

  > 「**FusionHub Solo is Peplink's free license for connecting a single device**, and a free 30-day evaluation of the full product is available」
  > 「Devices on PrimeCare or PrimeCare+ **do not count** toward FusionHub peer limits」
  > 链接：https://buypeplink.com/product/fusionhub-license/

- **硬件 + PrimeCare 订阅**（Peplink 论坛，2025-08-06，用户与经销商实测报价）：

  > 「If I buy a CarePlan for approximately **$180.00 annually**, I'll have paid for the router twice in five years.」
  > 「**For a Max Br1 Pro 5G, it should come back with PrimeCare (not plus) for $150/year**… or you can get Primecare + for $501, so $125/year.」
  > 「If you are talking about the **B One 5G, $USD599 to buy, $USD115 per year for primecare**… or $USD455 for 4 years.」
  > 链接：https://forum.peplink.com/t/primecare-subscriptions-quite-expensive-for-private-usage/57346

  → 一台 B One 5G：**$599 硬件 + $115/年 PrimeCare**；或者自备 x86 + FusionHub Solo（免费 1 peer）省掉订阅。

- **TCO 参考**（Waveform 自述，注意其销售立场）：

  > 「A comparable DIY setup runs roughly **$2,865 in the first year**.」

**结论**：SpeedFusion 是**唯一有明确「会话不断」承诺**的方案（hot failover + persistent IP）。**最省的合规做法是：自备 x86 软路由 + 自建 VPS 跑 FusionHub Solo（$0 授权）+ 一个 VPS 月费**。但 Solo 只给 1 个 peer，多设备要 $499 起。

### 6.2 OpenMPTCProuter（开源方案）

**项目健康度（阶段二，`gh repo view`）**：

```
repo:      Ysurac/openmptcprouter
stars:     2,513
forks:     360
open issues: 101
license:   GPL-3.0
created:   2017-12-22
last push: 2026-09-25
language:  Makefile（OpenWrt 构建集成）
```

最近提交（全部来自同一人）：

| 日期 | 提交 |
|---|---|
| 2026-09-25 | Add BPI R4 Pro 8X |
| 2026-09-22 | Revert "Update OpenWRT and add BPI r4 pro 8x support" |
| 2026-09-03 | Add gl inet mt3600be config |
| 2026-08-25 | Build qcow2 image by default for x86_64 |
| 2026-08-20 | Fix build |

**可持续性评估**：
- ✅ **9 年持续活跃**（2017-12 至今），2513 stars 是这个领域最高
- ✅ GPL-3.0，完全开源，OpenWrt 生态
- ⚠️ **bus factor = 1**：所有提交都是 `Ycarus (Yannick Chabanois)` 一个人。作者是法国人（栈：ShadowSocks + glorytun），有付费支持渠道但项目本身免费
- ⚠️ 101 个 open issue（对一个单人项目来说算多）
- ⚠️ 它是**完整 OpenWrt fork（构建产物是固件镜像）**，不是插件 —— 意味着升级跟上 OpenWrt 主线有滞后（从 2026-09-22 的 revert 也能看出跟上上游有摩擦）

**原理**：
> 「OpenMPTCProuter (OMR) uses: **ShadowSocks-libev for TCP traffic** between OMR and the VPS; **Glorytun for UDP and ICMP traffic**」
> 「Aggregation: Bonding connections to really aggregate bandwidth from **up to 8 internet connections**」
> 链接：https://dillonbaird.io/articles/mptcpbonding/

**关键前置要求**（决定成败）：

> 「Cloud VPS with 1 GB of RAM and at least 1 vCore, **as closest to you as possible (ping time matters!)**, with network speed **greater than 120% of what you expect to achieve**」
> 「(*) Explanation: If you have 2x 50 Mbps connections that you want to bond into a 100 Mbps connection, your VPS should have at least 120 Mb/s network speed limit to account for protocol overheads. Actual results may vary. **Ping from your home to the VPS should be less than 15ms.**」
> 同上链接

**实测数据（同一个作者的真实部署）**：

> 环境：2× Starlink（1 residential + 1 RV）+ 1× 5G LTE hotspot(T-Mobile) + 1× 4G LTE hotspot(Sprint) + marina WiFi + iPhone hotspot
> 「When using just the Starlink and LTE connections combined **I get speeds in excess of 500Mbps download** – combining Starlink with 5G actually makes for an extraordinary combination of both speed and low latency!」
> 「OpenMPTCProuter can be customized based on your needs and is free of charge apart from VPS bandwidth (**I currently get 2TB/month for only $5**)」
> VPS 实例：「Vultr instance (with Linux Debian, 1GB RAM, 1 vCPU, 25GB NVMe & 2TB Transfer) at **$6 per month**」
> 同上链接

**踩坑**：

> 「**Blocked Sites**: All internet flow that passes through aggregation is encrypted using a VPN. **Your public IP becomes that of the VPS server.** Some services like NETFLIX, DISNEY+, APPLE TV+ … may be alarmist and block your access.」
> 「**Inactive TCP Sessions Are Killed**: For SSH, you can modify ServerAliveInterval in ssh configuration.」
> 「Don't update packages via the interfaces, current packages are from OpenWRT snapshot and **this can break everything**.」
> 同上链接

**测试工具**（官方 wiki，2022-08-26）：
```sh
omr-test-speed          # 聚合下行
omr-test-speed eth1     # 单条线
omr-iperf               # 聚合上行（从服务器侧测）
omr-iperf vps -R        # 聚合下行
# Ctrl+C to stop after at least 2 minutes to have real speed.
```
链接：https://github.com/Ysurac/openmptcprouter/wiki/Test-speed

**成本**：软件 $0 + VPS ~$5–6/月 + 一台 x86 软路由（或 RPi4）。

⚠️ **在国内的可行性**：需要一台**低延迟 VPS**（<15ms 到现场）。国内 VPS 需备案才能开 80/443，但 OMR 用的是 ShadowSocks/glorytun 的自定义端口（安装脚本会给 65101/65001/65222 等），不涉及备案端口。**但我没有找到任何国内赛事/直播现场用 OMR 的实测报告** —— 这属于证据薄弱处（见 §11）。考虑因素是：国内跨省 VPS 延迟 20–40ms 已很常见，可能达不到「<15ms」的要求。

### 6.3 蒲公英 / 贝锐（Oray）—— ⚠️ 这不是聚合方案

**必须澄清**：蒲公英是 **SD-WAN 异地组网（Cloud VPN）**，用来把异地局域网互通，**不是多链路带宽聚合**。百度百科定义：

> 「蒲公英是上海贝锐信息科技股份有限公司推出的 SD-WAN 智能组网路由器系列产品。它通过 **Cloud VPN 技术，无需公网 IP 即可组建异地虚拟局域网**，实现多设备的安全互联互通。」

实测数据（acwifi 拆机评测，2024-06-19）：

> 「虽然看着像是 350KB/秒，实际上用文件容量除以时间就可以得出平均速度大约是 **225KB/秒**，也吻合**免费版所给的"中转带宽"上限：2Mbps**」
> 链接：https://www.acwifi.net/27605.html

→ **免费版中转带宽上限 2Mbps**。这是「异地组网」的带宽，不是聚合带宽。

**它在本场景的定位**：**这是解决 §8「公网可达性」问题的工具，不是解决带宽/冗余的工具。** 如果你需要从外网访问现场服务器，蒲公英可以做旁路；但它给不了你「双线聚合」。

### 6.4 国产多卡聚合路由器 —— 真实成本

我找到了一份**公开的、完整的价目表**（蚂蚁聚合 5G 多卡聚合路由器，页面 2026-01-20 更新）：

| 套餐 | 年费 | 带宽 | 聚合流量 | 超出 |
|---|---|---|---|---|
| 5G 专业版 | **¥1,120/年** | 100 Mbps 独享 | 10 GB/月 | ¥1.1/GB |
| 5G 企业版 | **¥3,100/年** | 200 Mbps 独享 | 50 GB/月 | ¥1.1/GB |
| 5G 国际版 | **¥4,600/年** | 100 Mbps 独享 | 50 GB/月 | ¥4/GB |
| **按量付费（推荐）** | **¥2/小时 + ¥2/GB**（国内节点） | 100 Mbps 独享 | — | 最低起售 1 小时 + 5GB = ¥12 |
| **私有化部署** | **¥20,000/台授权**（支持 50 台路由器） | 自备服务器 | — | 8 核/16GB/40GB 起 |

链接：https://55860.com/jiage

关键说明（原文）：

> 「**聚合云服务不是手机卡或宽带套餐，本地上网流量仍由你的运营商线路提供并计费。**」
> 「**峰值定义**：套餐所示带宽为"峰值公网带宽"，用于表征能力边界，**不构成持续性或恒定带宽承诺**。」
> 「**公平使用**：我们执行公平使用策略（FUP），对异常占用可采取限速或封号等措施。」
> 「一旦开通服务中途**不可退款**」
> 「按 8Mbps 码率估算，50GB 约可持续传输 **14 小时**」

★ **注意最后这条**：如果你按 8Mbps 码率推流，50GB 只够 **14 小时**。赛事现场如果连续两天推流，流量费会失控（¥1.1/GB × 每天 ~86GB = ¥95/天，还不算时长费）。

其他国产品牌（未找到公开价目表，仅供选型参考）：
- 汉华高科（4G/5G 多卡聚合，应急通讯/车载）https://www.hanhgk.com/h-nd-194.html
- 花火（4G/5G 聚合路由器，宣称 MAX 100MB）http://www.nagasoft.cn/router/index.html
- 腾视通维（2RU 机架式，可接入 6 个 5G，宣称高达 4Gbps）https://www.tsnetech.com/products/router-rack-5g/
- 鑫乐成 XLC-710（宣称最高 13 条链路并行）https://www.xlctec.com/list_34/75.html
- 蓝炬科技 EVAK（京东，1U 机架式 8 链路聚合）
- ZTE 中兴 topflow 聚合路由器（淘宝 ¥3,999）

**关于「冰狐」**：多轮中英文搜索（含精确短语）**均未命中该品牌的任何产品页、评测或报价**。要么品牌名有误，要么是小众到没有公开信息。**本报告无法给出「冰狐」的结论**（见 §11）。

### 6.5 聚合方案的真实效果与代价（汇总）

| 维度 | 数据 | 来源 |
|---|---|---|
| 上行聚合能到多少 | OMR 实测 **>500 Mbps 下行**（2×Starlink + 5G LTE + 4G LTE 混合）；国产商用产品标称 **100/200 Mbps 独享**（有 FUP） | dillonbaird / 蚂蚁聚合价目表 |
| 延迟增加多少 | SpeedFusion **+5–10 ms**（隧道绕行 relay）；OMR 增加 = 到 VPS 的 RTT（要求 <15ms 才推荐） | Waveform / dillonbaird |
| 丢包重传代价 | ⚠️ **未找到公开的量化数据**。定性上：OMR 用 ShadowSocks(TCP) + glorytun(UDP)，TCP over TCP 有重传放大风险；SpeedFusion 有 WAN Smoothing / FEC 功能（Waveform 提到「every system runs **FEC and packet duplication** tuned to the customer's specific WAN conditions」） | Waveform |
| 带宽上限 | SpeedFusion：约 150 Mbps 实际 / 200 Mbps 硬顶（B One 5G 硬件）；OMR：无软件上限，受 VPS 与硬件限制 | Waveform / dillonbaird |
| 公网 IP | 隧道出口 IP，**固定不变**（这正是会话存活的原因）；副作用：出口 IP 是 VPS 的，流媒体/风控可能拦截 | Waveform / dillonbaird |
| 数据合规 | ⚠️ 所有流量经第三方 VPS（境外节点的话还涉及跨境） | — |

---

## 7. 方案 F：星链 / 卫星通信作为最后手段

### 7.1 星链在中国大陆：**不可用，且违法**

一份 2026-09-19 的专题核查（starlink-news.com，附完整验证日志）给出五条硬事实（原文）：

> - 「SpaceX has **no MIIT telecom licence of any class in mainland China**, and no pending application appears in MIIT's public records.」
> - 「Starlink's own availability map shows **no service date for the mainland**, and the order flow **rejects mainland addresses**.」
> - 「Unlicensed satellite transmitting equipment is a **prohibited import** under General Administration of Customs (GACC) schedules; terminals are **detained at the border with no compensation**.」
> - 「The administrative fine ceiling for unlicensed telecom operation is **RMB 30,000** under the published English translation of the Telecommunications Regulations (State Council Order No. 291), on top of **confiscation** under China's radio regulations.」
> - 「Hong Kong and Macau license telecoms separately — and **neither has issued Starlink an authorisation either**.」

其验证日志（含日期与检索词，可复现）：

> 「**11 September 2026 — MIIT licence register.** Searched the public telecom business licence system at tsm.miit.gov.cn for SpaceX, Starlink, 星链 and 太空探索技术. Result: no basic telecommunications licence, no value-added service permit, no satellite network user registration.」
> 「**12 September 2026 — order flow.** Attempted a Starlink order against two mainland service addresses (one in Shanghai, one in Chengdu). Neither returned a serviceable coverage result, and checkout could not proceed to payment.」
> 「**What we could not verify.** We were not able to corroborate a single traveler confiscation account to the standard we apply… Forum and social posts describing airport seizures are numerous and consistent, but unverifiable, and we treat them as background rather than evidence. The strongest documented enforcement action to date remains the **2025 maritime penalty**」
> 链接：https://starlink-news.com/2026/09/19/starlink-in-china-ban-price-and-legal-satellite-internet/

关于「买了 Roam 漫游套餐能不能用」：

> 「a Starlink Roam or Global Roam subscription bought abroad **does not create a legal right to transmit inside China**. Roam governs your billing relationship with SpaceX. The offence under Chinese law is operating unlicensed radio equipment on Chinese territory, and it does not care where the invoice was issued.」

关于**被发现的风险**：

> 「A Starlink user terminal is a **transmitter, not a receiver**. SpaceX's own filings with the US FCC describe consumer terminals uplinking in the Ku-band, in the region of **14.0–14.5 GHz**, in a narrow beam pointed at a predictable arc of sky. Provincial radio administration bureaus run monitoring stations and mobile direction-finding units precisely for this class of signal」
> 「In 2025, Chinese authorities **penalised a foreign-flagged vessel for operating Starlink inside Chinese territorial waters** — the first such penalty reported publicly」

⚠️ **来源可信度提示**：这是一个专注 Starlink 的垂直媒体，非官方一手。但其列出的验证步骤指向一手登记系统（tsm.miit.gov.cn、customs.gov.cn、ofca.gov.hk、ctt.gov.mo），且明确标注了「无法核实」的部分。**结论方向与常识及多方报道一致，可用。**

**价格参考（在有授权的市场）**：
- 硬件（Standard kit / Mini）：US$299–599
- Roam（区域）：约 US$50/月起（有流量上限）；Unlimited/Global 约 US$165/月
- Residential/固定：US$80–120/月

### 7.2 中国星网（GW 星座）与千帆星座（G60）

| 星座 | 运营方 | 规划总量 | 2026 年在轨进展 |
|---|---|---|---|
| **千帆星座（G60）** | 上海垣信卫星科技（上海市政府 + 中科院支持） | 一期 1,296 颗，最终 1.5 万+ | 2026-04-09 报道**累计 126 颗**（已完成七批「一箭十八星」）；2026-06-05 **200 颗**；目标 **2026 年年中 324 颗在轨、年底 648 颗** |
| **中国星网 GW 星座** | 中国卫星网络集团 | GW-A59 子星座 6,080 颗 + GW-A2 子星座 6,912 颗 = **12,992 颗** | 截至 **2026 年 8 月约 180 颗在轨**；**2026 年全年计划发射约 300 颗**，计划年内完成骨干网组网 |

来源：
- 21 世纪经济报道（2026-04-09）：「千帆星座已完成七批"一箭十八星"发射,累计发射卫星 126 颗 … 千帆星座计划 2026 年年中实现 324 颗在轨、年底达到 648 颗在轨,一期建设目标为 1296 颗。」https://www.21jingji.com/article/20260409/herald/b20e158b221bffb82ea806e6b0a8da60.html
- 新华网（2024-09-03）：「中国星网的 GW 星座共计规划发射 12992 颗卫星,其中 GW-A59 子星座 6080 颗,分布在 500-600 千米的极低轨道;GW-A2 子星座 6912 颗,分布在 1145 千米的近地轨道。」https://www.news.cn/science/20240903/5bf288c1f58a434f97e5b0cb16fb7f64/c.html
- 百度百科「中国星网 GW 星座」（含 2026 年数据）：「截至 2026 年 8 月，GW 星座在轨卫星已增至约 180 颗，并计划在年内完成骨干网组网。2026 年全年 GW 星座计划发射约 300 颗卫星。」
- 微星（2026-05-12）：「千帆星座第八批组网卫星成功发射」https://www.microsate.com/xwzx/yw/202605/t20260513_8200236.html
- 雪球（2026-06-10）：「截止到 6 月 5 日，千帆卫星数量增加到 200 颗」https://xueqiu.com/9971192902/393570757

**关于「民用终端服务/资费」**：⚠️ **多轮中英文搜索均未找到面向国内消费者的卫星宽带套餐与实测时延数据**。国内低轨星座目前处于**组网期**，公开信息只有发射数量与规划，**没有任何「现在能买到的消费级卫星宽带」**。（另有天通卫星电话，但那是窄带语音/短信，不适用于本条场景。）

**中国星链 vs Starlink 的差距**（NYT 中文，2025-07-25）：

> 「"千帆星座"是中国计划建设的第一个卫星互联网星座，原定在今年年底前把近 650 颗卫星送入轨道。但记录显示，该星座的运营方——自从去年 8 月开始发射以来，上海…」
> 链接：https://cn.nytimes.com/technology/20250725/starlink-spacex-musk-china-satellites/

### 7.3 卫星作为「最后手段」是否现实？

**结论：在本场景下不现实。**

- 星链：**在大陆违法且被主动执法**，终端会被海关扣留，风险远超收益
- 星网/千帆：**2026 年尚未提供面向普通用户的卫星宽带服务**，在轨数量（~180 / ~200 颗）离提供连续覆盖还差一个数量级；规划是「2026 年底骨干网组网」
- 时间线判断：**赛事现场（当下）不能把卫星当作可用兜底**

**更现实的地面「最后手段」**：异构运营商的多张 SIM（移动/联通/电信 + 广电）放在不同 CPE 里，因为同运营商的多条线在同一个基站拥塞时会一起挂掉。Waveform 的原话（虽然是美国语境，但原理通用）：

> 「The point is **path diversity**. **If both connections use the same infrastructure (for example, two cellular SIMs on the same carrier), a single tower issue can take out both.**」

---

## 8. 公网可达性

### 8.1 国内蜂窝（5G/4G）给不给公网 IPv4？

**结论：一般不给。默认是 CGNAT 大内网（100.64.0.0/10）。**

- V2EX 讨论「国内有没有 5G+公网 IP 的民用"无线宽带"服务？」（2023-08-15，25 楼），最相关的几条：

  > #2 yyzh：「那些叫**物联网卡**，前几年广东电信用户直接把 **apn 改成 card** 就能拿公网 ip(没有 ipv6) 当然现在就没戏了.至于那堆 **5G CPE 的倒是没见有给公网 IP 的**」
  > #15 Benson1212：「现在改 card 也有公网 ip，只不过要**关 5g 用 4g 网。5g sa 不行**」
  > #23 Benson1212：「把 **apn 改为 card** 就行了，关掉 5g。**这方法应该不是全国通用的**」
  > #25 CBYellowstone（2023-08-28）：「**实测可行!坐标广东**」
  > #12 Archeb：「无线宽带业务这个挺多的，广东联通和腾讯极光盒子合作搞的"王卡智家无线宽带"… 至于 5G 的，暂时还没有见到有这类业务… 而**公网 IP 就更是没有了**」
  > #8 aru：「无线宽带业务在一些地方是有的，但是**都没公网 IP**，更别说固定 IP 了。」
  > #14 virualv：「公网 ip 这个得看地区，**现在大部分已经收紧了**」
  > 链接：https://www.v2ex.com/t/965626

  另有一位提到 NAT 类型：「5g 下我测过了 **不是没网络接入就是 nat3**」（#24 xinJang, 2023-08-21）

- 行业侧：**公网 IP 是以「物联网公网 IP 卡」这个付费产品形态存在的**，不是普通手机卡默认给的。
  > 「什么是 4G/5G 物联网公网 IP 卡？… 公网 IP 卡的优势是"延迟低、能直连", 是因为 5G 网络本身快,不是"公网 IP"让它变快。不然会出大问题: 1.配置 IP 白名单:只让你的云端和运维终端访问…」
  > 链接：https://www.163.com/dy/article/K91AM6220556EWZS.html （FIFISIM 物联，2025-09-09）
  → **要公网 IPv4 走「物联网卡 + 专用 APN + IP 白名单」的企业渠道，不是消费者渠道。**

- 固定宽带的对照：C114（2022-12-12）标题即「**运营商不再提供公网 IP**，如何才能访问内网服务?」——说明连固网都在收紧。
  > 链接：https://m.c114.com.cn/w241-1218371.html

### 8.2 蜂窝 IPv6 给不给？是不是动态？

**结论：蜂窝下 IPv6 基本是默认开启的**（三大运营商基本都支持），但是：
- 地址是**动态的**（随 PDP 上下文重建而变）
- **IPv6 前缀长度 / 是否给 PD 在蜂窝侧没有可靠公开数据** —— 我找到的全部 PD 数据都是**固网宽带**的（见下）
- 从 36Kr 的实测（2021-08-01）：「至于 4G 或者 5G 网络，现在三大运营商也基本有支持，**基本默认状态下就能支持 IPV6**。小雷找来一台插电信卡的安卓机和一台插联通卡的 iPhone，蜂窝网络下，测试均…」
  > 链接：https://m.36kr.com/p/1336132478081289
- 一个工程实践的直接证言（CSDN，2024-06-14）：「**手机 SIM 卡无公网 IP**,要实现无人机端向地面端(5G 模块供网)通讯,采用 **IPv6 实现数据交互**。」
  > 链接：https://blog.csdn.net/zhou2677273778/article/details/139677221
- ⚠️ 而且**手机热点的 IPv6 前缀向下游设备如何传递**（NAT66? PD? 中继?）在蜂窝场景下普遍是「给一个 /64 做 SLAAC，不给 PD」，这会让「后面接自己的交换机/服务器」的双栈方案变复杂。**我没有找到蜂窝场景的 PD 一手实测数据，这是本报告最大的证据缺口之一。**

### 8.3 固网宽带的 PD 情况（有大量一手数据，可作参照）

V2EX 主题「调查下各地运营商光纤宽带分配的 IPv6 PD 前缀的长度」（2023-04-08 发起，**99 楼**，最后一楼 2025-08-16）——这是中文互联网上最完整的一份 PD 分布调查：

> 楼主补充说明：「由于 IPv6 在末端最简单最主流的分配方式是 **SLAAC（安卓只支持这个），而 SLAAC 对 PD 前缀的最小要求就是 /64**。如果运营商只给你一段 /64，你就只能把这一段分给一个子网。」
> 「考虑到 IPv6 地址空间巨大，最开始部署的时候甚至推荐给每个客户 PD 分配 **/48** 前缀…后来从节约地址空间和提供差别服务定价的角度考虑，给家庭用宽带分配 **/56 或者 /60** 比较合适… **偏偏有些运营商（联通咳咳咳）扣扣搜搜的只给一段 /64**…」
> 后续：「经过不懈努力（半个多月时间内大概给五个客服人员讲解了一遍 IPv6 基础知识吧……），**深圳联通终于给我调成 /60 了**」
> 链接：https://www.v2ex.com/t/930849

从 99 条回复中抽样（运营商/地区/前缀）：

| 地区 | 电信 | 移动 | 联通 |
|---|---|---|---|
| 广州 | /60 | /60 | **/64** |
| 深圳 | /60 | /60 | **/64** |
| 上海 | /56 | /60 | /56（也有人报 /60） |
| 江苏 | 原 /56 → /60 | /60（也有 /64） | **/62** 或 /60 |
| 四川 | /60 | /60 | **/64** |
| 湖北 | **/56** | — | — |
| 北京 | — | /60 | /60 |
| 浙江 | /60 | /60 或 **/64** | — |
| 重庆 | **/56** | /60 | **/64** |
| 天津 | — | — | **/64** 或 /60 |
| 黑龙江 | — | /60 | **/63** |
| 湖南长沙 | **/56** | /60 | /60、/64 都有 |
| 福建 | **/56** | /60 | /60 |

→ **大致规律：电信最宽松（常见 /56–/60）；移动次之（/60，部分 /64）；联通最抠（大量 /64，少数 /62、/63、/60）。** 全部**动态**。

同一主题里还有一条**企业专线的反面案例**（V2EX 2024-06-09，「电信企业宽带 IPv6 禁止下发 PD 前缀！」，62 楼，最后回复 2026-04-23）：

> 楼主：「单位有一条企业专线，有公网 IPv4,IPv6… 分配了一个 ::/56 的段，但**没有 PD 前缀**…打电话问他们说就是这样的**禁止下发前缀**」
> 「每月 **6000 元**，100 兆上下行对等，4 个公网 v4,v6，还是拿工信部红头文件投诉才开的」
> 高赞分析（Archeb，获 3 赞）：「PO 主的认识没有问题，此种情况**除了 ND Proxy 没有其他解法**。因为目前的情况与一般的静态路由并不相同，运营商是将该 /56 前缀的路由指向了自己的设备，而且用户无法再在此设备上配置细分路由…此设备只会在该接口上根据 NDP 协议去学习地址并转发，导致**只有同一个广播域上的设备才能够使用这些 IP**。」
> 链接：https://www.v2ex.com/t/1048099

→ **结论：即使有公网 IPv6，也未必能「往下游子公司网」。** 现场要「接自己的交换机/服务器」，必须实地确认是「给一整段前缀」还是「给一段但网关在运营商设备上」。

### 8.4 需不需要 frp / Tailscale / ZeroTier 打洞？打洞成功率？

**需要，而且这是本场景（CGNAT 蜂窝）的核心手段。**

**Tailscale 官方的成功率数据**（2025-10-15，官方博客）：

> 「In practice, Tailscale succeeds in establishing direct connections nearly all of the time. **Internal metrics have indicated success rates for direct NAT traversal well north of 90% in typical conditions.** In other words, more than nine out of 10 connections between Tailscale nodes end up being direct P2P links.」
> 链接：https://tailscale.com/blog/nat-traversal-improvements-pt-1

**但蜂窝/CGNAT 是明确的最差场景**（同一篇官方博客）：

> 「**Carrier-grade NAT and large-scale networks** — Mobile networks and large Internet Service Providers (ISPs) often use carrier-grade NAT (CGNAT), where thousands of subscribers share a pool of public IP addresses. These systems tend to be **very restrictive - they typically employ short port timeouts and symmetric mapping** to cope with their sheer number of connections. **If you have two mobile devices trying to connect peer-to-peer from different cellular networks, there's a good chance they'll have to use DERP.**」
> 「**Symmetric or "hard" NAT devices** — The biggest culprit is a symmetric NAT… These NATs randomize the source port mapping for every outbound connection… **Enterprise-grade firewalls and carrier-grade NAT gateways (like those used by cellular providers or cloud providers) often behave this way** for maximum connection isolation.」
> 「**Two devices, each behind "hard NAT," will almost always need to use a relay**」

**中文实测（iKuai + CGNAT 双层 NAT）**（gavinchen.cn，「Tailscale + IPv6」专题）：

> 「**Double NAT: Home router (iKuai) + operator CGNAT stacking, UDP hole punching success rate drops to near 0.** Result: Tailscale forced to use DERP relay forwarding, data flow becomes:`xiaoming-server → local NAT → CGNAT → DERP(San Francisco) → peer network → xiaoming-pc` **Latency increases from theoretical 20ms to 200ms+**」
> 该页给出的对照表：

| 维度 | IPv4 + CGNAT | IPv6 直连 |
|---|---|---|
| 地址类型 | 100.64.x.x（私网） | 240e:xxxx（公网） |
| NAT 层数 | 双层（家用 + 运营商） | 0（原生地址） |
| 端口映射 | UPnP 失败 | 不需要 |
| Tailscale 连接 | **经 DERP 中继** | **直连** |
| 延迟 | **160–220 ms** | **20–40 ms** |

> 链接：https://gavinchen.cn/ipv6/

**学术数据（arXiv 2025-10-31，大规模 NAT 打洞测量）**：

> 「…hole punching success rates. They report an "**88% average success rate for TCP connection establishment with NATs in the wild**." However…」
> 链接：https://arxiv.org/html/2510.27500v1

**ZeroTier**：我没有找到 ZeroTier 官方给出的打洞成功率数字。ZeroTier 的 MOON/根服务器架构与 Tailscale 的 DERP 不同，在国内的可用性更多取决于根服务器可达性（历史上国内访问 ZeroTier 根服务器不稳）。**这是证据薄弱处（见 §11）。**

**NAT 类型分布**：⚠️ **我没有找到「国内三大运营商 NAT1/NAT2/NAT3/NAT4 分布比例」的权威统计数据。** 只有零散实测：
- V2EX #24 xinJang（2023-08-21）：「5g 下我测过了 **不是没网络接入就是 nat3**」
- Tailscale 官方定性：蜂窝 CGNAT 倾向 symmetric mapping（= NAT4 / 硬 NAT）

### 8.5 有公网 IPv6 时直连的可行性

**可行，且是本场景最优解。** 依据：

- gavinchen 的对照表（上）：IPv6 直连把延迟从 160–220ms 降到 **20–40ms**
- Tailscale 官方：「**IPv6 can sometimes circumvent NAT issues entirely** — if both peers have native IPv6 connectivity, Tailscale will prefer that for direct connections (since IPv6 requires no NAT)… in the best case, two IPv6-enabled nodes will talk directly, **with no DERP or NAT in the way at all**.」
- 36Kr 实测蜂窝下三大运营商「基本默认状态下就能支持 IPV6」

**但有几个必须现场验证的前置条件**：
1. **运营商 IPv6 防火墙**：国内多数运营商家宽/蜂窝默认**封入站**。需要实测从外网能否 ping / 连入。
2. **80/443 端口**：家宽入站 80/443 普遍被封（需备案才能开）。用高位端口。
3. **地址动态**：必须上 DDNS。IPv6 的 DDNS 比 IPv4 更麻烦（地址变化更频繁，SLAAC 隐私扩展会轮换地址）。
4. **前缀是否给下游**：见 §8.3 的企业专线反面案例 —— 「给一段但网关在运营商设备上」会导致只有同一广播域能用，必须 ND Proxy。
5. **双栈下 mwan3 的短板**：见 §2.4，mwan3 不能单接口管 v4+v6，且不实现 NAT66/NPTv6。
6. **CGNAT 下 UPnP/NAT-PMP 无效**（Tailscale 官方：「CGNAT (100.64.0.0/10)：运营商加一层 NAT，用户拿到"大内网"地址，**无法通过 UPnP/NAT-PMP 映射公网端口**」）

**结论（公网可达性）**：
- ❌ 别指望蜂窝给你公网 IPv4（除非走企业物联网卡 + 专用 APN）
- ✅ **把 IPv6 直连当成首选路径**，现场第一件事就是实测 `curl -6 ifconfig.co` 和从外部 ping 回来
- ✅ 兜底用 Tailscale（有 DERP 保底，最差也能通，只是延迟到 160–220ms）；**ZeroTier / 裸 frp 在 CGNAT 下不如 Tailscale 稳**
- ⚠️ 如果必须要有**固定的、可被外网入站访问的 IPv4**，最可靠的方案是 **frp + 一台有公网 IP 的 VPS**（或蒲公英类 SD-WAN，有独立公网出口但免费版中转只有 2Mbps）

---

## 9. 对比表

### 9.1 主备/分流类（蜂窝双 CPE 第零跳的「常规」方案）

| 架构 | 检测周期 | 实测/推算切换时间 | 成本 | 复杂度 | 已建立 TCP 连接 | 适用 |
|---|---|---|---|---|---|---|
| **OpenWrt mwan3**（默认参数） | 10 s/轮，需连续 5 轮 | **50 s（最好）～130 s（最坏）**；物理断载波秒级 | 免费 | 中 | **断** | 预算零、能接受 1 分钟级中断、愿意调参 |
| **OpenWrt mwan3**（interval 1s/timeout 2s/down 2） | 1–2 s/轮，2 轮 | **约 4–8 s** | 免费 | 中 | **断** | 调优后的可用基线 |
| **OpenWrt + dl12345/mwan3 (nftables 移植)** | 同上 | 同上 | 免费 | 中 | **断** | OpenWrt 24.10+/25.x 用 firewall4 时的现实路径；97 stars 单人项目 |
| **爱快 iKuai**（多线负载 + 自动切换） | **30 s 一检测** | **约 30 s 起（30 s 的整数倍）** | 路由系统免费；部分监控功能限企业版 | 低（GUI） | **断** | 国内商用场景；**必须用多线负载策略**，别用端口/协议分流 |
| **RouterOS `check-gateway`** | 硬编码 10 s，2 次超时 | **约 20 s** | 硬件自带，无授权费 | 中 | **断** | 想要可预测、文档清晰的方案 |
| **RouterOS `netwatch`** | interval 默认 10 s（可调到 1 s） | **约 10–13 s**（interval=1s + 早失败检测 → 数秒） | 同上 | 中 | **断** | 想比 check-gateway 快一倍 |
| **RouterOS recursive route + canary** | 取决于 check-gateway（10 s） | **约 20 s**；能正确处理「网关通但没网」 | 同上 | 中高 | **断** | 上游是 CPE 的拓扑（避免 #25487 那类误判） |
| **RouterOS OSPF + BFD 到自建 CHR** | BFD 亚秒级 | **亚秒级**（社区唯一认可的快速方案） | VPS 月费 | 高 | **断**（仍换 IP） | 有运维能力、要极致切换速度 |

### 9.2 兜底/聚合/卫星类

| 架构 | 原理 | 实测切换/延迟 | 成本 | 复杂度 | 连接存活 | 适用 |
|---|---|---|---|---|---|---|
| **手机 USB 共享（RNDIS）+ mwan3/watchcat** | 手机当 WAN，DHCP 拿地址 | 取决于上层切换逻辑 | 手机 + 流量费（注意热点限制） | 低 | **断** | 最低成本的应急兜底 |
| **USB 4G/5G dongle（QMI/MBIM）** | 纯 modem，直接拨号 | 同上 | dongle ¥200–2000 + 流量 | 中（驱动/模式切换有坑） | **断** | 比手机稳，但**必须选纯 modem**，别买 HiLink 二合一 |
| **手机热点 → WiFi STA（travelmate）** | 无线上行 | 重连需数秒 | 免费 | 低 | **断** | 应急；人群密集时 2.4G 干扰大 |
| **OpenMPTCProuter** | MPTCP + ShadowSocks/glorytun 到自建 VPS | 实测 **>500 Mbps**（2×Starlink+5G+4G）；延迟 = 到 VPS 的 RTT（要求 <15 ms） | 软件 $0 + VPS **$5–6/月** + x86 软路由 | 高（要自己搭 VPS、调内核） | **不断**（隧道 IP 固定） | 有运维能力、想要真聚合、能就近找到低延迟 VPS |
| **Peplink SpeedFusion（自建 FusionHub）** | 包级隧道 + Bandwidth Bonding / Hot Failover / WAN Smoothing | **+5–10 ms** 延迟；bonded 实测 **约 150 Mbps / 硬顶 200 Mbps** | FusionHub **Solo 免费（1 peer）**；Essential **$499（5 peers）**；Pro $1,999（20 peers）；+ VPS | 中 | **不断**（persistent IP） | 想要商业级「会话不断」且预算可控 |
| **Peplink SpeedFusion（SpeedFusion Cloud）** | 同上，用 Peplink 的云 relay | 同上 | 硬件 B One 5G **$599** + PrimeCare **$115/年**（BR1 Pro 5G 为 $150/年）；DIY 首年 TCO 约 **$2,865** | 低 | **不断** | 不想自己运维 |
| **国产多卡聚合路由器（蚂蚁聚合等）** | 厂商云聚合 | 未找到公开实测；标称「峰值公网带宽」**100/200 Mbps**，**非持续承诺** | **¥1,120/年**（100M/10GB月）；**¥3,100/年**（200M/50GB月）；按量 **¥2/小时+¥2/GB**；私有化 **¥20,000**/50 台 | 低 | 不断（有独立公网 IP） | 要国内合规、要固定公网 IP、能接受 FUP |
| **蒲公英 / 贝锐** | **SD-WAN 异地组网（Cloud VPN）** | — | 免费版中转 **2 Mbps** 上限 | 低 | N/A | ⚠️ **不是聚合方案**，是解决「无公网 IP 也能互通」 |
| **Speedify** | 客户端级聚合 | — | 订阅 | 低 | 不断 | 只覆盖单机，不适合整个现场 |
| **星链 Starlink** | LEO 卫星 | — | 硬件 US$299–599 + 月费 | 中 | — | ❌ **中国大陆违法，不可用** |
| **中国星网 / 千帆** | LEO 卫星 | — | 未知 | — | — | ❌ **2026 年尚无消费级服务**（星网约 180 颗、千帆约 200 颗在轨） |

---

## 10. 对本场景（会展/体育馆第零跳）的推荐架构

按「预算 → 可靠性」从低到高：

### 架构 A：最低成本（可接受分钟级中断）
- 2 张不同运营商的 SIM，各插一个 CPE（**必须不同运营商**，同运营商同基站会一起挂）
- 一台 OpenWrt x86/ARM 软路由跑 mwan3
- **必须改默认参数**：`interval 2` / `timeout 2` / `down 3` / `up 2` / `reliability 2`，track_ip 用 4 个不同厂商的（1.1.1.1 / 9.9.9.9 / 223.5.5.5 / 119.29.29.29），**别用 Google DNS 单点**（wiki 明确警告会被限速）
- 第零跳后面**所有业务必须实现重连**（这是硬约束，不是建议）
- 预期中断：**约 5–10 秒**（调参后）

### 架构 B：推荐（会话不中断）
- 2 张不同运营商 SIM + 2 个 CPE（纯 modem 型，如 RM500U 类模组，**不要 HiLink 二合一**）
- 一台 x86 软路由
- **Peplink SpeedFusion**：自建一台低延迟 VPS 跑 **FusionHub Solo（免费）**，或直接买 **FusionHub Essential $499**
  - 换来的是：**persistent IP + 会话不断 + +5–10ms 延迟 + ~150Mbps 上限**
  - 或 **OpenMPTCProuter**：软件免费 + VPS $5–6/月，无 200Mbps 上限，但运维成本高、需要 <15ms 的 VPS
- 第零跳后面**仍然建议业务实现重连**（双保险：隧道会有抖动/重连窗口）

### 架构 C：保底（预算充足 + 要国内合规公网 IP）
- 架构 B + 一路**国产多卡聚合路由器**（¥3,100/年档）：拿到**固定独立公网 IP** + 端口映射
- ⚠️ 注意流量费：按 8Mbps 码率，50GB/月只够约 **14 小时**；赛事两天推流会爆

### 无论哪种，现场必须做的 4 件事
1. **实测切换**：真拔线 / 真让 CPE 断网，用秒表 + 持续 ping 记录，不要信文档
2. **实测公网可达性**：`curl -6 ifconfig.co`、从外网 ping 回来、确认运营商 IPv6 入站是否被封
3. **实测 IPv6 前缀是否下发给下游**（如果架构依赖 IPv6 直连）
4. **准备异构兜底**：至少一张不同运营商的 SIM（甚至广电/虚拟运营商），因为同基站拥塞会让同运营商的多条线一起完蛋

---

## 11. 不确定 / 证据薄弱处（**必须明说**）

| # | 事项 | 状态 | 说明 |
|---|---|---|---|
| 1 | **iKuai 的毫秒级切换** | ❌ 未找到任何证据 | 官方文档只写「线路检测是 30s 一检测」。市面上的「毫秒级」说法与官方矛盾。**本报告以 30s 为准** |
| 2 | **iKuai 免费版 vs 企业版的完整功能边界与价格** | ⚠️ 不完整 | 只从官方文档里零散看到「3.7.16 企业版支持 [WAN 详情曲线图]」。**没有公开的功能对照表** |
| 3 | **mwan3 的 50–130s 结论** | ⚠️ 推算，非秒表实测 | 由 `mwan3track` 源码算法 + 官方参数表严格推导，并用 Nelson 的博客（"5 tests fail in a row"）交叉验证；但**没有找到一份带秒表的公开实测**。OpenWrt 官方论坛的搜索 API 全程 429，未能系统性检索论坛 |
| 4 | **爱快/华为/中兴 dongle 之外的 USB 4G 网卡型号兼容性** | ⚠️ 只覆盖少数型号 | iKuai 官方只列了 3 个已知型号；OpenWrt 侧只有社区案例，**没有官方 HCL** |
| 5 | **「冰狐」品牌** | ❌ 完全未命中 | 多轮中英文搜索（含精确短语）未找到任何产品页/评测/报价。**无法给出结论** |
| 6 | **聚合方案的「丢包重传代价」量化** | ❌ 未找到公开数据 | 只知道 SpeedFusion 有 FEC/包复制（Waveform 自述），OMR 用 ShadowSocks(TCP)+glorytun(UDP)。**没有找到任何一方给出的「重传率 / 额外流量开销 / 抖动」实测数字** |
| 7 | **OpenMPTCProuter 在国内的实测** | ❌ 未找到 | 所有实测报告（Dillon Baird 等）都是海外/船上场景。国内跨省 VPS 延迟普遍 20–40ms，**可能达不到官方推荐的 <15ms** |
| 8 | **三大运营商蜂窝侧的 IPv6 PD 情况** | ❌ 未找到一手数据 | 找到的 99 楼 PD 调查**全部是固网宽带**。蜂窝下是给 /64 SLAAC 还是给 PD、给多大，**没有可靠数据** |
| 9 | **国内运营商 NAT1/2/3/4 分布比例** | ❌ 未找到 | 只有零散实测（"不是没网络接入就是 nat3"）和 Tailscale 的定性描述（蜂窝 CGNAT 倾向 symmetric） |
| 10 | **ZeroTier 打洞成功率** | ❌ 未找到 | 未找到 ZeroTier 官方数字，也未找到国内蜂窝下的系统性实测 |
| 11 | **国产聚合路由器的实测数据** | ❌ 只有厂商标称 | 蚂蚁聚合价目表明确写了「峰值公网带宽…**不构成持续性或恒定带宽承诺**」，即厂商自己也不承诺。**没有任何第三方实测** |
| 12 | **星网/千帆的消费级资费与时延** | ❌ 未找到 | 只有发射数量与规划。**没有任何面向用户的套餐、终端价格、实测 RTT** |
| 13 | **mwan3 nftables 移植（dl12345/mwan3）的长期可持续性** | ⚠️ 存疑 | 97 stars、单人、2026-04 才创建、未上游。**issue #2/#12 明确在问「能不能进 OpenWrt 官方源/自建 feed」** |
| 14 | **OpenWrt 官方 wiki 的 2025–2026 版本** | ⚠️ 无法直接读取 | openwrt.org 已部署 **Anubis 反爬（PoW 挑战）**，r.jina.ai（AS30058 被封 401）、md.succ.ai、pure.md、markdown.new、web.archive.org 的 2025+ 快照**全部返回 Anubis 挑战页**。本报告的 mwan3 参数表来自 **2024-01 的 wayback 快照** + **2026-08 的源码直接读取**，两者交叉验证一致 |
| 15 | **OpenWrt 官方论坛的系统性检索** | ⚠️ 未完成 | `forum.openwrt.org/search.json` 全程返回 `429 Too Many Requests`。只取到了 2 个具体帖子。**可能存在本报告未覆盖的 mwan3 实测帖** |
| 16 | **`watchcat` 的具体检测参数** | ⚠️ 未深挖 | 只确认了它存在且用途正确，**未读取其源码/参数** |

---

## 附：核心证据索引

### 一手源码 / 官方文档
- `openwrt/packages` → `net/mwan3`（v2.12.2）源码：`files/usr/sbin/mwan3track`、`files/etc/config/mwan3`、`files/lib/mwan3/*.sh`、`Makefile`
- OpenWrt wiki mwan3（2024-01 wayback 快照）：https://web.archive.org/web/20240101id_/https://openwrt.org/docs/guide-user/network/wan/multiwan/mwan3
- MikroTik Netwatch 官方文档（2025-10-08 更新）：https://help.mikrotik.com/docs/spaces/ROS/pages/8323208/Netwatch
- MikroTik IP Routing 官方文档：https://help.mikrotik.com/docs/spaces/ROS/pages/328084/IP+Routing
- 爱快官方文档：多线负载 / 多线环境线路配置详解 / 内外网设置 / 线路监控 / 系统日志 / USB WAN
- Peplink FusionHub 价格：https://buypeplink.com/product/fusionhub-license/ （2026-08-17）
- Tailscale NAT traversal 官方博客（2025-10-15）：https://tailscale.com/blog/nat-traversal-improvements-pt-1
- OpenMPTCProuter 官方 wiki Test-speed：https://github.com/Ysurac/openmptcprouter/wiki/Test-speed

### 关键 GitHub issue
- [#16818 nftables 迁移](https://github.com/openwrt/packages/issues/16818)（189 评论，2021-10 → 2026-08，OPEN）
- [#16817 LTE 重启后 disabled](https://github.com/openwrt/packages/issues/16817)（2021-10 → 2026-05，OPEN）★
- [#24973 已建立连接不切换](https://github.com/openwrt/packages/issues/24973)（2024-09，OPEN）★
- [#25487 ICMP unreachable 被误判为在线](https://github.com/openwrt/packages/issues/25487)（2024-12，OPEN）★★
- [#23527 双 WAN 塌缩成单 WAN](https://github.com/openwrt/packages/issues/23527)（2024-02 → 2025-12，OPEN）
- [#14332 L2TP IPv6 50% 丢包](https://github.com/openwrt/packages/issues/14332)（2020-12 → 2025-11，OPEN）
- [#29714 mwan3track 100% CPU](https://github.com/openwrt/packages/issues/29714)（2026-06，CLOSED）

### 关键社区实测
- OpenWrt 论坛：拔线实测（2023-05-31）：https://forum.openwrt.org/t/multiwan-with-mwan3-in-22-03-5-not-working-properly/161784 ★
- Nelson Minar：mwan3 默认参数 + Starlink 4 分钟未切换（2022-04-22）：https://nelsonslog.wordpress.com/2022/04/22/openwrt-rpi4-failover-and-load-balancing/ ★
- MikroTik 论坛 topic 169108（2023-08-27，54 楼）：https://forum.mikrotik.com/t/simpler-failover-for-two-gateways-i-found-working/169108 ★
- MikroTik 论坛 topic 160877（2022-09-17，54 楼）：https://forum.mikrotik.com/t/most-effective-failover/160877 ★
- V2EX PD 前缀调查（2023-04-08，99 楼）：https://www.v2ex.com/t/930849 ★
- V2EX 蜂窝公网 IP 讨论（2023-08-15，25 楼）：https://www.v2ex.com/t/965626 ★
- V2EX 电信企业宽带禁 PD（2024-06-09，62 楼）：https://www.v2ex.com/t/1048099
- gavinchen：iKuai+CGNAT 打洞成功率近 0：https://gavinchen.cn/ipv6/ ★
- Dillon Baird：OMR 实测 >500Mbps（2023-08-15）：https://dillonbaird.io/articles/mptcpbonding/ ★
- Waveform multi-WAN 指南（2026-03）：https://www.waveform.com/guides/multi-wan-guide ★（厂商立场）
- ambientnode：RPi4 + LTE dongle 真实项目（2024-05-08）：https://ambientnode.uk/raspi-router
- 蚂蚁聚合价目表（2026-01-20）：https://55860.com/jiage ★
- Starlink 中国合规核查（2026-09-19）：https://starlink-news.com/2026/09/19/starlink-in-china-ban-price-and-legal-satellite-internet/ ★

---

*报告结束。所有引文均保留原文（中/英），链接与页面时间已标注。证据薄弱处见 §11。*
