"""YOLO11n 人体检测：ONNX（本机）与 RKNN（板子）两条后端，前后处理共用。

两种头都吃：
- 标准导出（我们自己导的 ONNX）：一个输出 [1, 84, 8400]
- 老仓库改过头的那份（yolo11n.rknn / 他们的 yolo11n.onnx）：9 个输出，DFL 在 Python 侧算

输入都是 letterbox 后的 640×640 RGB uint8，归一化由各自运行时按量化参数做（mean 0 / std 255）。
"""

import cv2
import numpy as np

PERSON = 0
SIZE = 640


def letterbox(bgr):
    """等比缩放 + 灰边填充到 SIZE×SIZE，返回填充后的图与映射参数"""
    h, w = bgr.shape[:2]
    ratio = min(SIZE / h, SIZE / w)
    nw, nh = round(w * ratio), round(h * ratio)
    pad_x, pad_y = (SIZE - nw) // 2, (SIZE - nh) // 2
    out = np.full((SIZE, SIZE, 3), 114, np.uint8)
    out[pad_y:pad_y + nh, pad_x:pad_x + nw] = cv2.resize(bgr, (nw, nh))
    return out, ratio, pad_x, pad_y


def dfl(position):
    """(n, 64) → 左 上 右 下 四个距离：每组 16 个 bin 做 softmax 期望"""
    x = position.reshape(len(position), 4, 16)
    x = np.exp(x - x.max(2, keepdims=True))
    p = x / x.sum(2, keepdims=True)
    return (p * np.arange(16)).sum(2)


class Detector:
    def __init__(self, model_path, conf=0.15, nms=0.6):
        self.conf = conf
        self.nms = nms
        self.is_rknn = model_path.endswith(".rknn")
        if self.is_rknn:
            from rknnlite.api import RKNNLite

            self.net = RKNNLite()
            self.net.load_rknn(model_path)
            self.net.init_runtime(core_mask=RKNNLite.NPU_CORE_0_1_2)
        else:
            import onnxruntime as ort

            self.net = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])

    def detect(self, bgr):
        """返回 [(x1, y1, x2, y2, 分数)]，原图坐标"""
        img, ratio, pad_x, pad_y = letterbox(bgr)
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).transpose(2, 0, 1)
        outs = self._infer(rgb)
        boxes, scores = self._flat(outs[0]) if len(outs) == 1 else self._dfl(outs)
        if not len(boxes):
            return []
        idx = np.array(cv2.dnn.NMSBoxes(boxes, scores, self.conf, self.nms)).flatten()
        h, w = bgr.shape[:2]
        dets = []
        for i in idx:
            x, y = (boxes[i, 0] - pad_x) / ratio, (boxes[i, 1] - pad_y) / ratio
            x2, y2 = x + boxes[i, 2] / ratio, y + boxes[i, 3] / ratio
            dets.append((float(np.clip(x, 0, w)), float(np.clip(y, 0, h)),
                         float(np.clip(x2, 0, w)), float(np.clip(y2, 0, h)), float(scores[i])))
        return dets

    def _infer(self, rgb):
        if self.is_rknn:
            return self.net.inference(inputs=[rgb])
        return self.net.run(None, {"images": rgb[None].astype(np.float32) / 255})

    def _flat(self, out):
        """标准头：(1, 4 + 80, N) → letterbox 空间的 xywh 与分数"""
        pred = out[0].T
        score = pred[:, 4 + PERSON]
        keep = score > self.conf
        cx, cy, bw, bh = pred[keep, :4].T.astype(np.float32)
        return np.stack([cx - bw / 2, cy - bh / 2, bw, bh], 1), score[keep].astype(np.float32)

    def _dfl(self, outs):
        """改头：每个尺度给 [box 64ch, 类分数, 附加]，取 person 那一通道"""
        boxes, scores = [], []
        for i in range(len(outs) // 3):
            box, cls = outs[i * 3][0], outs[i * 3 + 1][0]
            h, w = box.shape[1:]
            stride = SIZE // h
            score = cls[PERSON].reshape(-1)
            keep = score > self.conf
            if not keep.any():
                continue
            lt_rb = dfl(box.transpose(1, 2, 0).reshape(-1, 64)[keep])
            gy, gx = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
            gx, gy = gx.reshape(-1)[keep], gy.reshape(-1)[keep]
            boxes.append(np.stack([(gx + 0.5 - lt_rb[:, 0]) * stride, (gy + 0.5 - lt_rb[:, 1]) * stride,
                                   (lt_rb[:, 0] + lt_rb[:, 2]) * stride, (lt_rb[:, 1] + lt_rb[:, 3]) * stride], 1))
            scores.append(score[keep])
        if not boxes:
            return np.empty((0, 4), np.float32), np.empty(0, np.float32)
        return np.concatenate(boxes).astype(np.float32), np.concatenate(scores).astype(np.float32)
