const motion = matchMedia("(prefers-reduced-motion: reduce)");

function setupPromptStory() {
  const story = document.querySelector(".prompt-story");
  const panel = story.querySelector(".prompt-sticky");
  const dots = story.querySelector(".prompt-dots");
  const buttons = [...dots.querySelectorAll("button")];
  const scenes = [...story.querySelectorAll(".prompt-scene")];
  let step;
  let active = -1;
  let frame;
  let visible = false;
  let typed = false;
  let timeout;

  function stopTyping() {
    clearTimeout(timeout);
    panel.querySelector(".typed-copy")?.remove();
  }

  function typePrompt() {
    if (!visible || typed || active < 0 || motion.matches) return;
    typed = true;
    const quote = scenes[active].querySelector(".prompt-quote");
    const letters = Array.from(quote.textContent);
    const copy = document.createElement("span");
    copy.className = "typed-copy";
    copy.setAttribute("aria-hidden", "true");
    quote.append(copy);
    let index = 0;

    function next() {
      copy.textContent += letters[index++];
      if (index < letters.length) timeout = setTimeout(next, 27);
      else stopTyping();
    }

    timeout = setTimeout(next, 100);
  }

  function update() {
    frame = undefined;
    const top = parseFloat(getComputedStyle(panel).top);
    const offset = top - story.getBoundingClientRect().top;
    const index = Math.max(0, Math.min(scenes.length - 1, Math.floor(offset / step)));
    if (index !== active) {
      stopTyping();
      typed = false;
      active = index;
      scenes.forEach((scene, i) => {
        scene.hidden = i !== active;
        if (i === active) buttons[i].setAttribute("aria-current", "step");
        else buttons[i].removeAttribute("aria-current");
      });
    }
    typePrompt();
  }

  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(update);
  }

  function measure() {
    step = Math.max(220, Math.round(innerHeight * 0.59));
    const panelHeight = panel.offsetHeight;
    story.style.minHeight = panelHeight + step * (scenes.length - 0.45) + "px";
    schedule();
  }

  if (!("IntersectionObserver" in window) || !("ResizeObserver" in window)) return;
  story.dataset.scrollStory = "";
  dots.hidden = false;
  step = Math.max(220, Math.round(innerHeight * 0.59));
  update();
  measure();
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => {
      const inset = parseFloat(getComputedStyle(panel).top);
      const top = scrollY + story.getBoundingClientRect().top - inset + index * step + 2;
      window.scrollTo({ top, behavior: "instant" });
    });
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) stopTyping();
    schedule();
  }, { threshold: 0.34 }).observe(panel);
  new ResizeObserver(measure).observe(panel);
  window.addEventListener("resize", measure);
  window.addEventListener("scroll", schedule, { passive: true });
  motion.addEventListener("change", stopTyping);
}

function setupHeadline() {
  if (motion.matches) return;
  const lines = [...document.querySelectorAll(".hero-title-line")];
  let timer;
  const copies = lines.map((line) => {
    const text = Array.from(line.textContent.trim());
    const copy = document.createElement("span");
    copy.className = "headline-copy";
    copy.setAttribute("aria-hidden", "true");
    copy.hidden = true;
    line.append(copy);
    line.dataset.typing = "";
    return { line, copy, text };
  });

  function finish() {
    clearTimeout(timer);
    for (const { line, copy } of copies) {
      copy.remove();
      delete line.dataset.typing;
    }
    motion.removeEventListener("change", finish);
  }

  function type(lineIndex, letter = 0) {
    const { line, copy, text } = copies[lineIndex];
    copy.hidden = false;
    copy.textContent = text.slice(0, letter).join("");
    if (letter < text.length) {
      timer = setTimeout(() => type(lineIndex, letter + 1), 44);
    } else {
      copy.remove();
      delete line.dataset.typing;
      if (lineIndex + 1 < copies.length) timer = setTimeout(() => type(lineIndex + 1), 150);
      else finish();
    }
  }

  motion.addEventListener("change", finish);
  type(0);
}

function setupNetwork() {
  const hero = document.querySelector(".hero");
  const stage = hero.querySelector(".luna-visual");
  const svg = hero.querySelector(".hero-mesh");
  const devices = [...stage.querySelectorAll(".device-node")];
  const points = devices.map((device) => device.dataset.point.split(",").map(Number));

  // Fixed vertices give the web its own shape at every viewport size.
  points.push(
    [-1.25, -.72, -.5], [-1.36, .42, .37], [-1.82, -.22, .78], [-1.79, .71, -.57],
    [-2.25, -.71, -.4], [-2.43, .34, .4], [-2.75, -.18, -.2], [-2.77, .8, .24],
    [-.55, -.91, -.5], [.65, -.91, .26], [1.14, -.75, -.54], [1.21, .17, -.63],
    [1.06, .8, -.47], [.35, .91, .56], [-.88, .87, .2], [-.16, -.49, -.76],
    [.38, -.26, .7], [.39, .38, -.67], [-.46, .28, .58], [-.35, -.12, -.45],
    [-.05, .54, .12], [.09, -.92, -.55], [-.99, -.12, .75], [.94, .27, .65],
    [-.55, -1.7, -.5], [.13, -2.25, .4], [.78, -2, -.3], [-1.26, -1.56, .1],
  );

  const edgeKeys = new Set();
  const edges = [];
  points.forEach(([x, y, z], i) => {
    const nearest = points
      .map(([a, b, c], j) => ({ j, distance: Math.hypot(x - a, y - b, (z - c) * .56) }))
      .filter(({ j, distance }) => j !== i && distance < 1.27)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
    for (const { j } of nearest) {
      const key = i < j ? i + ":" + j : j + ":" + i;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push([i, j]);
    }
  });

  function addShape(parent, name, opacity) {
    const shape = document.createElementNS(svg.namespaceURI, name);
    shape.setAttribute("opacity", opacity);
    parent.append(shape);
    return shape;
  }

  const linkGroup = svg.querySelector(".mesh-links");
  const paths = [.12, .23, .43].map((opacity) => addShape(linkGroup, "path", opacity));
  const jointGroup = svg.querySelector(".mesh-joints");
  const joints = points.slice(devices.length).map(() => addShape(jointGroup, "circle", .64));
  const signals = edges.filter((_, index) => index % 6 === 1).map(([a, b], index) => {
    const signal = addShape(jointGroup, "circle", .92);
    signal.setAttribute("r", index % 2 ? "1.8" : "2.4");
    return { a, b, signal, phase: index * .173 };
  });
  let targetX = 0;
  let targetY = 0;
  let pitch = 0;
  let yaw = 0;
  let visible = true;
  let frame;
  let lastFrame = -Infinity;

  function render(now) {
    frame = undefined;
    if (!visible || document.hidden) return;
    if (!motion.matches && now - lastFrame < 28) {
      schedule();
      return;
    }
    lastFrame = now;
    const bounds = hero.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const left = stageBounds.left - bounds.left;
    const top = stageBounds.top - bounds.top;
    const centerX = left + stageBounds.width / 2;
    const centerY = top + stageBounds.height * .46;
    const spreadX = stageBounds.width * .42;
    const spreadY = stageBounds.height * .43;
    const time = motion.matches ? 0 : now / 1000;

    yaw = motion.matches ? 0 : yaw + (targetX * .36 - yaw) * .14;
    pitch = motion.matches ? 0 : pitch + (targetY * .28 - pitch) * .14;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const sinX = Math.sin(pitch);
    const cosX = Math.cos(pitch);
    const projected = points.map(([x, y, z], index) => {
      const float = Math.sin(time * .85 + index * 1.3) * .027;
      const worldY = y + (motion.matches ? 0 : float);
      const rotatedX = x * cosY + z * sinY;
      const depth = z * cosY - x * sinY;
      const rotatedY = worldY * cosX - depth * sinX;
      const rotatedZ = worldY * sinX + depth * cosX;
      const scale = 3.8 / (3.8 - rotatedZ);
      return [centerX + rotatedX * spreadX * scale, centerY + rotatedY * spreadY * scale, scale];
    });

    const segments = ["", "", ""];
    edges.forEach(([a, b]) => {
      const [x1, y1, scale1] = projected[a];
      const [x2, y2, scale2] = projected[b];
      const scale = (scale1 + scale2) / 2;
      const layer = scale > 1.08 ? 2 : scale > .94 ? 1 : 0;
      segments[layer] += "M" + x1.toFixed(1) + " " + y1.toFixed(1) + "L" + x2.toFixed(1) + " " + y2.toFixed(1);
    });
    paths.forEach((path, index) => {
      path.setAttribute("fill", "none");
      path.setAttribute("d", segments[index]);
    });

    devices.forEach((device, index) => {
      const [x, y, scale] = projected[index];
      device.style.setProperty("--x", (x - left).toFixed(1) + "px");
      device.style.setProperty("--y", (y - top).toFixed(1) + "px");
      device.style.setProperty("--depth", scale.toFixed(3));
    });
    joints.forEach((joint, index) => {
      const [x, y, scale] = projected[index + devices.length];
      joint.setAttribute("cx", x.toFixed(1));
      joint.setAttribute("cy", y.toFixed(1));
      joint.setAttribute("r", (1.65 * scale).toFixed(1));
    });
    signals.forEach(({ a, b, signal, phase }) => {
      const [x1, y1] = projected[a];
      const [x2, y2] = projected[b];
      const progress = (time * .23 + phase) % 1;
      signal.setAttribute("cx", (x1 + (x2 - x1) * progress).toFixed(1));
      signal.setAttribute("cy", (y1 + (y2 - y1) * progress).toFixed(1));
    });
    hero.dataset.meshReady = "";
    if (!motion.matches) schedule();
  }

  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(render);
  }

  hero.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const bounds = hero.getBoundingClientRect();
    targetX = (event.clientX - bounds.left) / bounds.width - .5;
    targetY = (event.clientY - bounds.top) / bounds.height - .5;
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { targetX = targetY = 0; });
  motion.addEventListener("change", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    }).observe(hero);
  }
  schedule();
}

setupPromptStory();
setupHeadline();
setupNetwork();
