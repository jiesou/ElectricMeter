"""判定线标定：一台机位的判定线组，每条线绑一间客房（device_id）。

线就是 vision.counter.LineCounter，标定直接改它 —— 不另存一份线数据再同步。
UI 递进来的手指坐标是归一化的（x 按画面宽、y 按画面高），命中与拖动都在这算。
"""

import numpy as np

from settings import DEFAULT_LINE, stored_settings
from vision.counter import LineCounter

HANDLE_HIT = 0.04  # 端点命中半径（归一化）
BODY_HIT = 0.02    # 线身命中带（归一化）

A, B, BODY = 0, 1, 2


class Calibration:
    def __init__(self, device):
        self.device = device
        self.selected = -1
        self.grab = None  # (拖的是哪个把手, 按下点相对它的偏移)
        self.counters = [
            LineCounter(room["line"][0], room["line"][1], room["device_id"], index)
            for index, room in enumerate(self._stored())
        ]

    def counter(self, device_id):
        return next((c for c in self.counters if c.device_id == device_id), None)

    def press(self, x, y):
        """手指落下：先找最近的把手，没有就找线身；命中哪条就选中哪条"""
        spot = np.array([x, y])
        handles = [(np.linalg.norm(spot - end), index, mode)
                   for index, c in enumerate(self.counters)
                   for mode, end in ((A, c.p1), (B, c.p2))]
        hit = [h for h in handles if h[0] < HANDLE_HIT]
        if hit:
            _, self.selected, mode = min(hit)
        else:
            hit = [(self._distance(spot, c.p1, c.p2), index) for index, c in enumerate(self.counters)]
            hit = [h for h in hit if h[0] < BODY_HIT]
            if not hit:
                self.selected = -1
                self.grab = None
                return
            _, self.selected = min(hit)
            mode = BODY
        self.grab = (mode, spot - self._anchor(mode))

    def drag(self, x, y):
        if self.grab is None:
            return
        mode, offset = self.grab
        spot = np.array([x, y]) - offset
        counter = self.counters[self.selected]
        if mode == BODY:  # 整线平移：两点一起挪
            shift = spot - (counter.p1 + counter.p2) / 2
            counter.set_line(counter.p1 + shift, counter.p2 + shift)
        elif mode == A:
            counter.set_line(spot, counter.p2)
        else:
            counter.set_line(counter.p1, spot)

    def release(self):
        self.grab = None

    def add(self, device_id):
        self.counters.append(LineCounter(DEFAULT_LINE[0], DEFAULT_LINE[1], device_id, len(self.counters)))
        self.selected = len(self.counters) - 1

    def remove(self):
        if self.selected < 0:
            return
        self.counters.pop(self.selected)
        for index, counter in enumerate(self.counters):
            counter.index = index  # 颜色跟着重排
        self.selected = -1

    def labels(self):
        """每条线的房号标签落点：线中点往法向偏一点，免得压住线"""
        out = []
        for counter in self.counters:
            along = counter.p2 - counter.p1
            normal = np.array([-along[1], along[0]]) / np.linalg.norm(along)
            spot = (counter.p1 + counter.p2) / 2 + normal * 0.03
            out.append((counter.device_id, float(spot[0]), float(spot[1]), counter.index == self.selected))
        return out

    def save(self):
        rooms = [{"device_id": c.device_id, "line": [list(map(float, c.p1)), list(map(float, c.p2))]}
                 for c in self.counters]
        cameras = stored_settings.get("cameras", [])
        for camera in cameras:
            if camera.get("device") == self.device:
                camera["rooms"] = rooms
                break
        else:
            cameras.append({"device": self.device, "rooms": rooms})
        stored_settings.set("cameras", cameras)
        stored_settings.sync()

    def _stored(self):
        for camera in stored_settings.get("cameras", []):
            if camera.get("device") == self.device:
                return camera.get("rooms", [])
        return []

    def _anchor(self, mode):
        counter = self.counters[self.selected]
        if mode == A:
            return counter.p1
        if mode == B:
            return counter.p2
        return (counter.p1 + counter.p2) / 2

    @staticmethod
    def _distance(spot, p1, p2):
        """点到线的距离（判定用无限长的线，画出来的线段也跟着铺满画面）"""
        along = p2 - p1
        return abs(along[0] * (spot[1] - p1[1]) - along[1] * (spot[0] - p1[0])) / np.linalg.norm(along)
