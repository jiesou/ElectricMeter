"""ByteTracker：贪心 IoU 两阶段匹配（高分框先配、低分框补配续命）。

照老板端 slintui/evaluation/yolo.py 的 ByteTracker 写的，多给一个 track id 和中心点——
跨线计数要靠 id 认住同一个人。
"""

import numpy as np


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / area if area > 0 else 0.0


class Track:
    def __init__(self, box, score, track_id):
        self.box = np.array(box, float)
        self.score = score
        self.id = track_id
        self.hits = 1
        self.misses = 0

    @property
    def center(self):
        return ((self.box[0] + self.box[2]) / 2, (self.box[1] + self.box[3]) / 2)

    def update(self, det):
        self.box = np.array(det[:4], float)
        self.score = det[4]
        self.hits += 1
        self.misses = 0


class ByteTracker:
    def __init__(self, high_conf=0.4, iou_thresh=0.3, max_age=10, min_hits=2):
        self.high_conf = high_conf
        self.iou_thresh = iou_thresh
        self.max_age = max_age
        self.min_hits = min_hits
        self.tracks = []
        self.next_id = 1

    def update(self, dets):
        high = [d for d in dets if d[4] >= self.high_conf]
        low = [d for d in dets if d[4] < self.high_conf]

        for t in self.tracks:
            t.misses += 1

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
