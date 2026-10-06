"""人员感知子模块：摄像头人形检测 + 跨线进/出计数"""

from .rknnpool import initRKNN, initRKNNs, rknnPoolExecutor
from .npu_monitor import get_npu_usage

__all__ = ["initRKNN", "initRKNNs", "rknnPoolExecutor", "get_npu_usage"]