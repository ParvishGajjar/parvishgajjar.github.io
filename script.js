const revealNodes = document.querySelectorAll("[data-reveal]");
const navLinks = document.querySelectorAll(".site-nav a");
const sections = document.querySelectorAll("main section[id]");
const header = document.querySelector(".site-header");
const yearNode = document.getElementById("year");
const portraitFrame = document.querySelector(".portrait-frame");
const heroCanvas = document.getElementById("hero-canvas");
const toolCards = Array.from(document.querySelectorAll(".tool-card[data-scene-tone]"));
const pathItems = Array.from(document.querySelectorAll(".path-item"));
const toolkitSection = document.getElementById("toolkit");
const pathSection = document.getElementById("path");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const sceneUI = {
  hoveredTool: null,
  activePathIndex: -1,
  scrollProgress: 0,
  toolkitProgress: 0,
  pathProgress: 0
};

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
  );

  revealNodes.forEach((node) => revealObserver.observe(node));

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const id = entry.target.getAttribute("id");
        const href = `#${id}`;
        const hasNavLink = Array.from(navLinks).some((link) => link.getAttribute("href") === href);

        if (!hasNavLink) {
          return;
        }

        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === href);
        });
      });
    },
    { threshold: 0.4 }
  );

  sections.forEach((section) => sectionObserver.observe(section));
} else {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
}

const updateHeaderState = () => {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 24);
};

updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });

const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (portraitFrame && supportsHover && !reduceMotion) {
  const maxTilt = 6;
  let frameRect = null;
  let rafId = null;

  const refreshRect = () => {
    frameRect = portraitFrame.getBoundingClientRect();
  };

  const onMove = (event) => {
    if (!frameRect) {
      refreshRect();
    }

    const relX = (event.clientX - frameRect.left) / frameRect.width;
    const relY = (event.clientY - frameRect.top) / frameRect.height;
    const tiltX = (0.5 - relY) * maxTilt;
    const tiltY = (relX - 0.5) * maxTilt;

    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      portraitFrame.style.transform =
        `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-2px)`;
    });
  };

  const onLeave = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    portraitFrame.style.transform = "";
    frameRect = null;
  };

  portraitFrame.addEventListener("mouseenter", refreshRect);
  portraitFrame.addEventListener("mousemove", onMove);
  portraitFrame.addEventListener("mouseleave", onLeave);
  window.addEventListener("resize", refreshRect, { passive: true });
}

const setHoveredTool = (toolKey) => {
  sceneUI.hoveredTool = toolKey;
  toolCards.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.sceneTone === toolKey);
  });
};

toolCards.forEach((card) => {
  const toolKey = card.dataset.sceneTone;
  card.addEventListener("mouseenter", () => setHoveredTool(toolKey));
  card.addEventListener("mouseleave", () => setHoveredTool(null));
  card.addEventListener("focusin", () => setHoveredTool(toolKey));
  card.addEventListener("focusout", (event) => {
    if (!card.contains(event.relatedTarget)) {
      setHoveredTool(null);
    }
  });
});

const setActivePathIndex = (index) => {
  sceneUI.activePathIndex = index;
  pathItems.forEach((item, itemIndex) => {
    item.classList.toggle("is-active", itemIndex === index);
  });
};

if (pathItems.length && "IntersectionObserver" in window) {
  const pathVisibility = new Map();
  const pathObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const index = pathItems.indexOf(entry.target);
        if (index >= 0) {
          pathVisibility.set(index, entry);
        }
      });

      let nextIndex = -1;
      let bestRatio = 0;
      pathVisibility.forEach((entry, index) => {
        if (entry.isIntersecting && entry.intersectionRatio >= bestRatio) {
          nextIndex = index;
          bestRatio = entry.intersectionRatio;
        }
      });

      setActivePathIndex(nextIndex);
    },
    {
      threshold: [0.22, 0.38, 0.55, 0.72],
      rootMargin: "-10% 0px -28% 0px"
    }
  );

  pathItems.forEach((item) => pathObserver.observe(item));
}

const updateSceneProgress = () => {
  const heroBudget = Math.max(window.innerHeight * 0.95, 1);
  const projectSection = (section) => {
    if (!section) {
      return 0;
    }

    const start = section.offsetTop - window.innerHeight * 0.7;
    const end = section.offsetTop + section.offsetHeight * 0.45;
    return clamp((window.scrollY - start) / Math.max(end - start, 1), 0, 1);
  };

  sceneUI.scrollProgress = clamp(window.scrollY / heroBudget, 0, 1.25);
  sceneUI.toolkitProgress = projectSection(toolkitSection);
  sceneUI.pathProgress = projectSection(pathSection);
};

updateSceneProgress();
window.addEventListener("scroll", updateSceneProgress, { passive: true });
window.addEventListener("resize", updateSceneProgress, { passive: true });

// Three.js scene: ribbon spine, toolkit pulses, traveling packets, and a path constellation.
const initHeroScene = () => {
  if (!heroCanvas || reduceMotion || !window.THREE) {
    return;
  }

  const THREE = window.THREE;
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas: heroCanvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
  } catch {
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 2200);
  const root = new THREE.Group();
  const heroGroup = new THREE.Group();
  const haloGroup = new THREE.Group();
  const constellationGroup = new THREE.Group();
  scene.add(root);
  root.add(heroGroup);
  root.add(haloGroup);
  root.add(constellationGroup);

  document.documentElement.dataset.heroScene = "ready";

  const cyan = new THREE.Color(0x6ee7e0);
  const amber = new THREE.Color(0xf4b36a);
  const ivory = new THREE.Color(0xf4f7fa);
  const toolPalette = {
    cloud: { color: new THREE.Color(0x90c9ff), speed: 1.08, spread: 1.05 },
    data: { color: new THREE.Color(0x6ee7e0), speed: 1.0, spread: 1.0 },
    languages: { color: new THREE.Color(0xf4b36a), speed: 1.02, spread: 0.95 },
    ai: { color: new THREE.Color(0x89d8a3), speed: 1.2, spread: 1.1 },
    practice: { color: new THREE.Color(0xf1d8a5), speed: 0.94, spread: 0.86 }
  };

  const ribbonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-260, 60, -250),
    new THREE.Vector3(-176, 86, -184),
    new THREE.Vector3(-94, 92, -130),
    new THREE.Vector3(10, 30, -60),
    new THREE.Vector3(132, -8, -94),
    new THREE.Vector3(260, 34, -206)
  ]);

  const ribbonSampleCount = 180;
  const ribbonLineOffsets = [-0.92, -0.48, 0, 0.48, 0.92];
  const ribbonLines = ribbonLineOffsets.map((offset, index) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ribbonSampleCount * 3), 3));
    const baseColor = index === 2
      ? cyan.clone().lerp(ivory, 0.18)
      : offset < 0
        ? cyan.clone()
        : amber.clone();

    const material = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: index === 2 ? 0.34 : 0.16
    });

    const line = new THREE.Line(geometry, material);
    heroGroup.add(line);
    return { geometry, material, baseColor, offset };
  });

  const ribbonPointCount = 980;
  const ribbonPositions = new Float32Array(ribbonPointCount * 3);
  const ribbonColors = new Float32Array(ribbonPointCount * 3);
  const ribbonSeeds = new Float32Array(ribbonPointCount * 5);

  for (let index = 0; index < ribbonPointCount; index += 1) {
    const t = Math.random();
    const lane = Math.random() * 2 - 1;
    const drift = 0.22 + Math.random() * 0.88;
    const phase = Math.random() * Math.PI * 2;
    const spread = 0.22 + Math.random() * 0.9;
    ribbonSeeds[index * 5] = t;
    ribbonSeeds[index * 5 + 1] = lane;
    ribbonSeeds[index * 5 + 2] = drift;
    ribbonSeeds[index * 5 + 3] = phase;
    ribbonSeeds[index * 5 + 4] = spread;

    const tone = cyan.clone().lerp(amber, t * 0.7 + Math.abs(lane) * 0.12);
    ribbonColors[index * 3] = tone.r;
    ribbonColors[index * 3 + 1] = tone.g;
    ribbonColors[index * 3 + 2] = tone.b;
  }

  const ribbonFieldGeometry = new THREE.BufferGeometry();
  ribbonFieldGeometry.setAttribute("position", new THREE.BufferAttribute(ribbonPositions, 3));
  ribbonFieldGeometry.setAttribute("color", new THREE.BufferAttribute(ribbonColors, 3));

  const ribbonFieldMaterial = new THREE.PointsMaterial({
    size: 2.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.82,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const ribbonField = new THREE.Points(ribbonFieldGeometry, ribbonFieldMaterial);
  heroGroup.add(ribbonField);

  const heroNodeGeometry = new THREE.BufferGeometry();
  const heroNodeCount = 18;
  const heroNodePositions = new Float32Array(heroNodeCount * 3);
  const heroNodeColors = new Float32Array(heroNodeCount * 3);
  for (let index = 0; index < heroNodeCount; index += 1) {
    heroNodeColors[index * 3] = cyan.r;
    heroNodeColors[index * 3 + 1] = cyan.g;
    heroNodeColors[index * 3 + 2] = cyan.b;
  }
  heroNodeGeometry.setAttribute("position", new THREE.BufferAttribute(heroNodePositions, 3));
  heroNodeGeometry.setAttribute("color", new THREE.BufferAttribute(heroNodeColors, 3));

  const heroNodeMaterial = new THREE.PointsMaterial({
    size: 6.4,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.34,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const heroNodes = new THREE.Points(heroNodeGeometry, heroNodeMaterial);
  heroGroup.add(heroNodes);

  const packets = Array.from({ length: 18 }, (_, index) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(index % 4 === 0 ? 2.4 : 1.8, 12, 12),
      new THREE.MeshBasicMaterial({
        color: cyan,
        transparent: true,
        opacity: 0.82
      })
    );

    mesh.scale.setScalar(0.88);
    heroGroup.add(mesh);

    return {
      mesh,
      material: mesh.material,
      baseT: index / 18 + Math.random() * 0.06,
      speed: 0.035 + Math.random() * 0.03,
      lane: (Math.random() * 2 - 1) * 0.18,
      drift: 0.3 + Math.random() * 0.7
    };
  });

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(112, 1.5, 12, 180),
    new THREE.MeshBasicMaterial({
      color: 0x6ee7e0,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide
    })
  );
  halo.rotation.x = 1.22;
  halo.rotation.y = 0.14;
  halo.position.set(92, -4, -94);
  haloGroup.add(halo);

  const orbit = new THREE.Mesh(
    new THREE.RingGeometry(72, 75, 180),
    new THREE.MeshBasicMaterial({
      color: 0xf4b36a,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide
    })
  );
  orbit.rotation.x = 1.15;
  orbit.rotation.z = 0.24;
  orbit.position.set(-136, 64, -174);
  haloGroup.add(orbit);

  const ribbonHalo = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(ribbonCurve.getPoints(140)),
    new THREE.LineBasicMaterial({
      color: 0x6ee7e0,
      transparent: true,
      opacity: 0.08
    })
  );
  haloGroup.add(ribbonHalo);

  const portraitShell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(66, 1)),
    new THREE.LineBasicMaterial({
      color: 0x6ee7e0,
      transparent: true,
      opacity: 0.12
    })
  );
  portraitShell.position.set(128, -18, -122);
  haloGroup.add(portraitShell);

  const constellationCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(205, 110, -190),
    new THREE.Vector3(148, 52, -170),
    new THREE.Vector3(234, -4, -150),
    new THREE.Vector3(178, -88, -190),
    new THREE.Vector3(248, -170, -248)
  ]);

  const constellationLineMaterial = new THREE.LineBasicMaterial({
    color: 0x6ee7e0,
    transparent: true,
    opacity: 0
  });
  const constellationLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(constellationCurve.getPoints(180)),
    constellationLineMaterial
  );
  constellationGroup.add(constellationLine);

  const constellationNodes = pathItems.map((_, index) => {
    const t = pathItems.length > 1 ? 0.08 + index * (0.84 / (pathItems.length - 1)) : 0.5;
    const point = constellationCurve.getPointAt(t);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 14, 14),
      new THREE.MeshBasicMaterial({
        color: 0x6ee7e0,
        transparent: true,
        opacity: 0.05
      })
    );
    mesh.position.copy(point);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 4.9, 48),
      new THREE.MeshBasicMaterial({
        color: 0x6ee7e0,
        transparent: true,
        opacity: 0.02,
        side: THREE.DoubleSide
      })
    );
    ring.position.copy(point);

    constellationGroup.add(mesh);
    constellationGroup.add(ring);

    return { mesh, ring, t };
  });

  const constellationPulse = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 14, 14),
    new THREE.MeshBasicMaterial({
      color: 0xf4b36a,
      transparent: true,
      opacity: 0
    })
  );
  constellationGroup.add(constellationPulse);

  const targetPointer = new THREE.Vector2();
  const currentPointer = new THREE.Vector2();
  const toolInteraction = {
    target: 0,
    current: 0,
    colorCurrent: cyan.clone(),
    colorTarget: cyan.clone(),
    speed: 1,
    spread: 1
  };

  const posePoint = new THREE.Vector3();
  const poseTangent = new THREE.Vector3();
  const poseNormal = new THREE.Vector3();
  const poseBinormal = new THREE.Vector3();
  const offsetVector = new THREE.Vector3();
  const nodeAttr = heroNodeGeometry.getAttribute("position");

  const setPointerTarget = (event) => {
    targetPointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
    targetPointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
  };

  const getCurvePose = (curveRef, t, time, point, normal, binormal) => {
    curveRef.getPointAt(t, point);
    curveRef.getTangentAt(t, poseTangent);
    poseTangent.normalize();

    normal.set(-poseTangent.y, poseTangent.x, 0);
    if (normal.lengthSq() < 0.0001) {
      normal.set(1, 0, 0);
    }
    normal.normalize();

    binormal.crossVectors(poseTangent, normal);
    if (binormal.lengthSq() < 0.0001) {
      binormal.set(0, 0, 1);
    }
    binormal.normalize();

    point.z += Math.sin(time * 1.5 + t * 7.8) * 10 + Math.cos(time * 1.2 + t * 5.1) * 4;
  };

  const setSceneSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 760 ? 420 : 360;
    camera.position.y = width < 760 ? 10 : 0;
    camera.updateProjectionMatrix();

    root.position.set(width < 960 ? 0 : 20, width < 960 ? 24 : -16, -228);
    heroGroup.scale.setScalar(width < 760 ? 0.9 : 1.02);
    haloGroup.scale.setScalar(width < 760 ? 0.9 : 1.05);
    constellationGroup.scale.setScalar(width < 760 ? 0.82 : 1);
    constellationGroup.position.set(width < 760 ? 148 : 0, width < 760 ? 34 : 0, 0);
  };

  setSceneSize();
  window.addEventListener("pointermove", setPointerTarget, { passive: true });
  window.addEventListener("resize", setSceneSize, { passive: true });

  const animate = () => {
    const time = performance.now() * 0.00045;
    currentPointer.lerp(targetPointer, 0.05);

    toolInteraction.target = sceneUI.hoveredTool ? 1 : 0;
    toolInteraction.current += (toolInteraction.target - toolInteraction.current) * 0.08;
    const toneConfig = toolPalette[sceneUI.hoveredTool] || toolPalette.data;
    toolInteraction.colorTarget.copy(toneConfig.color);
    toolInteraction.colorCurrent.lerp(toolInteraction.colorTarget, 0.08);
    toolInteraction.speed += (toneConfig.speed - toolInteraction.speed) * 0.06;
    toolInteraction.spread += (toneConfig.spread - toolInteraction.spread) * 0.06;

    const ribbonWidth = 12 + sceneUI.scrollProgress * 54 + toolInteraction.current * 10 * toolInteraction.spread;
    const ribbonLift = sceneUI.scrollProgress * 14;
    const ribbonAttr = ribbonFieldGeometry.getAttribute("position");
    const ribbonArray = ribbonAttr.array;

    ribbonLines.forEach(({ geometry, material, baseColor, offset }, lineIndex) => {
      const lineArray = geometry.getAttribute("position").array;
      for (let index = 0; index < ribbonSampleCount; index += 1) {
        const t = index / (ribbonSampleCount - 1);
        getCurvePose(ribbonCurve, t, time, posePoint, poseNormal, poseBinormal);

        const lateral = offset * ribbonWidth * (0.42 + Math.abs(offset) * 0.84);
        const wave = Math.sin(time * 2.2 - t * 11 + offset * 2.6) * (4 - Math.abs(offset) * 1.6);
        offsetVector.copy(posePoint)
          .addScaledVector(poseNormal, lateral)
          .addScaledVector(poseBinormal, wave * (1 - sceneUI.scrollProgress * 0.12));

        lineArray[index * 3] = offsetVector.x;
        lineArray[index * 3 + 1] = offsetVector.y - ribbonLift;
        lineArray[index * 3 + 2] = offsetVector.z;
      }

      geometry.getAttribute("position").needsUpdate = true;
      material.opacity = lineIndex === 2
        ? 0.34 - sceneUI.scrollProgress * 0.08 + toolInteraction.current * 0.1
        : 0.16 - sceneUI.scrollProgress * 0.03 + toolInteraction.current * 0.04;
      material.color.copy(baseColor).lerp(toolInteraction.colorCurrent, lineIndex === 2 ? 0.46 * toolInteraction.current : 0.18 * toolInteraction.current);
    });

    for (let index = 0; index < ribbonPointCount; index += 1) {
      const seedIndex = index * 5;
      const t = (ribbonSeeds[seedIndex] + time * 0.018 * ribbonSeeds[seedIndex + 2] * toolInteraction.speed) % 1;
      const lane = ribbonSeeds[seedIndex + 1];
      const phase = ribbonSeeds[seedIndex + 3];
      const spread = ribbonSeeds[seedIndex + 4];

      getCurvePose(ribbonCurve, t, time, posePoint, poseNormal, poseBinormal);
      const lateral = lane * ribbonWidth * (0.16 + spread * 0.68) * (1 + toolInteraction.current * 0.18);
      const flutter =
        Math.sin(time * (1.8 + spread * 0.6) + phase + t * 12) * (4 + spread * 5) +
        Math.cos(time * 1.1 + phase * 0.6) * 2.2;

      offsetVector.copy(posePoint)
        .addScaledVector(poseNormal, lateral)
        .addScaledVector(poseBinormal, flutter);

      ribbonArray[index * 3] = offsetVector.x;
      ribbonArray[index * 3 + 1] = offsetVector.y - ribbonLift;
      ribbonArray[index * 3 + 2] = offsetVector.z;
    }

    ribbonAttr.needsUpdate = true;
    ribbonFieldMaterial.opacity = 0.82 - sceneUI.scrollProgress * 0.16 + toolInteraction.current * 0.05;

    for (let index = 0; index < heroNodeCount; index += 1) {
      const t = 0.06 + index * (0.88 / (heroNodeCount - 1));
      getCurvePose(ribbonCurve, t, time, posePoint, poseNormal, poseBinormal);
      heroNodePositions[index * 3] = posePoint.x;
      heroNodePositions[index * 3 + 1] = posePoint.y - ribbonLift;
      heroNodePositions[index * 3 + 2] = posePoint.z;
    }
    nodeAttr.needsUpdate = true;
    heroNodeMaterial.opacity = 0.34 - sceneUI.scrollProgress * 0.1 + toolInteraction.current * 0.08;

    packets.forEach((packet, index) => {
      const t = (packet.baseT + time * packet.speed * toolInteraction.speed) % 1;
      getCurvePose(ribbonCurve, t, time, posePoint, poseNormal, poseBinormal);

      const lateral = packet.lane * ribbonWidth * 0.18 * (1 + toolInteraction.current * 0.3 * toolInteraction.spread);
      const flutter = Math.sin(time * 3.1 + index * 0.9) * (3 + packet.drift * 2.5);
      offsetVector.copy(posePoint)
        .addScaledVector(poseNormal, lateral)
        .addScaledVector(poseBinormal, flutter);

      packet.mesh.position.copy(offsetVector);
      packet.mesh.position.y -= ribbonLift;
      packet.mesh.scale.setScalar(0.72 + packet.drift * 0.34 + toolInteraction.current * 0.16 + Math.sin(time * 5 + index) * 0.05);
      packet.material.opacity = 0.42 + toolInteraction.current * 0.28;
      packet.material.color.copy(toolInteraction.colorCurrent).lerp(index % 3 === 0 ? amber : ivory, 0.18);
    });

    heroGroup.rotation.x = -0.74 + currentPointer.y * 0.1;
    heroGroup.rotation.y = 0.18 + currentPointer.x * 0.14;
    heroGroup.rotation.z = currentPointer.x * 0.03 - sceneUI.scrollProgress * 0.06;
    heroGroup.position.x = -8 + currentPointer.x * 8 + sceneUI.toolkitProgress * 6;
    heroGroup.position.y = -30 - sceneUI.scrollProgress * 12;

    halo.rotation.z = time * 0.36;
    halo.rotation.x = 1.18 + currentPointer.y * 0.04;
    halo.material.color.copy(cyan).lerp(toolInteraction.colorCurrent, 0.28 * toolInteraction.current);
    orbit.rotation.z = 0.24 - time * 0.24;
    orbit.material.color.copy(amber).lerp(toolInteraction.colorCurrent, 0.14 * toolInteraction.current);
    ribbonHalo.rotation.z = time * 0.06 - currentPointer.x * 0.08;
    ribbonHalo.scale.setScalar(1 + sceneUI.scrollProgress * 0.08 + toolInteraction.current * 0.06);
    ribbonHalo.material.color.copy(cyan).lerp(toolInteraction.colorCurrent, 0.24 * toolInteraction.current);
    portraitShell.rotation.y = time * 0.22 + currentPointer.x * 0.28;
    portraitShell.rotation.x = -0.24 + currentPointer.y * 0.12;
    portraitShell.rotation.z = time * 0.08;
    haloGroup.position.x = currentPointer.x * 12;
    haloGroup.position.y = currentPointer.y * 6 + sceneUI.scrollProgress * 4;

    const pathReveal = sceneUI.pathProgress;
    const pathIndex = sceneUI.activePathIndex >= 0
      ? sceneUI.activePathIndex
      : Math.round(pathReveal * Math.max(pathItems.length - 1, 0));

    constellationGroup.visible = pathReveal > 0.01 || pathIndex >= 0;
    constellationGroup.position.x = (window.innerWidth < 760 ? 122 : 0) + (1 - pathReveal) * 40;
    constellationGroup.position.y = (window.innerWidth < 760 ? 28 : 0) + (1 - pathReveal) * 20;
    constellationGroup.rotation.z = 0.18 - pathReveal * 0.06;
    constellationLineMaterial.opacity = 0.02 + pathReveal * 0.16;

    constellationNodes.forEach((node, index) => {
      const isActive = index === pathIndex;
      const isPassed = pathIndex > index;
      const strength = isActive ? 1 : isPassed ? 0.54 : 0.12;
      const nodeColor = isActive ? amber : isPassed ? cyan.clone().lerp(amber, 0.15) : cyan;

      node.mesh.material.color.copy(nodeColor);
      node.mesh.material.opacity = pathReveal * (0.08 + strength * 0.58);
      node.mesh.scale.setScalar(0.72 + strength * 0.82 + Math.sin(time * 4 + index) * 0.04);

      node.ring.material.color.copy(nodeColor);
      node.ring.material.opacity = pathReveal * (isActive ? 0.26 : isPassed ? 0.08 : 0.02);
      node.ring.scale.setScalar(1.04 + strength * 0.58 + (isActive ? Math.sin(time * 5.4) * 0.08 : 0));
      node.ring.quaternion.copy(camera.quaternion);
    });

    if (pathIndex >= 0 && pathItems.length > 1) {
      const pulseT = 0.08 + pathIndex * (0.84 / (pathItems.length - 1));
      const pulsePoint = constellationCurve.getPointAt(pulseT);
      constellationPulse.position.copy(pulsePoint);
      constellationPulse.material.opacity = pathReveal * 0.42;
      constellationPulse.scale.setScalar(0.88 + Math.sin(time * 6) * 0.12);
    } else {
      constellationPulse.material.opacity = 0;
    }

    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  };

  animate();
};

const bootHeroScene = () => {
  if (!heroCanvas || reduceMotion) {
    return;
  }

  if (!window.THREE) {
    window.setTimeout(bootHeroScene, 120);
    return;
  }

  initHeroScene();
};

if (document.readyState === "complete") {
  bootHeroScene();
} else {
  window.addEventListener("load", bootHeroScene, { once: true });
}
