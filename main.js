import { createExhibit } from "./exhibit.js";
import { loadImage } from "./splat.js";
import front from "./assets/front.webp";
import base from "./assets/front-base.webp";
import rear from "./assets/rear.webp";
import shoulder from "./assets/shoulder.webp";
import right from "./assets/right.webp";
import left from "./assets/left.webp";
import roof from "./assets/roof.webp";
import bottom from "./assets/bottom.webp";
import rearDetail from "./assets/rear-detail.webp";
import prompts from "./assets/generation-prompts.txt";

const stage = document.getElementById("stage");
const canvas = document.getElementById("artifact");
const fallback = document.getElementById("fallback");
const status = document.getElementById("stage-status");
const modeLabel = document.getElementById("mode-label");
const angle = document.getElementById("angle");
const angleValue = document.getElementById("angle-value");
const inspect = document.getElementById("inspect");
const inspectLabel = document.getElementById("inspect-label");
const presets = [...document.querySelectorAll("[data-angle]")];
const zoomButtons = [...document.querySelectorAll("[data-zoom]")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const fullAim = 1.65;
const state = { yaw: 22, pitch: 15, zoom: 1, aim: fullAim };
const target = { ...state };
const zoomRange = [.75, 1.75];
const staticViews = [
  { url: front, label: "正面", alt: "Macintosh 128K 正面复原图" },
  { url: right, label: "右侧", alt: "Macintosh 128K 右侧复原图" },
  { url: rearDetail, label: "背面", alt: "Macintosh 128K 背面复原图，显示铭牌、电源和底部接口" },
  { url: left, label: "左侧", alt: "Macintosh 128K 左侧复原图" },
];
let exhibit;
let ready = false;
let frame = 0;
let drag;
let detail = false;
let sliderAtEnd = false;
let currentStatic = -1;
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
const circle = (degrees) => ((degrees % 360) + 360) % 360;
const closestYaw = (goal, from) => from + circle(goal - from + 180) - 180;
const frameKeys = Object.keys(state);

for (const [i, prompt] of prompts.trim().split("\n\n").entries()) {
  const label = document.createElement("p");
  label.textContent = i ? "背面特写 · 内置 GPT Image" : "六视角素材 · 内置 GPT Image";
  const text = document.createElement("pre");
  text.textContent = prompt;
  document.getElementById("prompts").append(label, text);
}

function updateUI() {
  const degrees = sliderAtEnd ? 360 : Math.round(circle(state.yaw)) % 360;
  const direction = Math.round(degrees / 90) % 4;
  angle.value = String(degrees);
  angle.setAttribute("aria-valuetext", degrees + "°，" + staticViews[direction].label);
  angleValue.value = String(degrees).padStart(3, "0") + "°";
  for (const [i, button] of presets.entries()) button.setAttribute("aria-pressed", String(i === direction));
  for (const button of zoomButtons) {
    const bound = Number(button.dataset.zoom) < 0 ? zoomRange[0] : zoomRange[1];
    button.disabled = !ready || Math.abs(target.zoom - bound) < .001;
  }
  inspectLabel.textContent = detail ? "返回整机" : "放大背面";
  if (!exhibit && ready) {
    if (currentStatic !== direction) {
      currentStatic = direction;
      fallback.src = staticViews[direction].url;
      fallback.alt = staticViews[direction].alt;
    }
    fallback.style.transform = "translateX(-50%) scale(" + state.zoom + ")";
  }
}

function paint() {
  frame = 0;
  let moving = false;
  for (const key of frameKeys) {
    const remaining = target[key] - state[key];
    const snap = drag || reduced.matches || !exhibit || Math.abs(remaining) < .008;
    state[key] = snap ? target[key] : state[key] + remaining * .26;
    moving ||= !snap;
  }
  if (!moving && !drag && Math.abs(state.yaw) >= 720) state.yaw = target.yaw = circle(state.yaw);
  exhibit?.draw(state);
  updateUI();
  if (moving) schedule();
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(paint);
}
function set(next) {
  Object.assign(target, next);
  schedule();
}
function wholeView(degrees) {
  detail = false;
  sliderAtEnd = false;
  set({ yaw: closestYaw(degrees, state.yaw), pitch: degrees === 180 ? 8 : 13, zoom: 1, aim: fullAim });
}
function setZoom(delta) {
  set({ zoom: clamp(target.zoom + delta * .2, ...zoomRange) });
}

for (const button of presets) button.addEventListener("click", () => wholeView(Number(button.dataset.angle)));
for (const button of zoomButtons) button.addEventListener("click", () => setZoom(Number(button.dataset.zoom)));
angle.addEventListener("input", () => {
  const requested = angle.valueAsNumber;
  sliderAtEnd = requested === 360;
  detail = false;
  target.aim = fullAim;
  state.yaw = target.yaw = closestYaw(requested, state.yaw);
  schedule();
});
inspect.addEventListener("click", () => {
  if (detail) return wholeView(180);
  detail = true;
  sliderAtEnd = false;
  set({ yaw: closestYaw(180, state.yaw), pitch: 4, zoom: stage.clientWidth < 620 ? 1.36 : 1.58, aim: 1.05 });
  if (matchMedia("(max-width: 720px)").matches) stage.scrollIntoView({ block: "nearest" });
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || drag) return;
  canvas.setPointerCapture(event.pointerId);
  Object.assign(target, state);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: state.yaw, pitch: state.pitch };
});
canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== drag?.id) return;
  sliderAtEnd = false;
  if (detail) {
    detail = false;
    target.aim = fullAim;
    target.zoom = 1;
  }
  set({ yaw: drag.yaw - (event.clientX - drag.x) * .55, pitch: clamp(drag.pitch + (event.clientY - drag.y) * .27, 3, 63) });
});
function finishDrag(event) {
  if (event.pointerId === drag?.id) drag = undefined;
}
canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointercancel", finishDrag);
canvas.addEventListener("lostpointercapture", finishDrag);
canvas.addEventListener("keydown", (event) => {
  const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 1, ArrowDown: -1 }[event.key];
  if (event.key !== "Home" && !direction) return;
  event.preventDefault();
  sliderAtEnd = false;
  if (event.key === "Home") wholeView(0);
  else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    if (detail) set({ aim: fullAim, zoom: 1 });
    detail = false;
    set({ yaw: target.yaw + direction * (event.shiftKey ? 45 : 15) });
  } else set({ pitch: clamp(target.pitch + direction * 8, 3, 63) });
});

function resize() {
  exhibit?.resize(stage.clientWidth, stage.clientHeight);
  schedule();
}
function showFallback() {
  exhibit = undefined;
  canvas.hidden = true;
  fallback.hidden = false;
  modeLabel.textContent = "复原图";
  status.dataset.fallback = "true";
  status.textContent = "3D 视图不可用。可用下方按钮查看四面。";
  document.querySelector(".stage-hint").hidden = true;
  schedule();
}
async function start() {
  try {
    const urls = { front, base, rear, shoulder, right, left, roof, bottom };
    const images = Object.fromEntries(await Promise.all(Object.entries(urls).map(async ([key, url]) => [key, await loadImage(url)])));
    exhibit = createExhibit(canvas, images);
    canvas.hidden = false;
    status.textContent = "";
    resize();
    new ResizeObserver(resize).observe(stage);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      showFallback();
    });
  } catch {
    showFallback();
  }
  ready = true;
  angle.disabled = false;
  inspect.disabled = false;
  for (const button of presets) button.disabled = false;
  schedule();
}
start();
