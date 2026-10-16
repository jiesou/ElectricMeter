import type { Entity } from "@em/shared";

/** 回路配色定义了几种（见 styles.css 的 --circuit-*），多了就循环 */
const CIRCUITS = 3;

/** 电表 id 就是开关 id 加 -meter，靠这个认出「这块表配那个开关」 */
const circuitId = (id: string) => id.replace(/-meter$/, "");

/** 这个实体属于第几条回路：按开关在实体表里的顺序排，配不上开关就算第一条 */
export function circuitIndex(id: string, entities: Entity[]): number {
  const switches = entities
    .filter((e) => e.type === "switch")
    .map((e) => e.id);
  const i = switches.indexOf(circuitId(id));
  return (i < 0 ? 0 : i) % CIRCUITS;
}

/** 组件用：颜色只在主题里定义，组件不写死 */
export function circuitVar(id: string, entities: Entity[]): string {
  return `var(--circuit-${circuitIndex(id, entities) + 1})`;
}

/** 图表用：Chart.js 要真颜色值，从主题上读 */
export function circuitColor(id: string, entities: Entity[]): string {
  return cssVar(`--circuit-${circuitIndex(id, entities) + 1}`);
}

/** 读主题变量，颜色只有一个出处 */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
