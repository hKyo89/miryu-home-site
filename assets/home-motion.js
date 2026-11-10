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

const vertexSource = `
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    uv = position;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision mediump float;
  varying vec2 uv;
  uniform vec2 pointer;
  uniform float time;

  void main() {
    vec2 p = (uv - vec2(pointer.x, 0.08 + pointer.y)) / vec2(0.86, 0.67);
    float radius = length(p);
    float angle = atan(p.y, p.x);
    vec3 light = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float track = 0.48 + 0.14 * float(i);
      float heading = time * (0.8 + 0.2 * float(i)) + float(i) * 1.7;
      float trail = pow(0.5 + 0.5 * cos(angle - heading), 18.0);
      float ring = exp(-abs(radius - track) * 145.0);
      vec2 dotPosition = track * vec2(cos(heading), sin(heading));
      float dotDistance = length(p - dotPosition);
      vec3 tint = mix(vec3(0.18, 0.87, 1.0), vec3(0.70, 0.48, 1.0), float(i) / 3.0);
      light += tint * (ring * (0.035 + trail * 0.31) +
        exp(-dotDistance * 36.0) * 0.47 + exp(-dotDistance * 160.0) * 0.85);
    }
    light += vec3(0.14, 0.32, 0.70) * exp(-radius * radius * 2.4) * 0.37;
    gl_FragColor = vec4(clamp(light, 0.0, 1.0), clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0));
  }
`;

function createNetwork(canvas) {
  const gl = canvas.getContext("webgl", { antialias: false, depth: false, powerPreference: "low-power" });
  if (!gl) return null;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (vertex) gl.attachShader(program, vertex);
  if (fragment) gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (vertex) gl.deleteShader(vertex);
  if (fragment) gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "position");
  const pointer = gl.getUniformLocation(program, "pointer");
  const time = gl.getUniformLocation(program, "time");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  return (seconds, x, y) => {
    const scale = Math.min(devicePixelRatio, 1.5);
    const width = Math.round(canvas.clientWidth * scale);
    const height = Math.round(canvas.clientHeight * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(pointer, x * 0.13, -y * 0.13);
    gl.uniform1f(time, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

function setupStage() {
  if (motion.matches) return;
  const stage = document.querySelector(".luna-visual");
  const canvas = stage.querySelector("canvas");
  let draw = createNetwork(canvas);
  const pause = stage.querySelector(".orbit-motion");
  let visible = true;
  let paused = false;
  let seconds = 0;
  let previousFrame;
  let lastDraw = -Infinity;
  let frame;
  let x = 0;
  let y = 0;
  stage.dataset.orbitFallback = draw ? "false" : "true";
  pause.hidden = false;

  function render(now) {
    frame = undefined;
    if (!visible || document.hidden || motion.matches) return;
    const offset = stage.getBoundingClientRect().top * -0.055;
    stage.style.setProperty("--scroll-y", Math.max(-16, Math.min(16, offset)) + "px");
    stage.style.setProperty("--pointer-x", x * 16 + "px");
    stage.style.setProperty("--pointer-y", y * 16 + "px");
    if (previousFrame !== undefined && !paused) {
      seconds = (seconds + Math.min(now - previousFrame, 50) / 1000) % (10 * Math.PI);
    }
    previousFrame = now;
    if (paused || now - lastDraw >= 30) {
      draw?.(seconds, x, y);
      lastDraw = now;
    }
    if (draw && !paused) schedule();
  }

  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(render);
  }

  stage.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const bounds = stage.getBoundingClientRect();
    x = (event.clientX - bounds.left) / bounds.width - 0.5;
    y = (event.clientY - bounds.top) / bounds.height - 0.5;
    schedule();
  });
  stage.addEventListener("pointerleave", () => {
    x = y = 0;
    schedule();
  });
  pause.addEventListener("click", () => {
    paused = !paused;
    stage.dataset.orbitPaused = String(paused);
    pause.textContent = paused ? "Play animation" : "Pause animation";
    previousFrame = undefined;
    schedule();
  });
  canvas.addEventListener("webglcontextlost", () => {
    draw = null;
    stage.dataset.orbitFallback = "true";
    canvas.hidden = true;
  });
  motion.addEventListener("change", () => {
    canvas.hidden = motion.matches || !draw;
    pause.hidden = motion.matches;
    previousFrame = undefined;
    schedule();
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      stage.dataset.orbitOffscreen = String(!visible);
      previousFrame = undefined;
      if (visible) schedule();
    }).observe(stage);
  }
  schedule();
}

setupPromptStory();
setupStage();
