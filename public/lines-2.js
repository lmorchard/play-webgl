const shaderVertex = `
// see also: http://m1el.github.io/woscope-how/
precision highp float;
#define EPS 1E-6

uniform float uSize;
uniform float uRotation;
uniform vec2 uOrigin;

attribute vec2 aStart, aEnd, aPos;
attribute float aIdx, aScale;

varying vec4 uvl;
varying float vLen;

void main () {
  mat3 mIdentity = mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
  mat3 mPosition = mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, aPos.x, aPos.y, 1.0);
  mat3 mScale = mat3(aScale, 0.0, 0.0, 0.0, aScale, 0.0, 0.0, 0.0, 1.0);

  float c = cos(uRotation);
  float s = sin(uRotation);
  mat3 mRotation = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
  mat3 mOrigin = mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, uOrigin.x, uOrigin.y, 1.0);

  vec2 tStart = (mOrigin * mPosition * mRotation * mScale * vec3(aStart, 1)).xy;
  vec2 tEnd = (mOrigin * mPosition * mRotation * mScale * vec3(aEnd, 1)).xy;

  float tang;
  vec2 current;
  float idx = mod(aIdx,4.0);
  if (idx >= 2.0) {
    current = tEnd;
    tang = 1.0;
  } else {
    current = tStart;
    tang = -1.0;
  }

  float side = (mod(idx, 2.0)-0.5)*2.0;
  vec2 dir = tEnd-tStart;

  uvl.xy = vec2(tang, side);
  uvl.w = floor(aIdx / 4.0 + 0.5);
  uvl.z = length(dir);
  if (uvl.z > EPS) {
    dir = dir / uvl.z;
  } else {
    // If the segment is too short draw a square;
    dir = vec2(1.0, 0.0);
  }
  vec2 norm = vec2(-dir.y, dir.x);
  gl_Position = vec4((current+(tang*dir+norm*side)*uSize),0.0,1.0);
}
`;

const shaderFragment = `
void main (void)
{
    gl_FragColor = vec4(0.5, 1.0, 0.5, 1.0);
}
/*
precision highp float;
#define EPS 1E-6
#define TAU 6.283185307179586
#define TAUR 2.5066282746310002
#define SQRT2 1.4142135623730951
uniform float uSize;
uniform float uIntensity;
uniform vec4 uColor;
varying vec4 uvl;
float gaussian(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma)) / (TAUR * sigma);
}

float erf(float x) {
  float s = sign(x), a = abs(x);
  x = 1.0 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;
  x *= x;
  return s - s / (x * x);
}
void main (void)
{
  float len = uvl.z;
  vec2 xy = vec2((len/2.0+uSize)*uvl.x+len/2.0, uSize*uvl.y);
  float alpha;

  float sigma = uSize/4.0;
  if (len < EPS) {
    // If the beam segment is too short, just calculate intensity at the position.
    alpha = exp(-pow(length(xy),2.0)/(2.0*sigma*sigma))/2.0/sqrt(uSize);
  } else {
    // Otherwise, use analytical integral for accumulated intensity.
    alpha = erf((len-xy.x)/SQRT2/sigma) + erf(xy.x/SQRT2/sigma);
    alpha *= exp(-xy.y*xy.y/(2.0*sigma*sigma))/2.0/len*uSize;
  }
  alpha = 1.0;
  float afterglow = smoothstep(0.0, 0.33, uvl.w/2048.0);
  alpha *= afterglow * uIntensity;
  // gl_FragColor = vec4(vec3(uColor), uColor.a * alpha);
  gl_FragColor = vec4(uvl.x, uvl.w, uvl.y, 1.0);
  // gl_FragColor = vec4(0.3, 1.0, 0.3, 1.0);
}
*/
`;

function zip(keys, fn) {
  const out = {};
  keys.forEach((key, idx) => out[key] = fn(key, idx));
  return out;
}

function setUniforms(uniforms, data) {
  Object.keys(data).forEach(key =>
    gl[`uniform${data[key].length}f`]
      .call(gl, uniforms[key], ...data[key]));
}

var points = [
  [-0.75, -0.75],
  [-0.5, 0.0],
  [-0.25, 0.5],
  [0.0, 0.25],
  [0.25, 0.5],
  [0.5, 0.0],
  [0.75, -0.75],
  [0.25, -0.25],
  [-0.25, -0.25],
  [-0.75, -0.75],
];

var lines = points.slice(2).reduce(
  (a, p) => a.concat([[a[a.length-1][1], p]]),
  [[points[0], points[1]]]
);

var canvas = document.getElementById("c");
resizeCanvasToDisplaySize(canvas);

var gl = canvas.getContext("webgl", {
  antialias: true,
  preserveDrawingBuffer: true,
  premultipliedAlpha: true
});

var program = createProgram(gl,
  createShader(gl, gl.VERTEX_SHADER, shaderVertex),
  createShader(gl, gl.FRAGMENT_SHADER, shaderFragment)
);
gl.useProgram(program);

var uniforms = zip([
  'uColor', 'uIntensity', 'uSize', 'uRotation', 'uOrigin'
], name => gl.getUniformLocation(program, name));

setUniforms(uniforms, {
  uOrigin: [0, 0],
  uSize: [0.012],
  uIntensity: [1.0],
  uColor: [0.1, 1.0, 0.1, 1.0],
});

var position = [0, 0];
var scale = 0.5;

var attribsSpec = [
  ['aIdx', 1],
  ['aStart', 2],
  ['aEnd', 2],
  ['aPos', 2],
  ['aScale', 1]
];

var DATA_ITEM_LEN = 4;
var data = new Float32Array(lines.reduce((acc, line) => {
  var sx = line[0][0];
  var sy = line[0][1];
  var ex = line[1][0];
  var ey = line[1][1];
  return acc.concat([
    0, sx, sy, ex, ey, position[0], position[1], scale,
    1, sx, sy, ex, ey, position[0], position[1], scale,
    2, sx, sy, ex, ey, position[0], position[1], scale,
    3, sx, sy, ex, ey, position[0], position[1], scale,
  ]);
}, []));

var vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

var attribs = {};
var pos = 0;
var total = attribsSpec.reduce((sum, [name, size]) => sum + size, 0);
attribsSpec.forEach(([name, size]) => {
  const attrib = attribs[name] = gl.getAttribLocation(program, name);
  gl.vertexAttribPointer(attrib, size, gl.FLOAT, false, total * 4, pos * 4);
  gl.enableVertexAttribArray(attrib)
  pos += size;
});

var rot = 0;
setInterval(drawScene, 16);

function drawScene() {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
  gl.clearColor(0, 0, 0, 1.0);

  rot = rot + (Math.PI * 0.008);
  if (rot > Math.PI * 2) { rot = 0; }

  gl.uniform1f(uniforms.uRotation, rot);
  // gl.uniform2f(uniforms.uOrigin, Math.cos(rot) / 2, Math.sin(rot) / 2);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, lines.length * DATA_ITEM_LEN);
}

function getElementText(id) {
  return document.getElementById(id).text;
}

function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

function randomInt(range) {
  return Math.floor(Math.random() * range);
}

function resizeCanvasToDisplaySize(canvas, multiplier) {
  multiplier = multiplier || 1;
  var width  = canvas.clientWidth  * multiplier | 0;
  var height = canvas.clientHeight * multiplier | 0;
  if (canvas.width !== width ||  canvas.height !== height) {
    canvas.width  = width;
    canvas.height = height;
    return true;
  }
  return false;
}
