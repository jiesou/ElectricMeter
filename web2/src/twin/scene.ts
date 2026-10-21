import {
  ACESFilmicToneMapping, Color, DirectionalLight, Fog, HalfFloatType, HemisphereLight, InstancedMesh, MathUtils, Mesh, MeshStandardMaterial, PCFShadowMap,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene as ThreeScene, Spherical, Vector3, WebGLRenderer, WebGLRenderTarget,
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
  focusRoom(): void;
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

export function createScene(canvas: HTMLCanvasElement): Scene {
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
  scene.background = new Color(0x292725);
  scene.fog = new Fog(0x292725, 75, 180);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;

  // 傍晚的光：暖色主光投影、天光补暗部，压得略暗一点，台灯和琥珀光才显得出来
  scene.add(new HemisphereLight(0xdce5ed, 0x504131, 0.6));
  const sun = new DirectionalLight(0xffd3a5, 2.5);
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
  const ground = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ color: 0x191b1b, roughness: 1 }));
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

  /** 镜头退到刚好装下整张台面，主光阴影也框住台面 */
  function frame(width: number, depth: number) {
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
    controls.target.copy(target);
    camera.position.copy(direction.multiplyScalar(distance * 1.12)).add(target);
    controls.minDistance = 10;
    controls.maxDistance = distance * 1.6;

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

  function applyRooms(rooms: Room[], status: RoomStatus) {
    const next = layoutKey(rooms);
    if (next !== key) {
      key = next;
      rebuild(rooms);
    }
    for (const room of rooms) paint(sandbox!.views.get(room.id)!, room, status === "live");
  }

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
    if (sandbox) frame(sandbox.width, sandbox.depth);
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
    controls.update();
    composer.render();
  };
  const onVisibility = () => renderer.setAnimationLoop(document.hidden ? null : loop);
  document.addEventListener("visibilitychange", onVisibility);
  onVisibility();

  return {
    applyRooms,
    resetView() {
      if (sandbox) frame(sandbox.width, sandbox.depth);
    },
    focusRoom() {
      if (!sandbox?.room) return;
      const { position, facing } = sandbox.room;
      controls.target.copy(position).add(new Vector3(facing * 0.6, 0, facing * 0.5));
      const distance = camera.aspect < 1 ? 1 / camera.aspect : 1;
      camera.position.copy(controls.target).add(new Vector3(4, 11.5, -facing * 6.2).multiplyScalar(distance));
      controls.update();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
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
