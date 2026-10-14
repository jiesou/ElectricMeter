# Slint 触摸滚动调研

> 板子：香橙派 5 Plus，X11（`DISPLAY=:0`），Slint **1.18.1b1**（Python binding），style = `material-dark`。
> 结论全部在本机 X11 + XTEST 合成事件下实测过，板子上的输入栈已 ssh 实地查证，见「实测」与「板子实况」。

## 根因（三条，都很硬）

### 根因 A（最关键，且是上游 bug）：第一根手指的 finger id 是 0，被当成鼠标

`internal/backends/winit/touch_finger_id.rs` 用数组下标当 finger id，**第一根手指拿到 `0`**：

```rust
pub(crate) fn id_for(&mut self, touch: Id) -> i32 {
    let index = self.slot_of(touch)
        .or_else(|| self.slots.iter().position(Option::is_none))
        .unwrap_or_else(|| { self.slots.push(None); self.slots.len() - 1 });
    self.slots[index] = Some(touch);
    index as i32          // 第一根手指 -> 0
}
```

同文件单元测试白纸黑字确认：`assert_eq!(alloc.id_for((0, 11)), 0)`。

而判定「是不是触摸」只看 `!= 0`（`internal/core/input.rs:132`）：

```rust
pub fn is_from_touch(&self) -> bool {
    // touch events carry the finger id + 1, events from a mouse carry 0
    self.touch_finger_id() != 0
}
```

**注释说"finger id + 1"，实现却从 0 开始——注释与实现对不上，是 off-by-one。**

后果与用户现象一字不差：

| 手指 | finger id | `is_from_touch()` | 结果 |
|---|---|---|---|
| 单指 | 0 | false | 被 `mouse-drag-pan-enabled: false` 挡掉 → **滚不动** |
| 双指 | 第二根 = 1 | true | 走触摸分支 → **能滚** |

> 该 bug 在 v1.18.1 tag 与 master 上都存在（master 单测仍是 `id_for((0,11)) == 0`）。值得给上游提 issue。

### 根因 B：ScrollView 默认关掉了「拖着走」

`std-widgets` 的 material ScrollView 内部是 Flickable，且**写死了 `mouse-drag-pan-enabled: false`**：

```slint
// internal/compiler/widgets/material/scrollview.slint (v1.18.1)
in property <bool> mouse-drag-pan-enabled <=> flickable.mouse-drag-pan-enabled;

flickable := Flickable {
    mouse-drag-pan-enabled: false;   // ← 默认就是关的
    ...
}
```

而 `internal/core/items/flickable.rs` 的判定是：

```rust
fn accepts_pan_event(self: Pin<&Self>, event: &MouseEvent) -> bool {
    match event {
        MouseEvent::Wheel { .. } => true,        // 滚轮：永远能滚，不受任何开关限制
        MouseEvent::Pressed { .. } | MouseEvent::Moved { .. } | MouseEvent::Released { .. } => {
            self.interactive() && (event.is_from_touch() || self.mouse_drag_pan_enabled())
        }
        ...
    }
}
```

`is_from_touch()` 只看 `touch_finger_id != 0`（`internal/core/input.rs:132`）；winit 只有收到 `WindowEvent::Touch`（XI2 的 `XI_TouchBegin`）才会带 finger id，鼠标事件一律是 0。

**所以**：只有当事件来自「真触摸」（finger id ≠ 0）时，单指拖动才能滚。叠加根因 A，单指恰好被判定为「非触摸」，于是被 `mouse-drag-pan-enabled: false` 挡掉。

### 根因 C：嵌套 ScrollView 必然失效（横向滚动就是这个）

客房管理页是**外层竖向 ScrollView 里嵌每间房的横向 ScrollView**。这是 Slint 明说不支持的结构，实测外层一定会把拖动抢走。

外层 Flickable 是祖先，`input_event_filter_before_children` 先跑：按下的瞬间就 `DelayForwarding(100ms)` 抓住，之后移动事件到不了内层。

## 实测（本机 X11，`no-frame` 窗口 + XTEST 合成拖动）

| 场景 | 结果 |
|---|---|
| ScrollView 默认，鼠标拖动 | `sy = 0` / `0` —— **完全不滚** |
| 加 `mouse-drag-pan-enabled: true`，鼠标拖动 | `sy = 1512` / `531` —— **滚了** |
| 独立横向 ScrollView（不嵌套） | `sx = 192`（3/3 稳定） |
| 嵌套：内层 ScrollView，外层 pan **开** | `sx = 0`（6/6，**从不滚**） |
| 嵌套：内层 ScrollView，外层 pan **关** | `sx = 192`（3/3 稳定） |
| 嵌套：内层换成裸 `Flickable`，外层 pan 开 | `sx = 0`（3/3）—— 换 Flickable 没用 |
| 嵌套：内层自己画 TouchArea 拖拽，外层 pan 开 | `sx = 0 / 0 / 49` —— 偶尔抢到，不可靠 |
| 内层自绘 + 外层 pan 关 | `sx = 192`（3/3） |

**结论：只要外层能抓拖动，内层横向就死。跟内层用什么实现无关。**

## 板子实况（ssh 实地查证）

**屏是好的，X 也认它是触摸屏。** `xinput list` 会看到它挂在 "Virtual core pointer" 下，但那只是 X 的指针汇总节点；看内核拆出来的设备才准确：

内核把这块 `ILITEK ILITEK-TP`（USB，`222a:0001`）拆成**两个** input 设备：

| | event9 `ILITEK ILITEK-TP` | event10 `ILITEK ILITEK-TP Mouse` |
|---|---|---|
| udev 标记 | `ID_INPUT_TOUCHSCREEN=1` | `ID_INPUT_MOUSE=1` |
| Xorg 日志 | `is tagged by udev as: Touchscreen` / `device is a touch device` | `libinput pointer catchall` |
| X 能力 | **有 `XITouchClass`，direct 模式，最多 10 指** | 纯鼠标 |
| evdev | 有 `BTN_TOUCH`、`ABS_MT_SLOT 0-9`、`INPUT_PROP_DIRECT` | — |

X11 用的是 libinput 驱动（`40-libinput.conf`），winit 0.30.13 的 X11 后端也确实处理 `XI_TouchBegin/Update/End`。**XI2 touch 事件是有的**——所以问题不在输入栈，而在 Slint 把第一根手指的 id 编成了 0（根因 A）。

> `xinput list` 里它显示在 pointer 下只是 X 的呈现方式（touch 设备同时充当 core pointer），不代表降级。
> 那个 `ILITEK-TP Mouse` 子设备是固件额外暴露的鼠标仿真，与触摸滚动无关。

## 官方口径

- [#3254 How do I scroll on touch-screens?](https://github.com/slint-ui/slint/discussions/3254)（2023）：maintainer ogoffart 原话 —— 「The current ScrollView is meant for desktop and it's true that it isn't touch friendly. If you want something that can pan on touch, you can use Flickable instead」。
- [#9803 ScrollView Tracking Issue](https://github.com/slint-ui/slint/issues/9803)（2025-10 开，至今 3/6）：官方承认缺方向锁、缺惯性调参、缺滚动指示器，移动端体验不完整。
- [#13421](https://github.com/slint-ui/slint/issues/13421) 嵌套 Flickable，1.18.1 只修了触摸板那条（#13453）。
- CHANGELOG 1.18.0：`Flickable: Added the mouse-drag-pan-enabled property; panning by touch is always possible. (#4352)` —— 也就是说官方把「触摸」和「鼠标拖」彻底分开，鼠标拖默认是关的。
- winit 0.30.13（Slint 1.18.1 用的版本）X11 后端**确实**处理 `XI_TouchBegin/Update/End` → `WindowEvent::Touch`。前提是 X 把设备认成 touch（`XITouchClass`）。

## 路径（已实施 + 板子实测）

1. **三个 ScrollView 加 `mouse-drag-pan-enabled: true`** —— 已改。
   这一条正好绕开根因 A：单指虽被误判成「鼠标」，但开了 mouse-drag-pan 后「鼠标拖」也能滚。
   **板子实测（真触摸注入 + 真实应用）**：默认 `sy = 12.2` → 开 pan `sy = 502.1`；真应用客房管理页能一路滑到底。
2. **横向卡片条改换行** —— 已改，用 1.18 的 `FlexboxLayout`（默认 wrap）。
   板子实测横向确实滚不动（滑动前后截图 md5 完全相同），换成换行后 304 的 12 个实体全部可见、横向滚动条消失。
3. **板子上确认输入栈** —— 已查完，屏与 X 都正常（见 2b），**不需要改 udev / libinput / 换驱动**，也不用换 LinuxKMS 后端。
4. **滚动条**：material 的条只有 8px。当前竖向滚动条留着当指示器，未改。
5. **给上游提 issue**：finger id 从 0 开始导致单指被判成鼠标（根因 A）。上游改成 `+1` 后，不开 `mouse-drag-pan-enabled` 也能单指滚，且能拿到触摸惯性。
6. **副作用已验**：开 pan 后 Flickable 会对按下延迟 100ms 再转发。板子实测滚动区内的点击（人数页房间行）**照常响应**，不受影响。

## 板子实测方法（可复现）

板子上没有现成的触摸注入工具，用 `/dev/uinput` 造虚拟触摸屏（需 root）：

- `~/touchtest/touch_inject.py` —— 纯 ioctl 造多点触摸设备并发一次滑动。
  注意 ioctl 常量：`_IOW(0x55, n, int)`，`EV=100 KEY=101 REL=102 ABS=103 PROP=110`。
- `~/touchtest/board_*.py` —— 起真实应用 + 注入触摸 + `xwd` 截图，用来做前后对比。
- 验证 X 确实收到触摸：`xinput test-xi2` 应出现 `RawTouchUpdate`。
- 截图拉回本机用 `magick x.xwd x.png` 转换。

## 副作用

`mouse-drag-pan-enabled: true` 之后，Flickable 会对按下的事件延迟 100ms 再决定给谁（防止滚动时误触发按下态）。影响：滚动区里带 TouchArea 的条目（人数页的房间行）按下态会晚一点。但**快速点击不受影响**——规则是「100ms 内松开就把按下和松开一起立刻下发」。客房页的卡片没有 TouchArea，无影响。

**板子实测**：开 pan 后点人数页「302」房间行，判定线照常加上（`进 0 出 0 净 0`），点击未受影响。
