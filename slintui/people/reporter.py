"""把人数推给服务器：一条 WS 连接替所有标了线的房间报 people-counter。

服务器只认报文里的 device_id，所以这台大屏连上去报什么身份都行（settings.json 的 device_id）。
只管上报，不读回信 —— 清零之类的下行指令要动的时候再单独考虑。
"""

import asyncio
import json
import threading
import time

import websockets

from settings import stored_settings


class PeopleReporter:
    """谁标了线就报谁：每轮现读 calibration.counters，标定页增删、换机位都不用通知它。"""

    def __init__(self, device_id, calibration):
        self.device_id = device_id
        self.calibration = calibration
        self.interval = 2
        self.stop_event = threading.Event()

    def start(self):
        self.stop_event = threading.Event()
        threading.Thread(target=self._run, daemon=True).start()

    def stop(self):
        self.stop_event.set()

    def _entities(self):
        return [{
            "id": "people",
            "name": "人数",
            "type": "people-counter",
            "inCount": counter.in_count,
            "outCount": counter.out_count,
            # 净数大屏自己说了算，不劳服务器拿 in - out 去算
            "netCount": counter.in_count - counter.out_count,
            "device_id": counter.device_id,
        } for counter in self.calibration.counters]

    async def _session(self):
        async with websockets.connect(self._url()) as ws:
            while not self.stop_event.is_set():
                entities = self._entities()
                if entities:
                    await ws.send(json.dumps({
                        "type": "pub_entities",
                        "ts": int(time.time()),
                        "entities": entities,
                    }))
                await asyncio.sleep(self.interval)

    def _run(self):
        while not self.stop_event.is_set():
            try:
                asyncio.run(self._session())
            except Exception as e:
                print(f"[People] 上报断开: {e}")
                self.stop_event.wait(3)

    def _url(self):
        base = stored_settings.get("ws_url", "")
        if not base:
            host = stored_settings.get_server_ip()
            base = f"ws://{host}:8080/ws"
        sep = "&" if "?" in base else "?"
        return f"{base}{sep}device_id={self.device_id}"
