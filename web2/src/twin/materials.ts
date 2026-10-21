import { CanvasTexture, DoubleSide, LineBasicMaterial, MeshBasicMaterial, MeshStandardMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";
import { groundMaterial, plasterMaterial, woodFloorMaterial } from "./surfaces";

// 小件纹理在本地生成，墙面和地面使用本地图片，离线演示无需下载。
function texture(kind: "plaster" | "wood" | "linen" | "water" | "stone") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = kind === "wood" ? "#b79876" : "#eeeae2";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 17;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `rgba(55,43,31,${random() * (kind === "plaster" ? 0.07 : 0.12)})`;
    ctx.fillRect(random() * 256, random() * 256, 1, 1);
  }
  if (kind === "stone" || kind === "plaster") {
    for (let i = 0; i < 120; i++) {
      const x = random() * 256;
      const y = random() * 256;
      const radius = 6 + random() * 35;
      const patch = ctx.createRadialGradient(x, y, 0, x, y, radius);
      patch.addColorStop(0, `rgba(75,70,58,${kind === "stone" ? 0.12 : 0.025})`);
      patch.addColorStop(1, "rgba(75,70,58,0)");
      ctx.fillStyle = patch;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }
  if (kind === "wood") {
    for (let i = 0; i < 180; i++) {
      const x = random() * 256;
      ctx.strokeStyle = `rgba(67,42,24,${0.02 + random() * 0.1})`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + random() * 8, 80, x - random() * 8, 170, x, 256);
      ctx.stroke();
    }
  } else if (kind === "linen") {
    ctx.fillStyle = "rgba(80,66,48,0.07)";
    for (let i = 0; i < 256; i += 4) {
      ctx.fillRect(i, 0, 1, 256);
      ctx.fillRect(0, i, 256, 1);
    }
  } else if (kind === "water") {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(230,230,230,0.5)";
    ctx.lineWidth = 1.5;
    for (let y = -8; y < 264; y += 7) {
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 4) {
        const wave = y + Math.sin(x / 256 * Math.PI * 4 + y * 0.3) * 3;
        if (x === 0) ctx.moveTo(x, wave);
        else ctx.lineTo(x, wave);
      }
      ctx.stroke();
    }
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 8;
  return map;
}

// 叶片簇带透明空隙，交错摆放后能看见枝条和自然的树冠边缘。
function leavesTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  let seed = 83;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 850; i++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const x = 128 + Math.cos(angle) * radius * 114;
    const y = 128 + Math.sin(angle) * radius * 104;
    const green = 82 + Math.floor(random() * 65);
    ctx.fillStyle = `rgb(${green - 14},${green},${Math.floor(green * 0.56)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + random() * 5, 1.5 + random() * 2, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

export function createMaterials() {
  const plaster = texture("plaster");
  const stone = texture("stone");
  const wood = texture("wood");
  const linen = texture("linen");
  const terrain = groundMaterial();
  terrain.vertexColors = true;
  const leaves = leavesTexture();
  const water = texture("water");
  water.colorSpace = NoColorSpace;
  water.repeat.set(2, 2);
  const matte = (color: number) => new MeshStandardMaterial({ color, roughness: 0.92 });
  return {
    paper: plasterMaterial(),
    floor: woodFloorMaterial(),
    stone: new MeshStandardMaterial({ color: 0x898b83, map: stone, roughness: 0.88, bumpMap: stone, bumpScale: 0.035 }),
    board: groundMaterial(),
    terrain,
    soft: matte(0xf4f0e6),
    shade: matte(0x535951),
    wood: new MeshStandardMaterial({ color: 0x493326, map: wood, roughness: 0.48 }),
    timber: new MeshStandardMaterial({ color: 0x967253, map: wood, roughness: 0.76 }),
    linen: new MeshStandardMaterial({ color: 0xf1e9d8, map: linen, roughness: 1, bumpMap: linen, bumpScale: 0.018 }),
    blanket: new MeshStandardMaterial({ color: 0x827b60, map: linen, roughness: 1 }),
    roof: new MeshStandardMaterial({ color: 0x3c4545, map: plaster, bumpMap: plaster, bumpScale: 0.012, roughness: 0.78 }),
    metal: new MeshStandardMaterial({ color: 0x777d78, roughness: 0.48, metalness: 0.45 }),
    glass: new MeshStandardMaterial({ color: 0xa4b5b1, roughness: 0.14, metalness: 0.15, transparent: true, opacity: 0.3, depthWrite: false }),
    soil: matte(0x574a35),
    lily: matte(0x657d43),
    leaf: new MeshStandardMaterial({ color: 0x657255, side: DoubleSide, roughness: 1 }),
    foliage: new MeshStandardMaterial({ map: leaves, side: DoubleSide, alphaTest: 0.45, roughness: 1, emissive: 0x293a19, emissiveIntensity: 0.12 }),
    rock: new MeshStandardMaterial({ color: 0x787c70, map: stone, bumpMap: stone, bumpScale: 0.07, flatShading: true, roughness: 1 }),
    earth: matte(0x6e7358),
    water: new MeshStandardMaterial({ color: 0x284d4c, bumpMap: water, bumpScale: 0.035, roughness: 0.24, metalness: 0.35, transparent: true, opacity: 0.9 }),
    dot: new MeshBasicMaterial({ color: 0xffc36a }),
    line: new LineBasicMaterial({ color: 0x554d40, transparent: true, opacity: 0.18 }),
  };
}

export type Materials = ReturnType<typeof createMaterials>;
