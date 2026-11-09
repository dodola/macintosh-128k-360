import * as THREE from "three";
import calibration from "./assets/calibration.json";
import { splatSurface } from "./splat.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const { width: widthOfMac, profile } = calibration;
const half = widthOfMac / 2;
const handle = .425;
const roofCut = .14;
const [frontTop, roofBack, shoulderBottom, rearBase, frontBase, step, nose] = profile;

export function createExhibit(canvas, images) {
  const context = canvas.getContext("webgl2", { alpha: false, antialias: true });
  if (!context) throw new Error("WebGL 2 unavailable");
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#243731");
  scene.fog = new THREE.Fog("#263a33", 7, 23);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 80);
  scene.add(new THREE.HemisphereLight("#fff7df", "#a3976b", 2.03));
  const key = new THREE.DirectionalLight("#fff2d8", 1.92);
  key.position.set(-3, 7, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#c1d1bc", .63);
  fill.position.set(4, 4, -5);
  scene.add(fill);

  function mesh(geometry, material, x = 0, y = 0, z = 0) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    scene.add(part);
    return part;
  }
  function finish(color, roughness = .82) {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }

  const floorMaterial = finish("#31473d");
  const floor = mesh(new THREE.PlaneGeometry(160, 160), floorMaterial, 0, -.12, 0);
  floor.rotation.x = -Math.PI / 2;
  mesh(new THREE.CylinderGeometry(2.17, 2.22, .105, 96), finish("#536154"), 0, -.05, 0);
  const rim = mesh(new THREE.TorusGeometry(2.08, .006, 5, 112), finish("#798575"), 0, .009, 0);
  rim.rotation.x = -Math.PI / 2;

  const shadowCanvas = Object.assign(document.createElement("canvas"), { width: 256, height: 256 });
  const shadowContext = shadowCanvas.getContext("2d");
  const gradient = shadowContext.createRadialGradient(128, 128, 26, 128, 128, 126);
  gradient.addColorStop(0, "#101713d9");
  gradient.addColorStop(.52, "#101713ad");
  gradient.addColorStop(.75, "#10171365");
  gradient.addColorStop(1, "#10171300");
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 256, 256);
  const shadow = mesh(new THREE.PlaneGeometry(3.92, 3.72), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false,
  }), .13, .014, -.15);
  shadow.rotation.x = -Math.PI / 2;

  const bodyMaterial = finish("#a79270");
  function shellSlice(section, x1, x2) {
    const outline = new THREE.Shape();
    for (const [i, [z, y]] of section.entries()) {
      if (!i) outline.moveTo(z, y);
      else outline.lineTo(z, y);
    }
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: x2 - x1, bevelEnabled: false });
    geometry.applyMatrix4(new THREE.Matrix4().set(
      0, 0, -1, x2,
      0, 1, 0, 0,
      1, 0, 0, 0,
      0, 0, 0, 1,
    ));
    geometry.scale(.995, .997, .99);
    mesh(geometry, bodyMaterial);
  }
  const inset = (from, to, fraction) => from + (to - from) * fraction;
  const roofBreak = [inset(frontTop[0], roofBack[0], 1 - roofCut), inset(frontTop[1], roofBack[1], 1 - roofCut)];
  const pocketWall = [-.57, 3.02];
  const shoulderFront = [inset(nose[0], frontTop[0], (shoulderBottom[1] - nose[1]) / (frontTop[1] - nose[1])), shoulderBottom[1]];
  shellSlice([shoulderFront, shoulderBottom, rearBase, frontBase, step, nose], -half + .009, half - .009);
  const upperSides = [frontTop, roofBack, shoulderBottom, shoulderFront];
  shellSlice(upperSides, -half + .009, -handle);
  shellSlice(upperSides, handle, half - .009);
  shellSlice([frontTop, roofBreak, pocketWall, shoulderBottom, shoulderFront], -handle, handle);

  const surfaces = [];
  const xyz = (x, [z, y]) => V(x, y, z);
  const add = (image, bl, br, tl, tr, gain = 1, uv = [0, 0, 1, 1]) => {
    surfaces.push(splatSurface(scene, images[image], bl, br, tl, tr, gain, uv));
  };
  const face = (image, bottom, top, rear = false) => {
    const direction = rear ? -1 : 1;
    const offset = ([z, y]) => [z + direction * .008, y];
    add(image, xyz(-direction * half, offset(bottom)), xyz(direction * half, offset(bottom)),
      xyz(-direction * half, offset(top)), xyz(direction * half, offset(top)));
  };
  face("front", nose, frontTop);
  face("base", frontBase, step);
  face("rear", rearBase, shoulderBottom, true);

  function sides(frontToBack, right) {
    const x = (right ? 1 : -1) * half;
    const [low, high] = frontToBack;
    add(right ? "right" : "left", V(x, .10, low), V(x, .10, high), V(x, 3.49, low), V(x, 3.49, high), right ? .93 : 1);
  }
  sides([1.43, -1.37], true);
  sides([-1.37, 1.43], false);

  const portion = (handle + half) / widthOfMac;
  const cut = 1 - portion;
  function shoulder(xLeft, xRight, top, region) {
    add("shoulder", xyz(xLeft, [-1.376, 2.81]), xyz(xRight, [-1.376, 2.81]),
      xyz(xLeft, [top[0] - .007, top[1] + .007]), xyz(xRight, [top[0] - .007, top[1] + .007]), 1, region);
  }
  shoulder(half, handle, roofBack, [0, 0, cut, 1]);
  shoulder(handle, -handle, pocketWall, [cut, 0, portion, 1]);
  shoulder(-handle, -half, roofBack, [portion, 0, 1, 1]);
  function roof(xLeft, xRight, top, region) {
    add("roof", xyz(xLeft, [frontTop[0], frontTop[1] + .007]), xyz(xRight, [frontTop[0], frontTop[1] + .007]),
      xyz(xLeft, [top[0], top[1] + .007]), xyz(xRight, [top[0], top[1] + .007]), 1.01, region);
  }
  roof(-half, -handle, roofBack, [0, 0, cut, 1]);
  roof(-handle, handle, roofBreak, [cut, 0, portion, 1 - roofCut]);
  roof(handle, half, roofBack, [portion, 0, 1, 1]);
  const handleBar = mesh(new THREE.BoxGeometry(.83, .081, .144), finish("#b19a72"),
    0, 3.245, -.89);
  handleBar.rotation.x = -.1;
  add("bottom", V(-half, .095, -1.37), V(half, .095, -1.37), V(-half, .095, 1.17), V(half, .095, 1.17), .91);
  for (const x of [-.91, .91]) {
    for (const z of [-1.09, .91]) {
      mesh(new THREE.CylinderGeometry(.107, .095, .103, 20), finish("#3d3b32"), x, .057, z);
    }
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    const density = Math.max(26, Math.min(47, Math.round(width / 12)));
    for (const update of surfaces) update(density);
  }
  function draw({ yaw, pitch, zoom, aim }) {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const extent = Math.max(4.96, 3.70 / camera.aspect);
    const radius = extent / (2 * Math.tan(fov / 2) * zoom);
    const elevation = THREE.MathUtils.degToRad(pitch);
    const azimuth = THREE.MathUtils.degToRad(yaw);
    const lateral = radius * Math.cos(elevation);
    camera.position.set(lateral * Math.sin(azimuth), aim + radius * Math.sin(elevation), lateral * Math.cos(azimuth));
    camera.lookAt(0, aim, 0);
    renderer.render(scene, camera);
  }
  return { resize, draw };
}
