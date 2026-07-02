/* =================================================================
   Hero "digital commons" — a lazy, GPU-driven pixel planet atmosphere and
   orbit field under the programming-language satellites. This is the one
   deliberate spectacle (the owner priced the perf trade). It is an
   ENHANCEMENT ONLY:
     · no WebGL / no-JS  → the static CSS planet + language chips remain.
     · reduced-motion / automation → one deterministic poster frame.
   Kept tiny (a fullscreen-quad fragment shader, DPR-capped, fps-capped,
   paused off-screen) so the trade is as small as it can be.
   ================================================================= */

type Controller = {
  start: () => void;
  stop: () => void;
  destroy: () => void;
  paintAt: (timeSec: number) => void;
};

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
float stroke(vec2 p, vec2 a, vec2 b, float w){ return smoothstep(w*1.45, 0.0, sdSegment(p,a,b)); }
float sdBox(vec2 p, vec2 c, vec2 b){
  vec2 d = abs(p-c)-b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float pixelFill(vec2 p, vec2 c, float s){ return smoothstep(0.006, -0.002, sdBox(p, c, vec2(s))); }
float pixelStroke(vec2 p, vec2 c, float s){ return smoothstep(0.006, 0.0, abs(sdBox(p, c, vec2(s)))); }
mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
vec2 pixelGrid(vec2 p, float scale){ return (floor(p*scale)+0.5)/scale; }
float circleFill(vec2 p, vec2 c, float r){ return smoothstep(r, r-0.012, length(p-c)); }
float circleStroke(vec2 p, vec2 c, float r, float w){ return smoothstep(w*1.4, 0.0, abs(length(p-c)-r)); }
float ellipseStroke(vec2 p, vec2 c, vec2 r, float tilt, float w){
  vec2 q = rot(-tilt) * (p-c);
  return smoothstep(w*1.35, 0.0, abs(length(q/r)-1.0));
}
vec2 orbitPoint(vec2 c, vec2 r, float tilt, float a){
  return c + rot(tilt) * vec2(cos(a)*r.x, sin(a)*r.y);
}
float plusStar(vec2 p, vec2 c, float s){
  return max(stroke(p, c-vec2(s,0.0), c+vec2(s,0.0), s*0.22),
             stroke(p, c-vec2(0.0,s), c+vec2(0.0,s), s*0.22));
}
float repoNode(vec2 p, vec2 c, float active, float scale){
  float body = smoothstep(0.012, -0.002, sdBox(p, c, vec2(0.034, 0.024)*scale));
  float edge = smoothstep(0.009, 0.0, abs(sdBox(p, c, vec2(0.038, 0.028)*scale)));
  float line1 = stroke(p, c+vec2(-0.018, 0.006)*scale, c+vec2(0.013, 0.006)*scale, 0.0028*scale);
  float line2 = stroke(p, c+vec2(-0.018, -0.006)*scale, c+vec2(0.02, -0.006)*scale, 0.0028*scale);
  float mark = plusStar(p, c+vec2(0.024, 0.02)*scale, 0.011*scale);
  return body*(0.34 + active*0.38) + edge*0.26 + (line1+line2+mark)*(0.2+active*0.55);
}
float packageCube(vec2 p, vec2 c, float active, float scale){
  float box = smoothstep(0.012, -0.002, sdBox(p, c, vec2(0.027)*scale));
  float cut = stroke(p, c+vec2(-0.018,0.009)*scale, c+vec2(0.0,0.02)*scale, 0.0028*scale);
  cut += stroke(p, c+vec2(0.0,0.02)*scale, c+vec2(0.018,0.009)*scale, 0.0028*scale);
  cut += stroke(p, c, c+vec2(0.0,-0.022)*scale, 0.0028*scale);
  return box*(0.3+active*0.42) + cut*(0.2+active*0.5);
}
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
float commitSpark(vec2 p, vec2 a, vec2 b, float offset, float speed){
  float phase = fract(u_time*speed + offset);
  float fade = smoothstep(0.04, 0.18, phase) * smoothstep(0.98, 0.78, phase);
  vec2 c = mix(a, b, phase);
  return pixelFill(p, c, 0.007) * fade;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / u_res.y;
  uv += u_mouse * vec2(0.014, 0.01);
  vec2 drawUv = pixelGrid(uv, 150.0);
  vec2 lineUv = uv;
  float t = u_time * 0.055;
  float r = length(uv);
  float vig = smoothstep(1.08, 0.06, r);

  vec2 moonC = vec2(-0.02, -0.02) + vec2(sin(t*0.7)*0.014, cos(t*0.6)*0.01);
  vec2 moonP = rot(-0.18) * (drawUv - moonC);
  vec2 moonPx = pixelGrid(moonP, 34.0);
  float moonR = 0.39;
  float moonD = length(moonP);
  float moon = smoothstep(moonR+0.012, moonR-0.008, moonD);
  float inner = smoothstep(moonR*0.88, moonR*0.18, moonD);
  float rim = circleStroke(moonP, vec2(0.0), moonR, 0.035) * smoothstep(moonR+0.06, moonR-0.03, moonD);
  float terminator = smoothstep(-0.34, 0.42, moonP.x + moonP.y*0.28);
  float surface = fbm(moonPx*3.4 + vec2(0.8, -0.2));
  float land = smoothstep(0.47, 0.69, surface + moonPx.x*0.13 - moonPx.y*0.06);
  float seam = smoothstep(0.03, 0.0, abs(sin((moonPx.x*1.8 + moonPx.y*1.2)*10.0))) * moon;

  float craters = 0.0;
  for(int L=0; L<3; L++){
    float sc = 5.5 + float(L)*3.4;
    vec2 gp = moonP*sc + vec2(1.7*float(L), -0.8*float(L));
    vec2 cell = floor(gp);
    vec2 f = fract(gp) - 0.5;
    vec2 rnd = hash22(cell);
    float alive = step(0.7 + float(L)*0.06, rnd.x);
    float disk = step(length((cell + 0.5)/sc), moonR*1.02);
    craters += smoothstep(0.18, 0.02, abs(sdBox(f, (rnd-0.5)*0.55, vec2(0.09 + rnd.y*0.07)))) * alive * disk / (1.0 + float(L)*0.45);
  }
  craters *= moon;

  float orbit = 0.0;
  float orbitGlow = 0.0;
  orbit += ellipseStroke(lineUv, moonC, vec2(0.58, 0.23), 0.22, 0.016);
  orbit += ellipseStroke(lineUv, moonC, vec2(0.49, 0.18), -0.34, 0.014)*0.82;
  orbit += ellipseStroke(lineUv, moonC, vec2(0.67, 0.28), -0.02, 0.012)*0.42;
  orbitGlow += ellipseStroke(lineUv, moonC, vec2(0.58, 0.23), 0.22, 0.034)*0.28;
  orbitGlow += ellipseStroke(lineUv, moonC, vec2(0.49, 0.18), -0.34, 0.03)*0.24;

  float fund = clamp(u_fund, 0.0, 1.0);
  float a0 = smoothstep(0.02, 0.2, fund);
  float a1 = smoothstep(0.14, 0.34, fund);
  float a2 = smoothstep(0.28, 0.52, fund);
  float a3 = smoothstep(0.48, 0.74, fund);
  float a4 = smoothstep(0.68, 0.94, fund);

  vec2 s0 = orbitPoint(moonC, vec2(0.58,0.23), 0.22, u_time*0.16 + 0.3);
  vec2 s1 = orbitPoint(moonC, vec2(0.49,0.18), -0.34, -u_time*0.13 + 1.9);
  vec2 s2 = orbitPoint(moonC, vec2(0.67,0.28), -0.02, u_time*0.1 + 3.0);
  vec2 s3 = orbitPoint(moonC, vec2(0.58,0.23), 0.22, u_time*0.16 + 4.2);
  vec2 s4 = orbitPoint(moonC, vec2(0.49,0.18), -0.34, -u_time*0.13 + 4.8);
  vec2 s5 = orbitPoint(moonC, vec2(0.67,0.28), -0.02, u_time*0.1 + 5.2);

  float repos = 0.0;
  repos += repoNode(drawUv, s0, a0, 1.0);
  repos += packageCube(drawUv, s1, a1, 0.9);
  repos += repoNode(drawUv, s2, a2, 0.78);
  repos += packageCube(drawUv, s3, a3, 0.8);
  repos += repoNode(drawUv, s4, a4, 0.72);
  repos += packageCube(drawUv, s5, a2, 0.7);

  float sparks = 0.0;
  sparks += commitSpark(lineUv, s0, moonC + vec2(0.18, 0.07), 0.1, 0.12) * a0;
  sparks += commitSpark(lineUv, s1, moonC + vec2(-0.12, -0.12), 0.42, 0.105) * a1;
  sparks += commitSpark(lineUv, s2, moonC + vec2(0.03, 0.17), 0.7, 0.092) * a2;
  sparks += commitSpark(lineUv, s3, moonC + vec2(-0.18, 0.05), 0.28, 0.085) * a3;

  float dust = 0.0;
  for(int L=0; L<2; L++){
    float fl = float(L);
    float sc = 6.4 + fl*5.2;
    vec2 gp = drawUv*sc + vec2(t*(0.15+fl*0.05), -t*0.07 + fl*2.4);
    vec2 cell = floor(gp);
    vec2 f = fract(gp) - 0.5;
    vec2 rnd = hash22(cell);
    float alive = step(0.72 + fl*0.09, rnd.x);
    vec2 off = (rnd - 0.5) * 0.72;
    float d = abs(sdBox(f, off, vec2(0.018 + fl*0.006)));
    dust += smoothstep(0.032 + fl*0.005, 0.0, d) * alive * (0.35 + 0.65*rnd.y) / (1.0 + fl*0.7);
  }

  vec2 eggP = (drawUv - s5 - vec2(0.0, 0.06)) * 10.0;
  float eggGlyph = 0.0;
  eggGlyph = max(eggGlyph, glyphTwo(eggP - vec2(-1.1, 0.0)));
  eggGlyph = max(eggGlyph, glyphCaret(eggP - vec2(-0.22, 0.16)));
  eggGlyph = max(eggGlyph, glyphOne(eggP - vec2(0.48, 0.0)));
  eggGlyph = max(eggGlyph, glyphFive(eggP - vec2(1.2, 0.0)));
  float egg = eggGlyph * u_egg * (0.72 + 0.28*sin(u_time*4.0)) * vig;

  vec3 cGreen = vec3(0.15, 0.68, 0.36);
  vec3 cGold  = vec3(0.82, 0.62, 0.2);
  vec3 cInk = vec3(0.09, 0.10, 0.07);
  vec3 cOlive = vec3(0.2, 0.29, 0.18);
  vec3 cMoon = vec3(0.54, 0.5, 0.38);
  vec3 cMoonHi = vec3(0.78, 0.7, 0.48);
  vec3 cMoonDark = vec3(0.08, 0.12, 0.09);

  vec3 moonLight = mix(cMoon, cMoonHi, land*0.62 + inner*0.18);
  moonLight = mix(moonLight, cInk, craters*0.28 + (1.0-terminator)*0.36);
  moonLight += cGold * rim * 0.52 + cGreen * seam * 0.08;

  vec3 moonDark = mix(cMoonDark, cOlive, land*0.4 + inner*0.16);
  moonDark = mix(moonDark, vec3(0.02,0.04,0.03), (1.0-terminator)*0.54 + craters*0.24);
  moonDark += cGold * rim * 0.62 + cGreen * seam * 0.18;

  vec3 lightCol = moonLight*moon*0.84;
  lightCol += cInk*(orbit*0.36 + repos*0.48 + dust*0.34);
  lightCol += cGreen*(repos*0.18 + sparks*0.82 + dust*0.04 + egg*0.9);
  lightCol += cGold*(rim*0.32 + orbitGlow*0.16 + repos*0.2 + sparks*0.72 + egg*2.0);

  vec3 darkCol = moonDark*moon*0.9;
  darkCol += cGreen*(orbit*0.42 + repos*0.52 + sparks*0.85 + dust*0.3 + egg*0.9);
  darkCol += cGold*(rim*0.55 + orbitGlow*0.22 + repos*0.24 + sparks*0.72 + egg*2.0);
  darkCol += cInk*dust*0.06;

  vec3 col = mix(lightCol, darkCol, u_dark);
  float alpha =
    (moon*0.46 + rim*0.48 + orbit*0.24 + orbitGlow*0.12 + repos*0.62 +
     sparks*0.82 + dust*0.18 + egg*1.6) * vig;
  alpha *= mix(1.0, 0.9, u_dark);

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
    preserveDrawingBuffer: navigator.webdriver,
  }) ||
    canvas.getContext('experimental-webgl', {
      alpha: true,
      preserveDrawingBuffer: navigator.webdriver,
    })) as WebGLRenderingContext | null;
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
    const dpr = Math.min(window.devicePixelRatio || 1, 0.85);
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

  const paintAt = (timeSec: number) => {
    resize();
    draw(timeSec);
  };

  return { start, stop, destroy, paintAt };
}
