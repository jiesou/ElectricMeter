"""推理线程：抓帧 → 检测 → 跟踪 → 计数 → 画框；UI 线程按 16ms 拉最新帧。"""

import threading
import time

import cv2


class Pipeline:
    def __init__(self, read_frame, detector, tracker, counter=None, send=None, fps=10):
        self.read_frame = read_frame
        self.detector = detector
        self.tracker = tracker
        self.counter = counter
        self.send = send
        self.fps = fps
        self.running = False
        self.latest_frame = None
        self.counts = (0, 0, 0)

    def start(self):
        self.running = True
        threading.Thread(target=self._loop, daemon=True).start()

    def stop(self):
        self.running = False

    def step(self):
        """跑一帧，返回画好的帧；视频读完了回 None（离线验收也用这个）"""
        frame = self.read_frame()
        if frame is None:
            return None
        tracks = self.tracker.update(self.detector.detect(frame))
        if self.counter:
            self.counts = self.counter.update(tracks, frame.shape)
            self.counter.draw(frame)
        for t in tracks:
            x1, y1, x2, y2 = (int(v) for v in t.box)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        self.latest_frame = frame
        return frame

    def _loop(self):
        while self.running:
            frame = self.step()
            if frame is None:
                break
            if self.send:
                self.send(frame)
            time.sleep(1 / self.fps)
