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
uniform float u_egg;    // Konami: reveal the hidden 2^15 glyph

float hash21(vec2 p){ p = fract(p*vec2(123.34,345.45)); p += dot(p, p+34.345); return fract(p.x*p.y); }
vec2 hash22(vec2 p){ float n = sin(dot(p, vec2(41.0, 289.0))); return fract(vec2(262144.0, 32768.0)*n); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1.0,0.0)), c=hash21(i+vec2(0.0,1.0)), d=hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.02; a*=0.5; } return s; }
float sdSegment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h);
}
float stroke(vec2 p, vec2 a, vec2 b, float w){ return smoothstep(w, 0.0, sdSegment(p,a,b)); }
float glyphTwo(vec2 p){
  return max(max(stroke(p, vec2(-0.42,0.42), vec2(0.42,0.42), 0.045),
                 stroke(p, vec2(0.42,0.42), vec2(0.42,0.06), 0.045)),
             max(stroke(p, vec2(0.42,0.06), vec2(-0.42,-0.42), 0.045),
                 stroke(p, vec2(-0.42,-0.42), vec2(0.42,-0.42), 0.045)));
}
float glyphCaret(vec2 p){
  return max(stroke(p, vec2(-0.26,-0.06), vec2(0.0,0.22), 0.035),
             stroke(p, vec2(0.26,-0.06), vec2(0.0,0.22), 0.035));
}
float glyphOne(vec2 p){
  return max(stroke(p, vec2(0.0,0.42), vec2(0.0,-0.42), 0.045),
             stroke(p, vec2(-0.18,0.24), vec2(0.0,0.42), 0.045));
}
float glyphFive(vec2 p){
  float a = max(stroke(p, vec2(0.42,0.42), vec2(-0.42,0.42), 0.045),
                stroke(p, vec2(-0.42,0.42), vec2(-0.42,0.04), 0.045));
  float b = max(stroke(p, vec2(-0.42,0.04), vec2(0.35,0.04), 0.045),
                stroke(p, vec2(0.35,0.04), vec2(0.42,-0.42), 0.045));
  return max(max(a,b), stroke(p, vec2(0.42,-0.42), vec2(-0.42,-0.42), 0.045));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / u_res.y;
  uv += u_mouse * vec2(0.02, 0.014);
  float t = u_time * 0.055;

  float r = length(uv);
  float core = smoothstep(0.82, 0.04, r);
  float vig  = smoothstep(1.32, 0.13, r);

  // Slow domain-warped current: this is the "commons" under the graph.
  vec2 q = uv * 2.0;
  float warp = fbm(q + vec2(t*0.8, -t*0.45));
  float flow = fbm(q + warp*1.55 + vec2(-t*0.42, t*0.38));
  float ribbon = smoothstep(
    0.052,
    0.0,
    abs(sin((uv.y + flow*0.18)*16.0 + uv.x*4.5 - u_time*0.42))
  ) * smoothstep(1.05, 0.16, r);

  // Layered dependency graph. It should read as authored network, not dust.
  float pts = 0.0;
  float hot = 0.0;
  float links = 0.0;
  for(int L=0; L<3; L++){
    float fl = float(L);
    float sc = 5.4 + fl*6.8;
    vec2 gp = uv*sc + vec2(t*(0.34+fl*0.12), t*0.11 + fl*1.7);
    vec2 cell = floor(gp);
    vec2 f = fract(gp) - 0.5;
    vec2 rnd = hash22(cell);
    vec2 right = hash22(cell + vec2(1.0, 0.0));
    vec2 up = hash22(cell + vec2(0.0, 1.0));
    float alive = step(0.43 + fl*0.05, rnd.x);
    float layerFade = 1.0 / (1.0 + fl*0.58);
    if (alive > 0.0) {
      vec2 off = (rnd - 0.5) * 0.74;
      float d = length(f - off);
      float tw = 0.56 + 0.44*sin(u_time*(0.45+rnd.x*1.8) + rnd.y*6.2831);
      float pt = smoothstep(0.058 + fl*0.006, 0.0, d) * tw * layerFade;
      pts += pt;
      hot += pt * smoothstep(0.74, 0.98, rnd.y);
      if (right.x >= 0.48 + fl*0.05) {
        vec2 a = off;
        vec2 b = (right - 0.5)*0.74 + vec2(1.0, 0.0);
        links += stroke(f, a, b, 0.013 + fl*0.0025) * 0.54 * layerFade;
      }
      if (up.x >= 0.5 + fl*0.05) {
        vec2 a = off;
        vec2 b = (up - 0.5)*0.74 + vec2(0.0, 1.0);
        links += stroke(f, a, b, 0.011 + fl*0.0025) * 0.4 * layerFade;
      }
    }
  }

  // A precise orbital rail around the mark keeps the center intentional.
  float rail = smoothstep(0.018, 0.0, abs(r - (0.44 + 0.015*sin(u_time*0.55)))) * 0.58;
  rail += smoothstep(0.014, 0.0, abs(r - (0.58 + 0.018*cos(u_time*0.36)))) * 0.38;

  // Patron nodes: real funding % controls how many gold beams light the core.
  float fund = clamp(u_fund, 0.0, 1.0);
  float patron = 0.0;
  float beam = 0.0;
  for(int i=0; i<4; i++){
    float fi = float(i);
    float active = smoothstep(fi*0.25 - 0.12, fi*0.25 + 0.12, fund + 0.18);
    float ang = fi*1.5708 + t*0.28;
    float rad = 0.58 + 0.06*sin(t*0.75 + fi*1.3);
    vec2 pn = vec2(cos(ang), sin(ang)) * rad;
    float pulse = pow(0.5 + 0.5*sin(u_time*0.78 + fi*2.1), 8.0);
    patron += smoothstep(0.044, 0.0, length(uv - pn)) * (0.34 + pulse*1.05) * active;
    vec2 pa = uv - pn, ba = -pn;
    float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
    beam += smoothstep(0.009, 0.0, length(pa - ba*h)) * pulse * (1.0 - h*0.18) * active;
  }

  // Easter egg: Konami reveals a tiny 2^15 signal, matching the $32,768 goal.
  vec2 gp = (uv - vec2(0.0, 0.35)) * 8.6;
  float eggGlyph = 0.0;
  eggGlyph = max(eggGlyph, glyphTwo(gp - vec2(-1.1, 0.0)));
  eggGlyph = max(eggGlyph, glyphCaret(gp - vec2(-0.22, 0.16)));
  eggGlyph = max(eggGlyph, glyphOne(gp - vec2(0.48, 0.0)));
  eggGlyph = max(eggGlyph, glyphFive(gp - vec2(1.2, 0.0)));
  float eggBits = 0.0;
  for(int i=0; i<15; i++){
    float fi = float(i);
    float ang = fi*0.418879 + u_time*0.24;
    vec2 bit = vec2(cos(ang)*0.16, sin(ang)*0.28);
    bit += vec2(0.0, 0.018*sin(u_time*0.8 + fi*1.7));
    eggBits += smoothstep(0.038, 0.0, length(uv - bit)) * (0.66 + 0.34*sin(u_time*2.0 + fi));
  }
  float eggPulse = (0.72 + 0.28*sin(u_time*4.0));
  float egg = (eggGlyph*1.35 + eggBits*1.25) * u_egg * eggPulse * smoothstep(1.02, 0.05, r);
  float eggHalo = smoothstep(0.34, 0.0, length(uv - vec2(0.0, 0.35))) * u_egg * 0.45;

  vec3 cGreen = vec3(0.24, 0.88, 0.48);
  vec3 cGold  = vec3(0.91, 0.72, 0.29);
  vec3 cInk = vec3(0.10, 0.10, 0.07);
  vec3 cBlue = vec3(0.25, 0.38, 0.92);

  vec3 darkCol = cGreen*(pts-hot)*1.35 + cGold*hot*1.85 + cGreen*links*0.92;
  darkCol += cBlue*ribbon*0.32 + cGold*(patron*1.18 + beam*1.12 + rail*0.58 + egg*2.3 + eggHalo*1.4);
  darkCol += cGreen*flow*0.06*core + cGold*core*0.045;

  vec3 lightCol = cInk*(pts*1.18 + links*0.68 + rail*0.36);
  lightCol += cGold*(hot*0.9 + patron*1.05 + beam*1.0 + rail*0.5 + egg*2.1 + eggHalo*1.25);
  lightCol += cGreen*(ribbon*0.42 + egg*0.95 + flow*0.045*core);

  vec3 col = mix(lightCol, darkCol, u_dark);
  float alpha =
    (pts*1.45 + links*0.92 + ribbon*0.32 + patron*1.06 + beam*0.95 + rail*0.58 +
     flow*0.055*core + core*0.03 + egg*2.0 + eggHalo*1.1) * vig;
  alpha *= mix(0.9, 1.0, u_dark);

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
  const gl = (canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  }) || canvas.getContext('experimental-webgl', { alpha: true })) as WebGLRenderingContext | null;
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
  const uFund = gl.getUniformLocation(prog, 'u_fund');
  const uEgg = gl.getUniformLocation(prog, 'u_egg');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const mouse = { x: 0, y: 0 };
  const fundedShare = Math.min(
    1,
    Math.max(0, Number(canvas.closest<HTMLElement>('[data-hero-field]')?.dataset.fund ?? '0') / 100)
  );
  const isDark = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 1 : 0);
  const isEgg = () => (document.documentElement.classList.contains('konami') ? 1 : 0);

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
    gl.uniform1f(uFund, fundedShare);
    gl.uniform1f(uEgg, isEgg());
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
