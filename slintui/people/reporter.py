"""把人数推给服务器：一条 WS 连接替所有标了线的房间报 people-counter。

服务器只认报文里的 device_id，所以这台大屏连上去报什么身份都行（settings.json 的 device_id）。
有人跨线推一次，没人跨线每 KEEPALIVE 秒也推一次 —— 服务器 10 秒收不到话就判失联，
断线也靠这条周期报文才暴露得出来，不然得等下一个人跨线。
只管上报，不读回信 —— 清零之类的下行指令要动的时候再单独考虑。
"""

import asyncio
import json
import threading
import time

import websockets

from settings import stored_settings

KEEPALIVE = 3  # 秒：跟下位机心跳一个节奏（shared/types.ts 的 ALIVE）


class PeopleReporter:
    """谁标了线就报谁：每轮现读 calibration.counters，标定页增删、换机位都不用通知它。"""

    def __init__(self, device_id, calibration):
        self.device_id = device_id
        self.calibration = calibration
        self.connected = False  # 给 UI 看的连接状态，重连成功自己会变回来
        self.stop_event = threading.Event()
        self._loop = None  # 当前上报会话的事件循环与「有人跨线」旗子
        self._crossed = None

    def notify(self):
        """推理线程喊一声：有人跨线，别等下一个心跳"""
        loop, crossed = self._loop, self._crossed
        if loop and crossed and loop.is_running():
            loop.call_soon_threadsafe(crossed.set)

    def start(self):
        self.stop_event = threading.Event()
        threading.Thread(target=self._run, daemon=True).start()

    def stop(self):
        self.connected = False
        self.stop_event.set()
        self.notify()  # 把等着的上报线程叫醒，好让它看到 stop_event 退出

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
        crossed = self._crossed = asyncio.Event()
        self._loop = asyncio.get_running_loop()
        # ping 压到 KEEPALIVE：服务器一声不吭消失时，全靠它把连接判死
        async with websockets.connect(self._url(), ping_interval=KEEPALIVE, ping_timeout=KEEPALIVE) as ws:
            self.connected = True
            await self._send(ws)  # 连上先报一次全量，服务器不用等下一个人跨线
            while not self.stop_event.is_set():
                try:
                    await asyncio.wait_for(crossed.wait(), KEEPALIVE)
                except TimeoutError:
                    pass  # 没人跨线也要说话：服务器 10 秒没动静就判失联，断线也要这样才发现得了
                crossed.clear()
                # 发不出去就别等了（对端假死时 send 会一直挂着），抛出去让 _run 重连
                await asyncio.wait_for(self._send(ws), KEEPALIVE)

    def _run(self):
        while not self.stop_event.is_set():
            try:
                asyncio.run(self._session())
            except Exception as e:
                print(f"[People] 上报断开: {e}")
            self.connected = False
            self.stop_event.wait(3)  # 断线 3 秒后重连，连上自己会把状态改回来

    def _url(self):
        base = stored_settings.get("ws_url", "")
        if not base:
            host = stored_settings.get_server_ip()
            base = f"ws://{host}:8080/ws"
        sep = "&" if "?" in base else "?"
        return f"{base}{sep}device_id={self.device_id}"
