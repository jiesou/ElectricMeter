"""客房用电页的 mock 数据：不连服务器时给大屏看的一屏数据，形状与真实快照一致。"""


def meter(name, power, energy):
    return {"name": name, "type": "meter", "state": False, "power": power, "energy": f"{energy:.2f}"}


def switch(name, state):
    return {"name": name, "type": "switch", "state": state, "power": 0, "energy": ""}


def room(name, online, entities):
    meters = [e for e in entities if e["type"] == "meter"]
    return {
        "name": name,
        "online": online,
        "power": f"{sum(e['power'] for e in meters):.0f}",
        "energy": f"{sum(float(e['energy']) for e in meters):.2f}",
        "entities": entities,
    }


ROWS = [
    room("301 电表箱", True, [meter("总表", 1280, 66.75)]),
    room("302 电表箱", True, [switch("照明", True), switch("插座", False), meter("空调", 900, 46.2)]),
    room("303 电表箱", False, []),
    room(
        "304 电表箱",
        True,
        [meter(f"回路 {i}", i * 160, i * 1.5) for i in range(1, 9)]
        + [switch(f"开关 {i}", i % 2 == 0) for i in range(1, 5)],
    ),
]
