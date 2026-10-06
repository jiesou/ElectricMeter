"""客房用电页的假数据预览：不连服务器，几间房各放不同数量的实体，看渲染合不合理。

    cd slintui && .venv/bin/python scripts/mock_power.py [跳过前几间]
"""

import sys

import slint

ui = slint.load_file("ui/app-window.slint")


def meter(name, power, energy):
    return ui.EntityCard(name=name, type="meter", state=False, power=power, energy=f"{energy:.2f}")


def switch(name, state):
    return ui.EntityCard(name=name, type="switch", state=state, power=0, energy="")


def room(name, online, entities):
    meters = [e for e in entities if e.type == "meter"]
    return ui.Room(
        name=name,
        online=online,
        power=f"{sum(e.power for e in meters):.0f}",
        energy=f"{sum(float(e.energy) for e in meters):.2f}",
        entities=slint.ListModel(entities),
    )


window = ui.AppWindow()
window.AppData.current_tab = 0
rooms = [
    room("301 电表箱", True, [meter("总表", 1280, 66.75)]),
    room("302 电表箱", True, [switch("照明", True), switch("插座", False), meter("空调", 900, 46.2)]),
    room("303 电表箱", False, []),
    room("304 电表箱", True,
         [meter(f"回路 {i}", i * 160, i * 1.5) for i in range(1, 9)]
         + [switch(f"开关 {i}", i % 2 == 0) for i in range(1, 5)]),
]
# 截图看不到下面的房间时，传个数字跳过前几间
window.PowerPageData.rooms = slint.ListModel(rooms[int(sys.argv[1]) if len(sys.argv) > 1 else 0:])
window.PowerPageData.updated = "假数据"
window.PowerPageData.server = "mock"
window.PowerPageData.refresh = lambda: None
window.AppData.tab_changed = lambda i: None
window.show()
window.run()
