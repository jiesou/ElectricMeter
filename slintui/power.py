"""客房用电页的数据流：后台线程取数，UI 线程按秒读快照。"""

import json
import threading
import time
import urllib.request

import mock


class PowerStream:
    def __init__(self, api_url):
        self.api_url = api_url.rstrip("/")
        self.rows = []
        self.updated = "还没收到数据"
        self.mock = False
        self.stop_event = threading.Event()
        self.lock = threading.Lock()

    def start(self):
        self.stop_event = threading.Event()
        threading.Thread(target=self._run, args=(self.stop_event,), daemon=True).start()

    def stop(self):
        self.stop_event.set()

    def toggle_mock(self):
        """换个来源：停掉当前线程，按新的来源重开"""
        self.mock = not self.mock
        self.stop()
        self.start()

    def snapshot(self):
        with self.lock:
            return self.rows, self.updated

    def _run(self, stop):
        if self.mock:
            with self.lock:
                self.rows = mock.ROWS
                self.updated = "演示数据"
            return

        url = f"{self.api_url}/rooms/stream"
        request = urllib.request.Request(url, headers={"Accept": "text/event-stream"})

        while not stop.is_set():
            try:
                with urllib.request.urlopen(request, timeout=5) as response:
                    for line in response:
                        if stop.is_set():
                            return
                        if line.startswith(b"data:"):
                            self._update(json.loads(line[5:].strip()))
            except Exception:
                with self.lock:
                    self.updated = f"连不上服务器 {self.api_url}"
                stop.wait(1)

    def _update(self, data):
        if self.mock:  # 切到 mock 后，旧连接尾巴上的数据不再写进来
            return
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
