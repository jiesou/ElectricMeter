"""按窗口标题截一张 X11 窗口图。应用要先用 X11 跑起来（见 AGENTS.md 末尾）。

    .venv/bin/python scripts/x11_shot.py 民宿用电管理 /tmp/agents/shot.png 10
"""

import sys
import time

import cv2
import numpy as np
from Xlib import X, display

title, out, wait = sys.argv[1], sys.argv[2], float(sys.argv[3])
d = display.Display()
wm_name, utf8 = d.intern_atom("_NET_WM_NAME"), d.intern_atom("UTF8_STRING")


def find(w):
    p = w.get_full_property(wm_name, utf8)
    if p and title in p.value.decode(errors="ignore") and w.get_attributes().map_state == X.IsViewable:
        return w  # 窗口标题比窗口映射早出现，没映射的窗口 get_image 会 BadMatch
    for c in w.query_tree().children:
        if found := find(c):
            return found


end = time.time() + wait
while not (win := find(d.screen().root)) and time.time() < end:
    time.sleep(0.5)
if not win:
    sys.exit(f"{wait}s 内没等到可见窗口：{title}")
g = win.get_geometry()
raw = win.get_image(0, 0, g.width, g.height, X.ZPixmap, 0xFFFFFFFF).data
cv2.imwrite(out, np.frombuffer(raw, np.uint8).reshape(g.height, g.width, 4)[:, :, :3])
print("saved", out, g.width, g.height)
