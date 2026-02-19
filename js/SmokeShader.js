// ============================================================
// SmokeShader – WebGL2 FBM smoke overlay for the menu
// Rendered on a separate canvas placed behind Phaser.
// ============================================================

const SMOKE_VERT = `#version 300 es
precision mediump float;
const vec2 positions[6] = vec2[6](
  vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0),
  vec2(-1.0, 1.0), vec2(1.0,-1.0), vec2(1.0, 1.0)
);
out vec2 uv;
void main() {
  uv = positions[gl_VertexID] * 0.5 + 0.5;
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}`;

const SMOKE_FRAG = `#version 300 es
precision highp float;

uniform float time;
uniform vec2  vp;

in  vec2 uv;
out vec4 fragColor;

float rand(vec2 p) {
  return fract(sin(dot(p, vec2(1.0, 300.0))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = rand(i);
  float b = rand(i + vec2(1.0, 0.0));
  float c = rand(i + vec2(0.0, 1.0));
  float d = rand(i + vec2(1.0, 1.0));
  vec2  u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

#define OCTAVES 5
float fbm(vec2 p) {
  float v = 0.0, amp = 0.45;
  for (int i = 0; i < OCTAVES; i++) {
    v   += amp * noise(p);
    p   *= 2.0;
    amp *= 0.42;
  }
  return v;
}

void main() {
  vec2 p  = uv;
  p.x    *= vp.x / vp.y;

  // Smoke fills bottom half, fades to transparent above
  float rise   = smoothstep(0.80, 0.0, uv.y);
  if (rise < 0.001) discard;

  float speed   = 0.15;
  float details = 6.0;
  float force   = 0.88;
  float shift   = 0.32;

  vec2  fast = vec2(p.x, p.y - time * speed) * details;
  float ns_a = fbm(fast);
  float ns_b = force * fbm(fast + ns_a + time * 0.6) - shift;
  float nns  = force * fbm(vec2(ns_a, ns_b));
  float ins  = fbm(vec2(ns_b, ns_a));

  // Rouge/orange ninja palette
  vec3 dark  = vec3(0.30, 0.04, 0.01); // rouge sombre
  vec3 mid   = vec3(0.70, 0.22, 0.04); // orange brûlé
  vec3 light = vec3(0.95, 0.55, 0.10); // orange clair / braise

  vec3 col   = mix(dark, mid, ns_a);
  col        = mix(col, light, clamp(ins * 1.2, 0.0, 1.0));

  // Densité de la fumée
  float density = clamp(nns * 1.8 - 0.05, 0.0, 1.0);

  float alpha = density * rise * 1.0;
  fragColor   = vec4(col * alpha, alpha);
}`;

class SmokeShader {
  constructor() {
    this._canvas  = null;
    this._gl      = null;
    this._program = null;
    this._rafId   = null;
    this._startTime = 0;
    this._resizeHandler = () => this._resize();
  }

  start() {
    if (this._canvas) return; // already running

    this._canvas = document.createElement('canvas');
    this._canvas.id = 'smoke-canvas';
    // Insert before #game so it sits behind Phaser's canvas
    const gameDiv = document.getElementById('game');
    gameDiv.parentNode.insertBefore(this._canvas, gameDiv);

    this._gl = this._canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true });
    if (!this._gl) { this._canvas.remove(); this._canvas = null; return; }

    this._startTime = Date.now();
    this._buildProgram();
    this._resize();
    window.addEventListener('resize', this._resizeHandler);
    this._rafId = requestAnimationFrame(this._render);
  }

  stop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    window.removeEventListener('resize', this._resizeHandler);
    if (this._canvas) { this._canvas.remove(); this._canvas = null; }
    this._gl = null;
    this._program = null;
  }

  _buildProgram() {
    const gl = this._gl;
    const prog = gl.createProgram();

    [SMOKE_VERT, SMOKE_FRAG].forEach((src, i) => {
      const type   = i === 0 ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('SmokeShader compile error:', gl.getShaderInfoLog(shader));
        return;
      }
      gl.attachShader(prog, shader);
    });

    gl.linkProgram(prog);
    gl.useProgram(prog);
    this._program = prog;
    this._uTime = gl.getUniformLocation(prog, 'time');
    this._uVp   = gl.getUniformLocation(prog, 'vp');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  _resize() {
    if (!this._canvas) return;
    const gameCanvas = document.querySelector('#game canvas');
    if (gameCanvas && gameCanvas.width > 0) {
      // Match Phaser canvas size and position exactly
      const rect = gameCanvas.getBoundingClientRect();
      this._canvas.width  = gameCanvas.width;
      this._canvas.height = gameCanvas.height;
      this._canvas.style.width  = rect.width  + 'px';
      this._canvas.style.height = rect.height + 'px';
      this._canvas.style.left   = rect.left   + 'px';
      this._canvas.style.top    = rect.top    + 'px';
    } else {
      // Phaser canvas not ready yet — retry in 200ms
      setTimeout(() => this._resize(), 200);
      return;
    }
    if (this._gl) this._gl.viewport(0, 0, this._canvas.width, this._canvas.height);
  }

  _render = () => {
    const gl = this._gl;
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(this._uTime, (Date.now() - this._startTime) / 1000);
    gl.uniform2fv(this._uVp, [this._canvas.width, this._canvas.height]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this._rafId = requestAnimationFrame(this._render);
  };
}

const smokeShader = new SmokeShader();
