import {
  BoxGeometry, CanvasTexture, CatmullRomCurve3, CircleGeometry, Color, CylinderGeometry, DoubleSide,
  EdgesGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, LineSegments,
  Mesh, MeshStandardMaterial, PlaneGeometry, PointLight, RepeatWrapping, Shape, ShapeGeometry,
  Object3D, SphereGeometry, SRGBColorSpace, TubeGeometry, Vector3,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Entity } from "@em/shared";
import type { Room } from "../types";
import { createMaterials, type Materials } from "./materials";

// 江南合院剖切沙盘：保留回廊瓦檐，客房揭顶，墙剖到窗台高
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
  room?: { position: Vector3; facing: number };
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
  const west = -houseLength / 2 - 7;
  const east = houseLength / 2 + 3;
  const north = -ROW_Z - RD / 2 - 5;
  const south = ROW_Z + RD / 2 + 4.5;
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
  const first = doors.find((door) => sorted.find((room) => room.id === door.id)?.online) ?? doors[0];
  const room = first ? { position: new Vector3(first.x + first.facing * 0.3 - cx, 0, first.facing * ROW_Z - cz), facing: first.facing } : undefined;
  return { group, width, depth, views, room };
}

/** 底面贴在 y 上的方块，结构件保留很淡的接缝 */
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
    const column = new Mesh(new CylinderGeometry(0.075, 0.09, COL, 12), m.timber);
    column.position.set(x0 + RW * i, BASE + COL / 2, zColumn);
    row.add(column);
  }
  row.add(box(length + 0.3, 0.18, 0.18, m.timber, x0 + length / 2, BASE + COL, zColumn));
  row.add(box(length + 0.3, 0.08, 0.12, m.timber, x0 + length / 2, BASE + COL - 0.38, zColumn));
  const count = Math.floor(length / 0.24);
  const lattice = new InstancedMesh(new BoxGeometry(0.028, 0.28, 0.035), m.timber, count);
  const at = new Object3D();
  for (let i = 0; i < count; i++) {
    at.position.set(x0 + (i + 0.5) * length / count, BASE + COL - 0.22, zColumn);
    at.rotation.z = i % 2 ? Math.PI / 4 : -Math.PI / 4;
    at.updateMatrix();
    lattice.setMatrixAt(i, at.matrix);
  }
  row.add(lattice);
  // 瓦檐只盖回廊，客房仍揭顶；线管在靠天井的檐口外侧可见。
  const eave = buildEave(length + 0.45, HALL + 0.24, m);
  eave.position.set(x0 + length / 2, EAVE_Y - 0.2, facing * (YARD / 2 + HALL / 2));
  eave.rotation.x = facing * 0.16;
  row.add(eave);
  for (let i = 0; i <= rooms.length; i++) {
    row.add(box(0.08, 0.32, 0.08, m.timber, x0 + RW * i, BASE + COL - 0.34, zColumn));
  }

  // 两端马头墙，中间屋顶留空，保证室内始终可见
  row.add(buildGable(x0, zMid, m));
  row.add(buildGable(x0 + length, zMid, m));
  return row;
}

/** 一片片搭接的小青瓦，共用一份几何体，不增加数百次绘制。 */
function buildEave(width: number, depth: number, m: Materials) {
  const g = new Group();
  g.add(box(width, 0.07, depth, m.wood, 0, -0.07, 0));
  const columns = Math.ceil(width / 0.22);
  const rows = Math.ceil(depth / 0.34);
  const tile = new CylinderGeometry(width / columns / 2, width / columns / 2, depth / rows + 0.1, 8, 1, true, Math.PI / 2, Math.PI);
  tile.rotateX(Math.PI / 2);
  const tiles = new InstancedMesh(tile, m.roof, columns * rows);
  const at = new Object3D();
  const color = new Color();
  for (let x = 0; x < columns; x++) {
    for (let z = 0; z < rows; z++) {
      const i = x * rows + z;
      at.position.set(-width / 2 + (x + 0.5) * width / columns, 0.018 + z * 0.009, -depth / 2 + (z + 0.5) * depth / rows);
      at.updateMatrix();
      tiles.setMatrixAt(i, at.matrix);
      tiles.setColorAt(i, color.setScalar(0.76 + ((x * 7 + z * 11) % 17) / 70));
    }
  }
  g.add(tiles);
  for (const z of [-depth / 2, depth / 2]) g.add(box(width, 0.13, 0.07, m.timber, 0, -0.13, z));
  return g;
}

/** 床尾织物有轻微褶皱和垂边，仍是一个简单网格。 */
function buildCover(material: Material, x: number, y: number, z: number) {
  const geometry = new PlaneGeometry(1.46, 0.82, 16, 12);
  geometry.rotateX(-Math.PI / 2);
  const points = geometry.attributes.position!;
  for (let i = 0; i < points.count; i++) {
    const px = points.getX(i);
    const pz = points.getZ(i);
    points.setY(i, Math.sin(px * 17 + pz * 3) * 0.012 - Math.max(0, pz - 0.31) * 1.8);
  }
  geometry.computeVertexNormals();
  const cover = new Mesh(geometry, material);
  cover.position.set(x, y, z);
  return cover;
}

function buildCurtain(material: Material, x: number, y: number, z: number) {
  const geometry = new PlaneGeometry(0.19, 0.3, 10, 1);
  const points = geometry.attributes.position!;
  for (let i = 0; i < points.count; i++) points.setZ(i, Math.cos(points.getX(i) * 125) * 0.015);
  geometry.computeVertexNormals();
  const curtain = new Mesh(geometry, material);
  curtain.position.set(x, y, z);
  return curtain;
}

/** 一间客房，本地坐标：门在 +z（朝天井），后墙在 -z，床靠后墙 */
function buildRoom(room: Room, m: Materials, budget: { lights: number }) {
  const g = new Group();
  // 每间房自己一套材质，离线变灰、功率发光才不会串到别的房
  const wall = m.paper.clone();
  const floor = m.floor.clone();
  floor.emissive.set(AMBER);
  floor.emissiveIntensity = 0;
  const wood = m.timber.clone();
  const cushion = m.linen.clone();
  const blanket = m.blanket.clone();
  const porcelain = m.soft.clone();
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
  for (const [width, x] of [[hw + 0.75, (-hw + 0.75) / 2], [hw - 1.65, (hw + 1.65) / 2]]) {
    g.add(box(width, 0.19, T + 0.025, m.stone, x, y, frontZ));
  }
  g.add(box(RW, 0.19, T + 0.025, m.stone, 0, y, backZ));
  // 低窗框与门框给剖切墙体一个明确的木作收口。
  g.add(box(1.3, 0.06, 0.22, wood, 1, y + 0.75, backZ));
  for (const x of [0.4, 1, 1.6]) g.add(box(0.045, 0.32, 0.06, wood, x, y + 0.76, backZ));
  g.add(box(1.3, 0.045, 0.06, wood, 1, y + 1.06, backZ));
  const glass = box(1.14, 0.28, 0.012, m.glass, 1, y + 0.79, backZ + 0.012);
  glass.userData.noShadow = true;
  g.add(glass);
  g.add(box(1.2, 0.025, 0.06, wood, 1, y + 0.92, backZ + 0.035));
  for (const x of [0.52, 1.48]) g.add(buildCurtain(cushion, x, y + 0.93, backZ + 0.08));
  for (const x of [0.75, 1.65]) g.add(box(0.065, WALL, 0.17, wood, x, y, frontZ));
  g.add(box(1.02, 0.08, 0.18, wood, 1.2, y, frontZ));
  // 门扇同样剖到窗台高，静态木作不表达门的实时开闭。
  const door = new Group();
  door.position.set(0.79, y, frontZ);
  door.rotation.y = -0.5;
  door.add(box(0.8, WALL - 0.05, 0.045, wood, 0.4, 0, 0));
  door.add(box(0.64, 0.62, 0.02, wood, 0.4, 0.18, 0.027));
  for (const x of [0.17, 0.39, 0.61]) door.add(box(0.025, 0.62, 0.025, wood, x, 0.18, 0.045));
  door.add(box(0.035, 0.08, 0.035, m.metal, 0.7, 0.76, 0.055));
  g.add(door);
  g.add(box(RW - 0.1, 0.08, 0.04, wood, 0, y, -hd + T));

  // 床、床头柜、书桌椅
  const bedZ = -hd + T + 1.05;
  g.add(soft(1.65, 0.012, 2.45, blanket, -0.6, y, bedZ + 0.16, 0.005));
  g.add(soft(1.5, 0.3, 2.0, wood, -0.6, y + 0.015, bedZ));
  g.add(soft(1.42, 0.14, 1.9, cushion, -0.6, y + 0.3, bedZ + 0.02, 0.06));
  g.add(buildCover(blanket, -0.6, y + 0.47, bedZ + 0.64));
  g.add(soft(0.55, 0.1, 0.32, cushion, -0.93, y + 0.44, bedZ - 0.72, 0.05));
  g.add(soft(0.55, 0.1, 0.32, cushion, -0.27, y + 0.44, bedZ - 0.72, 0.05));
  g.add(soft(1.65, 0.85, 0.1, wood, -0.6, y, -hd + T + 0.05));
  g.add(soft(1.42, 0.32, 0.04, blanket, -0.6, y + 0.43, -hd + T + 0.12, 0.015));
  g.add(soft(0.38, 0.48, 0.38, wood, -1.66, y, -hd + T + 0.25));
  g.add(soft(0.38, 0.48, 0.38, wood, 0.45, y, -hd + T + 0.25));
  g.add(soft(0.55, 0.05, 1.2, wood, hw - 0.36, y + 0.7, -0.95, 0.02));
  for (const z of [-1.46, -0.44]) {
    for (const x of [hw - 0.57, hw - 0.15]) g.add(box(0.045, 0.7, 0.045, wood, x, y, z));
  }
  g.add(soft(0.42, 0.07, 0.42, blanket, hw - 0.95, y + 0.39, -0.95, 0.025));
  g.add(soft(0.06, 0.36, 0.42, wood, hw - 1.18, y + 0.42, -0.95, 0.025));
  for (const z of [-1.1, -0.8]) {
    for (const x of [hw - 1.1, hw - 0.8]) g.add(box(0.04, 0.39, 0.04, wood, x, y, z));
  }
  // 书桌上的书与茶杯，让近景能读出客房尺度。
  g.add(box(0.22, 0.035, 0.3, blanket, hw - 0.36, y + 0.75, -1.23));
  g.add(new Mesh(new CylinderGeometry(0.055, 0.045, 0.1, 12), porcelain).translateX(hw - 0.36).translateY(y + 0.8).translateZ(-0.65));

  // 卫生间在门边一角：两道矮隔墙，马桶、洗手台
  g.add(box(0.8, WALL, T, wall, -hw + 0.4, y, 0.6, m));
  g.add(box(T, WALL, hd - 0.6 - T, wall, -0.6, y, (0.6 + hd - T) / 2, m));
  g.add(soft(0.4, 0.4, 0.55, porcelain, -1.62, y, hd - T - 0.3, 0.12));
  g.add(soft(0.62, 0.7, 0.42, wood, -1.0, y, hd - T - 0.21, 0.03));
  g.add(soft(0.64, 0.1, 0.44, porcelain, -1.0, y + 0.7, hd - T - 0.21, 0.03));
  g.add(box(1.2, 0.03, 0.6, m.stone, -1.32, y, 0.98));

  // 电器按实体生成：台灯、壁挂空调、墙插、其它用小方块
  let others = 0;
  for (const { key, kind } of furnitureOf(room)) {
    if (kind === "light") {
      g.add(soft(0.16, 0.025, 0.16, wood, -1.66, y + 0.48, -hd + T + 0.25, 0.01));
      g.add(new Mesh(new CylinderGeometry(0.015, 0.015, 0.25, 6), m.metal).translateX(-1.66).translateY(y + 0.6).translateZ(-hd + T + 0.25));
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
      g.add(soft(0.22, 0.28, 0.95, porcelain, -hw + T / 2 + 0.11, y + 0.7, -0.1, 0.06));
      g.add(box(0.02, 0.03, 0.8, glow(key, kind, GREEN), -hw + T / 2 + 0.22, y + 0.73, -0.1));
    } else if (kind === "socket") {
      g.add(soft(0.03, 0.12, 0.22, porcelain, hw - T / 2 - 0.015, y + 0.28, 0.3, 0.01));
      g.add(box(0.02, 0.04, 0.04, glow(key, kind, GREEN), hw - T / 2 - 0.035, y + 0.36, 0.39));
    } else {
      const slot = others++;
      const x = -0.25 + (slot % 2) * 0.48;
      const z = hd - T - 0.3 - Math.floor(slot / 2) * 0.5;
      g.add(soft(0.32, 0.38, 0.32, porcelain, x, y, z, 0.05));
      g.add(box(0.12, 0.02, 0.12, glow(key, kind, GREEN), x, y + 0.38, z));
    }
  }
  const view = { wall, floor, furniture: [wood, cushion, blanket, porcelain], appliances, lamp, speed: 0, t: 0 } as RoomView;
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
  g.add(box(0.27, 0.28, SPAN + 0.32, m.stone, x, BASE, zMid));
  const steps = [2.2, 2.9, 3.6, 2.9, 2.2];
  const seg = (SPAN + 0.3) / steps.length;
  steps.forEach((h, i) => {
    const z = zMid - (SPAN + 0.3) / 2 + seg * (i + 0.5);
    g.add(box(0.24, h, seg + 0.01, m.paper, x, BASE, z, m));
    g.add(box(0.42, 0.1, seg + 0.12, m.roof, x, BASE + h, z));
    // 每级檐角翘起的小座头
    if (i !== 2) g.add(box(0.36, 0.12, 0.18, m.roof, x, BASE + h + 0.1, z + (i < 2 ? -1 : 1) * (seg / 2 - 0.05)));
  });
  return g;
}

/** 天井：石板地、方池、一棵桂花，东西两道院墙开门 */
function buildCourtyard(x0: number, length: number, eastOpen: boolean, m: Materials) {
  const g = new Group();
  const pavingMap = pavingTexture(length, YARD);
  const paving = new Mesh(new PlaneGeometry(length, YARD), new MeshStandardMaterial({ map: pavingMap, bumpMap: pavingMap, bumpScale: 0.025, roughness: 0.94 }));
  paving.rotation.x = -Math.PI / 2;
  paving.position.set(x0 + length / 2, 0.01, 0);
  g.add(paving);

  const poolW = Math.min(length * 0.4, 4.2);
  const poolX = x0 + length * 0.42;
  for (const z of [-1, 1]) g.add(soft(poolW + 0.3, 0.2, 0.18, m.stone, poolX, 0, z, 0.025));
  for (const x of [-1, 1]) g.add(soft(0.18, 0.2, 1.85, m.stone, poolX + x * poolW / 2, 0, 0, 0.025));
  g.add(box(poolW - 0.1, 0.02, 1.85, m.soil, poolX, 0.015, 0));
  const water = box(poolW - 0.1, 0.1, 1.85, m.water, poolX, 0, 0);
  water.userData.noShadow = true;
  g.add(water);
  for (let i = 0; i < 5; i++) {
    const leaf = new Mesh(new CircleGeometry(0.09 + (i % 3) * 0.025, 18, 0.2, Math.PI * 2 - 0.4), m.lily);
    leaf.rotation.set(-Math.PI / 2, 0, i * 1.7);
    leaf.position.set(poolX + poolW * 0.22 + Math.cos(i * 2.4) * poolW * 0.12, 0.108 + i * 0.001, 0.2 + Math.sin(i * 2.4) * 0.32);
    g.add(leaf);
  }

  const treeX = x0 + length * 0.8;
  for (const side of [-1, 1]) {
    g.add(box(1.2, 0.35, 0.12, m.stone, treeX, 0, 1.1 + side * 0.54));
    g.add(box(0.12, 0.35, 0.96, m.stone, treeX + side * 0.54, 0, 1.1));
  }
  g.add(box(0.96, 0.03, 0.96, m.soil, treeX, 0.28, 1.1));
  g.add(ballTree(treeX, 1.1, 0.31, 1.3, m));

  const benchX = x0 + length * 0.14;
  for (const x of [-0.17, 0.17]) {
    for (const z of [-0.4, 0.4]) g.add(box(0.065, 0.4, 0.065, m.timber, benchX + x, 0, 0.7 + z));
  }
  for (let i = 0; i < 6; i++) g.add(soft(0.45, 0.055, 0.15, m.timber, benchX, 0.4, 0.23 + i * 0.18, 0.01));

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
    g.add(box(0.23, 0.25, z1 - z0, m.stone, x, 0, (z0 + z1) / 2));
    g.add(box(0.34, 0.08, z1 - z0 + 0.1, m.roof, x, h, (z0 + z1) / 2));
  }
  // 门头：一道门楣加一片小门罩
  if (gate) {
    for (const z of [-0.86, 0.86]) g.add(box(0.24, 2.15, 0.1, m.timber, x, 0, z));
    g.add(box(0.24, 0.18, 1.8, m.timber, x, 2.15, 0));
    const roof = new Group();
    roof.position.set(x, 2.4, 0);
    roof.rotation.y = Math.PI / 2;
    for (const side of [-1, 1]) {
      const slope = buildEave(2.45, 0.7, m);
      slope.position.z = side * 0.3;
      slope.rotation.x = side * 0.35;
      roof.add(slope);
    }
    roof.add(box(2.55, 0.08, 0.09, m.roof, 0, 0.1, 0));
    g.add(roof);
  }
  return g;
}

function pavingTexture(w: number, d: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#777b73";
  ctx.fillRect(0, 0, 256, 256);
  // 错缝铺的长条石板
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    for (let x = row % 2 ? -64 : 0; x < 256; x += 128) {
      const shade = 158 + ((row * 13 + x * 7) % 17);
      ctx.fillStyle = `rgb(${shade},${shade + 1},${shade - 5})`;
      ctx.fillRect(x + 1, y + 1, 126, 62);
      ctx.fillStyle = "rgba(255,255,245,0.16)";
      ctx.fillRect(x + 2, y + 2, 124, 1);
    }
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,240,0.08)" : "rgba(40,45,35,0.06)";
    ctx.fillRect((i * 73) % 256, Math.floor(i * 39.7) % 256, 1, 1);
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
  g.add(box(0.1, 2.3, 0.1, m.metal, -w / 2 - 0.05, 0.12, 0));
  g.add(box(0.1, 2.3, 0.1, m.metal, w / 2 + 0.05, 0.12, 0));
  const board = box(w, 1.7, 0.05, new MeshStandardMaterial({ color: 0xf3f0e9, roughness: 0.92, map: pegboardTexture() }), 0, 0.6, 0, m);
  g.add(board);
  g.add(box(w + 0.5, 0.07, 0.5, m.metal, 0, 2.42, 0.15));

  const n = Math.max(count, 1);
  const step = Math.min((w - 0.3) / n, 0.42);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * step;
    g.add(soft(step * 0.7, 0.36, 0.1, m.soft, x, 1.75, 0.075, 0.02));
    g.add(box(step * 0.5, 0.1, 0.02, m.shade, x, 1.95, 0.13));
    g.add(soft(Math.min(step * 0.45, 0.12), 0.24, 0.14, m.soft, x, 1.18, 0.09, 0.015));
    g.add(box(Math.min(step * 0.28, 0.075), 0.08, 0.035, m.shade, x, 1.27, 0.175));
  }
  g.add(box(w - 0.2, 0.04, 0.03, m.shade, 0, 1.26, 0.04));
  g.add(box(0.5, 0.03, 0.3, m.leaf, 0, 0.8, 0.04).rotateX(Math.PI / 2));
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
      new Vector3(panel.x + offset, EAVE_Y, panel.z - 0.05),
      new Vector3(houseWest - 0.4 + lane * 0.06, EAVE_Y, panel.z - 0.05),
      new Vector3(houseWest - 0.4 + lane * 0.06, EAVE_Y, trayZ),
      new Vector3(door.x - 0.6, EAVE_Y, trayZ),
      new Vector3(door.x, EAVE_Y, trayZ),
      new Vector3(door.x, EAVE_Y, door.z + door.facing * 0.06),
      new Vector3(door.x, BASE + WALL + 0.1, door.z + door.facing * 0.06),
    ], false, "catmullrom", 0.04);
    g.add(new Mesh(new TubeGeometry(curve, 100, 0.028, 6), m.metal));
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

/** 深木色底座与庭院地表 */
function buildTable(width: number, depth: number, m: Materials) {
  const g = new Group();
  g.add(soft(width + 0.6, 0.65, depth + 0.6, m.wood, 0, -0.95, 0, 0.08));
  g.add(box(width, 0.3, depth, m.board, 0, -0.3, 0, m));
  return g;
}

/** 连续起伏的草坡，颜色随高度变化；树和景石都落在实际坡面上。 */
function buildHill(cx: number, cz: number, west: number, east: number, north: number, m: Materials) {
  const g = new Group();
  const left = Math.max(west + 0.2, cx - 9);
  const right = Math.min(east - 0.2, cx + 9);
  const depth = 4.7;
  const height = (x: number, z: number) => {
    const t = Math.max(0, Math.min(1, (z - north) / depth));
    const ridge = 1.1 + 0.6 * Math.cos((x - cx) * 0.4) + 0.24 * Math.sin(x * 1.2);
    return Math.pow(Math.sin(t * Math.PI), 1.3) * ridge;
  };
  const geometry = new PlaneGeometry(right - left, depth, 64, 24);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((left + right) / 2, 0.015, north + depth / 2);
  const points = geometry.attributes.position!;
  const colors: number[] = [];
  const color = new Color();
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i);
    const z = points.getZ(i);
    const y = height(x, z);
    points.setY(i, y + 0.015);
    color.setHSL(0.2 + 0.015 * Math.sin(x), 0.16, 0.45 - y * 0.045);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  g.add(new Mesh(geometry, m.terrain));
  for (let i = 0; i < 5; i++) {
    const x = left + 1 + (right - left - 2) * i / 4;
    const z = cz + 0.6 + Math.sin(i * 2) * 0.4;
    g.add(pineTree(x, z, height(x, z), 0.95 + (i % 3) * 0.18, m));
    const rock = new Mesh(new IcosahedronGeometry(0.55, 0), m.rock);
    rock.scale.set(1.3, 0.8, 0.95);
    rock.rotation.set(0.2, i * 1.7, 0.15);
    rock.position.set(x + 0.65, height(x + 0.65, z + 0.4) + 0.16, z + 0.4);
    g.add(rock);
  }
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
  // 河岸用少量景石与灌木收边，避免一条水带直接贴在台面上。
  for (let x = west + 0.6, i = 0; x < east - 0.5; x += 0.72, i++) {
    for (const side of [-1, 1]) {
      if (Math.abs(x - bridgeX) < 1.2) continue;
      const z = streamZ(x) + side * (0.95 + 0.2 * Math.sin(x * 0.5)) + Math.sin(i * 7.3) * 0.13;
      const stone = new Mesh(new IcosahedronGeometry(0.19 + (i % 5) * 0.045, 0), m.rock);
      stone.position.set(x, 0.09, z);
      stone.rotation.set(i * 0.3, i * 1.7, side * 0.2);
      stone.scale.set(1.3, 0.8, 0.9);
      g.add(stone);
      if (i % 4 === 0) {
        const shrub = buildFoliage(0.36, m);
        shrub.position.set(x + 0.25, 0.16, z + side * 0.2);
        g.add(shrub);
      }
    }
  }

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
  const treePositions: [number, number][] = [];
  for (let tries = 0; tries < 400 && planted < 11; tries++) {
    const x = west + 1 + random() * (east - west - 2);
    const z = -houseHalfZ + random() * (south - 1 + houseHalfZ);
    const size = random() < 0.65 ? 0.7 + random() * 0.5 : 0.9 + random() * 0.4;
    const treeRadius = size * 1.15;
    const nearHouse = Math.abs(x) < houseHalfX + treeRadius + 0.55 && Math.abs(z) < houseHalfZ + treeRadius + 0.55;
    const nearStream = Math.abs(z - streamZ(x)) < 1.6;
    const nearPath = Math.abs(x - bridgeX) < 1.2 || (Math.abs(z) < 1.4 && x < -houseHalfX + 1);
    const nearPanel = Math.abs(x - panel.x) < 2.5 && Math.abs(z - panel.z) < 1.8;
    const nearTree = treePositions.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < treeRadius + 1.1);
    if (nearHouse || nearStream || nearPath || nearPanel || nearTree) continue;
    planted++;
    treePositions.push([x, z]);
    g.add(ballTree(x, z, 0, size, m));
    const bed = new Mesh(new CylinderGeometry(size * 0.85, size, 0.07, 12), m.earth);
    bed.position.set(x, 0.035, z);
    g.add(bed);
  }
  return g;
}

/** 交错的叶簇共用网格；透明处能透出背景，树冠不再是实心圆球。 */
function buildFoliage(size: number, m: Materials) {
  const count = 30;
  const foliage = new InstancedMesh(new PlaneGeometry(1, 1), m.foliage, count);
  const at = new Object3D();
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4;
    const level = -0.65 + 1.3 * (i + 0.5) / count;
    const radius = Math.sqrt(1 - level * level) * size * 0.55;
    at.position.set(Math.cos(angle) * radius, level * size * 0.65, Math.sin(angle) * radius);
    at.rotation.set(i * 0.79, angle, Math.sin(angle) * 0.5);
    at.scale.set(size * (1.15 + Math.sin(i * 7) * 0.12), size * 0.95, 1);
    at.updateMatrix();
    foliage.setMatrixAt(i, at.matrix);
  }
  return foliage;
}

/** 树干分出几根侧枝，树冠保留疏密变化。 */
function ballTree(x: number, z: number, y: number, size: number, m: Materials) {
  const g = new Group();
  g.add(new Mesh(new CylinderGeometry(0.045 * size, 0.07 * size, 1.45 * size, 7), m.timber).translateY(y + 0.72 * size));
  for (let i = 0; i < 3; i++) {
    const branch = new Mesh(new CylinderGeometry(0.012 * size, 0.03 * size, 0.65 * size, 5), m.timber);
    branch.rotation.set(0.7, i * 2.1, 0.7);
    branch.position.set(Math.cos(i * 2.1) * 0.15 * size, y + 1.1 * size, Math.sin(i * 2.1) * 0.15 * size);
    g.add(branch);
  }
  const crown = buildFoliage(size, m);
  crown.position.y = y + 1.6 * size;
  g.add(crown);
  g.position.set(x, 0, z);
  return g;
}

/** 山上的树冠更扁，和庭院树拉开轮廓 */
function pineTree(x: number, z: number, y: number, size: number, m: Materials) {
  const g = ballTree(x, z, y, size, m);
  g.scale.set(1.2, 0.9, 0.85);
  return g;
}

/** 重建前把旧沙盘的几何体、材质、贴图全部释放 */
export function disposeSandbox(group: Group) {
  const materials = new Set<Material>();
  group.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      if (object instanceof InstancedMesh) object.dispose();
      object.geometry.dispose();
      materials.add(object.material as Material);
    }
  });
  materials.forEach((material) => {
    const standard = material as MeshStandardMaterial;
    standard.map?.dispose();
    if (standard.bumpMap !== standard.map) standard.bumpMap?.dispose();
    material.dispose();
  });
}
