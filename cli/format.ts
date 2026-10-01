/** CLI 排版工具：颜色、表格、火花图。全部按终端实际显示宽度排，中文算两格 */

const on = process.stdout.isTTY;
const paint = (code: string) => (s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  dim: paint("2"),
  bold: paint("1"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  blue: paint("36"),
  gray: paint("90"),
};

const strip = (s: string) => s.replace(/\x1b\[\d+m/g, "");
const wide = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

/** 终端显示宽度，中文算两格，ANSI 转义不计 */
export const w = (s: string) => {
  let n = 0;
  for (const ch of strip(s)) n += wide.test(ch) ? 2 : 1;
  return n;
};

export const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - w(s)));

/** right 里的列右对齐，其余左对齐 */
export function table(head: string[], rows: string[][], right: number[] = []) {
  const widths = head.map((h, i) => Math.max(w(h), ...rows.map((r) => w(r[i] ?? ""))));
  const line = (cells: string[]) =>
    cells
      .map((s, i) => (right.includes(i) ? " ".repeat(Math.max(0, widths[i] - w(s))) + s : pad(s, widths[i])))
      .join("  ");
  console.log(c.dim(line(head)));
  console.log(c.dim(widths.map((n) => "─".repeat(n)).join("  ")));
  for (const r of rows) console.log(line(r));
}

const SPARK = "▁▂▃▄▅▆▇█";

/** 数值序列画成一行柱状，width 列封顶——点太多终端放不下 */
export function spark(values: number[], width = 60) {
  const step = Math.max(1, Math.ceil(values.length / width));
  const cols: number[] = [];
  for (let i = 0; i < values.length; i += step) {
    const seg = values.slice(i, i + step);
    cols.push(step > 1 ? seg.reduce((a, b) => a + b, 0) / seg.length : seg[0]);
  }
  const max = Math.max(...cols, 1e-9);
  return cols.map((v) => SPARK[Math.min(SPARK.length - 1, Math.floor((v / max) * SPARK.length))]).join("");
}

/** 横向条形图，用于电量这类「几条对比」的场合 */
export function bars(items: [string, number][], unit = "", width = 28) {
  const max = Math.max(...items.map(([, v]) => v), 1e-9);
  for (const [label, v] of items) {
    const n = Math.max(v > 0 ? 1 : 0, Math.round((v / max) * width));
    console.log(`  ${pad(label, 12)} ${c.blue("█".repeat(n))} ${v.toFixed(2)}${unit}`);
  }
}

export const kwh = (wh: number) => (wh >= 3.6e6 ? `${(wh / 3.6e6).toFixed(2)} kWh` : `${(wh / 1e3).toFixed(0)} Wh`);

export const power = (p: number) => (p >= 1000 ? `${(p / 1000).toFixed(2)} kW` : `${p.toFixed(0)} W`);

export const clock = (ts: number) => new Date(ts * 1000).toLocaleTimeString("zh-CN", { hour12: false });

export const fail = (msg: string) => {
  console.error(c.red(`✗ ${msg}`));
  process.exit(1);
};
