"""ByteTracker：贪心 IoU 两阶段匹配（高分框先配、低分框补配续命）+ 匀速卡尔曼预测。

匹配用的是「预测框」而不是上一帧的框 —— 人走得快时，上一帧的框已经跟他对不上了，
按速度外推一格才接得上；跟丢的轨迹每帧也照样外推，短暂遮挡能续上。
轨迹的框存的是卡尔曼校正后的估计，比原始检测框平滑，判定线不容易被抖出假进出。

状态量与噪声权重照 ifzhang/ByteTrack（MIT）的 KalmanFilterXYAH，只留预测 / 校正两条路径。
"""

import numpy as np

STD_POS = 1 / 20    # 位置噪声按框高比例给
STD_VEL = 1 / 160   # 速度噪声更小：速度是估出来的，不如位置可信


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / area if area > 0 else 0.0


def cxcywh(box):
    return np.array([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2, box[2] - box[0], box[3] - box[1]])


def xyxy(c):
    w, h = max(c[2], 1.0), max(c[3], 1.0)  # 尺寸别让它跑到零以下，画框和算 IoU 都靠这个
    return np.array([c[0] - w / 2, c[1] - h / 2, c[0] + w / 2, c[1] + h / 2])


class Kalman:
    """8 维匀速卡尔曼：状态 [cx, cy, w, h, vx, vy, vw, vh]，只用来预测下一帧的框"""

    F = np.eye(8)
    F[np.arange(4), np.arange(4) + 4] = 1  # 位置 += 速度
    H = np.eye(4, 8)  # 只观测位置与尺寸

    def __init__(self, box):
        c = cxcywh(box)
        std = [2 * STD_POS * c[3], 2 * STD_POS * c[3], 1e-2, 2 * STD_POS * c[3],
               10 * STD_VEL * c[3], 10 * STD_VEL * c[3], 1e-5, 10 * STD_VEL * c[3]]
        self.x = np.r_[c, np.zeros(4)]
        self.P = np.diag(np.square(std))

    def predict(self, coast=False):
        if coast:
            self.x[6:] = 0  # 跟丢的轨迹别让尺寸继续自己长，照 ByteTrack 的做法
        h = self.x[3]
        q = np.square(np.r_[[STD_POS * h] * 4, [STD_VEL * h] * 4])
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + np.diag(q)
        self.x[2:4] = np.maximum(self.x[2:4], 1)
        return xyxy(self.x)

    def update(self, box):
        r = np.square([STD_POS * self.x[3]] * 4)
        K = self.P @ self.H.T @ np.linalg.inv(self.H @ self.P @ self.H.T + np.diag(r))
        self.x = self.x + K @ (cxcywh(box) - self.H @ self.x)
        self.P = (np.eye(8) - K @ self.H) @ self.P
        return xyxy(self.x)


class Track:
    def __init__(self, box, score, track_id):
        self.box = np.array(box, float)   # 卡尔曼估计：匹配、计数用，平滑但跟丢后会按惯性外推
        self.obs = np.array(box, float)   # 最后一次观测到的框：画图用，跟人贴合、不会飘
        self.score = score
        self.id = track_id
        self.kf = Kalman(box)
        self.hits = 1
        self.misses = 0

    @property
    def center(self):
        return ((self.box[0] + self.box[2]) / 2, (self.box[1] + self.box[3]) / 2)

    def predict(self):
        self.box = self.kf.predict(coast=self.misses > 0)
        self.misses += 1

    def update(self, det):
        self.obs = np.array(det[:4], float)
        self.box = self.kf.update(det[:4])
        self.score = det[4]
        self.hits += 1
        self.misses = 0


class ByteTracker:
    def __init__(self, high_conf=0.4, iou_thresh=0.2, max_age=30, min_hits=1):
        self.high_conf = high_conf
        self.iou_thresh = iou_thresh
        self.max_age = max_age  # 能容忍多少帧没检出：按帧率给，15fps 下 30 帧 = 2 秒
        self.min_hits = min_hits
        self.tracks = []
        self.next_id = 1

    def update(self, dets):
        high = [d for d in dets if d[4] >= self.high_conf]
        low = [d for d in dets if d[4] < self.high_conf]

        for t in self.tracks:
            t.predict()

        pairs = self._match(high)
        for i, j in pairs:
            self.tracks[i].update(high[j])

        # 低分框只给没配上的轨迹续命，不新建轨迹
        rest = [i for i in range(len(self.tracks)) if i not in {i for i, _ in pairs}]
        for i, j in self._match(low, rest):
            self.tracks[i].update(low[j])

        taken = {j for _, j in pairs}
        for j, d in enumerate(high):
            if j not in taken:
                self.tracks.append(Track(d[:4], d[4], self.next_id))
                self.next_id += 1

        self.tracks = [t for t in self.tracks if t.misses <= self.max_age]
        return [t for t in self.tracks if t.hits >= self.min_hits]

    def _match(self, dets, track_ids=None):
        ids = range(len(self.tracks)) if track_ids is None else track_ids
        pairs = {}
        for i in ids:
            for j, d in enumerate(dets):
                v = iou(self.tracks[i].box, d[:4])
                if v >= self.iou_thresh:
                    pairs[(i, j)] = v
        matched = []
        while pairs:
            (i, j), _ = max(pairs.items(), key=lambda kv: kv[1])
            matched.append((i, j))
            pairs = {k: v for k, v in pairs.items() if k[0] != i and k[1] != j}
        return matched
