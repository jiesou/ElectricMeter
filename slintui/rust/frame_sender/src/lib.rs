//! 板端图传：BGR 裸帧 → JPEG q80 → 8 字节小端包头分片 → UDP。
//!
//! 协议与老项目 `slintui/udp_frame_uploader.py` 逐项一致，调度循环仍留在 Python。

use std::net::UdpSocket;
use std::sync::atomic::{AtomicU32, Ordering};

use jpeg_encoder::{ColorType, Encoder};
use numpy::{PyReadonlyArray3, PyUntypedArrayMethods};
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;

/// 每包总长（含 8 字节包头）
const CHUNK_LENGTH: usize = 1472;
const QUALITY: u8 = 80;

static FRAME_INDEX: AtomicU32 = AtomicU32::new(0);

/// 发一帧。进去是 BGR 裸帧，出来什么都不回，失败只打 stderr。
#[pyfunction]
fn send(py: Python<'_>, frame: PyReadonlyArray3<'_, u8>, host: &str, port: u16) -> PyResult<()> {
    let (h, w, c) = {
        let s = frame.shape();
        (s[0], s[1], s[2])
    };
    if c != 3 {
        return Err(PyValueError::new_err("只吃 3 通道 BGR 帧"));
    }
    let bgr = frame.as_slice()?;
    let index = FRAME_INDEX.fetch_add(1, Ordering::Relaxed);

    // 编码和发包期间放开 GIL，否则会卡住 Slint 事件循环和摄像头线程
    py.detach(move || {
        let mut jpeg = Vec::new();
        if let Err(e) = Encoder::new(&mut jpeg, QUALITY).encode(bgr, w as u16, h as u16, ColorType::Bgr)
        {
            eprintln!("[frame_sender] JPEG 编码失败: {e}");
            return;
        }
        let sock = match UdpSocket::bind("0.0.0.0:0") {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[frame_sender] 开 socket 失败: {e}");
                return;
            }
        };
        let payload = CHUNK_LENGTH - 8;
        let total = jpeg.len().div_ceil(payload);
        for (i, chunk) in jpeg.chunks(payload).enumerate() {
            let mut packet = Vec::with_capacity(8 + chunk.len());
            packet.extend_from_slice(&index.to_le_bytes());
            packet.extend_from_slice(&(i as u16).to_le_bytes());
            packet.extend_from_slice(&(total as u16).to_le_bytes());
            packet.extend_from_slice(chunk);
            if let Err(e) = sock.send_to(&packet, (host, port)) {
                eprintln!("[frame_sender] 发分片失败: {e}");
                return;
            }
        }
    });
    Ok(())
}

#[pymodule]
fn frame_sender(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(send, m)?)?;
    Ok(())
}
