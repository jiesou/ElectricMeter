"""客房用电页的数据流：后台线程接收 SSE，UI 线程负责构造 Slint 数据。"""

import json
import threading
import time
import urllib.request


class PowerStream:
    def __init__(self, api_url):
        self.api_url = api_url.rstrip("/")
        self.rows = []
        self.updated = "还没收到数据"
        self.stop_event = threading.Event()
        self.lock = threading.Lock()

    def start(self):
        threading.Thread(target=self._consume, daemon=True).start()

    def stop(self):
        self.stop_event.set()

    def snapshot(self):
        with self.lock:
            return self.rows, self.updated

    def _consume(self):
        url = f"{self.api_url}/rooms/stream"
        request = urllib.request.Request(url, headers={"Accept": "text/event-stream"})

        while not self.stop_event.is_set():
            try:
                with urllib.request.urlopen(request, timeout=5) as response:
                    for line in response:
                        if self.stop_event.is_set():
                            return
                        if line.startswith(b"data:"):
                            self._update(json.loads(line[5:].strip()))
            except Exception:
                with self.lock:
                    self.updated = f"连不上服务器 {self.api_url}"
                self.stop_event.wait(1)

    def _update(self, data):
        with self.lock:
            self.rows = [{
                "name": room["name"],
                "online": room["online"],
                "power": f"{room['power']:.0f}",
                "energy": f"{room['energy']:.2f}",
                "entities": [{
                    "name": entity["name"],
                    "type": entity["type"],
                    "state": bool(entity.get("state")),
                    "power": entity.get("powerW") or 0,
                    "energy": f"{entity.get('energyKwh') or 0:.2f}",
                } for entity in room["entities"]],
            } for room in data]
            self.updated = "最后更新 " + time.strftime("%H:%M:%S")
