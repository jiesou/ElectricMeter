"""判定线跨线计数：轨迹的脚点从线的一侧走到另一侧算一次。

判定点用框底边中点（脚点）——斜视透视下人走近时框会变高、框中心跟着往下漂，
脚点贴地面才稳。判据是「上次脚点 → 这次脚点」这条线段真的穿过判定线，
所以快走的人一帧跨过去也算得上。

线的两点用归一化坐标配置（0~1），跟分辨率无关。线的两侧由两点顺序决定，
叉积为负的那侧算「进」侧 —— 哪侧是室内，靠交换两点来定。
每条线绑一间客房（device_id），一台机位一屏可以有好几条。
"""

import cv2
import numpy as np

LINE_COLORS = [(0, 215, 255), (0, 255, 140), (255, 130, 0), (200, 0, 255)]
DEAD_ZONE = 0.02  # 画面高的 2%：脚点落在这条带子里算「线上」，这一帧不作数
COAST_LIMIT = 5   # 轨迹多少帧没被检出之后就不再算数：再往后框是纯外推的，可能已经飘到没人的地方


def crossed(p, q, a, b):
    """线段 pq 是否真的穿过判定线 ab：已知 p、q 在 ab 两侧，只需再看 a、b 在 pq 两侧"""
    def side(o, u, v):
        return (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0])
    return side(p, q, a) * side(p, q, b) < 0


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
        self.last = {}  # 换线后旧脚点全部作废，不然一比对就是一堆假进出

    def reset(self):
        self.in_count = 0
        self.out_count = 0
        self.last = {}

    def _point(self, t, h):
        x1, y1, x2, y2 = t.box
        if y2 >= h - 2:  # 脚被画面底边截了，脚点不可信，退回框中心
            return np.array([(x1 + x2) / 2, (y1 + y2) / 2])
        return np.array([(x1 + x2) / 2, y2])

    def update(self, tracks, shape):
        """跑一帧：有人跨线就返回 True，上报端凭这个立刻推一次"""
        h, w = shape[:2]
        p1 = self.p1 * (w, h)
        p2 = self.p2 * (w, h)
        d = p2 - p1
        dead = DEAD_ZONE * h * np.hypot(*d)
        alive = set()
        crossed_line = False
        for t in tracks:
            alive.add(t.id)
            if t.misses > COAST_LIMIT:
                continue  # 留着上次的脚点，等它重新被检出时那条线段照样会穿过判定线
            pt = self._point(t, h)
            side = d[0] * (pt[1] - p1[1]) - d[1] * (pt[0] - p1[0])
            if abs(side) < dead:
                continue  # 贴着线，等走远了再判，免得人在门口站着来回抖
            last = self.last.get(t.id)
            if last is not None and last[1] * side < 0 and crossed(last[0], pt, p1, p2):
                crossed_line = True
                if last[1] < 0:
                    self.in_count += 1
                else:
                    self.out_count += 1
            self.last[t.id] = (pt, side)
        self.last = {k: v for k, v in self.last.items() if k in alive}
        return crossed_line

    def draw(self, frame):
        h, w = frame.shape[:2]
        cv2.line(frame, tuple((self.p1 * (w, h)).astype(int)),
                 tuple((self.p2 * (w, h)).astype(int)),
                 LINE_COLORS[self.index % len(LINE_COLORS)], 2)
        return frame
