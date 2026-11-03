import os

os.environ["SLINT_STYLE"] = "material-dark"
os.environ["SLINT_FULLSCREEN"] = "1"
os.environ["SLINT_SCALE_FACTOR"] = "1.5"  # 1920 / 1280

import slint

from people import PeoplePage
from power import PowerStream, bind_power
from settings import bind_settings, stored_settings


class AppWindow(slint.loader.ui.app_window.AppWindow):
    pass


def main():
    power_stream = PowerStream(stored_settings.get("api_url", ""))
    power_stream.start()

    people_page = PeoplePage(power_stream)

    window = AppWindow()
    people_page.bind(window)
    bind_power(window, power_stream)
    bind_settings(window)
    window.AppData.stop_app = window.hide

    # 推理与上报常驻：切页面只是不渲染画面，人还在数、还在推给服务器
    people_page.start()
    window.show()
    window.run()

    people_page.stop()
    power_stream.stop()


main()
