import {
  BoxGeometry, BufferGeometry, CanvasTexture, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DoubleSide,
  EdgesGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, LineBasicMaterial, LineSegments,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight, RepeatWrapping, Shape, ShapeGeometry,
  SphereGeometry, SRGBColorSpace, TubeGeometry, Vector3,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Entity } from "@em/shared";
import type { Room } from "../types";

// 江南合院式民宿的白模：客房沿天井两侧排开，屋顶揭掉只剩虚线轮廓，墙剖到窗台高，从斜上方看进室内
// 单位按米：客房开间、进深、剖切墙高、墙厚、台基高、回廊深、天井深、廊柱高
const RW = 4;
const RD = 4.2;
const WALL = 1.1;
const T = 0.12;
const BASE = 0.3;
const HALL = 1.5;
const YARD = 5;
const COL = 2.3;
const PER_ROW = 4;
const LANE = 1.6;

const SPAN = RD + HALL;
const ROW_Z = YARD / 2 + HALL + RD / 2;
const EAVE_Y = BASE + COL + 0.24;

type Kind = "light" | "ac" | "socket" | "other";

const AMBER = 0xf59e0b;
const LAMP = 0xffc06a;
const GREEN = 0x7fb08e;
const DOTS = 3;

/** 一件会亮的电器：key 用来跟开关配对 */
export interface Appliance {
  key: string;
  kind: Kind;
  glow: MeshStandardMaterial;
}

/** 一间房里随数据变化的东西，scene.ts 的 applyRooms 只改这些 */
export interface RoomView {
  wall: MeshStandardMaterial;
  floor: MeshStandardMaterial;
  furniture: MeshStandardMaterial[];
  appliances: Appliance[];
  lamp?: PointLight;
  setLabel(text: string): void;
  curve: CatmullRomCurve3;
  dots: Mesh[];
  speed: number;
  t: number;
}

/** 线管落到每间房门边的那个点 */
interface Door {
  id: string;
  x: number;
  z: number;
  facing: number;
  view: RoomView;
}

export interface Sandbox {
  group: Group;
  width: number;
  depth: number;
  views: Map<string, RoomView>;
}

/** 房间结构的指纹：房间、房名、家具种类不变就不用重建 */
export const layoutKey = (rooms: Room[]) =>
  rooms.map((room) => `${room.id}:${room.name}:${furnitureOf(room).map((f) => f.key).join(",")}`).join("|");

const sortRooms = (rooms: Room[]) => [...rooms].sort((a, b) => a.id.localeCompare(b.id, "zh-CN", { numeric: true }));

const kindOf = (entity: Entity): Kind => {
  const text = `${entity.id} ${entity.name ?? ""}`;
  if (/照明|灯|light/i.test(text)) return "light";
  if (/空调|(^|[-_ ])ac([-_ ]|$)/i.test(text)) return "ac";
  if (/插座|socket/i.test(text)) return "socket";
  return "other";
};

/** 同一件电器的开关和电表只画一件：light 和 light-meter 是同一盏灯 */
export const furnitureKey = (entity: Entity) => {
  const kind = kindOf(entity);
  return kind === "other" ? entity.id.replace(/-meter$/, "") : kind;
};

const furnitureOf = (room: Room) => {
  const seen = new Map<string, Kind>();
  for (const entity of room.entities) seen.set(furnitureKey(entity), kindOf(entity));
  return [...seen].map(([key, kind]) => ({ key, kind }));
};

/** lights：最多给几间房的台灯配一盏点光源（数量建好就不变，免得材质重编译） */
export function buildSandbox(rooms: Room[], lights: number): Sandbox {
  const m = createMaterials();
  const group = new Group();
  const sorted = sortRooms(rooms);
  const views = new Map<string, RoomView>();
  const budget = { lights };

  // 每进天井最多 8 间（南北各 4），再多就往东接一进
  const blocks: Room[][] = [];
  for (let i = 0; i < sorted.length; i += PER_ROW * 2) blocks.push(sorted.slice(i, i + PER_ROW * 2));
  if (!blocks.length) blocks.push([]);

  const house = new Group();
  const doors: Door[] = [];
  let x = 0;
  blocks.forEach((block, index) => {
    const north = block.slice(0, Math.ceil(block.length / 2));
    const south = block.slice(north.length);
    const length = Math.max(north.length, south.length, 1) * RW;
    house.add(buildCourtyard(x, length, index < blocks.length - 1, m));
    house.add(buildRow(north, x, -1, m, doors, budget));
    house.add(buildRow(south, x, 1, m, doors, budget));
    x += length + LANE;
  });
  const houseLength = x - LANE;
  house.position.x = -houseLength / 2;
  doors.forEach((door) => (door.x -= houseLength / 2));
  group.add(house);
  doors.forEach((door) => views.set(door.id, door.view));

  // 沙盘台面：西边留出配电房和入口小径，北边是后山，南边是溪
  const west = -houseLength / 2 - 9;
  const east = houseLength / 2 + 5;
  const north = -ROW_Z - RD / 2 - 7;
  const south = ROW_Z + RD / 2 + 6;
  const width = east - west;
  const depth = south - north;
  const cx = (west + east) / 2;
  const cz = (north + south) / 2;
  group.add(buildTable(width, depth, m).translateX(cx).translateZ(cz));

  const panel = new Vector3(-houseLength / 2 - 5.5, 0, -1.6);
  group.add(buildPanel(panel, sorted.length, m));
  group.add(buildConduits(panel, doors, -houseLength / 2, m));
  group.add(buildHill(east - 8, north + 1.2, west, east, north, m));
  group.add(buildLandscape({ west, east, north, south, houseLength, panel }, m));

  // 整个沙盘挪到原点，镜头和阴影都围着原点算
  group.children.forEach((child) => {
    child.position.x -= cx;
    child.position.z -= cz;
  });
  group.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = !object.userData.noShadow;
      object.receiveShadow = true;
    }
  });
  return { group, width, depth, views };
}

function createMaterials() {
  const matte = (color: number) => new MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
  return {
    paper: matte(0xf3f0e9),
    floor: matte(0xe8e1d4),
    stone: matte(0xdad3c6),
    board: matte(0xece8df),
    soft: matte(0xfaf8f4),
    shade: matte(0xd4cdc0),
    wood: new MeshStandardMaterial({ color: 0x3a3129, roughness: 0.7 }),
    water: new MeshStandardMaterial({ color: 0xa9c4c6, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.8 }),
    dot: new MeshBasicMaterial({ color: 0xfbbf24 }),
    line: new LineBasicMaterial({ color: 0x8c8477, transparent: true, opacity: 0.45 }),
    ghost: new LineBasicMaterial({ color: 0xc9c1b4, transparent: true, opacity: 0.4 }),
  };
}

type Materials = ReturnType<typeof createMaterials>;

/** 底面贴在 y 上的方块，带一圈细描边，像模型板材切出来的 */
function box(w: number, h: number, d: number, material: Material, x: number, y: number, z: number, m?: Materials) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  if (m) mesh.add(new LineSegments(new EdgesGeometry(mesh.geometry, 30), m.line));
  return mesh;
}

/** 圆角小件，家具用 */
function soft(w: number, h: number, d: number, material: Material, x: number, y: number, z: number, radius = 0.04) {
  const mesh = new Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, h / 2, w / 2, d / 2)), material);
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

function lines(points: number[][], material: Material) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
  return new LineSegments(geometry, material);
}

/* ===== 客房 ===== */

/** 一排客房：facing = -1 是北排（门朝南开向天井），1 是南排 */
function buildRow(rooms: Room[], x0: number, facing: -1 | 1, m: Materials, doors: Door[], budget: { lights: number }) {
  const row = new Group();
  if (!rooms.length) return row;
  const length = rooms.length * RW;
  const zRoom = facing * ROW_Z;
  const zMid = facing * (YARD / 2 + SPAN / 2);
  const zColumn = facing * (YARD / 2 + 0.18);

  // 台基连着回廊，天井那侧加一级台阶
  row.add(box(length + 0.6, BASE, SPAN + 0.2, m.stone, x0 + length / 2, 0, zMid, m));
  row.add(box(length, 0.15, 0.4, m.stone, x0 + length / 2, 0, facing * (YARD / 2 - 0.2), m));

  rooms.forEach((room, i) => {
    const cx = x0 + RW * (i + 0.5);
    const { group: unit, view } = buildRoom(room, m, budget);
    unit.position.set(cx, BASE, zRoom);
    unit.rotation.y = facing === -1 ? 0 : Math.PI;
    row.add(unit);
    // 房名贴在门边空地上，统一朝南摆，从主机位看是正的
    const label = buildLabel(cx - facing * 0.95, BASE + 0.056, zRoom - facing * 0.5);
    view.setLabel = label.draw;
    label.draw(room.name);
    row.add(label.mesh);
    // 线管落在门左手那段前墙上
    doors.push({ id: room.id, x: cx - facing * 0.3, z: facing * (YARD / 2 + HALL), facing, view });
    if (i > 0) row.add(box(T, WALL, RD, m.paper, x0 + RW * i, BASE, zRoom, m));
  });

  // 回廊：一排细柱 + 檐枋
  for (let i = 0; i <= rooms.length; i++) {
    const column = new Mesh(new CylinderGeometry(0.08, 0.09, COL, 12), m.paper);
    column.position.set(x0 + RW * i, BASE + COL / 2, zColumn);
    row.add(column);
  }
  row.add(box(length + 0.3, 0.2, 0.18, m.paper, x0 + length / 2, BASE + COL, zColumn, m));

  // 两端马头墙，中间是揭掉的屋顶，只留虚线轮廓
  row.add(buildGable(x0, zMid, m));
  row.add(buildGable(x0 + length, zMid, m));
  row.add(buildGhostRoof(x0, x0 + length, zMid, m));
  return row;
}

/** 一间客房，本地坐标：门在 +z（朝天井），后墙在 -z，床靠后墙 */
function buildRoom(room: Room, m: Materials, budget: { lights: number }) {
  const g = new Group();
  // 每间房自己一套材质，离线变灰、功率发光才不会串到别的房
  const wall = m.paper.clone();
  const floor = m.floor.clone();
  floor.emissive.set(AMBER);
  floor.emissiveIntensity = 0;
  const paper = m.paper.clone();
  const cushion = m.soft.clone();
  const appliances: Appliance[] = [];
  const glow = (key: string, kind: Kind, color: number, side = m.soft.side) => {
    const material = new MeshStandardMaterial({ color: 0xfaf8f4, roughness: 0.6, emissive: color, emissiveIntensity: 0, side });
    appliances.push({ key, kind, glow: material });
    return material;
  };
  let lamp: PointLight | undefined;
  const hw = RW / 2;
  const hd = RD / 2;
  const y = 0.05;
  g.add(box(RW - 0.02, y, RD - 0.02, floor, 0, 0, 0));

  // 后墙中段压低成窗台，前墙开门洞
  const backZ = -hd + T / 2;
  g.add(box(hw + 0.4, WALL, T, wall, (-hw + 0.4) / 2, y, backZ, m));
  g.add(box(1.2, 0.75, T, wall, 1.0, y, backZ, m));
  g.add(box(hw - 1.6, WALL, T, wall, (hw + 1.6) / 2, y, backZ, m));
  const frontZ = hd - T / 2;
  g.add(box(hw + 0.75, WALL, T, wall, (-hw + 0.75) / 2, y, frontZ, m));
  g.add(box(hw - 1.65, WALL, T, wall, (hw + 1.65) / 2, y, frontZ, m));
  g.add(box(0.9, 0.12, T, wall, 1.2, y + 0.98, frontZ, m));

  // 床、床头柜、书桌椅
  const bedZ = -hd + T + 1.05;
  g.add(soft(1.5, 0.3, 2.0, paper, -0.6, y, bedZ));
  g.add(soft(1.42, 0.14, 1.9, cushion, -0.6, y + 0.3, bedZ + 0.02, 0.06));
  g.add(soft(1.44, 0.05, 0.85, paper, -0.6, y + 0.44, bedZ + 0.5, 0.025));
  g.add(soft(0.55, 0.1, 0.32, cushion, -0.93, y + 0.44, bedZ - 0.72, 0.05));
  g.add(soft(0.55, 0.1, 0.32, cushion, -0.27, y + 0.44, bedZ - 0.72, 0.05));
  g.add(box(1.6, 0.8, 0.08, paper, -0.6, y, -hd + T + 0.04));
  g.add(soft(0.38, 0.48, 0.38, paper, -1.66, y, -hd + T + 0.25));
  g.add(soft(0.38, 0.48, 0.38, paper, 0.45, y, -hd + T + 0.25));
  g.add(soft(0.55, 0.05, 1.2, paper, hw - 0.36, y + 0.7, -0.95, 0.02));
  g.add(box(0.5, 0.7, 0.05, paper, hw - 0.36, y, -1.5));
  g.add(box(0.5, 0.7, 0.05, paper, hw - 0.36, y, -0.4));
  g.add(soft(0.42, 0.42, 0.42, cushion, hw - 0.95, y, -0.95, 0.06));
  g.add(soft(0.06, 0.4, 0.42, cushion, hw - 1.18, y + 0.42, -0.95, 0.03));

  // 卫生间在门边一角：两道矮隔墙，马桶、洗手台
  g.add(box(0.8, WALL, T, wall, -hw + 0.4, y, 0.6, m));
  g.add(box(T, WALL, hd - 0.6 - T, wall, -0.6, y, (0.6 + hd - T) / 2, m));
  g.add(soft(0.4, 0.4, 0.55, cushion, -1.62, y, hd - T - 0.3, 0.12));
  g.add(soft(0.62, 0.8, 0.42, paper, -1.0, y, hd - T - 0.21, 0.03));
  g.add(box(1.2, 0.03, 0.6, m.stone, -1.32, y, 0.98));

  // 电器按实体生成：台灯、壁挂空调、墙插、其它用小方块
  let others = 0;
  for (const { key, kind } of furnitureOf(room)) {
    if (kind === "light") {
      g.add(new Mesh(new CylinderGeometry(0.015, 0.015, 0.25, 6), m.shade).translateX(-1.66).translateY(y + 0.6).translateZ(-hd + T + 0.25));
      const lampShade = new Mesh(new CylinderGeometry(0.1, 0.15, 0.18, 20, 1, true), glow(key, kind, LAMP, DoubleSide));
      lampShade.position.set(-1.66, y + 0.78, -hd + T + 0.25);
      g.add(lampShade);
      if (budget.lights > 0) {
        budget.lights--;
        lamp = new PointLight(LAMP, 0, 4, 1.5);
        lamp.position.set(-1.66, y + 1.0, -hd + T + 0.45);
        g.add(lamp);
      }
    } else if (kind === "ac") {
      g.add(soft(0.22, 0.28, 0.95, cushion, -hw + T / 2 + 0.11, y + 0.7, -0.1, 0.06));
      g.add(box(0.02, 0.03, 0.8, glow(key, kind, GREEN), -hw + T / 2 + 0.22, y + 0.73, -0.1));
    } else if (kind === "socket") {
      g.add(soft(0.03, 0.12, 0.22, cushion, hw - T / 2 - 0.015, y + 0.28, 0.3, 0.01));
      g.add(box(0.02, 0.04, 0.04, glow(key, kind, GREEN), hw - T / 2 - 0.035, y + 0.36, 0.39));
    } else {
      const slot = others++;
      const x = -0.25 + (slot % 2) * 0.48;
      const z = hd - T - 0.3 - Math.floor(slot / 2) * 0.5;
      g.add(soft(0.32, 0.38, 0.32, cushion, x, y, z, 0.05));
      g.add(box(0.12, 0.02, 0.12, glow(key, kind, GREEN), x, y + 0.38, z));
    }
  }
  const view = { wall, floor, furniture: [paper, cushion], appliances, lamp, speed: 0, t: 0 } as RoomView;
  return { group: g, view };
}

/** 地上的房名牌，draw 可以重写文字（离线、未上报实体时加注） */
function buildLabel(x: number, y: number, z: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 150;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const mesh = new Mesh(new PlaneGeometry(1.4, 0.41), new MeshStandardMaterial({ map: texture, transparent: true, roughness: 1 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.userData.noShadow = true;

  let current = "";
  const draw = (text: string) => {
    if (text === current) return;
    current = text;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 104px "Noto Serif SC", "Songti SC", serif';
    ctx.fillStyle = "#4f493f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 太长就缩字号，缩到一半还放不下再截断
    let size = 104;
    while (ctx.measureText(text).width > canvas.width - 24 && size > 52) ctx.font = `600 ${(size -= 4)}px "Noto Serif SC", "Songti SC", serif`;
    let label = text;
    while (ctx.measureText(label).width > canvas.width - 24 && label.length > 1) label = label.slice(0, -1);
    if (label !== text) label = `${label.slice(0, -1)}…`;
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    texture.needsUpdate = true;
  };
  return { mesh, draw };
}

/** 马头墙：三级阶梯，每级压一道檐 */
function buildGable(x: number, zMid: number, m: Materials) {
  const g = new Group();
  const steps = [2.2, 2.9, 3.6, 2.9, 2.2];
  const seg = (SPAN + 0.3) / steps.length;
  steps.forEach((h, i) => {
    const z = zMid - (SPAN + 0.3) / 2 + seg * (i + 0.5);
    g.add(box(0.24, h, seg + 0.01, m.paper, x, BASE, z, m));
    g.add(box(0.42, 0.1, seg + 0.12, m.paper, x, BASE + h, z, m));
    // 每级檐角翘起的小座头
    if (i !== 2) g.add(box(0.36, 0.16, 0.18, m.paper, x, BASE + h + 0.1, z + (i < 2 ? -1 : 1) * (seg / 2 - 0.05), m));
  });
  return g;
}

/** 揭掉的坡屋顶：屋脊、檐口、椽子都只画细线 */
function buildGhostRoof(x0: number, x1: number, zMid: number, m: Materials) {
  const ridge = BASE + 3.3;
  const eave = BASE + 2.45;
  const z0 = zMid - SPAN / 2 - 0.4;
  const z1 = zMid + SPAN / 2 + 0.4;
  const points = [
    [x0, ridge, zMid], [x1, ridge, zMid],
    [x0, eave, z0], [x1, eave, z0],
    [x0, eave, z1], [x1, eave, z1],
  ];
  for (let x = x0; x <= x1 + 0.01; x += 0.8) {
    points.push([x, eave, z0], [x, ridge, zMid], [x, ridge, zMid], [x, eave, z1]);
  }
  return lines(points, m.ghost);
}

/** 天井：石板地、方池、一棵桂花，东西两道院墙开门 */
function buildCourtyard(x0: number, length: number, eastOpen: boolean, m: Materials) {
  const g = new Group();
  const paving = new Mesh(new PlaneGeometry(length, YARD), new MeshStandardMaterial({ map: pavingTexture(length, YARD), roughness: 0.95 }));
  paving.rotation.x = -Math.PI / 2;
  paving.position.set(x0 + length / 2, 0.01, 0);
  g.add(paving);

  const poolW = Math.min(length * 0.4, 4.2);
  const poolX = x0 + length * 0.42;
  g.add(box(poolW + 0.3, 0.2, 0.15, m.stone, poolX, 0, -1, m));
  g.add(box(poolW + 0.3, 0.2, 0.15, m.stone, poolX, 0, 1, m));
  g.add(box(0.15, 0.2, 1.85, m.stone, poolX - poolW / 2, 0, 0, m));
  g.add(box(0.15, 0.2, 1.85, m.stone, poolX + poolW / 2, 0, 0, m));
  const water = box(poolW - 0.1, 0.1, 1.85, m.water, poolX, 0, 0);
  water.userData.noShadow = true;
  g.add(water);
  g.add(box(1.2, 0.4, 1.2, m.stone, x0 + length * 0.8, 0, 1.1, m));
  g.add(ballTree(x0 + length * 0.8, 1.1, 0.4, 1.3, m));
  g.add(soft(0.7, 0.45, 0.7, m.stone, x0 + length * 0.15, 0, 0.8, 0.2));

  g.add(courtyardWall(x0 - 0.15, true, m));
  g.add(courtyardWall(x0 + length + 0.15, eastOpen, m));
  return g;
}

function courtyardWall(x: number, gate: boolean, m: Materials) {
  const g = new Group();
  const h = 1.9;
  const half = YARD / 2;
  const segments = gate ? [[-half, -0.9], [0.9, half]] : [[-half, half]];
  for (const [z0, z1] of segments) {
    g.add(box(0.2, h, z1 - z0, m.paper, x, 0, (z0 + z1) / 2, m));
    g.add(box(0.34, 0.08, z1 - z0 + 0.1, m.paper, x, h, (z0 + z1) / 2, m));
  }
  // 门头：一道门楣加一片小门罩
  if (gate) {
    g.add(box(0.2, 0.3, 1.8, m.paper, x, 2.15, 0, m));
    g.add(box(0.9, 0.08, 2.4, m.paper, x, 2.45, 0, m));
  }
  return g;
}

function pavingTexture(w: number, d: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e7e1d6";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#cfc7b9";
  ctx.lineWidth = 3;
  // 错缝铺的长条石板
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    for (let x = row % 2 ? 64 : 0; x < 256; x += 128) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 64);
    }
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(w / 2.4, d / 1.2);
  texture.anisotropy = 8;
  return texture;
}

/* ===== 配电与线路 ===== */

/** 配电网孔板：上排电能表、中间导轨上一排断路器、下面一块 ESP32 */
function buildPanel(at: Vector3, count: number, m: Materials) {
  const g = new Group();
  g.position.copy(at);
  const w = 2.6;
  g.add(box(3.4, 0.12, 1.6, m.stone, 0, 0, 0.3, m));
  g.add(box(0.1, 2.3, 0.1, m.paper, -w / 2 - 0.05, 0.12, 0, m));
  g.add(box(0.1, 2.3, 0.1, m.paper, w / 2 + 0.05, 0.12, 0, m));
  const board = box(w, 1.7, 0.05, new MeshStandardMaterial({ color: 0xf3f0e9, roughness: 0.92, map: pegboardTexture() }), 0, 0.6, 0, m);
  g.add(board);
  g.add(box(w + 0.5, 0.07, 0.5, m.paper, 0, 2.42, 0.15, m));

  const n = Math.max(count, 1);
  const step = Math.min((w - 0.3) / n, 0.42);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * step;
    g.add(soft(step * 0.7, 0.36, 0.1, m.soft, x, 1.75, 0.075, 0.02));
    g.add(box(step * 0.5, 0.1, 0.02, m.shade, x, 1.95, 0.13));
    g.add(soft(Math.min(step * 0.45, 0.12), 0.24, 0.14, m.soft, x, 1.18, 0.09, 0.015));
  }
  g.add(box(w - 0.2, 0.04, 0.03, m.shade, 0, 1.26, 0.04));
  g.add(box(0.5, 0.03, 0.3, m.shade, 0, 0.8, 0.04).rotateX(Math.PI / 2));
  g.add(box(0.14, 0.02, 0.12, m.soft, 0.08, 0.83, 0.06).rotateX(Math.PI / 2));
  return g;
}

function pegboardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f3f0e9";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#b9b1a4";
  ctx.beginPath();
  ctx.arc(32, 32, 7, 0, Math.PI * 2);
  ctx.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(26, 17);
  return texture;
}

/** 从配电板顶上出线，翻过院门，沿檐枋走到各房，再垂到门边前墙上 */
function buildConduits(panel: Vector3, doors: Door[], houseWest: number, m: Materials) {
  const g = new Group();
  doors.forEach((door, i) => {
    const offset = (i - (doors.length - 1) / 2) * 0.12;
    // 同一侧的线管在檐枋上并排走，各占一道
    const side = doors.filter((other) => other.facing === door.facing);
    const lane = side.indexOf(door) - (side.length - 1) / 2;
    const trayZ = door.facing * (YARD / 2 + 0.18) + lane * 0.06;
    const curve = new CatmullRomCurve3([
      new Vector3(panel.x + offset, 2.3, panel.z - 0.05),
      new Vector3(panel.x + offset, EAVE_Y + 0.3, panel.z - 0.8),
      new Vector3(houseWest - 0.6, EAVE_Y + 0.3, trayZ * 0.6),
      new Vector3(houseWest + 0.4, EAVE_Y, trayZ),
      new Vector3(door.x - 0.6, EAVE_Y, trayZ),
      new Vector3(door.x, EAVE_Y, trayZ),
      new Vector3(door.x, BASE + WALL + 0.1, door.z + door.facing * 0.06),
    ], false, "centripetal");
    g.add(new Mesh(new TubeGeometry(curve, 160, 0.035, 6), m.soft));
    door.view.curve = curve;
    door.view.dots = Array.from({ length: DOTS }, () => {
      const dot = new Mesh(new SphereGeometry(0.09, 10, 8), m.dot);
      dot.visible = false;
      dot.userData.noShadow = true;
      g.add(dot);
      return dot;
    });
  });
  return g;
}

/* ===== 台面与景观 ===== */

/** 模型桌：深色木框里嵌一块白板 */
function buildTable(width: number, depth: number, m: Materials) {
  const g = new Group();
  g.add(box(width + 1, 1.2, depth + 1, m.wood, 0, -1.25, 0));
  g.add(box(width, 0.3, depth, m.board, 0, -0.3, 0, m));
  return g;
}

/** 后山：一层层等高线纸板叠出来，超出台面的部分被台边切齐 */
function buildHill(cx: number, cz: number, west: number, east: number, north: number, m: Materials) {
  const g = new Group();
  const layers = 7;
  for (let k = 0; k < layers; k++) {
    const scale = 1 - k * 0.13;
    const shape = new Shape();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const wobble = 1 + 0.16 * Math.sin(3 * a + k * 0.7) + 0.08 * Math.sin(5 * a + 1.3);
      const x = Math.min(Math.max(cx + 9 * scale * wobble * Math.cos(a), west), east);
      const z = Math.max(cz + 3.6 * scale * wobble * Math.sin(a), north);
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    }
    const geometry = new ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: false, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    const layer = new Mesh(geometry, k % 2 ? m.paper : m.board);
    layer.position.y = k * 0.26;
    layer.add(new LineSegments(new EdgesGeometry(geometry, 30), m.line));
    g.add(layer);
  }
  // 山上几棵松，越靠山顶越高
  const pines: [number, number, number][] = [[-5, -0.8, 2], [-2.5, 0.6, 4], [0, -0.4, 6], [2.2, 0.8, 4], [4.5, -0.6, 3], [-6.8, 1.2, 1], [6.5, 0.5, 1]];
  for (const [dx, dz, level] of pines) g.add(pineTree(cx + dx, cz + dz, level * 0.26, 1 + level * 0.12, m));
  return g;
}

/** 溪、小桥、入口步道、配电板、散落的树 */
function buildLandscape(
  area: { west: number; east: number; north: number; south: number; houseLength: number; panel: Vector3 },
  m: Materials,
) {
  const g = new Group();
  const { west, east, south, houseLength, panel } = area;
  const streamZ = (x: number) => south - 2.6 + 0.7 * Math.sin(x * 0.22);
  const bridgeX = -houseLength / 2 - 3;

  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  for (let x = west; x <= east + 0.01; x += 0.5) {
    const z = streamZ(x);
    const w = 0.8 + 0.2 * Math.sin(x * 0.5);
    top.push([x, z - w]);
    bottom.unshift([x, z + w]);
  }
  const shape = new Shape();
  [...top, ...bottom].forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  const stream = new Mesh(new ShapeGeometry(shape), m.water);
  stream.rotation.x = -Math.PI / 2;
  stream.position.y = 0.02;
  stream.userData.noShadow = true;
  g.add(stream);

  // 平板石桥 + 两道矮栏
  const bz = streamZ(bridgeX);
  g.add(box(1.4, 0.14, 2.8, m.stone, bridgeX, 0.08, bz, m));
  g.add(box(0.08, 0.3, 2.8, m.paper, bridgeX - 0.66, 0.22, bz, m));
  g.add(box(0.08, 0.3, 2.8, m.paper, bridgeX + 0.66, 0.22, bz, m));

  // 步道：桥头往北拐到院门，岔一支到配电板
  const path: [number, number][] = [];
  for (let z = bz - 2; z > 0.6; z -= 0.75) path.push([bridgeX, z]);
  for (let x = bridgeX + 0.8; x < -houseLength / 2 - 0.4; x += 0.75) path.push([x, 0]);
  for (let x = bridgeX - 0.8; x > panel.x + 0.6; x -= 0.75) path.push([x, 0]);
  path.forEach(([x, z]) => g.add(box(0.62, 0.05, 0.5, m.stone, x, 0, z, m)));

  // 用固定种子撒树，避开房子、溪、步道和配电板
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const houseHalfX = houseLength / 2 + 1;
  const houseHalfZ = ROW_Z + RD / 2 + 0.8;
  let planted = 0;
  for (let tries = 0; tries < 400 && planted < 16; tries++) {
    const x = west + 1 + random() * (east - west - 2);
    const z = -houseHalfZ + random() * (south - 1 + houseHalfZ);
    const nearHouse = Math.abs(x) < houseHalfX && Math.abs(z) < houseHalfZ;
    const nearStream = Math.abs(z - streamZ(x)) < 1.6;
    const nearPath = Math.abs(x - bridgeX) < 1.2 || (Math.abs(z) < 1.4 && x < -houseHalfX + 1);
    const nearPanel = Math.abs(x - panel.x) < 2.5 && Math.abs(z - panel.z) < 1.8;
    if (nearHouse || nearStream || nearPath || nearPanel) continue;
    planted++;
    g.add(random() < 0.65 ? ballTree(x, z, 0, 0.7 + random() * 0.5, m) : pineTree(x, z, 0, 0.9 + random() * 0.4, m));
  }
  return g;
}

/** 模型树：细杆顶一团多面球 */
function ballTree(x: number, z: number, y: number, size: number, m: Materials) {
  const g = new Group();
  g.add(new Mesh(new CylinderGeometry(0.04 * size, 0.06 * size, 1.1 * size, 6), m.shade).translateY(y + 0.55 * size));
  const crown = new Mesh(new IcosahedronGeometry(0.75 * size, 1), m.soft);
  crown.position.y = y + 1.45 * size;
  g.add(crown);
  const crown2 = new Mesh(new IcosahedronGeometry(0.5 * size, 1), m.soft);
  crown2.position.set(0.45 * size, y + 1.1 * size, 0.2 * size);
  g.add(crown2);
  g.position.set(x, 0, z);
  return g;
}

/** 松：叠两层多棱锥 */
function pineTree(x: number, z: number, y: number, size: number, m: Materials) {
  const g = new Group();
  g.add(new Mesh(new CylinderGeometry(0.04, 0.05, 0.5 * size, 6), m.shade).translateY(y + 0.25 * size));
  g.add(new Mesh(new ConeGeometry(0.55 * size, 1.1 * size, 7), m.soft).translateY(y + 0.9 * size));
  g.add(new Mesh(new ConeGeometry(0.4 * size, 0.9 * size, 7), m.soft).translateY(y + 1.4 * size));
  g.position.set(x, 0, z);
  return g;
}

/** 重建前把旧沙盘的几何体、材质、贴图全部释放 */
export function disposeSandbox(group: Group) {
  const materials = new Set<Material>();
  group.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      object.geometry.dispose();
      materials.add(object.material as Material);
    }
  });
  materials.forEach((material) => {
    (material as MeshStandardMaterial).map?.dispose();
    material.dispose();
  });
}
