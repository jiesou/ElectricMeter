"""人数监控相机视图，线程结构照老项目 evaluation/camera_viewport.py。

_inference_loop 后台线程一直推理最新帧：推完一帧接着推下一帧，多快算多快，
没有帧率目标；结果（框、timing）存在实例上。UI 的 16ms 定时回调
request_camera_frame 每次拿最新帧画上最近的框推给界面——框可以滞后，
渲染独立持续刷新。
"""

import threading
import time

import cv2
import numpy as np
import slint


class CameraViewport:
    def __init__(self, read_frame, detector, tracker, counters=(), send=None):
        self.read_frame = read_frame
        self.detector = detector
        self.tracker = tracker
        self.counters = counters  # 共用同一个列表：标定页增删判定线这边立刻跟着变
        self.send = send
        self.tracks = []  # 最近一次推理的框，显示时复用（对应老项目 latest_result）
        self._running = False
        self._lock = threading.Lock()

    def start(self):
        if self._running:
            return
        self._running = True
        threading.Thread(target=self._inference_loop, daemon=True).start()

    def stop(self):
        self._running = False

    def _inference_loop(self):
        while self._running:
            frame = self.read_frame()
            if frame is None:
                time.sleep(0.01)  # 还没出图，下一轮再试
                continue
            with self._lock:
                self.tracks = self.tracker.update(self.detector.detect(frame))
                t = self.detector.timing
                print(f"[People] Timing (ms): preprocess={t['preprocess']:.2f} inference={t['inference']:.2f} "
                      f"postprocess={t['postprocess']:.2f} total={t['total']:.2f}")
                for counter in self.counters:
                    counter.update(self.tracks, frame.shape)
            if self.send:
                self.send(self.draw(frame.copy()))

    def draw(self, frame):
        """判定线 + 最近的框画到帧上（显示 / 图传共用）"""
        for counter in self.counters:
            counter.draw(frame)
        for t in self.tracks:
            x1, y1, x2, y2 = (int(v) for v in t.box)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        return frame

    def bind(self, window, push_rows) -> None:
        # 被 UI 的 16ms 定时调用（照老项目 bind_camera 的接法）
        def request_camera_frame() -> None:
            frame = self.read_frame()
            if frame is not None:
                drawn = self.draw(frame.copy())
                window.PeoplePageData.camera_frame = slint.Image.load_from_array(
                    np.ascontiguousarray(drawn[:, :, ::-1]))
            push_rows()

        window.PeoplePageData.request_camera_frame = request_camera_frame
