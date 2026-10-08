# 工业级/企业级 5G 路由器与 CPE 的基带平台调研

> 目的：给「第零路外网接入」选型提供**最硬的一条判据** —— 真正的工业级设备，基带用的是谁家的什么平台。
> 调研日期：2026-10（以页面/文档标注日期为准）。所有结论区分「**官方明写**」与「**推断**」。
> 未找到证据的地方一律写「未找到证据」，不编造。

---

## 0. 方法论与重要前置结论

1. **绝大多数工业路由器 datasheet 不写模组型号，更不写基带芯片。** 映翰通 IR925、H3C MSR1004S-5G、四信 F-NR100、有人 USR 系列、宏电 5G CPE 的官方规格页/说明书里，5G 部分只写「工业级无线模块」「内置单 5G 模组」「5G Sub-6」这类字样，**不点名模组也不点名芯片**。
2. 因此本报告的最高证据等级来自三处，恰好都能同时给出「模组型号 + 芯片型号」：
   - **整机厂自己写给运营商/客户的 datasheet**（Nokia FRRO501a 是最干净的一例）
   - **运营商入网认证数据库**（T-Mobile 的 device-certification 页面有 `Chipset brand name` / `Chipset model number` / `Module brand name` / `Module model number` 四个独立字段，是本次调研的"金矿"）
   - **模组厂自己的官网产品页 / 官方新闻稿 / 官方产品册 PDF**
3. 免费转载站（Scribd / device.report / 各类分销商）只作旁证，凡只有这类来源的一律标「推断」。

---

## 1. 表一：主流 5G 模组型号 → 芯片平台 → 制式 → 发布年份 → 来源

### 1.1 移远 Quectel

| 型号 | 芯片平台 | 5G 制式/版本 | 发布/商用年份 | 证据等级 | 来源 |
|---|---|---|---|---|---|
| **RM500Q-GL / RM500Q-AE** | **Qualcomm SDX55**（骁龙 X55） | 5G NR Sub-6，NSA/SA，3GPP R15 | 2019 发布，2020 商用 | **官方明写** | ① [Nokia 工业 5G 路由器 datasheet](https://www.westconcomstor.com/content/dam/wcgcom/Global/CorpSite/pdfs/Nokia-Data-sheet-Router-HWNDUSES1040.pdf)：`Module Quectel RM500Q-GL` / `Chipset Qualcomm SDX55` ② [Quectel RM50xQ Q&A 报道（国际电子商情 2019-03-29）](https://www.esmchina.com/news/5007.html)：「移远发布的 4 款 5G 模组新品，包括 RG500Q、RG510Q、RM500Q、RM510Q，**均基于高通 X55 5G 芯片**」 |
| **RM502Q-AE** | **Qualcomm SDX55** | Sub-6，NSA/SA，R15 | 2020 | **官方明写（同句并列）** | [Quectel 官方新闻 2022-09-29](https://www.quectel.com/news-and-pr/mwc-las-vegas-qualcomm-5g-wifi-link-aggregation/)：「the RM502Q-AE and the RM520N-GL powered by **Snapdragon® X65/X62/X55** 5G Modem-RF Systems」（顺序与前两个型号一一对应） |
| **RM505Q-AE** | Qualcomm SDX55（**推断**：与 RM500Q/RM502Q 同属 RM50xQ-AE 系列同为 R15） | Sub-6，NSA/SA，R15 | 2020 | 官方只明写系列=R15 | [Quectel 官方 5G 中文产品册（2021-01）](https://market.quectel.com/wp-content/uploads/custom/pdf/5G_20210129.pdf)：`RM50xQ-AE 系列…采用 3GPP Release 15 技术`，与 RM500Q-AE / RM502Q-AE 并列成一张表 |
| **RM520N-GL / RM520N 系列** | **Qualcomm SDX62**（骁龙 X62） | Sub-6，NSA/SA，**3GPP R16**；SA 2.4Gbps DL / 900Mbps UL，NSA 3.4/0.55Gbps；**-40~+85℃** | 2021-02 发布，2022-12 过 Telstra 认证 | **官方明写 + 运营商库双证** | ① [Quectel 官方 R16 发布新闻 2021-02-10](https://www.quectel.com/news-and-pr/quectel-announces-2nd-gen-of-5g-nr-modules-compliant-with-3gpp-r16-standard/)：「the RG520N (LGA), the **RM520N (M.2) based on Snapdragon X62**」 ② [Quectel 官方 Telstra 认证新闻 2022-12-07](https://www.quectel.com/news-and-pr/5g-modules-telstra-australia-certification/)：「the first modules **based on the Qualcomm® Snapdragon™ X62**」 ③ [T-Mobile 认证页 Quectel RM520N-GL](https://www.t-mobile.com/business/solutions/iot/device-certification/quectel-rm520n-gl)：`Chipset model number: SDX62` / `Module model number: RM520N-GL` ④ [官方产品页](https://www.quectel.com/product/5g-rm520n-series/) |
| **RM521F-GL** | **Qualcomm SDX65**（骁龙 X65） | Sub-6，R16 | 2022 | 推断（第三方一致，官方未直接明写） | [Quectel 官方论坛帖](https://forums.quectel.com/t/5g-rm521f-rm520-issue-aggregation-nr-5g/31354)：「RM521F (**X65 snapdragon**)」；[ispreview 论坛](https://www.ispreview.co.uk/talk/threads/build-my-own-5g-modem-router.42034/page-3)：「RM521F-GL, **based on SDX65**」。注：该型号官方论坛 2024-05 回复称「RM521F-GL had stopped to produce」 |
| **RM530N-GL** | Qualcomm SDX62 + 毫米波（**推断**：官方只明写 R16 + mmWave，未点名芯片） | Sub-6 **+ mmWave**，NSA/SA，**R16**；4.0Gbps DL / 1.4Gbps UL；-40~+85℃ | 2021-02 与 RM520N 同批发布 | 官方明写制式，芯片为推断 | [Quectel 官方产品页](https://www.quectel.com/product/5g-rm530n-gl/)：「Based on **3GPP Release 16**…compatible with Quectel 5G modules from the Sub-6-only **RM520N series**」 |
| **RM550V-GL / RM551E-GL** | **SDX72 / SDX75** | Sub-6 + mmWave，M.2 | 2024-2025 | 官方产品册转录（PDF 本体未能抓取） | [Quectel 官方《5G & LTE-Advanced Module Product Overview》](https://www.avnet.com/wcm/connect/aeb49403-e602-48dc-8a9e-3ec60768ad1d/quectel-5g-lte-advanced-module-product-overview.pdf)（Avnet 镜像）：`Variant RM550V-GL / RM551E-GL … Platform SDX72 / SDX75`。另见 [device.report 转录](https://device.report/m/9e9991c95d09608edcd88d82adb63f44fa675dfcf77fc434eda6df4df66f3568)。**该 PDF 两次抓取均失败（target_unreachable / bot_blocked），本行仅为检索快照转录，未能读原文全文。** |
| **RM500U-CN / RG500U-CN / RG200U** | **紫光展锐 春藤 V510** | Sub-6，NSA/SA，R15 | 2021-02（RG500U-CN 商用）/ 2021-08（RG200U） | **官方明写** | ① [Quectel 官方 2021-02-24](https://www.quectel.com.cn/news-and-pr/quectel-5g-modules-commercial-use-unisoc)：「基于**紫光展锐春藤 V510 平台**的移远 RG500U-CN 5G 模组日前已进入商用阶段…助力 30 多家客户在**电力、CPE、工业网关**等行业实现商用化落地」 ② [Quectel 官方 2021-08-11](https://www.quectel.com.cn/news-and-pr/quectel-new-5g-module-rg200u)：「正式推出基于**展锐唐古拉 5G 基带芯片平台 V510** 的超小尺寸 5G 模组 RG200U」 |
| **RG500L-EU** | **MediaTek T750** | Sub-6，NSA/SA，R15，5G 2CC CA | 2021 | **官方明写** | [Quectel 官方 5G 中文产品册 2021-01](https://market.quectel.com/wp-content/uploads/custom/pdf/5G_20210129.pdf)：「**搭载 MTK T750 平台**，7nm 制程工艺…4 核 ARM Cortex-A55 CPU…可为**工规级模组**，适用于工业级和商业级应用」 |
| **RG620UA / RM520UA 系列** | **紫光展锐 V620** | 5G eMBB，R16 全特性 | **2026-03-05（MWC 2026）** | **官方明写** | [Quectel 官方 2026-03-06](https://www.quectel.com.cn/news-and-pr/5g-module)：「RG620UA/RM520UA 系列 5G 模组**基于展锐 V620 平台**…高端**工业级**模组」 |
| RG258UB-GL/CN | 紫光展锐 V610 | 5G SA/NSA 全网通 | 2026-03 | 官方明写 | 同上 |
| RG155UC-CN | 紫光展锐 V527 | 5G RedCap | 2026-03 | 官方明写 | 同上 |

### 1.2 广和通 Fibocom

| 型号 | 芯片平台 | 5G 制式/版本 | 年份 | 证据等级 | 来源 |
|---|---|---|---|---|---|
| **FM160（-NA / -EAU / -PN / -JK）** | **Qualcomm Snapdragon X62** | Sub-6，NSA/SA，**R16**；SA 2470/900Mbps，EN-DC 3470/555Mbps；**-30~+75℃**；认证 CE/RCM/Anatel/FCC/IC/TELEC/JATE/KC + GCF/PTCRB，运营商 Telstra/AT&T/TMO/Verizon/KDDI/DCM | 2021-09 工程样片（2022-06 过 CE/RCM/FCC/PTCRB/GCF） | **官方明写** | ① [官方产品页](https://www.fibocom.com/en/SeriesProduct/info_itemid_80.html)：「developed with the **X62 modem**」 ② [官方新闻 2021-09-23](https://www.fibocom.com/en/newscenter/fibocom-5g-sub6-module-fm160.html?id=2510)：「**Powered by the Qualcomm Snapdragon® X62 modem chipset**」 |
| **FG160** | Qualcomm **SDX62** | Sub-6，R16 | 2022 | 官方合作方资料 | [Richardson RFPD（广和通 5G 模组方案页）](https://www.richardsonrfpd.com/iot-videos/fibocom-high-performance-fm160-fg160-5g-module-solution-for-fwa/)：「Powered by the **Qualcomm SDX62 chipset**, the modules deliver maximum downlink rates of 3.5Gbps…」（FM160/FG160 并列） |
| **FM150 / FG150** | **未找到官方明写的芯片平台**（按 2019-2020 发布 + R15 推断为 SDX55 —— **推断**） | Sub-6 + mmWave，SA/NSA | 2019 首发样片；FM150-NA 2020-10 过 FCC/IC/PTCRB | 官方只写制式 | [Fibocom 官方 2020-10-19](https://www.fibocom.com/en/newscenter/fibocoms5g.html?id=1947)：FM150-NA 「supporting 5G standalone network (SA) and non-standalone network (NSA)…5G Sub 6 and mm wave bands」，**全文未提芯片平台** |
| **FG360（-EAU / -NA / -JP / -IN / -MEA）** | **MediaTek T750** | Sub-6，SA/NSA，7nm，内建 4 核 A55，2CC CA（200MHz）；**-30~+75℃**；认证 CE/RCM/FCC/IC/JATE/TELEC + GCF/PTCRB/HF | 2021（Q3 量产） | **官方明写** | ① [Fibocom 官方产品页](https://www.fibocom.com/en/SeriesProduct/info_itemid_82.html)：「FG360 is equipped with **MTK T750 chip**, adopting 7nm manufacturing process」 ② [Fibocom 官方新闻（世界首个 5G SA 数据呼叫）](https://www.fibocom.com/en/newscenter/info_itemid_2149.html)：「FG360, based on the **MediaTek T750 chipset platform**」 |
| 新一代 T830 平台 5G 模组（官方未点名具体型号） | **MediaTek T830** | R16，4nm，4 核 A55，7.01Gbps，Sub-6 4CC-CA | 2022-09-14 | **官方明写** | [Fibocom 官方 2022-09-14](https://www.fibocom.com/en/newscenter/5g-module-based-on-mediatek-t830.html?id=3081)：「Fibocom started the development of the new generation 5G module based on the newly launched **MediaTek T830 chipset platform**」 |
| **FM180** | **未找到证据**（本次未检索到官方产品页或 datasheet 明写平台） | — | — | — | — |
| 广和通整体平台策略 | 官方口径：**"多芯平台" = 高通 + 联发科 + 展锐** | — | — | **官方明写** | [Fibocom 官方「点击解锁广和通 5G 模组关键词」](https://www.fibocom.com/5gFeaturePage/info_itemid_4430.html)：「广和通已全面布局多芯平台，推出多款基于**高通、联发科技、展锐**等 5G 芯片平台的 5G 模组」 |

### 1.3 美格智能 MeiG

| 型号 | 芯片平台 | 5G 制式/版本 | 年份 | 证据等级 | 来源 |
|---|---|---|---|---|---|
| **SRM815 / SRM825（LGA / M.2）** | **Qualcomm SDX55**（骁龙 X55） | Sub-6，SA/NSA，**R15**，LTE Cat 22，内建 GNSS | 2019-10（Qualcomm 5G Summit 展出） | **官方明写** | [MeiG 官方新闻 2019-10-21](https://en.meigsmart.com/articledetail/175.html)：「SRM815 and SRM825 are designed in different packages (LGA & M.2). **Based on the design of Qualcomm SDX55 5G baseband chip**」 |
| **SRM825W（毫米波版）** | **Qualcomm SDX55** | Sub-6 **+ mmWave**，R15，SA/NSA；mmWave 7.53/2.98Gbps；Sub-6 4Gbps/450Mbps；**扩展工作温度 -40~+85℃** | 2020 | **官方 datasheet 明写** | [MeiG SRM825W Module Specification V1.1 PDF](https://www.mrc-gigacomp.de/pdfs/MeiG_SRM825W_Module%20Specification_V1.1.pdf)：「It implements **Qualcomm SDX55 chipset** which supports SA and NSA network types, and comply with **3GPP Release 15**」 |
| **SRM825N / SRM815N** | **Qualcomm Snapdragon X62** | Sub-6，SA/NSA，**R16** | 2022 | 官方 datasheet（经分销商转载） | 文件名即 `MeiG_**X62**_SRM825N-EA ModulE V1.0.pdf`（[TME 转载](https://www.tme.eu/Document/dbbc16ff3a340efe2d771cb6bd55e5d3/MeiG_X62_SRM825N-EA+ModulE+V1.0.pdf)，**本次抓取 target_unreachable**）；旁证：[Satronel SRM815N](https://satronel.com/download/files/index.php?f=6d103c0e8f7ba5ac899e17375536f7335728a0b7)：「It integrates **Qualcomm Snapdragon X62 chipset**, complies with 3GPP **Release 16**」 |
| **SRM817** | **Qualcomm Snapdragon X72** | 5G（终端产品做到 4Gbps DL） | 2025 | **Qualcomm 官方设备库明写** | [Qualcomm Device Finder: MeiG SRT8780](https://www.qualcomm.com/networking-infrastructure/device-finder/meig-smart-technology-co-srt8780)：「powered by the Qualcomm Dragonwing™ **X72** platform and based on the **MeiG Smart SRM817 module**」 |
| **SRM928** | **未找到证据** | — | — | — | 本次检索未命中该型号的官方产品页/datasheet |
| SRM813Q（RedCap） | Qualcomm Snapdragon X35 | 5G RedCap | 2024 | 第三方 | [everythingRF](https://www.everythingrf.com/products/cellular-modules/meig-smart-technology/811-2148-srm813q) |

### 1.4 芯讯通 SIMCom

| 型号 | 芯片平台 | 5G 制式/版本 | 年份 | 证据等级 | 来源 |
|---|---|---|---|---|---|
| **SIM8200G / SIM8200-M2 / SIM8202X-M2** | **Qualcomm Snapdragon X55** | Sub-6（SIM8200G 不含 mmWave），NSA/SA，**R15**，最高 4.0Gbps DL；**工作温度 -40~+85℃**；认证含 CCC/CTA/SRRC/三运营商入库/JATE/TELEC/RCM/CE(RED)/**GCF** | 2019-12 宣布 | 官方只写 R15/温度；芯片为第三方一致 | [everythingRF 2019-12-03](https://www.everythingrf.com/news/details/9342-SIMCom-Partners-with-Qualcomm-to-Develop-5G-Modules)：「SIM8200 and SIM8300 are **based on Qualcomm's Snapdragon X55 5G Modem platform**」；[SIMCom 官方产品页 SIM8200G](https://www.simcom.com/product/SIM8200G.html) |
| **SIM8262X-M2 / SIM8262G-M2（E/A/G）** | **Qualcomm SDX62（Snapdragon X62）** | M.2，Sub-6，NSA/SA，**R16**；2.4Gbps DL/500Mbps UL；**-30~+70℃** | 2021-03-04（MWC 上海） | **官方明写** | [SIMCom 官方新闻](https://www.simcom.com/news_view-146.html)：「5G module **SIM8262G-M2**, supports R16, **equipped with Qualcomm SDX62**」；[官方产品页 SIM8262X-M2](https://www.simcom.com/product/SIM8262X-M2.html) |
| **SIM8270X（NA/E/SA）** | **Qualcomm Snapdragon X72** | LGA，NSA/SA，**R17**；SA 2.4Gbps/1Gbps UL，NSA 3.4Gbps；**-30~+70℃**；认证 FCC/IC/PTCRB/CE(RED)/**GCF** | 2024-02-27（MWC 巴塞罗那） | **官方明写** | [SIMCom 官方新闻 2024-02-27](https://www.simcom.com/news_view-340.html)：「SIMCom has released 5G module series for 5G Advanced—**SIM8270X (based on Qualcomm Technologies, Inc.'s Snapdragon® X72 5G Modem-RF System)**」；[官方产品页](https://en.simcom.com/product/SIM8270X.html) |
| SIM8282G-M2 | Qualcomm Snapdragon X65 | Sub-6 + mmWave，NSA/SA，10Gbps | 2021-03 | **官方明写** | [SIMCom 官方新闻](https://www.simcom.com/news_view-146.html)：「Based on Qualcomm's fourth-generation 5G modem-to-antenna solution **Snapdragon X65**」 |
| **SIM8380G-M2** | **官方未点名芯片**（下载区同时提供 `QCOMM_FH_Single_UpgradeTool_**X62_X65**` 与 `315_X55_X65_X62_Series_5G_Module_Schematic&Layout_checklist`，指向 X62/X65 家族 —— **推断**） | M.2，Sub-6 **+ mmWave**（n257/258/260/261），**R16**；mmWave 7Gbps/3Gbps | 2022-08（SPEC 20220321） | 官方只明写 R16/毫米波 | [SIMCom 官方产品页 SIM8380G-M2](https://www.simcom.com/product/SIM8380G-M2.html) |

### 1.5 中兴 ZTE 自家模组

| 型号 | 芯片平台 | 5G 制式 | 年份 | 证据等级 | 来源 |
|---|---|---|---|---|---|
| **ZM9000**（5G 工业模组，M.2 30×52×3.6mm） | **高通 SDX55**（骁龙 X55） | 5G NSA/SA 双模，下行最高 3.8Gbps、上行双流 662Mbps；-40~+85℃；集成 GNSS/FOTA | 2019-10 打通数据业务，预计 2019-12 商用；2021-08 中标中国移动 5G 通用模组集采 M.2 封装第二名 | **中兴自家官网明写** | ① [中兴手机官网 2021-12-21](https://www.ztedevices.com/cn/news/2021-zhanfang-cup-award/)：「**中兴 ZM9000 采用高通 SDX55 基带平台芯片**，可向下兼容 4G 网络…满足 -40℃ ~ +85℃ 的工作环境」 ② [通信世界网 2019-10-17](http://www.cww.net.cn/article?id=459402)：「中兴通讯 5G 模组 ZM9000 实现了在 5G NSA/SA 网络下，**高通 SDX55 平台（骁龙™ X55 5G 调制解调器）**的数据业务打通」 |
| ZM9010 | 未找到证据（官方只写"内置 eSIM+SE 二合一芯片、支持国密 SM1/2/3/4/9"） | 5G 国产模组 | 2021 年底 | — | 同 ① |
| **ZM9300（车规级 5G R16）** | **中兴全栈自研 5G Modem 芯片平台** | 5G NR SA/NSA，R16，最高 4.6Gbps DL / 2.5Gbps UL | 2023-06 公布，2024 量产 | **中兴官方明写** | [中兴通讯官网 2023-09-06](https://www.zte.com.cn/content/zte-site/www-zte-com-cn/china/about/news/20230906c5.html)：「**5G Modem 芯片平台**，可同时支持 5G NR 独立组网(SA)和非独立组网(NSA)模式，最高可支持 4.6 Gbps 下行速率和 2.5 Gbps 上行速率」；[中兴官网 2023-06-08](https://www.zte.com.cn/china/about/news/20230608c1.html)：「国内首个**基于全自研芯片平台**打造的车规级 5G R16 ZM9300 模组」 |

> ⚠️ **一处官方自相矛盾，必须标注**：中兴官网 MWC2020 专题页写「中兴 5G 工业模组 ZM9000 **采用中兴自研方案**」（[链接](https://www.zte.com.cn/china/topics/mwc2020/exhibition-detail.aspx-id=100668226.html)），而中兴手机官网与通信世界网都明写「采用**高通 SDX55** 基带平台」。最可能的解释是「自研方案」指整机/模组方案，基带仍为高通 SDX55；但仅从文字无法排除。**建议以 SDX55 为准，并把这一矛盾写进选型风险。**

### 1.6 顺带查到的模组厂（出现在工业设备里，值得知道）

| 模组 | 芯片平台 | 制式 | 证据 | 来源 |
|---|---|---|---|---|
| **Sierra Wireless EM9190 / EM9191** | **Qualcomm SDX55** | Sub-6（+mmWave），R16 | 运营商库明写 | [T-Mobile: Cradlepoint E3000-5GB](https://www.t-mobile.com/business/solutions/iot/device-certification/ericsson-cradlepoint-e3000-5gb)：`Chipset model number: SDX55` / `Module brand name: Sierra Wireless` / `Module model number: EM9190` |
| **Sierra Wireless EM9291** | **Qualcomm SDX62** | Sub-6，R16 | 运营商库明写 | [T-Mobile: Ubiquiti U5g-Max](https://www.t-mobile.com/business/solutions/iot/device-certification/ubiquiti-u5g-max)：`Chipset model number: SDX62` / `Module model number: EM9291` |
| **Sierra Wireless EM9293** | **Qualcomm SDX65M** | Sub-6（宣称支持 mmWave），**R16**；4.9Gbps DL / 1.3Gbps UL；**-40~+85℃**；认证 FCC/GCF/IC/KCC/PTCRB/EU RED/JATE/Telec/Anatel/NCC | 运营商库明写（型号级） | [T-Mobile: Sierra Wireless EM9293](https://www.t-mobile.com/business/solutions/iot/device-certification/sierra-wireless-em9293)：`Chipset brand name: Qualcomm` / `Chipset model number: **SDX65M**` / `Module model number: EM9293`；[官方产品页](https://www.sierrawireless.com/iot-modules/5g-modules/em9293/) |
| **Telit FN990A28** | **Qualcomm SDX62** | 5G Sub-6，Cat19 | 运营商库明写 | [T-Mobile: Digi IX40-05](https://www.t-mobile.com/business/solutions/iot/device-certification/digi-ix40-05) |
| **Telit FN990A40-HP** | **Qualcomm SDX65** | 5G Sub-6，Cat20 | 运营商库明写 | [T-Mobile: Peplink MAX-BR1-PRO-5GK](https://www.t-mobile.com/business/solutions/iot/device-certification/peplink-max-br1-pro-5gk-t-prm) |
| **Telit LE910C4-WWXD**（4G） | Qualcomm MDM9607 | LTE Cat4 | 运营商库明写 | [T-Mobile: Digi IX25-4A-0G](https://www.t-mobile.com/business/solutions/iot/device-certification/digi-ix25-4a-0g) |
| **MediaTek MV31-W** | MediaTek | 5G | 第三方汇总 | [Llama Networks Peplink 模组对照表](https://support.llamanetworks.com/hc/en-us/articles/53749904078483-What-cellular-modems-are-in-Peplink-devices) |
| **华为巴龙 5000 (Balong 5000)** | 华为海思自研，7nm，单芯片多模 2G/3G/4G/5G | Sub-6 4.6Gbps DL / 2.5Gbps UL（200MHz） | **华为官方** | [华为官网 2019-01-24](https://www.huawei.com/cn/news/2019/1/huawei-5g-multi-mode-chipset-5g-cpe-pro)；[海思官网 Balong 5000](https://www.hisilicon.com/en/products/balong/balong-5000)：「A single chip supports 2G・3G, 4G, and 5G networks・achieving **4.6 Gbps** in Sub-6 GHz」 |

---

## 2. 表二：工业级/企业级 5G 设备 → 所用模组/基带 → 来源

> 「证据」列中，**【双字段】** 表示来源里同时明写了模组型号与芯片型号；**【仅模组】** 表示只写模组型号（芯片需按表一换算）；**【未点名】** 表示官方规格里只写「5G 模组」不写型号。

| 厂商 | 具体型号 | 所用 5G 模组 | 基带/平台 | 工作温度 | 证据 | 来源 |
|---|---|---|---|---|---|---|
| **Nokia** | Industrial 5G fieldrouter **FRRO501a** | **Quectel RM500Q-GL** | **Qualcomm SDX55** | **-40~+70℃**，IP67 | **【双字段】官方 datasheet 表格逐行写明** | [Nokia datasheet PDF](https://www.westconcomstor.com/content/dam/wcgcom/Global/CorpSite/pdfs/Nokia-Data-sheet-Router-HWNDUSES1040.pdf)。原文：`Benefits • **Qualcomm SDX55 single chip solution**` / `Hardware specifications — Module: **Quectel RM500Q-GL**；Chipset: **Qualcomm SDX55**；Category: 3GPP Release 15` |
| **Moxa** | **CCG-1500 系列** 工业私有 5G 网关 | 内建 5G/LTE 模块（**未点名型号**） | **Qualcomm Snapdragon X55 5G Modem-RF System** | **-40~+70℃**（5G 开启） | **【官方明写芯片】** | [Moxa 官方新闻 2023-11-21](https://www.moxa.com/en/about-us/news-events-(1)/news/2023/moxa-unveils-private-5g-cellular-gateways)。原文：「act as an ARM-based media and protocol converter with a built-in 5G/LTE module, **leveraging Snapdragon® X55 5G Modem-RF System**」「-40 to 70°C wide operating temperature with 5G enabled」。另：[官方产品页](https://www.moxa.com/en/products/industrial-network-infrastructure/cellular-gateways-routers/cellular-gateways/ccg-1500-series) |
| **Teltonika** | **RUTX50**（已 EOL） | **Quectel RG501Q-EU**（R15） | SDX55（**推断**，按表一） | 工业级 | 【仅模组】 | [Teltonika 社区官方口径](https://community.teltonika.lt/t/rutm52-what-modem-is-inside/13039)：「RUTM52 has the same modem as the **RUTX50**… device features two 5G modems (**RG501Q-EU**)」；[Teltonika Wiki RUTX50](https://wiki.teltonika-networks.com/view/RUTX50) 已标注 `This device has entered it's EOL (End of Life) cycle` |
| **Teltonika** | **RUTM52**（双 5G） | **Quectel RG520N-EB**（R16） | SDX62（**推断**，RG520N 与 RM520N 同为 X62 平台） | 工业级 | 【仅模组】 | [Teltonika 社区帖（附 Teltonika datasheet 摘录）](https://community.teltonika.lt/t/rutm52-what-modem-is-inside/13039)：「**RUTM52 - Quectel RG520N-EB**… LTE Cat 19/UL Cat 18；5G SA 2.4Gbps/900Mbps」 |
| **Teltonika** | **RUTC50** | Quectel RG520N-EB | SDX62（推断） | 工业级 | 【仅模组，第三方】 | [TechInfoDepot](https://techinfodepot.shoutwiki.com/wiki/Teltonika_RUTC50) |
| **Teltonika** | **RUTM50**（北美） | **未找到官方明写** —— 官方产品页规格区为 JS 动态渲染，抓取到的是模板占位文本；T-Mobile 认证 Wiki 只给产品码 `RUTM50 0*****1`，不列模组 | 未找到证据 | 工业级 | — | [官方产品页](https://www.teltonika-networks.com/products/routers/rutm50)、[Teltonika Wiki RUTM50 T-Mobile](https://wiki.teltonika-networks.com/view/RUTM50_T-Mobile)。**注意：官方新闻稿只写 3.4Gbps（与 RM520N-GL 的 NSA 3.4Gbps 吻合），但这是推断不是证据。** |
| **Cradlepoint（Ericsson）** | **E3000-5GB**（企业分支路由） | **Sierra Wireless EM9190** | **Qualcomm SDX55** | 0~50℃（商用级，**不是**宽温） | **【双字段】运营商认证库** | [T-Mobile 认证页](https://www.t-mobile.com/business/solutions/iot/device-certification/ericsson-cradlepoint-e3000-5gb)：`Chipset brand name: Qualcomm` / `Chipset model number: **SDX55**` / `Module brand name: Sierra Wireless` / `Module model number: **EM9190**`；[官方 datasheet](https://cradlepoint.ericsson.com/datasheet/e3000-series-enterprise-router/) 只写 `Embedded 5GB low/mid-band mode`，**不写模组也不写芯片** |
| **Cradlepoint** | E300 / E3000 的 **MC400 5G 模块**、W1850/W2005 等外置 5G 适配器 | 未找到证据（官方只给速率档位 3.4/4.1/7.5Gbps） | 未找到证据 | — | — | 同上 datasheet 订购信息表 |
| **Digi** | **IX40-05**（5G 边缘计算工业路由） | **Telit FN990A28** | **Qualcomm SDX62** | 工业级 | **【双字段】运营商认证库** | [T-Mobile 认证页](https://www.t-mobile.com/business/solutions/iot/device-certification/digi-ix40-05) |
| **Digi** | **TX40-A500**（车载公共安全 5G 中枢） | **Telit FN990A28** | **Qualcomm SDX62** | 车载级、FIPS 140-2 | **【双字段】运营商认证库** | [T-Mobile 认证页](https://www.t-mobile.com/business/solutions/iot/device-certification/digi-tx40-a500) |
| **Digi** | IX25-4A-0G（4G） | Telit LE910C4-WWXD | Qualcomm MDM9607 | — | 【双字段】 | [T-Mobile 认证页](https://www.t-mobile.com/business/solutions/iot/device-certification/digi-ix25-4a-0g) |
| **Digi** | IX20 / EX15 | **未找到证据** | 未找到证据 | — | — | — |
| **Peplink** | **MAX-BR1-PRO-5GK-T-PRM** | **Telit FN990A40-HP** | **Qualcomm SDX65** | **-40~+65℃** | **【双字段】运营商认证库** | [T-Mobile 认证页](https://www.t-mobile.com/business/solutions/iot/device-certification/peplink-max-br1-pro-5gk-t-prm)。原文 Features：「**Industrial-grade durability with wide operating temperature range (-40°C to 65°C)**」 |
| **Peplink** | 全系 5G SKU（按后缀区分代次） | **5GN = Quectel RM520N-GL**；**5GH = Sierra Wireless EM9191**；**5GK = Telit FN990A40-HP**；**5GY = Quectel RG520N-NA**；**5GRC = Telit FN920C04-WW**；**5GD = MediaTek MV31-W** | 分别对应 SDX62 / SDX55 / SDX65 / — / — / MediaTek | 工业级 | **【官方/授权渠道对照表】** | [Llama Networks《What cellular modems are in Peplink devices?》（更新 2026-07-23）](https://support.llamanetworks.com/hc/en-us/articles/53749904078483-What-cellular-modems-are-in-Peplink-devices)。**注意：Peplink 不"自研模块"——他们买第三方模组（Quectel/Sierra/Telit/MediaTek）做成 SKU 后缀；SpeedFusion 是软件层面的带宽聚合/热切换，与基带选择无关。** |
| **Semtech / Sierra Wireless** | **AirLink XR90**（-EM9293 版本，双 5G 车载） | **Sierra EM9293** | **Qualcomm SDX65（SDX65M）** | **-30~+70℃**，IP64，**MIL-STD-810G**，Class 1 Div 2，EN50155；MTBF 19 年 | 【官方 datasheet 写模组型号 + 运营商库写芯片】 | [Semtech 官方 XR90 datasheet PDF（2024-05-22）](https://es.t-mobile.com/content/dam/digx/tfb/us/en/assets/iot/oemSpecSheet/Sierra_Wireless_5G_Router_XR90/XR90-EM9293-DataSheet.pdf)：`Radio: **EM9293**`；芯片见 [T-Mobile 认证页](https://www.t-mobile.com/business/solutions/iot/device-certification/sierra-wireless-em9293) |
| **Semtech / Sierra Wireless** | **AirLink XR60**（世界最小加固 5G 路由） | 未找到证据（官方只写 5G + Wi-Fi 6 + IP64 + MIL-STD） | 未找到证据 | IP64 / MIL-STD | — | [官方产品页](https://www.sierrawireless.com/router-solutions/xr60/) |
| **映翰通 InHand** | **IR925**（云管理型 5G 工业路由，Wi-Fi 6） | **未点名模组** | 未找到证据 | **-40~+70℃**，DC 9~48V，无风扇，IP30，硬件 TPM | — | [官方产品页](https://www.inhand.com.cn/products/industrial-routers/ir925)：规格里只有 `蜂窝网络 5G 网络，下行最大 3.4 Gbps，Sub6` 与 `处理器 1 GHz / 内存 512 MB`，**完全未提模组或基带**。注：下行 3.4Gbps 与 RM520N-GL 的 NSA 峰值一致，但这是推断 |
| **映翰通 InHand** | **XCR624 / IR602**（信创 5G 工业路由） | **国产展锐平台 5G 模组** | **紫光展锐（UNISOC）**（官方未写具体型号） | **-40~+70℃**，EMC 3 级，DC 9~48V，国产 RISC-V 四核 | **官方明写平台厂商** | [映翰通官方新闻 2026-09-10](https://www.inhand.com.cn/company/news/5g-xinchuang-router-launch)：标题即「国产**展锐平台 5G 模组**」；正文：「采用国产自主 RISC-V 架构四核处理器和**国产展锐平台 5G 模组**」 |
| **宏电 Hongdian** | H8922 / 5G 工业 CPE | **未点名模组** | 未找到证据 | — | — | 官方 5G CPE 说明书只写「采用工业级硬件平台及 **5G 工业模组**」（[说明书 PDF](https://mkp-res.hc-cdn.com/marketplace/public/app/attachment/20210416/d92d0e31-8144-4599-b52e-3b23f591d2c3/2104160929216007.pdf)）；[官方下载中心](https://zh.hongdian.com/Search.html?k=%E8%B7%AF%E7%94%B1%E5%99%A8&page=3) 只提供「技术规格书—H8922 工业路由器」 |
| **有人物联 USR** | G816 / G809（5G 工业路由） | **未点名模组** | 未找到证据 | 宽温宽压、工业 EMC | — | [官方产品页](https://www.usr.cn/Product/343.html)（本次抓取 target_unreachable，仅检索快照）：「采用工业级设计标准，支持宽温宽压端子供电、工业 EMC 防护、硬件看门狗」——**全文未提模组/基带** |
| **厦门四信 Four-Faith** | **F-NR100** | 官方参数写「**工业级无线模块**」，未点名 | 未找到证据 | 宽温、EMC4 级、全金属 | — | [官方产品页](https://www.four-faith.com/5grouter/780.html)：`无线模块：工业级无线模块`；`标准及频段 5G NR: n1/n2/n3/n5/n7/n8/n20/n28/n41/n66/n71/n77/n78/n79`；`理论带宽 5G NR：下行 3.4Gbps，上行 350Mbps` |
| **才茂 Caimore** | CM520-59F-L 等双卡工业路由 | 未找到证据 | 未找到证据 | — | — | [官方产品页](https://caimore.com/industrial-router-127-1.html)（仅列出「集 5G、WiFi、串口、虚拟专用网等技术于一体」，**无模组/芯片字段**） |
| **佰马 Baima** | BMR400 | 4G 工业路由器（无 5G 基带字段） | — | — | — | [官方产品页](https://www.baimatech.com/router400.html)。5G 型号的模组/基带 **未找到证据** |
| **新华三 H3C** | **MSR1004S-5G** | 官方写「**内置单 5G 模组**」，未点名 | 未找到证据 | **-20~+60℃**（注意：比专业工业路由窄） | **官方明写"未点名"** | [H3C 官方产品页](https://www.h3c.com/cn/Products_And_Solution/InterConnect/Products/Routers/Products/Wan_Router/MSR/MSR1004S_5G/)：`5G：内置单 5G 模组，支持 5G NR、TDD/FDD-LTE、WCDMA`；`工作温度：-20～60℃` |
| **新华三 H3C** | CPE5100X 室外 5G 数据终端 / SIC-5G 接口模块 | 未找到证据 | 未找到证据 | — | — | [CPE5100X 页面](https://www.h3c.com/cn/Products_And_Solution/InterConnect/Products/Mobile_Communication/Products/5G/Terminal/CPE5100X/) |
| **华为** | 5G CPE Pro **H112-372** / CPE Pro 2 **H122-373** / CPE Win **H312-371** / 智选 5G CPE 5 **H155-381** / 车规模组 **MH5000** | 华为自有（不外供） | **华为海思 巴龙 5000（Balong 5000）** | 消费级（0~40℃ 为主） | **官方明写** | [华为官网 2019-01-24 发布稿](https://www.huawei.com/cn/news/2019/1/huawei-5g-multi-mode-chipset-5g-cpe-pro)；[海思官网](https://www.hisilicon.com/en/products/balong/balong-5000)；本仓库另一份笔记 [华为蜂窝接入设备调研.md](./华为蜂窝接入设备调研.md) 已逐机型核过：H112/H122/H138/H312/H155/H153/H158 全部为巴龙 5000 |

---

## 3. 工业级为什么偏好高通 SDX 系列？——能找到的原话与推不出来的部分

### 3.1 有原文支撑的论据

| 论据 | 原文摘录 | 来源 |
|---|---|---|
| **"单芯片方案"是工业整机厂自己摆在 Benefits 第一位的卖点** | Nokia FRRO501a Benefits 第一条：「**Qualcomm SDX55 single chip solution**」 | [Nokia datasheet](https://www.westconcomstor.com/content/dam/wcgcom/Global/CorpSite/pdfs/Nokia-Data-sheet-Router-HWNDUSES1040.pdf) |
| **芯片厂的原厂调试工具直接进工业整机厂的研发流程** | Moxa 官方：「leveraging Qualcomm Technologies' powerful **QXDM Professional™ Tool**, which helped Moxa's engineering team to become more proficient in 5G product development」；并称与高通「conducting **module- and system-level tests according to the 3GPP 5G standard**」 | [Moxa 官方 2023-11-21](https://www.moxa.com/en/about-us/news-events-(1)/news/2023/moxa-unveils-private-5g-cellular-gateways) |
| **模组厂把"工业级"当作明确产品定位，并给出宽温指标** | Quectel RM520N 页：「The RM520N is an **industrial-grade module for industrial and commercial applications only**」+「**Extended temperature range of -40°C to +85°C**」 | [Quectel 官方产品页](https://www.quectel.com/product/5g-rm520n-series/) |
| **认证清单是硬门槛：GCF/PTCRB + 各国强制认证 + 运营商入网** | Fibocom FM160：`Industry: -EAU: GCF; -NA: PTCRB/GCF` + `Operator: Telstra/AT&T/TMO/Verizon/KDDI/DCM`；SIMCom SIM8200G：`RoHS/REACH/CCC/CTA/SRRC/Mobile/Unicom/Telecom/JATE/Telec/RCM/CE(RED)/**GCF**` | [FM160 官方产品页](https://www.fibocom.com/en/SeriesProduct/info_itemid_80.html)、[SIM8200G 官方产品页](https://www.simcom.com/product/SIM8200G.html) |
| **载波聚合（CA）是工业/CPE 端明确宣传的能力** | Quectel R16 发布稿：「Quectel's new 5G modules support all three combinations of sub-6GHz TDD and FDD carrier aggregation (**CA of FDD+TDD, FDD+FDD and TDD+TDD**). This ensures greater 5G coverage, capacity and throughput」 | [Quectel 官方 2021-02-10](https://www.quectel.com/news-and-pr/quectel-announces-2nd-gen-of-5g-nr-modules-compliant-with-3gpp-r16-standard/) |
| **模组厂自己的说法：选高通是因为芯片厂的工程能力 + 与芯片同步上市** | 移远通信高级产品经理姚立：「为模组供应芯片必须要有强大的专业背景能力，还要取决于供应商的产品能力和市场策略。移远一直选择更优的、符合客户需求的芯片，**高通的 5G X55 芯片无疑是移远当前的最佳选择**」；同文亦称「移远的 5G 模组基本上与高通骁龙 X55 芯片同步」 | [国际电子商情 2019-03-29](https://www.esmchina.com/news/5007.html) |
| **车规/工程级延伸：同一 SDX 家族被拿去做车规模组，说明平台本身扛得住严苛认证** | Quectel 车规模组 AG550Q「将搭载高通 5G NR **SDX55** 芯片，支持 C-V2X+5G NR」；MeiG 车规模组走 Qualcomm SDM625/SA515M 路线 | [国际电子商情](https://www.esmchina.com/news/5007.html) 等 |
| **加固等级是整机厂叠加的，不是芯片给的** | Semtech XR90：`-30°C to +70°C`、`MIL-STD-810G (shock, vibration, thermal shock, humidity)`、`IP64`、`Class 1 Div 2`、`EN50155/EN45545`、MTBF 19 年 | [XR90 datasheet PDF](https://es.t-mobile.com/content/dam/digx/tfb/us/en/assets/iot/oemSpecSheet/Sierra_Wireless_5G_Router_XR90/XR90-EM9293-DataSheet.pdf) |

### 3.2 明确「未找到证据」的常见说法

- **「长期供货（longevity）承诺」**：本次未在任何芯片厂/模组厂的官方页面上找到针对 SDX55/62/65 的长期供货年限承诺（如 "10-year longevity"）。**未找到证据。** 间接反证倒是有：Quectel 官方论坛 2024-05 回复称 RM521F-GL（X65）「**had stopped to produce. Currently, there is no plan to update the firmware**」——即**高通平台也照样会停产停更**。
- **「工业级 = 车规温度」**：未找到证据。本次查到的"工业级"模组工作温度普遍是 **-30~+75℃**（Fibocom FM160/FG360）或 **-40~+85℃**（Quectel RM520N 扩展温度、SIMCom SIM8200G），并非 AEC-Q100 车规。车规模组是另一条产品线（MeiG/Quectel 的 AG/AN/AR 系列）。
- **「联发科/展锐做不了工业级」**：**反证存在**。Quectel 官方把 RG500L-EU（MTK T750）明确标为「**工规级模组，适用于工业级和商业级应用**」；展锐 V510 平台的 RG500U-EA 于 2023-11 通过 **GCF** 认证（号称"全球首款基于紫光展锐平台通过 GCF 的 5G 模组"）。所以"工业级"不是高通专属。

### 3.3 从"客户实际买什么"看平台格局（可由表二直接读出）

- **X55（SDX55）**：Nokia FRRO501a、Moxa CCG-1500、Cradlepoint E3000-5GB（Sierra EM9190）、Teltonika RUTX50（RG501Q-EU，推断）、Peplink 5GH（Sierra EM9191）、ZTE ZM9000 — **覆盖 2019~2023 那一代工业/企业设备**。
- **X62（SDX62）**：Teltonika RUTM52/RUTC50（RG520N-EB）、Digi IX40/TX40（Telit FN990A28）、Peplink 5GN（RM520N-GL）、Sierra EM9291、Fibocom FM160/FG160、MeiG SRM825N、SIMCom SIM8262 — **2022 年以后的工业主流**。
- **X65（SDX65）**：Peplink 5GK（Telit FN990A40-HP）、Semtech XR90（Sierra EM9293）、SIMCom SIM8270X（X72）、Quectel RM521F（已停产）— **高端/车载/公共安全档**。
- **非高通路线**：华为（巴龙 5000，只在自己整机内）、广和通 FG360 / 移远 RG500L（MTK T750，官方定位 **FWA/CPE/路由器**）、移远 RG500U/RM500U/RG200U（展锐 V510，官方称已落地**电力/CPE/工业网关**）、映翰通信创 XCR624（展锐平台）。

---

## 4. 结论（5 句以内）

1. **工业级/企业级 5G 的实际基带高度集中在高通骁龙 SDX 系列**：能同时查到"模组型号 + 芯片型号"的工业设备全部落在 SDX55（Nokia FRRO501a、Moxa CCG-1500、Cradlepoint E3000-5GB）、SDX62（Digi IX40/TX40、Peplink 5GN、Teltonika RUTM52）和 SDX65（Peplink 5GK、Semtech XR90）三档上。
2. **但"工业级"不是基带品牌给的，而是模组厂 + 整机厂叠出来的**：芯片只提供平台，宽温（-40~+85℃）、IP67/IP64、MIL-STD-810G、EN50155、GCF/PTCRB/运营商入网这些工业级指标全部是模组与整机层面的工程结果。
3. **平台代次比"哪家"更重要**：X55 那一代工业设备还在大量在售（R15、无 5G LAN/网络切片），X62/X65 才带 R16/R17 能力；选型时"是不是 SDX62 及以上"比"是不是高通"更有区分度。
4. **国产平台（紫光展锐 V510/V620、联发科 T750/T830）走的是一条并行的"FWA/CPE + 国内信创/电力"路线**——广和通 FG360、移远 RG500L/RG500U、映翰通 XCR624 都用它们，官方也明确标"工规级"，但在海外工业整机厂的公开选型中基本缺席。
5. **华为是唯一的自研基带闭环（巴龙 5000），只出现在华为自家整机内、不对外供模组**；因此对"第零路"这种要买现货设备的场景，真正的可选项就是 **Quectel / Sierra / Telit 三家模组 × SDX55/62/65**。

---

## 5. 给本次选型的实操提示

- 想让评委一眼看到"工业级"，最硬的举证是**打印整机 datasheet 里那两行**（`Module:` + `Chipset:`）。Nokia FRRO501a 是本次唯一找到"两行都在同一份官方 datasheet 里"的整机，最适合当展板证据。
- **不要用"H3C 是企业级所以更稳"当判据**：H3C MSR1004S-5G 官方工作温度只有 **-20~60℃**，且不公开模组；而 Teltonika/Peplink/Digi 这类"看起来更小众"的反而明确写了工业级宽温与模组型号。
- **注意 RUTX50 已 EOL**（Teltonika 官方 Wiki 明确标注），如果参照别人的方案买 RUTX50，应换成 RUTM50/RUTM52/RUTC50（R16 平台）。
- **国产化 ≠ 更工业**：映翰通 XCR624 的"展锐平台"卖点是**信创/自主可控**，官方给出的工业指标（-40~70℃、EMC 3 级）与高通平台机型同级，但它是作为"国产替代"叙事出现，不是"更工业"。

### 本次未能取证的清单（诚实标注）

1. Quectel 官方《5G/LTE-Advanced Module Product Overview》PDF 全文（两次抓取失败）→ RM550V=SDX72 / RM551E=SDX75 仅来自检索快照转录。
2. Quectel RM550V-GL、RM521F-GL、RM505Q-AE、RM530N-GL 的官方逐型号平台声明（只有同系列/第三方证据）。
3. Fibocom FM150 / FG150 的官方芯片声明；Fibocom FM180 的任何平台信息。
4. MeiG SRM928 的平台信息。
5. Teltonika RUTM50、Cradlepoint MC400 5G / W1850 / W2005、Semtech XR60、Digi IX20/EX15、H3C CPE5100X、宏电 H8922、有人 USR G816/G809、四信 F-NR100、才茂、佰马 5G 型号的模组/基带。
6. 任何芯片厂/模组厂关于 SDX 系列"长期供货年限"的正式承诺文件。

### 一手源清单（可点击）

- 整机 datasheet：[Nokia FRRO501a](https://www.westconcomstor.com/content/dam/wcgcom/Global/CorpSite/pdfs/Nokia-Data-sheet-Router-HWNDUSES1040.pdf) ｜ [Semtech AirLink XR90](https://es.t-mobile.com/content/dam/digx/tfb/us/en/assets/iot/oemSpecSheet/Sierra_Wireless_5G_Router_XR90/XR90-EM9293-DataSheet.pdf) ｜ [Cradlepoint E3000](https://cradlepoint.ericsson.com/datasheet/e3000-series-enterprise-router/)
- 运营商认证库（含 Chipset/Module 双字段）：[Cradlepoint E3000-5GB](https://www.t-mobile.com/business/solutions/iot/device-certification/ericsson-cradlepoint-e3000-5gb) ｜ [Digi IX40-05](https://www.t-mobile.com/business/solutions/iot/device-certification/digi-ix40-05) ｜ [Digi TX40-A500](https://www.t-mobile.com/business/solutions/iot/device-certification/digi-tx40-a500) ｜ [Peplink MAX-BR1-PRO-5GK](https://www.t-mobile.com/business/solutions/iot/device-certification/peplink-max-br1-pro-5gk-t-prm) ｜ [Sierra EM9293](https://www.t-mobile.com/business/solutions/iot/device-certification/sierra-wireless-em9293) ｜ [Quectel RM520N-GL](https://www.t-mobile.com/business/solutions/iot/device-certification/quectel-rm520n-gl)
- 模组厂官方：[Quectel RM520N](https://www.quectel.com/product/5g-rm520n-series/) ｜ [Quectel R16 发布稿](https://www.quectel.com/news-and-pr/quectel-announces-2nd-gen-of-5g-nr-modules-compliant-with-3gpp-r16-standard/) ｜ [Quectel 5G 中文产品册 PDF](https://market.quectel.com/wp-content/uploads/custom/pdf/5G_20210129.pdf) ｜ [Fibocom FM160](https://www.fibocom.com/en/SeriesProduct/info_itemid_80.html) ｜ [Fibocom FG360](https://www.fibocom.com/en/SeriesProduct/info_itemid_82.html) ｜ [SIMCom SIM8262X-M2](https://www.simcom.com/product/SIM8262X-M2.html) ｜ [SIMCom SIM8270X 新闻](https://www.simcom.com/news_view-340.html) ｜ [MeiG 官方](https://en.meigsmart.com/articledetail/175.html)
- 整机厂官方：[Moxa 私有 5G 网关新闻](https://www.moxa.com/en/about-us/news-events-(1)/news/2023/moxa-unveils-private-5g-cellular-gateways) ｜ [映翰通 XCR624](https://www.inhand.com.cn/company/news/5g-xinchuang-router-launch) ｜ [映翰通 IR925](https://www.inhand.com.cn/products/industrial-routers/ir925) ｜ [H3C MSR1004S-5G](https://www.h3c.com/cn/Products_And_Solution/InterConnect/Products/Routers/Products/Wan_Router/MSR/MSR1004S_5G/) ｜ [四信 F-NR100](https://www.four-faith.com/5grouter/780.html)
