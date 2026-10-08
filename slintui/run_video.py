"""离线跑一段视频：打印每条判定线的进/出/净，可写出带框的录像。

用法：.venv/bin/python run_video.py samples/vtest.avi --line 0.45,0.3,0.45,1.0 --out samples/annotated.mp4
"""

import argparse
import time

import cv2

from calibration import Calibration
from settings import DEFAULT_LINE, stored_settings
from vision.counter import LineCounter
from vision.detector import Detector
from vision.pipeline import Pipeline
from vision.tracker import ByteTracker


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", nargs="?", default=stored_settings.get("video"))
    ap.add_argument("--line", help="x1,y1,x2,y2，归一化坐标；不给就用 settings.json 里这个视频标好的线")
    ap.add_argument("--out", default="", help="带框录像的输出路径")
    ap.add_argument("--csv", default="", help="人数随时间变化的输出路径")
    ap.add_argument("--limit", type=int, default=0, help="只跑前 N 帧")
    a = ap.parse_args()

    counters = Calibration(a.video).counters or [LineCounter(*DEFAULT_LINE)]
    if a.line:
        x1, y1, x2, y2 = map(float, a.line.split(","))
        counters[0].set_line([x1, y1], [x2, y2])

    def counts():
        return "  ".join(f"线{i} 进{c.in_count} 出{c.out_count} 净{c.in_count - c.out_count}"
                         for i, c in enumerate(counters))

    cap = cv2.VideoCapture(a.video)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    pipeline = Pipeline(lambda: cap.read()[1],
                        Detector(stored_settings.get("model", "models/yolo11n.onnx")),
                        ByteTracker(), counters)

    writer = None
    rows = []
    i = 0
    t0 = time.time()
    while True:
        frame = pipeline.step()
        if frame is None or (a.limit and i >= a.limit):
            break
        if a.out:
            if writer is None:
                writer = cv2.VideoWriter(a.out, cv2.VideoWriter_fourcc(*"mp4v"), 10,
                                         (frame.shape[1], frame.shape[0]))
            writer.write(frame)
        first = counters[0]
        rows.append((i, first.in_count, first.out_count, first.in_count - first.out_count))
        i += 1
        if i % 100 == 0:
            print(f"{i}/{total}  {counts()}  {i / (time.time() - t0):.1f} fps")
    if a.csv:
        with open(a.csv, "w") as f:
            f.write("frame,in,out,now\n")
            for row in rows:
                f.write(",".join(str(v) for v in row) + "\n")
    print(f"跑完 {i} 帧，{time.time() - t0:.1f}s，{counts()}")


main()
