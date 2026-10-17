"""把人数推给服务器：一条 WS 连接替所有标了线的房间报 people-counter。

服务器只认报文里的 device_id，所以这台大屏连上去报什么身份都行（settings.json 的 device_id）。
有人跨线才推一次，不按秒轮询。
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
        self.crossed = threading.Event()  # 有人跨线就置位，上报线程睡在这上面
        self.stop_event = threading.Event()

    def notify(self):
        self.crossed.set()

    def start(self):
        self.stop_event = threading.Event()
        threading.Thread(target=self._run, daemon=True).start()

    def stop(self):
        self.stop_event.set()
        self.crossed.set()  # 把等着的上报线程叫醒，好让它看到 stop_event 退出

    def _entities(self):
        ts = int(time.time())
        return [{
            "id": "people",
            "name": "人数",
            "type": "people-counter",
            "inCount": counter.in_count,
            "outCount": counter.out_count,
            # 净数大屏自己说了算，不劳服务器拿 in - out 去算
            "netCount": counter.in_count - counter.out_count,
            "device_id": counter.device_id,
            "ts": ts,
        } for counter in self.calibration.counters]

    async def _send(self, ws):
        entities = self._entities()
        if entities:
            await ws.send(json.dumps({
                "type": "pub_entities",
                "ts": int(time.time()),
                "entities": entities,
            }))

    async def _session(self):
        async with websockets.connect(self._url()) as ws:
            await self._send(ws)  # 连上先报一次全量，服务器不用等下一个人跨线
            while not self.stop_event.is_set():
                await asyncio.to_thread(self.crossed.wait)
                self.crossed.clear()
                await self._send(ws)

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
