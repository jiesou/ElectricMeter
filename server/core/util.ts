export const now = () => Date.now();

/** 展示顺序：设备与实体一律按 id 字母序，跟谁先连上、谁先申报无关 */
export const byId = (a: { id: string }, b: { id: string }) =>
  a.id.localeCompare(b.id);
