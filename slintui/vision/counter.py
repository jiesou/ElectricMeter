"""判定线跨线计数：轨迹中心从线的一侧走到另一侧算一次。

线的两点用归一化坐标配置（0~1），跟分辨率无关。线的两侧由两点顺序决定，
叉积为负的那侧算「进」侧 —— 哪侧是室内，靠交换两点来定。
每条线绑一间客房（device_id），一台机位一屏可以有好几条。
"""

import cv2
import numpy as np

LINE_COLORS = [(0, 215, 255), (0, 255, 140), (255, 130, 0), (200, 0, 255)]
DEAD_ZONE = 0.02  # 画面高的 2%：中心点落在这条带子里算「线上」，不改变侧别


class LineCounter:
    def __init__(self, p1, p2, device_id="", index=0):
        self.device_id = device_id
        self.index = index
        self.in_count = 0
        self.out_count = 0
        self.set_line(p1, p2)

    def set_line(self, p1, p2):
        self.p1 = np.array(p1, float)
        self.p2 = np.array(p2, float)
        self.sides = {}  # 换线后旧侧别全部作废，不然一比对就是一堆假进出

    def reset(self):
        self.in_count = 0
        self.out_count = 0
        self.sides = {}

    def update(self, tracks, shape):
        h, w = shape[:2]
        p1 = self.p1 * (w, h)
        d = self.p2 * (w, h) - p1
        dead = DEAD_ZONE * h * np.hypot(*d)
        alive = set()
        for t in tracks:
            alive.add(t.id)
            cx, cy = t.center
            side = d[0] * (cy - p1[1]) - d[1] * (cx - p1[0])
            if abs(side) < dead:
                continue
            old = self.sides.get(t.id)
            if old is not None and old * side < 0:
                if old < 0:
                    self.in_count += 1
                else:
                    self.out_count += 1
            self.sides[t.id] = side
        self.sides = {k: v for k, v in self.sides.items() if k in alive}
        return self.in_count, self.out_count, self.in_count - self.out_count

    def draw(self, frame):
        h, w = frame.shape[:2]
        cv2.line(frame, tuple((self.p1 * (w, h)).astype(int)),
                 tuple((self.p2 * (w, h)).astype(int)),
                 LINE_COLORS[self.index % len(LINE_COLORS)], 2)
        return frame
