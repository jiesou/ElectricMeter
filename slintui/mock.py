"""客房管理页的 mock 数据：不连服务器时给大屏看的一屏数据，形状与真实快照一致。"""


def meter(name, power, energy):
    return {"name": name, "type": "meter", "state": False, "power": power, "energy": f"{energy:.2f}"}


def switch(name, state):
    return {"name": name, "type": "switch", "state": state, "power": 0, "energy": ""}


APPLIANCES = [("灯", 55, 3.42), ("热水壶", 1600, 18.4), ("吹风机", 900, 46.2)]


def circuits(state):
    return [e for name, power, energy in APPLIANCES for e in (meter(f"{name}功率", power, energy), switch(name, state))]


def room(name, online, entities):
    meters = [e for e in entities if e["type"] == "meter"]
    return {
        "id": "esp-" + name.split()[0],  # 跟模拟器的 device_id 对齐，判定线要挂在这上面
        "name": name,
        "online": online,
        "power": f"{sum(e['power'] for e in meters):.0f}",
        "energy": f"{sum(float(e['energy']) for e in meters):.2f}",
        "entities": entities,
    }


ROWS = [
    room("301 电表箱", True, circuits(True)),
    room("302 电表箱", True, circuits(True)),
    room("303 电表箱", False, []),
    room("304 电表箱", True, circuits(False)),
]
