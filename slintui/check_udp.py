"""UDP 图传验收：Rust 发（Python 扩展）→ 服务器收（server/core/udp_camera.ts）→ MJPEG 取帧。

用法：先起服务器（cd server && bun run start），再 .venv/bin/python check_udp.py
"""

import socket
import struct
import time
import urllib.request

import cv2
import numpy as np

import frame_sender

VIDEO = "samples/vtest.avi"
SERVER = "http://127.0.0.1:8080"
UDP_PORT = 8080
CHUNK_PAYLOAD = 1472 - 8


def check_protocol(frame):
    """本地裸 socket 收包，逐字段核对包头与重组结果"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("127.0.0.1", 0))
    sock.settimeout(2)
    frame_sender.send(frame, "127.0.0.1", sock.getsockname()[1])

    chunks, index, total, biggest = {}, None, None, 0
    while True:
        try:
            packet, _ = sock.recvfrom(2048)
        except socket.timeout:
            break
        index, chunk_index, total = struct.unpack("<IHH", packet[:8])
        chunks[chunk_index] = packet[8:]
        biggest = max(biggest, len(packet))
        if len(chunks) == total:
            break
    jpeg = b"".join(chunks[i] for i in range(total))
    img = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
    print(f"协议: frame_index={index} 分片 {len(chunks)}/{total} 最大包 {biggest}B "
          f"净荷上限 {CHUNK_PAYLOAD}B 重组 {len(jpeg)}B → 解码 {img.shape}")


def grab_mjpeg(url):
    """从 MJPEG 流里取第一张完整 JPEG"""
    with urllib.request.urlopen(url, timeout=5) as resp:
        buf = b""
        while b"\xff\xd9" not in buf:
            chunk = resp.read(4096)
            if not chunk:
                return None
            buf += chunk
        start = buf.index(b"\xff\xd8")
        return buf[start:buf.index(b"\xff\xd9", start) + 2]


def main():
    cap = cv2.VideoCapture(VIDEO)
    frames = []
    for _ in range(20):
        ok, frame = cap.read()
        if ok:
            frames.append(frame)

    print("== 1. 协议对齐（裸 socket） ==")
    check_protocol(frames[0])

    print("== 2. 发给服务器 ==")
    for frame in frames:
        frame_sender.send(frame, "127.0.0.1", UDP_PORT)
        time.sleep(1 / 10)
    time.sleep(0.3)

    print("== 3. 从服务器的 MJPEG 取回一帧 ==")
    received = grab_mjpeg(f"{SERVER}/api/cv/stream")
    if received is None:
        print("没取到帧（服务器起了吗？）")
        return
    img = cv2.imdecode(np.frombuffer(received, np.uint8), cv2.IMREAD_COLOR)
    cv2.imwrite("samples/udp_frame.jpg", img)
    diff = float(np.abs(img.astype(int) - frames[-1].astype(int)).mean())
    print(f"收到 {len(received)}B → 解码 {img.shape}，与最后发出的一帧平均像素差 {diff:.2f}"
          f"（JPEG 有损，个位数即同帧），已存 samples/udp_frame.jpg")


main()
