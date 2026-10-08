"""人数监控页：一路画面 + 这台机位的判定线，外加四个控件（标定 / 图传 / 换摄像头 / 清零）。

框与判定线都由 vision.pipeline 画进帧里，这层只把帧和数字推给 UI、把 UI 的动作落回去。
"""

import numpy as np
import slint

import frame_sender
from calibration import Calibration
from camera_service import camera_service
from settings import stored_settings
from vision import sources
from vision.detector import Detector
from vision.pipeline import Pipeline
from vision.tracker import ByteTracker

RoomRow = slint.loader.ui.people_page.RoomRow
LineLabel = slint.loader.ui.people_page.LineLabel

CALIBRATION_FPS = 20  # 标定态提帧率：拖动时帧里的线跟手一点（线在帧里，快不了更多）
PEOPLE_FPS = 10


class CameraPage:
    def __init__(self, power_stream):
        self.power_stream = power_stream
        self.device, read_frame = self._source()
        self.calibration = Calibration(self.device)
        self.sender = self._sender()
        self.streaming = self.sender is not None
        self.pipeline = Pipeline(read_frame,
                                 Detector(stored_settings.get("model", "models/yolo11n.onnx")),
                                 ByteTracker(),
                                 self.calibration.counters,
                                 send=self.sender if self.streaming else None)
        self.rows = []

    def start(self):
        self.pipeline.start()

    def stop(self):
        self.pipeline.stop()

    def bind(self, window):
        self.data = window.PeoplePageData
        self.data.camera = self.device
        self.data.streaming = self.streaming
        self.data.can_swap = len(camera_service.devices()) > 1
        self._push_rows(force=True)

        self.data.request_camera_frame = self.request_camera_frame
        self.data.toggle_stream = self.toggle_stream
        self.data.reset_counts = self.reset_counts
        self.data.open_calibration = self.open_calibration
        self.data.close_calibration = self.close_calibration
        self.data.room_clicked = self.room_clicked
        self.data.press = self.press
        self.data.drag = self.drag
        self.data.release = self.calibration.release
        self.data.remove_line = self.remove_line
        self.data.swap_camera = self.swap_camera
        window.AppData.swap_cameras = self.swap_camera

    def request_camera_frame(self):
        frame = self.pipeline.latest_frame
        if frame is not None:
            self.data.camera_frame = slint.Image.load_from_array(np.ascontiguousarray(frame[:, :, ::-1]))
        self._push_rows()

    def toggle_stream(self):
        self.streaming = not self.streaming
        self.pipeline.send = self.sender if self.streaming else None
        self.data.streaming = self.streaming

    def reset_counts(self):
        for counter in self.calibration.counters:
            counter.reset()
        self._push_rows()

    def open_calibration(self):
        self.data.calibrating = True
        self.calibration.selected = 0 if self.calibration.counters else -1  # 直接选第一条，省得先点一下
        self.pipeline.fps = CALIBRATION_FPS
        self._push_calibration()

    def close_calibration(self):
        self.calibration.save()
        self.data.calibrating = False
        self.pipeline.fps = PEOPLE_FPS
        self._push_rows()

    def room_clicked(self, device_id):
        counter = self.calibration.counter(device_id)
        if counter is None:
            if not self.data.calibrating:
                return
            self.calibration.add(device_id)  # 还没标定的房间，点一下就给它一条线
        else:
            self.calibration.selected = counter.index
        self._push_calibration()

    def press(self, x, y):
        self.calibration.press(x, y)
        self._push_calibration()

    def drag(self, x, y):
        self.calibration.drag(x, y)
        self._push_calibration()

    def remove_line(self):
        self.calibration.remove()
        self._push_calibration()

    def swap_camera(self):
        """换下一台机位：画面、判定线组、计数一起换（没在看的机位不计数）"""
        devices = camera_service.devices()
        if self.device not in devices or len(devices) < 2:
            return
        self.device = devices[(devices.index(self.device) + 1) % len(devices)]
        self.calibration = Calibration(self.device)
        self.pipeline.read_frame = sources.camera(devices.index(self.device))
        self.pipeline.counters = self.calibration.counters
        self.pipeline.tracker = ByteTracker()  # 换了画面，旧轨迹全作废
        self.data.camera = self.device
        self._push_calibration()

    def _source(self):
        video = stored_settings.get("video", "")
        if video:  # 离线和真摄像头各存各的线：画面不一样，本来就不该共用
            return video, sources.video(video)
        camera_service.start()
        return "/dev/video0", sources.camera(0)

    def _sender(self):
        url = stored_settings.get("image_feed_udp_url", "")
        if not url.startswith("udp://"):
            return None
        host, _, port = url[6:].partition(":")
        return lambda frame: frame_sender.send(frame, host, int(port))

    def _rows(self):
        rooms, _ = self.power_stream.snapshot()
        counters = {c.device_id: c for c in self.calibration.counters}
        rows = []
        for room in rooms:
            device_id = room.get("id", room["name"])
            counter = counters.get(device_id)
            rows.append({
                "id": device_id,
                "name": room["name"].split()[0],  # "301 电表箱" → "301"
                "in_count": counter.in_count if counter else 0,
                "out_count": counter.out_count if counter else 0,
                "net": counter.in_count - counter.out_count if counter else 0,
                "lined": counter is not None,
                "selected": counter is not None and counter.index == self.calibration.selected,
            })
        return rows

    def _push_rows(self, force=False):
        rows = self._rows()
        if force or rows != self.rows:
            self.rows = rows
            self.data.rooms = slint.ListModel([RoomRow(**row) for row in rows])

    def _push_calibration(self):
        self._push_rows()
        names = {row["id"]: row["name"] for row in self.rows}
        self.data.labels = slint.ListModel([
            LineLabel(name=names.get(device_id, device_id), x=x, y=y, selected=selected)
            for device_id, x, y, selected in self.calibration.labels()
        ])
        selected = self.calibration.selected
        counter = self.calibration.counters[selected] if selected >= 0 else None
        self.data.selected = selected
        self.data.ax, self.data.ay = counter.p1 if counter else (0.0, 0.0)
        self.data.bx, self.data.by = counter.p2 if counter else (0.0, 0.0)
