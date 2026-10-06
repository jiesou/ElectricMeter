"""帧来源：视频文件（本机验收）或摄像头（板子）。"""

import cv2

from camera_service import camera_service


def video(path):
    cap = cv2.VideoCapture(path)

    def read():
        ok, frame = cap.read()
        if not ok:  # 放完从头再来，演示要一直有画面
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = cap.read()
        return frame if ok else None

    return read


def camera(index=0):
    camera_service.start()
    return lambda: camera_service.get_frame(index)
