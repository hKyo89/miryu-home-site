const motion = matchMedia("(prefers-reduced-motion: reduce)");

function setupTyping() {
  const grid = document.querySelector(".prompt-grid");
  const button = document.querySelector(".prompt-motion");
  const prompts = [...grid.querySelectorAll("article p")];
  let timeout;

  function finish() {
    clearTimeout(timeout);
    for (const prompt of prompts) {
      prompt.querySelector(".typed-copy")?.remove();
      delete prompt.parentElement.dataset.typing;
    }
    button.textContent = "Replay typing";
  }

  function start() {
    if (motion.matches) return;
    button.hidden = false;
    button.textContent = "Show all prompts";

    const copies = prompts.map((prompt) => {
      const text = Array.from(prompt.textContent);
      const copy = document.createElement("span");
      copy.className = "typed-copy";
      copy.setAttribute("aria-hidden", "true");
      prompt.append(copy);
      return { prompt, text, copy };
    });

    function type(index, count = 0) {
      const { prompt, text, copy } = copies[index];
      prompt.parentElement.dataset.typing = "";
      copy.textContent = text.slice(0, count).join("");
      if (count < text.length) {
        timeout = setTimeout(() => type(index, count + 1), 25);
        return;
      }
      copy.remove();
      delete prompt.parentElement.dataset.typing;
      if (index + 1 < copies.length) {
        timeout = setTimeout(() => type(index + 1), 200);
      } else {
        finish();
      }
    }

    type(0);
  }

  button.addEventListener("click", () => {
    if (grid.querySelector(".typed-copy")) finish();
    else start();
  });
  motion.addEventListener("change", finish);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      start();
    }, { threshold: 0.25 });
    observer.observe(grid);
  }
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
      float heading = time * (0.9 + 0.19 * float(i)) + float(i) * 1.7;
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
  let visible = true;
  let frame;
  let x = 0;
  let y = 0;
  const started = performance.now();

  function render(now) {
    frame = undefined;
    if (!visible || document.hidden || motion.matches) return;
    const offset = stage.getBoundingClientRect().top * -0.055;
    stage.style.setProperty("--scroll-y", Math.max(-16, Math.min(16, offset)) + "px");
    stage.style.setProperty("--pointer-x", x * 16 + "px");
    stage.style.setProperty("--pointer-y", y * 16 + "px");
    const elapsed = (now - started) / 1000;
    draw?.(Math.min(elapsed, 4.5), x, y);
    if (draw && elapsed < 4.5) schedule();
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
  canvas.addEventListener("webglcontextlost", () => {
    draw = null;
    canvas.hidden = true;
  });
  motion.addEventListener("change", () => {
    canvas.hidden = motion.matches || !draw;
    schedule();
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    }).observe(stage);
  }
  schedule();
}

setupTyping();
setupStage();
