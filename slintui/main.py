import os

os.environ["SLINT_STYLE"] = "material-dark"
os.environ["SLINT_FULLSCREEN"] = "1"
os.environ["SLINT_SCALE_FACTOR"] = "1.5"  # 1920 / 1280

import slint

from people import PeoplePage
from power import PowerStream
from settings import stored_settings


class AppWindow(slint.loader.ui.app_window.AppWindow):
    pass


Room = slint.loader.ui.power_page.Room
EntityCard = slint.loader.ui.power_page.EntityCard


def bind_settings_page(window):
    data = window.SettingsPageData
    data.server_ip = stored_settings.get_server_ip()
    data.model = stored_settings.get("model", "")
    data.video = stored_settings.get("video", "") or "摄像头"
    data.udp = stored_settings.get("image_feed_udp_url", "")

    def save(ip):
        stored_settings.set_server_ip(ip)
        data.server_ip = stored_settings.get_server_ip()
        data.hint = "已保存，重启程序生效"

    data.save = save


def main():
    power_stream = PowerStream(stored_settings.get("api_url", ""))
    power_stream.start()

    people_page = PeoplePage(power_stream)

    window = AppWindow()
    people_page.bind(window)
    bind_settings_page(window)

    def refresh():
        rows = power_stream.snapshot()
        window.PowerPageData.rooms = slint.ListModel([
            Room(**{**row, "entities": slint.ListModel([EntityCard(**e) for e in row["entities"]])})
            for row in rows
        ])

    def toggle_mock():
        power_stream.toggle_mock()
        refresh()

    # tab 切换只管人数页起停：用电数据流便宜，常驻；推理贵，停在这页之外
    def tab_changed(index):
        if index == 1:
            people_page.start()
        else:
            people_page.stop()

    def stop_app():
        window.hide()

    window.AppData.tab_changed = tab_changed
    window.AppData.toggle_mock = toggle_mock
    window.AppData.stop_app = stop_app
    window.PowerPageData.refresh = refresh

    tab_changed(window.AppData.current_tab)  # 初始页也走一遍（照老项目 activate_tab）
    window.show()
    window.run()

    people_page.stop()
    power_stream.stop()


main()
