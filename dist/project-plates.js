// The camera and plate matrices come from the pinned Spline runtime.
export async function attachProjectPlates({ application, canvas, hero, links, runtimeBase }) {
  const [three, splineThree] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.min.js"),
    import(runtimeBase + "runtime-chunk-KPOUV3HD.js"),
  ]);
  const { Fc: Vector2, Pe: Raycaster } = splineThree;
  const clones = application._scene.getObjectByName("Squares Clones");
  const plates = clones.children.map(clone => clone.getObjectByName("Squares")).filter(Boolean);
  const projects = await Promise.all(Array.from(links, async link => {
    const image = new Image();
    image.src = link.dataset.cover;
    await image.decode();
    const texture = new three.Texture(image);
    texture.colorSpace = three.SRGBColorSpace;
    // The Spline plate's local axes point opposite to the artwork's display axes.
    texture.repeat.set(-1, -1);
    texture.offset.set(1, 1);
    texture.needsUpdate = true;
    const material = new three.MeshBasicMaterial({ map: texture, toneMapped: false });
    return { href: link.href, texture, material };
  }));

  // Render only the photos and use the actual plates as invisible depth masks.
  const renderer = new three.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.domElement.className = "project-render";
  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;
  const gpuToGl = new three.Matrix4().set(
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 2, -1,
    0, 0, 0, 1,
  );

  const depthMaterial = new three.MeshBasicMaterial({ colorWrite: false, side: three.DoubleSide });
  const depthGeometries = new Map();
  const depthPlates = plates.map(plate => {
    let geometry = depthGeometries.get(plate.geometry);
    if (!geometry) {
      geometry = new three.BufferGeometry();
      geometry.setAttribute("position", plate.geometry.getAttribute("position"));
      geometry.setIndex(plate.geometry.index);
      depthGeometries.set(plate.geometry, geometry);
    }
    const mesh = new three.Mesh(geometry, depthMaterial);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    scene.add(mesh);
    return { plate, mesh };
  });

  const faceLinks = new Map();
  const coverGeometries = new Map();
  const covers = plates.map((plate, index) => {
    const { href, material } = projects[(index + 12) % projects.length];
    let geometry = coverGeometries.get(plate.geometry);
    if (!geometry) {
      plate.geometry.computeBoundingBox();
      const { min, max } = plate.geometry.boundingBox;
      geometry = new three.PlaneGeometry((max.x - min.x) * 0.88, (max.y - min.y) * 0.88);
      geometry.rotateY(Math.PI);
      geometry.translate((min.x + max.x) / 2, (min.y + max.y) / 2, min.z - 0.7);
      coverGeometries.set(plate.geometry, geometry);
    }
    const mesh = new three.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    faceLinks.set(plate, href);
    return { plate, mesh };
  });

  function draw() {
    const sourceCamera = application._camera;
    camera.matrixWorld.copy(sourceCamera.matrixWorld);
    camera.matrixWorldInverse.copy(sourceCamera.matrixWorldInverse);
    camera.projectionMatrix.copy(sourceCamera.projectionMatrix);
    if (sourceCamera.coordinateSystem === three.WebGPUCoordinateSystem) {
      camera.projectionMatrix.premultiply(gpuToGl);
    }
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    for (const { plate, mesh } of depthPlates) mesh.matrix.copy(plate.matrixWorld);
    for (const { plate, mesh } of covers) mesh.matrix.copy(plate.matrixWorld);
    renderer.render(scene, camera);
  }

  const raycaster = new Raycaster();
  const point = new Vector2();
  const events = new AbortController();
  const eventOptions = { signal: events.signal };
  let pressed;

  function projectAt(event) {
    if (event.target.closest("a, button, input, summary, .project-index nav")) return;
    const rect = canvas.getBoundingClientRect();
    point.set(
      2 * (event.clientX - rect.left) / rect.width - 1,
      1 - 2 * (event.clientY - rect.top) / rect.height,
    );
    raycaster.setFromCamera(point, application._camera);
    const [hit] = raycaster.intersectObjects(plates, false);
    return hit?.face?.normal.z < -0.9 ? faceLinks.get(hit.object) : undefined;
  }

  canvas.insertAdjacentElement("afterend", renderer.domElement);
  canvas.addEventListener("rendered", draw, eventOptions);
  draw();

  hero.addEventListener("pointermove", event => {
    if (event.pointerType !== "touch") {
      hero.toggleAttribute("data-project-hover", Boolean(projectAt(event)));
    }
  }, eventOptions);

  hero.addEventListener("pointerleave", () => {
    hero.removeAttribute("data-project-hover");
  }, eventOptions);

  hero.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    const href = projectAt(event);
    pressed = href ? { href, x: event.clientX, y: event.clientY } : undefined;
  }, eventOptions);

  hero.addEventListener("pointercancel", () => { pressed = undefined; }, eventOptions);

  hero.addEventListener("click", event => {
    const press = pressed;
    pressed = undefined;
    if (!press || event.defaultPrevented || event.target.closest("a, button, input, summary, .project-index nav")) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) return;

    if (event.metaKey || event.ctrlKey) window.open(press.href, "_blank", "noopener");
    else window.location.assign(press.href);
  }, eventOptions);

  return () => {
    events.abort();
    hero.removeAttribute("data-project-hover");
    renderer.domElement.remove();
    for (const geometry of depthGeometries.values()) geometry.dispose();
    depthMaterial.dispose();
    for (const geometry of coverGeometries.values()) geometry.dispose();
    for (const { material, texture } of projects) {
      material.dispose();
      texture.dispose();
    }
    renderer.dispose();
  };
}
