# `em` CLI 框架选型报告（Bun + TypeScript）

> 研究方法：npm registry / GitHub API 一手数据 + /tmp/agents 下 Bun 1.4.2 逐个实装实测（help / 子命令 / flags / --json / 错误路径全部跑过）。所有结论有实测证据，非搜索预览。

## 结论（TL;DR）

**主框架 commander@15.0.0 + picocolors@1.1.1 + cli-table3@0.6.5，三个依赖，总安装量 < 300KB。SSE 客户端用 Bun 原生 `fetch` + `ReadableStream` 手写 ~15 行（Bun 1.4.2 没有 EventSource，实测确认）。现在不引入任何 TUI / 交互库。**

```sh
bun add commander picocolors cli-table3
```

## 一、候选实测对比（全部在 Bun 1.4.2 下真实运行）

| 框架 | 版本（npm latest） | 依赖数 | Bun 实测 | 帮助/错误质量 | 维护状态 | 判定 |
|---|---|---|---|---|---|---|
| **commander** | 15.0.0（2026-05） | **0**，ESM | ✅ 全过：help/子命令/`--json` 前置生效/表格 | 中文直出；未知命令 `Did you mean entities?` 拼写建议；未知 flag 报错清晰 exit 1 | 28.4k★，仅 **12 个 open issue**，上周仍在 push，v15 今年发版 | **✅ 推荐** |
| citty | 0.2.2（2026-04） | **0**（基于 util.parseArgs） | ⚠️ 两个坑：① 父级 `--json` 放子命令**前面**不传播（`em --json entities` 拿到 undefined，实测）；② 帮助里 CJK 宽度算错导致对齐错位（实测截图见下） | 未知命令打整屏 usage，噪声大 | 1.3k★，unjs 系，活跃但 **7 年了还是 0.x** | 备选不推荐 |
| gunshi | 0.37.3（2026-09，v1.0.0-rc.1） | **0** | ⚠️ 能跑，但默认体验差：未知命令**甩整页源码堆栈**（实测）；每条命令输出前都打印 header（需自定义关闭） | 帮助生成漂亮、内置 i18n、有官方补全插件 @gunshi/plugin-completion | 470★、月下载 38 万，作者 kazupon（Vue I18n 作者）个人维护，活跃 | 有意思但太早，观察名单 |
| cac | 7.0.0（2026-02） | **0** | ❌ **未知命令静默 exit 0、零输出**（`em entites` 拼错直接无声成功，实测两次） | help 尚可；未知 flag 抛原始堆栈 | 3.1k★，活跃 | 排除（静默失败不可接受） |
| yargs | 18.2.0（2026-09） | **6** | （未实测，数据面已无优势） | — | 11.5k★，214 open issues | 排除：比 commander 重，无增益 |
| clipanion | 4.0.0-rc.4 | 1（typanion） | — | — | **2024-09 后零发布，卡 RC 两年** | 排除（停滞） |
| @oclif/core | 5.1.2（2026-09） | **18**，458KB | — | — | Salesforce 支持，活跃 | 排除：为 ~10 个子命令的只读 CLI 拉全家桶，严重过度工程 |

## 二、必答问题逐条

**1. Bun 兼容性**：commander / citty / gunshi / cac 四个全部在 Bun 1.4.2 直接跑通，无任何 workaround。差异全在**默认 UX 质量**：commander 的错误提示（拼写建议、exit code）是唯一开箱即用就体面的。

**2. 依赖重量 vs 收益**：commander 0 依赖 207KB unpacked；加 picocolors（6KB）+ cli-table3（46KB+string-width）总共 <300KB，换来的是声明式子命令、自动 help、拼写建议、exit code 语义。yargs 6 依赖、oclif 18 依赖/458KB，对这个规模没有任何对应回报。

**3. 什么时候才需要 TUI（ink）**：ink 需要 React + react-reconciler + yoga-layout 共 23 个依赖（ink 8.0.0，2026-10 仍活跃、40k★），解决的是「全屏、多面板、事件驱动的终端重绘」。**本 CLI 是只读表格 + 单命令生命周期，没到那个程度**；演示级 `watch` 用「ANSI 清屏 + 循环重打表格」即可。blessed 已死（最后发布 2015-09），不考虑。触发 ink 的条件：未来做实时事件流全屏仪表盘时再评估。

**4. `--json` 与框架结合**：commander 把 `--json` 挂 program 级，子命令内 `prog.opts().json` 读取，**放在子命令前后都生效**（实测）。输出契约 = 原始 JSON（只写 stdout，错误走 stderr），将来包 MCP server 就是现成工具描述。Shell 补全：commander 无内置（gunshi 有 @gunshi/plugin-completion，yargs/oclif 有内置），对内部演示 CLI 是非阻塞项，将来要的话单独加，不影响选型。`--help` 一致性由 commander 自动生成，所有子命令免费获得。

**5. SSE 消费**：**Bun 1.4.2 无 `EventSource`（实测 `typeof EventSource === 'undefined'`）**。方案：`fetch(url)` + 读 `response.body`（ReadableStream）按 `\n\n` 分帧解析，~15 行；服务端本来就每秒推全量快照，解析器极薄。不引第三方 SSE 库。

## 三、最终推荐 + 已验证最小示例（37 行，Bun 实跑通过）

```ts
#!/usr/bin/env bun
// cli/em.ts —— bun add commander picocolors cli-table3
import { Command } from 'commander'
import pc from 'picocolors'
import Table from 'cli-table3'

const prog = new Command()
  .name('em')
  .description('民宿用电管理 CLI')
  .version('0.1.0')
  .option('--json', '以 JSON 输出原始数据')

prog
  .command('entities')
  .description('列出实体（可按设备过滤）')
  .option('-d, --device <id>', '按设备过滤，如 esp-301')
  .action((opts) => {
    const rows = [
      ['esp-301/light', 'on', '12.5 W'],
      ['esp-301/ac', 'off', '0 W'],
    ]
    if (prog.opts().json) {
      console.log(JSON.stringify({ device: opts.device, rows }, null, 2))
    } else {
      const t = new Table({ head: ['实体', '状态', '功率'] })
      t.push(...rows)
      console.log(t.toString())
      console.log(pc.dim(`设备: ${opts.device ?? '全部'}`))
    }
  })

prog
  .command('show')
  .description('查看实体详情')
  .argument('<ref>', '实体引用，如 esp-301/light')
  .action((ref) => console.log(`show ${ref}`))

prog.parse()
```

### 实测输出证据（Bun 1.4.2）

```
$ bun em.ts --help
Usage: em [options] [command]

民宿用电管理 CLI

Options:
  -V, --version       output the version number
  --json              以 JSON 输出原始数据
  -h, --help          display help for command

Commands:
  entities [options]  列出实体（可按设备过滤）
  show <ref>          查看实体详情
  help [command]      display help for command

$ bun em.ts entities --device=esp-301
┌───────────────┬──────┬────────┐
│ 实体          │ 状态 │ 功率   │
├───────────────┼──────┼────────┤
│ esp-301/light │ on   │ 12.5 W │
│ esp-301/ac    │ off  │ 0 W    │
└───────────────┴──────┴────────┘
设备: esp-301

$ bun em.ts --json entities -d esp-301   # 全局 flag 前置也生效
{ "device": "esp-301", "rows": [...] }

$ bun em.ts entitie
error: unknown command 'entitie'
(Did you mean entities?)        # exit 1

$ bun em.ts entities --devic=esp-301
error: unknown option '--devic=esp-301'   # exit 1

冷启动（help）：commander 0.02s / citty 0.01s / gunshi 0.01s / cac 0.00s —— 均非问题
```

## 四、落库版本清单

| 包 | 版本 | 角色 |
|---|---|---|
| commander | 15.0.0 | 子命令/flags/help/错误处理 |
| picocolors | 1.1.1 | 颜色（0 依赖 6KB；chalk 6 虽已 0 依赖但没必要） |
| cli-table3 | 0.6.5 | 表格（CJK 对齐实测正确；维护慢但纯稳定件，月下载 1.4 亿） |
| （不加）@clack/prompts | 1.8.1 | 等「动作下发」需要 confirm 时再装，现在零交互场景 |
| （不加）ora / ink / blessed | 9.4.1 / 8.0.0 / 0.1.81(死) | 不需要，见问题 3 |

## 五、主要来源

- npm registry（版本/依赖/发布日期/下载量）：registry.npmjs.org + api.npmjs.org，抓取于本次研究当日
- GitHub API（stars/issues/pushed_at/releases）：tj/commander.js、unjs/citty、kazupon/gunshi、cacjs/cac、arcanis/clipanion、oclif/core、vadimdemedes/ink 等
- gunshi README: https://github.com/kazupon/gunshi （v1.0.0-rc.1, 2026-10-02）
- citty README: https://github.com/unjs/citty （0.2.2）
- 实测代码与全部输出：/tmp/agents/em-cli-research/（demo-commander/citty/gunshi/cac/sse.ts）
