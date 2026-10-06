import os

os.environ["SLINT_STYLE"] = "material-dark"
os.environ["SLINT_FULLSCREEN"] = "1"
os.environ["SLINT_SCALE_FACTOR"] = "1.5"  # 1920 / 1280

import numpy as np
import slint

import frame_sender
from power import PowerStream
from settings import stored_settings
from vision import sources
from vision.counter import LineCounter
from vision.detector import Detector
from vision.pipeline import Pipeline
from vision.tracker import ByteTracker


class AppWindow(slint.loader.ui.app_window.AppWindow):
    pass


Room = slint.loader.ui.power_page.Room
EntityCard = slint.loader.ui.power_page.EntityCard


def build_pipeline():
    video = stored_settings.get("video", "")
    line = stored_settings.get("line", [[0.5, 0.05], [0.5, 0.95]])
    sender = None
    url = stored_settings.get("image_feed_udp_url", "")
    if url.startswith("udp://"):
        host, _, port = url[6:].partition(":")
        sender = lambda frame: frame_sender.send(frame, host, int(port))
    return Pipeline(
        sources.video(video) if video else sources.camera(),
        Detector(stored_settings.get("model", "models/yolo11n.onnx")),
        ByteTracker(),
        LineCounter(*line),
        send=sender,
    )


def bind_settings_page(window):
    data = window.SettingsPageData
    p1, p2 = stored_settings.get("line", [[0, 0], [0, 0]])
    data.server_ip = stored_settings.get_server_ip()
    data.model = stored_settings.get("model", "")
    data.video = stored_settings.get("video", "") or "摄像头"
    data.line = f"({p1[0]:.2f}, {p1[1]:.2f}) → ({p2[0]:.2f}, {p2[1]:.2f})"
    data.udp = stored_settings.get("image_feed_udp_url", "")

    def save(ip):
        stored_settings.set_server_ip(ip)
        data.server_ip = stored_settings.get_server_ip()
        data.hint = "已保存，重启程序生效"

    data.save = save


def main():
    pipeline = build_pipeline()
    pipeline.start()

    power_stream = PowerStream(stored_settings.get("api_url", ""))
    power_stream.start()

    window = AppWindow()
    window.PeoplePageData.running = True  # 摄像头视口那个 16ms 定时器

    @slint.callback(global_name="PeoplePageData")
    def request_camera_frame():
        frame = pipeline.latest_frame
        if frame is None:
            return
        window.PeoplePageData.camera_frame = slint.Image.load_from_array(
            np.ascontiguousarray(frame[:, :, ::-1]))
        window.PeoplePageData.person_count = pipeline.counts[2]
        window.PeoplePageData.in_count = pipeline.counts[0]
        window.PeoplePageData.out_count = pipeline.counts[1]

    @slint.callback(global_name="PowerPageData")
    def refresh():
        rows, updated = power_stream.snapshot()
        window.PowerPageData.rooms = slint.ListModel([
            Room(**{**row, "entities": slint.ListModel([EntityCard(**e) for e in row["entities"]])})
            for row in rows
        ])
        window.PowerPageData.server = power_stream.api_url
        window.PowerPageData.updated = updated

    @slint.callback(global_name="AppData")
    def stop_app():
        window.hide()

    window.PeoplePageData.request_camera_frame = request_camera_frame
    window.PowerPageData.refresh = refresh
    window.AppData.stop_app = stop_app
    bind_settings_page(window)

    window.show()
    window.run()

    pipeline.stop()
    power_stream.stop()


main()
