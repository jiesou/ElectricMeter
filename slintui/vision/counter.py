"""判定线跨线计数：轨迹中心从线的一侧走到另一侧算一次。

线的两点用归一化坐标配置（0~1），跟分辨率无关。负侧 → 正侧算「进」，反过来算「出」。
"""

import cv2
import numpy as np


class LineCounter:
    def __init__(self, p1, p2):
        self.p1 = np.array(p1, float)
        self.p2 = np.array(p2, float)
        self.sides = {}
        self.in_count = 0
        self.out_count = 0

    def update(self, tracks, shape):
        h, w = shape[:2]
        p1 = self.p1 * (w, h)
        d = self.p2 * (w, h) - p1
        alive = set()
        for t in tracks:
            cx, cy = t.center
            side = d[0] * (cy - p1[1]) - d[1] * (cx - p1[0])
            old = self.sides.get(t.id)
            if old is not None and old * side < 0:
                if old < 0:
                    self.in_count += 1
                else:
                    self.out_count += 1
            self.sides[t.id] = side
            alive.add(t.id)
        self.sides = {k: v for k, v in self.sides.items() if k in alive}
        return self.in_count, self.out_count, self.in_count - self.out_count

    def draw(self, frame):
        h, w = frame.shape[:2]
        cv2.line(frame, tuple((self.p1 * (w, h)).astype(int)),
                 tuple((self.p2 * (w, h)).astype(int)), (0, 215, 255), 2)
        return frame
