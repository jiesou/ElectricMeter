import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";
import plasterUrl from "../assets/textures/lime-plaster.png";
import woodUrl from "../assets/textures/oak-floor.png";
import pavingUrl from "../assets/textures/courtyard-stone.png";
import groundUrl from "../assets/textures/garden-ground.png";

// 原图负责颜色；从同一张图派生凹凸和粗糙度，纹理与接缝保持对齐。
function surface(url: string, repeatX: number, repeatY: number, bumpScale: number, roughness: number) {
  const canvases = Array.from({ length: 2 }, () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 512, 512);
    return ctx;
  });
  const bumpMap = new CanvasTexture(canvases[0]!.canvas);
  const roughnessMap = new CanvasTexture(canvases[1]!.canvas);
  const map = new TextureLoader().load(url, (texture) => {
    const ctx = canvases[0]!;
    ctx.drawImage(texture.image, 0, 0, 512, 512);
    const image = ctx.getImageData(0, 0, 512, 512);
    const height = ctx.createImageData(512, 512);
    const matte = ctx.createImageData(512, 512);
    for (let i = 0; i < image.data.length; i += 4) {
      const gray = image.data[i]! * 0.2126 + image.data[i + 1]! * 0.7152 + image.data[i + 2]! * 0.0722;
      for (let c = 0; c < 3; c++) {
        height.data[i + c] = gray;
        matte.data[i + c] = 210 + gray * 0.15;
      }
      height.data[i + 3] = matte.data[i + 3] = 255;
    }
    ctx.putImageData(height, 0, 0);
    canvases[1]!.putImageData(matte, 0, 0);
    bumpMap.needsUpdate = roughnessMap.needsUpdate = true;
  });
  map.colorSpace = SRGBColorSpace;
  for (const texture of [map, bumpMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = 8;
  }
  return new MeshStandardMaterial({ map, bumpMap, roughnessMap, bumpScale, roughness });
}

export function plasterMaterial() {
  const material = surface(plasterUrl, 1, 1, 0.018, 1);
  material.name = "plaster";
  material.vertexColors = true;
  return material;
}

export function woodFloorMaterial() {
  return surface(woodUrl, 2, 2, 0.012, 0.8);
}

export function pavingMaterial(width: number, depth: number) {
  return surface(pavingUrl, width / 2.4, depth / 2.4, 0.025, 1);
}

export function groundMaterial() {
  return surface(groundUrl, 1, 1, 0.03, 1);
}
