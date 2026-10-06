"""导出 YOLO11n 为 ONNX（本机 onnxruntime 与板子 RKNN 都用这一份）。

用法：.venv-export/bin/python scripts/export_yolo11n.py
"""

import shutil
from pathlib import Path

from ultralytics import YOLO

root = Path(__file__).resolve().parent.parent
model = YOLO("yolo11n.pt")
onnx_path = Path(model.export(format="onnx", opset=12, imgsz=640, simplify=True, dynamic=False))

target = root / "models" / "yolo11n.onnx"
target.parent.mkdir(exist_ok=True)
shutil.move(onnx_path, target)
print(f"导出 {target} ({target.stat().st_size / 1e6:.1f} MB)")
