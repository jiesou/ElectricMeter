import { describe, expect, test } from "bun:test";
import { clock, kwh, stamp, watt } from "./format.ts";

describe("格式化", () => {
  test("功率最多一位小数", () => {
    expect(watt(955)).toBe("955 W");
    expect(watt(955.44)).toBe("955.4 W");
    expect(watt(0)).toBe("0 W");
  });

  test("电量两位小数", () => {
    expect(kwh(66.7)).toBe("66.70 kWh");
    expect(kwh(0)).toBe("0.00 kWh");
  });

  test("秒级时间戳转本地时间", () => {
    // 2025-10-01 12:00:00 UTC+8
    const ts = 1759291200;
    expect(clock(ts)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(stamp(ts)).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
