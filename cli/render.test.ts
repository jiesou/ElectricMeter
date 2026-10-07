import { describe, expect, test } from "bun:test";
import * as view from "./render.ts";
import { entities, rooms } from "./stub.ts";

// bun test 下 stdout 非 TTY，picocolors 自动关色，直接断言纯文本

describe("render", () => {
  test("rooms 合计行：功率只算在线房，电量全计", () => {
    const s = view.rooms(rooms);
    expect(s).toContain("955 W");
    expect(s).toContain("79.04 kWh");
    expect(view.rooms([])).toContain("暂无客房");
  });

  test("rooms 空名称回退 ID", () => {
    expect(view.rooms(rooms)).toContain("esp-302");
  });

  test("entities 状态文案", () => {
    const s = view.entities(entities);
    expect(s).toContain("esp-301/light");
    expect(s).toContain("通电");
    expect(s).toContain("123.4 W");
    expect(s).toContain("12.50 kWh");
  });

  test("show 详情", () => {
    expect(view.show(entities[0]!)).toContain("照明");
    expect(view.show(entities[1]!)).toContain("123.4 W");
  });

  test("watchTick 带时钟", () => {
    expect(view.watchTick(rooms)).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
