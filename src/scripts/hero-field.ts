/* =================================================================
   Hero "digital commons" — a lazy, GPU-driven generative WebGL field
   that lives BEHIND the < > mark. This is the one deliberate spectacle
   (the owner priced the perf trade). It is an ENHANCEMENT ONLY:
     · no WebGL / reduced-motion / no-JS / automation  → never loads,
       and the static < > mark + breathing gold halo remain as the poster.
   Kept tiny (a fullscreen-quad fragment shader, DPR-capped, fps-capped,
   paused off-screen) so the trade is as small as it can be.
   ================================================================= */

type Controller = { start: () => void; stop: () => void; destroy: () => void };

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;   // -1..1
uniform float u_dark;   // 1 dark, 0 light
uniform float u_fund;   // 0..1 share of the launch goal funded

float hash21(vec2 p){ p = fract(p*vec2(123.34,345.45)); p += dot(p, p+34.345); return fract(p.x*p.y); }
vec2 hash22(vec2 p){ float n = sin(dot(p, vec2(41.0, 289.0))); return fract(vec2(262144.0, 32768.0)*n); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1.0,0.0)), c=hash21(i+vec2(0.0,1.0)), d=hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.02; a*=0.5; } return s; }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / u_res.y;
  uv += u_mouse * 0.05;
  float t = u_time * 0.045;

  // slow domain-warped energy — "the commons is alive"
  vec2 q = uv * 2.1;
  float warp = fbm(q + vec2(t, -t*0.6));
  float flow = fbm(q + warp*1.4 + vec2(-t*0.5, t*0.35));

  // layered constellation of drifting nodes (dependencies / maintainers / stars)
  // + thin links between near nodes in a cell — a living dependency network.
  float pts = 0.0;
  float gold = 0.0;
  float links = 0.0;
  for(int L=0; L<4; L++){
    float fl = float(L);
    float sc = 5.5 + fl*6.5;
    vec2 gp = uv*sc + vec2(t*(0.32+fl*0.16), t*0.11 + fl*1.7);
    vec2 cell = floor(gp);
    vec2 f = fract(gp) - 0.5;
    // this cell's node + the neighbour node to build a short link
    vec2 rnd = hash22(cell);
    vec2 rnd2 = hash22(cell + vec2(1.0, 0.0));
    float layerFade = 1.0 / (1.0 + fl*0.5);
    if (rnd.x >= 0.42) {
      vec2 off = (rnd - 0.5) * 0.74;
      float d = length(f - off);
      float tw = 0.5 + 0.5*sin(u_time*(0.7+rnd.x*2.4) + rnd.y*6.2831);
      float pt = smoothstep(0.085, 0.0, d) * tw * layerFade;
      pts += pt;
      if (rnd.y > 0.8) gold += pt;              // a few nodes are patron-gold
      // link to the node one cell to the right, if it exists
      if (rnd2.x >= 0.42) {
        vec2 a = off;
        vec2 b = (rnd2 - 0.5)*0.74 + vec2(1.0, 0.0);
        vec2 pa = f - a, ba = b - a;
        float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
        float dl = length(pa - ba*h);
        links += smoothstep(0.02, 0.0, dl) * 0.5 * layerFade;
      }
    }
  }

  float r = length(uv);
  float core = smoothstep(1.2, 0.0, r);         // concentrate toward the < > mark
  float vig  = smoothstep(1.3, 0.12, r);        // fade to transparent at the edges

  // Patron nodes: a few gold nodes orbit and periodically FIRE a bright gold link
  // into the < > core — a legible "funding the commons" gesture, so the hero reads
  // on first glance rather than only on a second look.
  float patron = 0.0;
  float beam = 0.0;
  for(int i=0; i<4; i++){
    float fi = float(i);
    // more patron nodes light + fire as the launch goal fills (live funding %)
    float active = smoothstep(fi*0.25 - 0.12, fi*0.25 + 0.12, u_fund + 0.18);
    float ang = fi*1.5708 + t*0.22;
    float rad = 0.62 + 0.1*sin(t*0.8 + fi*1.3);
    vec2 pn = vec2(cos(ang), sin(ang)) * rad;
    float pulse = pow(0.5 + 0.5*sin(u_time*0.8 + fi*2.1), 8.0);  // sharp + infrequent
    patron += smoothstep(0.06, 0.0, length(uv - pn)) * (0.3 + pulse*1.4) * active;
    vec2 pa = uv - pn, ba = -pn;
    float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
    beam += smoothstep(0.013, 0.0, length(pa - ba*h)) * pulse * (1.0 - h*0.25) * active;
  }

  vec3 cGreen = vec3(0.24, 0.88, 0.48);
  vec3 cGold  = vec3(0.91, 0.72, 0.29);

  vec3 col = cGreen*(pts-gold)*1.9 + cGold*gold*2.1 + cGreen*links*1.1;
  col += cGold*(patron*1.5 + beam*1.4);         // patrons + funding beams
  col += cGreen*flow*0.14*core;                 // living energy
  col += cGold*core*0.07;                       // soft central gilt

  float alpha = (pts*1.9 + links*0.9 + patron*1.4 + beam*1.15 + flow*0.13*core + core*0.06) * vig;

  // light theme: no glow reads on parchment, so ink the field down + soften
  vec3 cInk = vec3(0.10, 0.10, 0.07);
  col = mix(mix(cInk, cGold*0.55, gold*0.9) * (pts + core*0.25), col, u_dark);
  alpha *= mix(0.42, 1.0, u_dark);

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function initHeroField(canvas: HTMLCanvasElement): Controller | null {
  const gl = (canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false }) ||
    canvas.getContext('experimental-webgl', { alpha: true })) as WebGLRenderingContext | null;
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const uDark = gl.getUniformLocation(prog, 'u_dark');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const mouse = { x: 0, y: 0 };
  const isDark = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 1 : 0);

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const draw = (timeSec: number) => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, timeSec);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uDark, isDark());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let raf = 0;
  let running = false;
  let startMs = 0;
  let last = 0;
  const frameMs = 1000 / 40; // fps cap — keep the GPU/CPU cost bounded

  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    mouse.y = ((e.clientY - r.top) / r.height - 0.5) * -2;
  };

  const loop = (nowMs: number) => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (nowMs - last < frameMs) return;
    last = nowMs;
    if (!startMs) startMs = nowMs;
    resize();
    draw((nowMs - startMs) / 1000);
  };

  const start = () => {
    if (running) return;
    running = true;
    startMs = 0;
    last = 0;
    window.addEventListener('pointermove', onPointer, { passive: true });
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('pointermove', onPointer);
  };
  const destroy = () => {
    stop();
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteBuffer(buf);
  };

  // paint one deterministic frame immediately (also the reduced-motion poster)
  resize();
  draw(6.0);

  return { start, stop, destroy };
}
