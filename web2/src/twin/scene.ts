import {
  ACESFilmicToneMapping, Color, DirectionalLight, Fog, HalfFloatType, HemisphereLight, InstancedMesh, MathUtils, Mesh, MeshStandardMaterial, PCFShadowMap,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, Raycaster, Scene as ThreeScene, Spherical, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { switchesOf, type Room, type RoomStatus } from "../types";
import { buildSandbox, disposeSandbox, furnitureKey, layoutKey, type RoomView, type Sandbox } from "./sandbox";

export interface Scene {
  /** 每秒快照来了就调：只改材质和可见性，房间结构变了才重建 */
  applyRooms(rooms: Room[], status: RoomStatus): void;
  resetView(): void;
  focusRoom(id?: string): void;
  dispose(): void;
}

// 从院门斜上方看进合院，客房与配电板同时入画。
const HOME_POLAR = MathUtils.degToRad(60);
const HOME_AZIMUTH = MathUtils.degToRad(-25);
const FOV = 30;

const WHITE = 0xf2eee5;
const OFFLINE_GRAY = 0x8a857c;
// 2000 W 时地面琥珀光拉满
const FULL_POWER = 2000;
const MAX_LIGHTS = 8;

export function createScene(canvas: HTMLCanvasElement, onSelect: (id: string | null) => void): Scene {
  const small = window.innerWidth < 640;
  const renderer = new WebGLRenderer({ canvas, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = PCFShadowMap;
  // 建筑和树都是静态的，只有重建或取景变化时重算太阳阴影。
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new ThreeScene();
  scene.background = new Color(0xd8d5ce);
  const fog = new Fog(0xd8d5ce, 75, 180);
  scene.fog = fog;
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;

  // 中性的展厅光保留材质本色，台灯继续由客房开关点亮
  scene.add(new HemisphereLight(0xdce5ed, 0x504131, 0.6));
  const sun = new DirectionalLight(0xffead4, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new DirectionalLight(0xb7d1e4, 0.55);
  fill.position.set(12, 9, -7);
  scene.add(fill);

  // 展台接住底座的阴影，让沙盘有落地感。
  const ground = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ color: 0xb8b7b0, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.98;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new PerspectiveCamera(FOV, 1, 0.5, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minPolarAngle = MathUtils.degToRad(20);
  controls.maxPolarAngle = MathUtils.degToRad(65);
  controls.screenSpacePanning = false;

  // 多重采样的离屏缓冲，后处理之后边缘也不锯齿
  const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera);
  ao.updateGtaoMaterial({ radius: 0.6, thickness: 1, distanceExponent: 1.5, scale: 0.85, samples: 8 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
  composer.addPass(ao);
  composer.addPass(new OutputPass());

  let sandbox: Sandbox | undefined;
  let key: string | undefined;
  let rooms: Room[] = [];
  let selectedId: string | null = null;
  let flight: { start: number; from: Vector3; targetFrom: Vector3; to: Vector3; target: Vector3 } | undefined;

  function moveCamera(to: Vector3, target: Vector3, animate: boolean) {
    flight = undefined;
    // 清掉上一次拖拽的阻尼，避免取景结束后镜头继续偏移。
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flight = { start: Date.now(), from: camera.position.clone(), targetFrom: controls.target.clone(), to, target };
    } else {
      camera.position.copy(to);
      controls.target.copy(target);
      controls.update();
    }
  }

  /** 镜头退到刚好装下整张台面，主光阴影也框住台面 */
  function frame(width: number, depth: number, animate = false) {
    const radius = Math.hypot(width, depth) / 2;
    const vertical = MathUtils.degToRad(FOV / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const direction = new Vector3().setFromSpherical(new Spherical(1, HOME_POLAR, HOME_AZIMUTH));
    const right = new Vector3().crossVectors(camera.up, direction).normalize();
    const up = new Vector3().crossVectors(direction, right);
    // 按实际网格的角点取景，避免把台面上方整块空白也算成建筑。
    const target = new Vector3(0, 0, depth * 0.035);
    let distance = 0;
    sandbox!.group.updateMatrixWorld(true);
    sandbox!.group.traverse((object) => {
      if (!(object instanceof Mesh) || !object.visible) return;
      if (object instanceof InstancedMesh) object.computeBoundingBox();
      else if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const bounds = object instanceof InstancedMesh ? object.boundingBox! : object.geometry.boundingBox!;
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            const point = new Vector3(x, y, z).applyMatrix4(object.matrixWorld).sub(target);
            distance = Math.max(distance, Math.abs(point.dot(right)) / Math.tan(horizontal) + point.dot(direction), Math.abs(point.dot(up)) / Math.tan(vertical) + point.dot(direction));
          }
        }
      }
    });
    controls.minDistance = 10;
    controls.maxDistance = distance * 1.6;
    moveCamera(direction.multiplyScalar(distance * 1.12).add(target), target, animate);
    // 窄屏镜头退得更远，雾也往后退，避免模型褪成白色。
    fog.near = distance + radius * 2;
    fog.far = fog.near + radius * 8;

    sun.position.set(-0.85, 0.95, -0.4).normalize().multiplyScalar(radius * 2.5);
    const shadow = sun.shadow.camera;
    shadow.left = shadow.bottom = -radius * 1.05;
    shadow.right = shadow.top = radius * 1.05;
    shadow.near = radius * 0.5;
    shadow.far = radius * 5;
    shadow.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  }

  function rebuild(rooms: Room[]) {
    const previous = sandbox;
    if (sandbox) {
      scene.remove(sandbox.group);
      disposeSandbox(sandbox.group);
    }
    sandbox = buildSandbox(rooms, small ? 0 : MAX_LIGHTS);
    scene.add(sandbox.group);
    renderer.shadowMap.needsUpdate = true;
    if (previous?.width !== sandbox.width || previous?.depth !== sandbox.depth) frame(sandbox.width, sandbox.depth);
  }

  function applyRooms(nextRooms: Room[], status: RoomStatus) {
    rooms = nextRooms;
    const next = layoutKey(rooms);
    if (next !== key) {
      key = next;
      rebuild(rooms);
      if (selectedId && !sandbox!.views.has(selectedId)) resetView();
      else if (selectedId) focusRoom(selectedId);
    }
    for (const room of rooms) paint(sandbox!.views.get(room.id)!, room, status === "live");
  }

  function resetView() {
    selectedId = null;
    for (const view of sandbox?.views.values() ?? []) view.outline.visible = false;
    onSelect(null);
    if (sandbox) frame(sandbox.width, sandbox.depth, true);
  }

  function focusRoom(id = selectedId ?? rooms.find((room) => room.online)?.id ?? rooms[0]?.id) {
    if (!id) return;
    const view = sandbox?.views.get(id);
    if (!view) return;
    selectedId = id;
    for (const [roomId, room] of sandbox!.views) room.outline.visible = roomId === id;
    sandbox!.group.updateMatrixWorld(true);
    const target = view.group.getWorldPosition(new Vector3());
    target.y = 0;
    const door = view.group.getWorldDirection(new Vector3());
    const side = new Vector3().crossVectors(new Vector3(0, 1, 0), door);
    const offset = door.multiplyScalar(6.2).add(side.multiplyScalar(4)).add(new Vector3(0, 11.5, 0));
    offset.multiplyScalar(Math.max(1, 0.85 / camera.aspect));
    moveCamera(target.clone().add(offset), target, true);
    onSelect(selectedId);
  }

  // 点击和拖拽分开；双指缩放或手指划过客房都不会误选。
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let press: { id: number; x: number; y: number; dragged: boolean } | undefined;
  const onPointerDown = (event: PointerEvent) => {
    press = event.isPrimary && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false } : undefined;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.dragged = true;
  };
  const onPointerCancel = () => { press = undefined; };
  const onPointerUp = (event: PointerEvent) => {
    const click = press;
    press = undefined;
    if (!click || click.id !== event.pointerId || click.dragged || Math.hypot(event.clientX - click.x, event.clientY - click.y) > 6 || !sandbox) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(sandbox.group).find(({ object }) => object instanceof Mesh && object.visible);
    let object = hit?.object;
    while (object && !object.userData.roomId) object = object.parent ?? undefined;
    if (object) focusRoom(object.userData.roomId);
    else if (selectedId) resetView();
  };
  const onControlStart = () => { flight = undefined; };
  controls.addEventListener("start", onControlStart);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);

  /** 接口字段 → 画面：离线变灰、功率发光、开关点亮电器、线管光点流动 */
  function paint(view: RoomView, room: Room, live: boolean) {
    const online = room.online;
    view.wall.color.set(online ? WHITE : OFFLINE_GRAY);
    for (const material of view.furniture) {
      if (material.transparent !== !online) {
        material.transparent = !online;
        material.needsUpdate = true;
      }
      material.opacity = online ? 1 : 0.35;
    }

    const load = online ? Math.min(room.power / FULL_POWER, 1) : 0;
    view.floor.emissiveIntensity = load * 0.12;

    const on = new Map(switchesOf(room).map((entity) => [furnitureKey(entity), entity.state === true]));
    let lampOn = false;
    for (const { key, kind, glow } of view.appliances) {
      const lit = online && on.get(key) === true;
      glow.emissiveIntensity = lit ? (kind === "light" ? 2.5 : 1.5) : 0;
      if (kind === "light" && lit) lampOn = true;
    }
    if (view.lamp) view.lamp.intensity = lampOn ? 9 : 0;

    view.speed = online && live && room.power > 0 ? 0.08 + load * 0.3 : 0;
    view.dots.forEach((dot) => (dot.visible = view.speed > 0));

    if (!online) view.setLabel(`${room.name} · 离线`);
    else if (!room.entities.length) view.setLabel(`${room.name} · 未上报实体`);
    else view.setLabel(room.name);
  }

  /** 光点沿线管从配电板流向房间，每圈 1/speed 秒 */
  function flow(dt: number) {
    for (const view of sandbox?.views.values() ?? []) {
      if (!view.speed) continue;
      view.t = (view.t + dt * view.speed) % 1;
      view.dots.forEach((dot, i) => view.curve.getPointAt((view.t + i / view.dots.length) % 1, dot.position));
    }
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    ao.setSize(Math.ceil(w * 0.75), Math.ceil(h * 0.75));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (selectedId) focusRoom(selectedId);
    else if (sandbox) frame(sandbox.width, sandbox.depth, !!flight);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // 不能平移出台面
  const limit = new Vector3();
  controls.addEventListener("change", () => {
    if (!sandbox) return;
    limit.set(sandbox.width / 2, 0, sandbox.depth / 2);
    controls.target.clamp(limit.clone().negate(), limit);
    controls.target.y = 0;
  });

  let last = performance.now();
  const loop = (now: number) => {
    flow(Math.min(Math.max(now - last, 0) / 1000, 0.1));
    last = now;
    if (flight) {
      const progress = Math.min((Date.now() - flight.start) / 800, 1);
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(flight.from, flight.to, eased);
      controls.target.lerpVectors(flight.targetFrom, flight.target, eased);
      if (progress === 1) flight = undefined;
    }
    controls.update();
    composer.render();
  };
  const onVisibility = () => renderer.setAnimationLoop(document.hidden ? null : loop);
  document.addEventListener("visibilitychange", onVisibility);
  onVisibility();

  return {
    applyRooms,
    resetView,
    focusRoom,
    dispose() {
      renderer.setAnimationLoop(null);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      controls.removeEventListener("start", onControlStart);
      controls.dispose();
      if (sandbox) disposeSandbox(sandbox.group);
      ground.geometry.dispose();
      ground.material.dispose();
      scene.environment?.dispose();
      pmrem.dispose();
      composer.dispose();
      ao.dispose();
      renderer.dispose();
    },
  };
}
