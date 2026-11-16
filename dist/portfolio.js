const hero = document.querySelector(".hero");
const scene = hero.querySelector(".scene");
const surface = hero.querySelector(".scene-surface");
const poster = hero.querySelector(".scene-poster");
const projectIndex = hero.querySelector(".project-index");
const projectLinks = projectIndex.querySelectorAll("[data-cover]");
const tools = hero.querySelector(".hero-tools");
const motionButton = hero.querySelector(".motion-tool");
const sceneUrl = "https://prod.spline.design/QzFYO-pwcQCbiF9t/scene.splinecode";
const runtimeBase = "https://cdn.jsdelivr.net/npm/@splinetool/runtime@2.0.170/build/";
// This module is the timeline clock shared by the pinned Spline runtime and its transitions.
const timelineModule = "runtime-chunk-GGSUJEGZ.js";
const maxScrollBoost = 32;
const maxScrollImpulse = 16;
const scrollPixelsPerBoost = 11.25;
const scrollDecayMs = 780;
let application;
let timelineClock;
let sceneFailed = false;
let loading = false;
let wantsMotion = true;
let scrollBoost = 0;
let lastFrame;
let frameRequest;
let posterRate = 1;

// Resize the presentation, keeping the WebGL canvas and camera at a fixed aspect ratio.
const stageWidth = surface.clientWidth;
const stageHeight = surface.clientHeight;
new ResizeObserver(([{ contentRect }]) => {
  const { width, height } = contentRect;
  if (!width || !height) return;
  const portrait = Math.min(1, Math.max(0, (1.6 - width / height) / 1.12));
  const scale = 1.24 * Math.max(width / stageWidth, height / stageHeight);
  const focusX = .55 + .17 * portrait;
  const x = width / 2 - stageWidth * scale * focusX;
  const y = -height * (.055 + .035 * portrait);
  surface.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}).observe(scene);

function advanceMotion(timestamp) {
  const elapsed = lastFrame === undefined ? 0 : Math.min(timestamp - lastFrame, 50);
  lastFrame = timestamp;
  const rate = 1 + scrollBoost;
  timelineClock?.update(elapsed * rate);

  if (!application && rate !== posterRate) {
    for (const animation of poster.getAnimations({ subtree: true })) {
      animation.updatePlaybackRate(rate);
    }
    posterRate = rate;
  }

  scrollBoost *= Math.exp(-elapsed / scrollDecayMs);
  if (scrollBoost < 0.01) scrollBoost = 0;
  frameRequest = requestAnimationFrame(advanceMotion);
}

function accelerate(pixels) {
  if (!wantsMotion || !pixels) return;

  const impulse = Math.min(maxScrollImpulse, Math.abs(pixels) / scrollPixelsPerBoost);
  const directBoost = Math.min(impulse, Math.max(0, maxScrollImpulse - scrollBoost));
  scrollBoost += directBoost;

  // Taper added speed at high rates so consecutive inputs can still build on each other.
  const extraImpulse = impulse - directBoost;
  const headroom = maxScrollBoost - scrollBoost;
  scrollBoost += headroom * (1 - Math.exp(-extraImpulse / maxScrollImpulse));
}

function syncPlayback() {
  const playing = wantsMotion && !document.hidden;
  scene.dataset.playing = String(playing);
  motionButton.dataset.playing = String(wantsMotion);
  motionButton.setAttribute(
    "aria-label",
    wantsMotion ? "Mettre l’animation en pause" : "Lancer l’animation",
  );
  if (playing) {
    application?.play();
    frameRequest ??= requestAnimationFrame(advanceMotion);
  } else {
    application?.stop();
    if (frameRequest !== undefined) cancelAnimationFrame(frameRequest);
    frameRequest = undefined;
    lastFrame = undefined;
    scrollBoost = 0;
  }
}

async function loadScene() {
  if (!wantsMotion || loading || application || sceneFailed || document.hidden) return;

  loading = true;

  const canvas = document.createElement("canvas");
  surface.replaceChildren(canvas);
  let nextApplication;
  let detachProjectPlates;

  try {
    const [{ Application }, { a: clock }, { attachProjectPlates }] = await Promise.all([
      import(runtimeBase + "runtime.js"),
      import(runtimeBase + timelineModule),
      import("./project-plates.js"),
    ]);
    clock.isUsingInternalRaf = false;
    nextApplication = new Application(canvas);
    await nextApplication.load(sceneUrl);
    detachProjectPlates = await attachProjectPlates({
      application: nextApplication,
      canvas,
      hero,
      links: projectLinks,
      runtimeBase,
    });
    application = nextApplication;
    timelineClock = clock;
    const restorePoster = () => {
      if (application !== nextApplication) return;
      scene.removeAttribute("data-ready");
      sceneFailed = true;
      application = undefined;
      timelineClock = undefined;
      detachProjectPlates();
      poster.inert = false;
      nextApplication.dispose();
      surface.replaceChildren();
    };
    canvas.addEventListener("webglcontextlost", restorePoster, { once: true });
    surface.querySelector(".project-render").addEventListener("webglcontextlost", restorePoster, { once: true });
    poster.inert = true;
    scene.setAttribute("data-ready", "");
    syncPlayback();
  } catch (error) {
    sceneFailed = true;
    application = undefined;
    timelineClock = undefined;
    scene.removeAttribute("data-ready");
    detachProjectPlates?.();
    poster.inert = false;
    nextApplication?.dispose();
    surface.replaceChildren();
    console.warn("La scène Spline est indisponible.", error);
  } finally {
    loading = false;
  }
}

tools.hidden = false;
motionButton.addEventListener("click", () => {
  wantsMotion = !wantsMotion;
  if (wantsMotion) sceneFailed = false;
  syncPlayback();
  loadScene();
});

document.addEventListener("visibilitychange", () => {
  syncPlayback();
  loadScene();
});

window.addEventListener("wheel", (event) => {
  if (event.ctrlKey || projectIndex.contains(event.target)) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? hero.clientHeight : 1;
  accelerate(event.deltaY * unit);
}, { passive: true });

let touchY;
hero.addEventListener("touchstart", (event) => {
  touchY = event.touches.length === 1 && !projectIndex.contains(event.target)
    ? event.touches[0].clientY
    : undefined;
}, { passive: true });

hero.addEventListener("touchmove", (event) => {
  if (touchY === undefined || event.touches.length !== 1) return;
  const nextY = event.touches[0].clientY;
  accelerate(nextY - touchY);
  touchY = nextY;
}, { passive: true });

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof Element && event.target.closest("a, button, input, .project-index")) return;
  if (!["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "].includes(event.key)) return;
  event.preventDefault();
  accelerate(event.key.startsWith("Arrow") ? 65 : 180);
});

document.addEventListener("click", event => {
  if (projectIndex.open && !projectIndex.contains(event.target)) projectIndex.open = false;
});

projectIndex.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !projectIndex.open) return;
  projectIndex.open = false;
  projectIndex.querySelector("summary").focus();
});

syncPlayback();
loadScene();

const image = hero.querySelector(".hero-image");
const imageSource = image.dataset.src.trim();

if (imageSource) {
  image.addEventListener("load", () => { image.hidden = false; }, { once: true });
  image.src = imageSource;
}
