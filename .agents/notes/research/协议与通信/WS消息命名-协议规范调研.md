# WS 消息命名：主流协议报文规范调研

> 只做研究，不含本项目实现。所有结论均来自规范原文，下文标注了条款号 / 表号。
> 调研日期 2026-10-01。**缺口**：LwM2M 的 OMA 原始规范 PDF 在公开网络上已不可达（404），
> 本轮未取得原文，故**不在下文给出 LwM2M 的报文名**（不做凭印象填充）。

---

## 1. MQTT 3.1.1 / 5.0（OASIS Standard）

### 1.1 完整报文类型表（MQTT 5.0 §2.1.2, Table 2-1 "MQTT Control Packet types"）

| 名称 | 值 | 方向 | 语义 |
|---|---|---|---|
| Reserved | 0 | Forbidden | 保留 |
| CONNECT | 1 | Client → Server | Connection request |
| CONNACK | 2 | Server → Client | Connect acknowledgment |
| PUBLISH | 3 | **Client → Server 或 Server → Client** | Publish message |
| PUBACK | 4 | **双向** | Publish acknowledgment (QoS 1) |
| PUBREC | 5 | 双向 | Publish received (QoS 2 第 1 步) |
| PUBREL | 6 | 双向 | Publish release (QoS 2 第 2 步) |
| PUBCOMP | 7 | 双向 | Publish complete (QoS 2 第 3 步) |
| SUBSCRIBE | 8 | Client → Server | Subscribe request |
| SUBACK | 9 | Server → Client | Subscribe acknowledgment |
| UNSUBSCRIBE | 10 | Client → Server | Unsubscribe request |
| UNSUBACK | 11 | Server → Client | Unsubscribe acknowledgment |
| PINGREQ | 12 | Client → Server | PING request |
| PINGRESP | 13 | Server → Client | PING response |
| DISCONNECT | 14 | 双向（3.1.1 为 C→S） | Disconnect notification |
| AUTH | 15 | 双向 | Authentication exchange（v5.0 新增） |

3.1.1 共 **14 种**（无 AUTH）；5.0 共 **15 种**。

### 1.2 关键问题：服务器往客户端"推"数据用哪个报文？

**就是 PUBLISH。** 规范原文（§3.3）："A PUBLISH packet is sent from a Client to a Server **or from a Server to a Client** to transport an Application Message."
Table 2-1 的方向列直接写成 `Client to Server or Server to Client`。

**启发**：同一个词在两个方向上都是"运数据"，**方向不参与数据报文的名字**。
MQTT 里根本不存在 `push` / `downlink` / `uplink` 这类词。

### 1.3 PUBACK 到底是"请求的应答"还是"独立一类"？

**是独立的一类**，而且它的语义被规范明确地与"业务处理完"切割开：

- [MQTT-4.3.2-4]：接收方 "MUST respond with a PUBACK packet …, **having accepted ownership** of the Application Message."
- [MQTT-4.5.0-2]："The Client MUST acknowledge any Publish packet it receives according to the applicable QoS rules **regardless of whether it elects to process** the Application Message that it contains."
- [MQTT-4.4.0-2]：PUBACK 带 Reason Code ≥ 0x80 **也算已确认**，同样不得重传。

即：**PUBACK = "我收到了、我接管了这条消息的所有权"，不是"我处理完了"**。
MQTT 5.0 §4.10 把请求/响应建立在 `Response Topic` + `Correlation Data` 两个 **PUBLISH 属性**上——
**应答本身又是一条 PUBLISH**，不是新的报文类型。

### 1.4 命名形态：动词/名词在前 + ACK 后缀（缩写）

`PUBACK` / `CONNACK` / `SUBACK` / `UNSUBACK` / `PUBREC` / `PUBREL` / `PUBCOMP`——
**全部是"词干缩写 + ACK 后缀"**，没有 `ACKPUB`、没有 `ACK_PUBLISH`、没有 `PUBLISHACK`。
注意 `SUBACK` 不是 `SUBSCRIBEACK`：**压到 3+3 的视觉平行**（PUBACK / SUBACK / CONNACK 同长）。

### 1.5 PINGREQ / PINGRESP 在命名体系里的位置

- 它们是**正式的 12 / 13 号报文类型**，和其他报文一样平等，不是"特例另开一类"。
- 固定头 flags 位是 `0010`，Remaining Length = 0，无 Variable Header、无 Payload。
- §3.12 给出的三个用途：① 告诉服务器客户端还活着；② 请求服务器回应以证明它活着；③ 打通网络。
- 关键：它们**不叫 PINGACK**，叫 `PINGRESP`。回声式的名词-名词对，不是请求-ACK 对。

---

## 2. CoAP（RFC 7252）+ Observe（RFC 7641）

CoAP **只有一种报文格式**，4 字节头：

```
|Ver| T |  TKL  |      Code     |          Message ID           |
```

- **T（Type），2 bit**：Confirmable(0) / Non-confirmable(1) / **Acknowledgement(2)** / Reset(3)。
- **Code，8 bit**，高 3 bit 是 class：`0` = request，`2` = 成功响应，`4` = 客户端错误，`5` = 服务端错误；
  class 0 且 detail 0 = **Empty Message（既不是请求也不是响应）**。

**T 与"请求/应答"是正交的两个维度**：ACK 只表示"我收到了"，它可以顺手捎一个响应。

| Method Code | 名称 | 方向 | 语义 |
|---|---|---|---|
| 0.01 | GET | C → S | 取 |
| 0.02 | POST | C → S | 提交 |
| 0.03 | PUT | C → S | 整体替换 |
| 0.04 | DELETE | C → S | 删除 |

| Response Code | 名称 | 方向 | 语义 |
|---|---|---|---|
| 0.00 | Empty | S → C | 裸 ACK / ping 占位 |
| 2.01 | Created | S → C | POST 建资源成功 |
| 2.02 | Deleted | S → C | DELETE 成功 |
| 2.03 | Valid | S → C | 缓存副本仍有效 |
| 2.04 | Changed | S → C | PUT 成功 |
| 2.05 | Content | S → C | **GET 的数据应答**；也是 Observe 的载荷 |
| 4.xx / 5.xx | Bad Request … Server Error | S → C | 失败 |

**关键发现（§5.2.2）**：服务器来不及答时，先发一个 `T=ACK, Code=0.00` 的空 ACK，
规范原话 *"the acknowledgement effectively is a **promise** that the request will be acted upon later"*，
数据随后用**另一条** `2.05 Content` 单独发（Separate Response）。
→ **受理回执 = 承诺，数据 = 之后另发，是两条独立的东西，但它们用的是同一种报文格式。**

- **心跳**：没有 PING 报文。发一个空 CON 即可；也可以用 RST 做廉价存活探测（§1.2 Reset 定义）。
- **服务器主动推**（RFC 7641）：叫 **Notification**，但它**就是 2.05 Content 报文本身**，
  只是多带一个 `Observe` option（序号 6）和递增序号。**CoAP 拒绝为"推送"新造报文类型。**

---

## 3. AMQP

### 3.1 AMQP 0-9-1（`class.method` 点号命名）

规范 BNF 原文：

```
basic = C:QOS S:QOS-OK
      / C:CONSUME S:CONSUME-OK
      / C:CANCEL S:CANCEL-OK
      / C:PUBLISH content
      / S:RETURN content
      / S:DELIVER content
      / C:GET ( S:GET-OK content / S:GET-EMPTY )
      / C:ACK
      / C:REJECT
      / C:RECOVER-ASYNC
      / C:RECOVER S:RECOVER-OK
```

| 名称 | 方向 | 语义 |
|---|---|---|
| connection.start / start-ok / tune / tune-ok / open / open-ok / close / close-ok | 交替 | 握手；**`heartbeat` 是 tune-ok 里的一个秒数字段，不是报文** |
| queue.declare / declare-ok、bind / bind-ok、unbind / unbind-ok、purge / purge-ok | C→S + S→C | **请求 + 数据型应答，`Xxx` / `Xxx-Ok`** |
| basic.publish | **仅 C→S** | 发消息 |
| basic.consume / consume-ok、cancel / cancel-ok | C→S + S→C | 注册消费者 |
| **basic.deliver** | **仅 S→C** | **服务器投递数据**（不是 push，不是 publish） |
| basic.get | C→S | 同步取 |
| basic.get-ok | S→C | **取到的数据** |
| basic.get-empty | S→C | 没有数据 |
| **basic.ack** | **C→S** | 确认**已消费**（消息级），裸词不跟任何请求配对 |
| basic.reject | C→S | 同上，否定式 |
| tx.select / commit / rollback | C→S + S→C | 事务 |

**命名规律**：① 请求+数据应答 = `Xxx` / `Xxx-Ok`（连字符）；② 受理回执 = **裸 `ACK` / `REJECT`**。
0-9-1 **方向不对称是刻意的**：`publish` 只允许 C→S，`deliver` 只允许 S→C。

### 3.2 AMQP 1.0（OASIS, Part 0 Overview 原文）

> "AMQP does not define a wire-level distinction between 'clients' and 'brokers',
> **the protocol is symmetric**."

1.0 **取消了 method 命名**，改成对称的 performative：`open / begin / attach / flow / transfer / disposition / detach / end / close`，
两端都能发同一个。**受理语义被整个从命名里拿掉，变成一个 delivery state 的取值**：
`received / accepted / rejected / released / modified`。

---

## 4. WebSocket（RFC 6455）

- 帧类型由 **opcode 最高位**区分：
  - **控制帧 MSB=1**：0x8 Close、0x9 Ping、0xA Pong，0xB–0xF 预留
  - **数据帧 MSB=0**：0x1 Text、0x2 Binary，0x3–0x7 预留
- §5.5 原文：控制帧 "are **not intended to carry data for the application** but instead for
  protocol-level signaling"；payload ≤ 125 字节，MUST NOT be fragmented，可插在分片消息中间。
- §1.2 / §5.6：控制帧**永远不会交给应用层**（不触发 `onmessage`）。
- 命名是**反义成对 Ping / Pong**，不是 REQ / ACK。Pong 可以 unsolicited，当单向心跳。

**对我们的意义**：WS 传输层已经有 ping/pong 了，它和应用层消息是两套东西。
如果应用层再做心跳，**不能叫 ack**（ACK 在这一层的含义已经被 WS 自己占了：Close 的对帧），
更不能占用 ping/pong 这两个名字的语义。

---

## 5. STOMP 1.2（补充）

| 帧 | 方向 | 语义 |
|---|---|---|
| CONNECT / CONNECTED | C→S / S→C | 握手，头里带 `heart-beat` 协商参数 |
| SEND | C→S | 客户端发数据 |
| SUBSCRIBE / UNSUBSCRIBE | C→S | 订阅控制 |
| **ACK / NACK** | **C→S** | 确认**已消费**某条订阅来的消息（消息级，不是请求级） |
| **MESSAGE** | **S→C** | **服务器投递数据**（≠ SEND 的镜像，独立名字） |
| **RECEIPT** | **S→C** | **服务器对"请求了回执的客户端帧"的受理回执** |
| BEGIN / COMMIT / ABORT | C→S + S→C | 事务 |
| DISCONNECT / ERROR | 双向 / S→C | 关闭 / 错误 |

- **心跳刻意不进命令词汇表**：STOMP 1.2 §Heart-beating 规定心跳是字节级的 **CR LF 空行**，
  不用 SEND 之类的帧来发。
- 注意 STOMP 的**不对称**：`SEND`/`MESSAGE`、`ACK`/`RECEIPT` 两组各自不同名。

## 6. MQTT-SN 1.2（补充，MQTT 的受限场景亲兄弟）

§5.4 消息清单：ADVERTISE / SEARCHGW / GWINFO / CONNECT / CONNACK / WILLTOPICREQ / WILLTOPIC /
WILLMSGREQ / WILLMSG / REGISTER / **REGACK** / PUBLISH / PUBACK / PUBREC / PUBREL / PUBCOMP /
SUBSCRIBE / SUBACK / UNSUBSCRIBE / UNSUBACK / **PINGREQ / PINGRESP** / DISCONNECT /
WILLTOPICUPD / WILLMSGUPD / **WILLTOPICRESP / WILLMSGRESP**

- 它引入了 MQTT 没有的**第三种命名法：`XxxREQ` / `XxxRESP`**（后缀是 RESP 不是 ACK）。
- 同一个规范里 `REGACK` 和 `WILL*RESP` 并存 → 说明 **ACK 后缀本身就是历史包袱**，不是普适规则。

---

## 7. 回答五个问题

### Q1「受理回执」和「服务器主动推送」是两类消息还是一个？

**全行业都是两类**，但"回执"这一类的表达方式分三派：

| 派别 | 代表 | 做法 |
|---|---|---|
| A. 独立报文类型 | MQTT `PUBACK`、STOMP `RECEIPT`、AMQP 0-9-1 `basic.ack`/`basic.reject` | 回执有自己的名字和编号 |
| B. 不叫报文，叫字段/选项 | CoAP（ACK 是 2 bit Type 位 + Code 0.00）、AMQP 1.0（delivery state 取值） | 回执被降级成状态位 |
| C. 回执与数据共用一个报文，靠属性区分 | MQTT 5.0 §4.10（Response Topic + Correlation Data） | 应答就是另一条 PUBLISH |

**"服务器主动推数据"从来不是新名字**：MQTT = `PUBLISH`、CoAP = `2.05 Content` + `Observe` option、
STOMP = `MESSAGE`、AMQP 0-9-1 = `basic.deliver`。
**没有任何主流协议为"服务器下发数据"造过带 push/downlink 语义的新动词。**

### Q2 有没有做到"设备→服务器 / 服务器→设备"严格对称的协议？

**MQTT 是最接近的，而且它的对称轴选得很聪明：轴是"谁主动"，不是"哪一端"。**
它的报文表在方向上分三档：

1. **单向请求**（C→S）：CONNECT / SUBSCRIBE / UNSUBSCRIBE / PINGREQ
2. **单向应答**（S→C）：CONNACK / SUBACK / UNSUBACK / PINGRESP
3. **双向数据**：PUBLISH / PUBACK / PUBREC / PUBREL / PUBCOMP

即：**凡是"上行请求的受理回执"，一律 `XxxACK`；凡是"运数据的"，一律双向同一个词。**
它处理"回执 vs 数据"的手段是：回执永远带 ACK 后缀，数据永远不带。

AMQP 1.0 是最彻底的（直接取消 client/broker 角色区分），但代价是它没有可读的报文名。
STOMP 反而是最不对称的（SEND/MESSAGE、ACK/RECEIPT 两组各叫各的）。

### Q3 `Xxx` / `XxxACK` 是主流还是异类？`AckXxx` 有没有先例？

- **`XxxACK`（后缀）是压倒性主流**：MQTT 有 8 个（CONNACK/PUBACK/PUBREC/PUBREL/PUBCOMP/SUBACK/UNSUBACK + MQTT-SN 的 REGACK）。
- **ACK 前置（`AckXxx`）在我核过的所有规范里找不到有影响力的先例。**
  最接近的两个都不是前置：STOMP/AMQP 用**裸词 `ACK`**（不跟在任何词干后面）。
- 主流变体一共三种：`XxxACK`（MQTT）、`Xxx-Ok`（AMQP 0-9-1）、`XxxRESP`（MQTT-SN 的 WILL 系列）。
- **为什么是 `PUBACK` 而不是 `PUBLISHACK`**：规范没写理由（这类"为什么"通常不进 RFC）。
  但从 3.1.1 沿革能看出约束——报文类型要塞进 4 bit 枚举、名字要在文档里一眼认出协议动作，
  而 `PUBACK / SUBACK / CONNACK` 三个并排时**词干长度全等于 3**，视觉平行立刻成立；
  `PUBLISHACK` 会把这个平行彻底破坏。代价：丢词根，`PUBACK` 看不出是 publish 的 ack，只能背。

### Q4 心跳/保活叫什么？是特例吗？

| 协议 | 名字 | 是不是特例 |
|---|---|---|
| MQTT | `PINGREQ` / `PINGRESP` | **正式报文类型**（12/13 号），与其他报文平等 |
| WebSocket | `Ping` / `Pong` **控制帧** | **特例**：opcode MSB=1，显式声明"不承载应用数据" |
| STOMP | **不是帧**，是 CR LF 空行 | **彻底移出消息词汇表** |
| AMQP | `heartbeat` **字段**（秒） | 彻底移出消息词汇表 |
| CoAP | 空的 CON / RST | 复用已有报文，无新名字 |

**三个共同结论**：
1. 没有任何协议给心跳起名叫 `XxxACK`——它是"我还在吗"，不是对某个请求的回应。
2. 越是资源受限的协议，越倾向于把心跳踢出消息层（STOMP/AMQP/CoAP），MQTT 是唯一把它做成正式报文的。
3. 回声式的名字（PINGREQ→PINGRESP / Ping→Pong）比请求-ACK 式更贴切，因为心跳没有"请求方/应答方"。

### Q5 缩写（PUBACK 而不是 PUBLISHACK）是惯例吗？取舍是什么？

- **是惯例，但压得很有节制**：只压到"3+3 词族"（PUBACK/SUBACK/CONNACK/PUBREC/PUBREL/PUBCOMP/REGACK），
  **压到"丢词根"为止，不压到无法辨认**。
- 换来的：控制包头只要 1 byte（4 bit 类型 + 4 bit flags），在 UDP/TCP 头上省下的字节是真金白银。
- 付出的：不可自解释，新人必须查表。
- 另外两个细节：**MQTT 不用下划线**（没有 `ACK_PUBLISH`），**也不在报文名里用点号**（AMQP 的点号是 class.method 层级分隔，不是词内分隔）。

---

## 8. 建议（针对"一条连接上设备只发上行、服务器只发下行"）

对四条基座 `PostMessage`(D→S) / `AckPostMessage`(S→D) / `GetMessage`(D→S) / `PushMessage`(S→D)：

1. **对称轴取"谁主动"，不取"哪一端"**——这是 MQTT 唯一做对的地方，也正好匹配你的硬约束（方向已被钉死，不需要轴去区分端）。
2. **唯一的改动：把 `PushMessage` 改成 `GetAckMessage`**。理由：
   `GetAck` 与 `PostAck` 同构，`Get`/`Post` 同构，四条消息读下来是**两对 Xxx / XxxAck**，彻底对称。
   而 `Push` 在 MQTT/CoAP/STOMP/AMQP 里**都不是**"服务器下发数据"的名字（分别是 publish / notification / message / deliver），跟先例对着干没有收益。
3. **`PostAckMessage` 保持 ACK 后置**，不要改成 `AckPostMessage`：后缀是压倒性惯例，前置无先例，
   而且 `AckPost` 读起来像"反向的 post"，语义方向会被读反。
4. **`GetAck` 一条同时承担两件事**（get 的数据应答 + 服务器主动下的命令）是**可以接受的**，有直接先例：
   CoAP 只用 `2.05 Content` 一个码值干两件事，MQTT 只用 PUBLISH。让它靠 payload 里的字段区分即可
   （"这条是给你的命令 / 这条是你要的数据"），这正是 CoAP Observe 的做法。
5. 如果你坚持回执和数据必须是两类消息（这是全行业共识，见 Q1），那也**不要引入 `push`**——
   保持 `Xxx` / `XxxAck` 四条，让两条下行消息靠字段而不是靠名字区分。
6. **不要缩写**。ESP32 上省下的字节远小于失去可读性的代价；MQTT 缩写是因为它有 4 bit 枚举 + TCP/UDP 头预算，我们没有这个约束。
7. **应用层心跳叫 `ping`，回执叫 `pong`**，跟 WebSocket 惯例一致；**不要叫 `ack`**——ACK 在这一层已经有确定含义（受理回执），混用会让 `PostAck` 失去唯一性。
8. WS 传输层自带的 ping/pong 控制帧不要拿来做业务心跳，它不会进应用层。