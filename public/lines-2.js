var shapes = {
  box: [
    [-0.25, -0.25],
    [0.25, -0.25],
    [0.25, 0.25],
    [-0.25, 0.25],
    [-0.25, -0.25]
  ],
  star: [
    [0, 1],
    [0.25, 0.25],
    [1, 0],
    [0.25, -0.25],
    [0, -1],
    [-0.25, -0.25],
    [-1, 0],
    [-0.25, 0.25],
    [0, 1]
  ],
  plus: [
    [0, 1],
    [0.025, 0.025],
    [1, 0],
    [0.025, -0.025],
    [0, -1],
    [-0.025, -0.025],
    [-1, 0],
    [-0.025, 0.025],
    [0, 1]
  ],
  hero: [
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
  ],
  enemy: [
    [0.0, 1],
    [-0.75, -1],
    [0.0, 0.0],
    [0.75, -1],
    [0.0, 1]
  ]
};

console.time('scene');
var scene = [
  { shape: shapes.plus, position: [0, 0], scale: 0.05 },
  { shape: shapes.plus, position: [-0.5, -0.5], scale: 0.05 },
  { shape: shapes.plus, position: [ 0.5, -0.5], scale: 0.05 },
  { shape: shapes.plus, position: [-0.5,  0.5], scale: 0.05 },
  { shape: shapes.plus, position: [ 0.5,  0.5], scale: 0.05 },
  { shape: shapes.plus, position: [-1.0, -1.0], scale: 0.05 },
  { shape: shapes.plus, position: [ 1.0, -1.0], scale: 0.05 },
  { shape: shapes.plus, position: [-1.0,  1.0], scale: 0.05 },
  { shape: shapes.plus, position: [ 1.0,  1.0], scale: 0.05 },
  { shape: shapes.hero, position: [0, 0], scale: 0.125, deltaRotation: 0.002 },
  { shape: shapes.enemy, position: [0.5, 0.5], scale: 0.125, deltaRotation: -0.001 }
];
for (var i=0; i<2000; i++) {
  scene.push({
    shape: shapes.star,
    scale: 0.05,
    position: [1 - Math.random() * 2, 1 - Math.random() * 2],
    deltaPosition: [(0.5 - Math.random()) / 1000, (0.5 - Math.random()) / 1000],
    deltaRotation: Math.random() / 2,
    color: [Math.random(), Math.random(), Math.random(), 1.0]
  });
}
console.timeEnd('scene');

var canvas = document.getElementById("c");
resizeCanvasToDisplaySize(canvas);

var gl = canvas.getContext("webgl", {
  antialias: true,
  preserveDrawingBuffer: true,
  premultipliedAlpha: true
});

var program = createProgram(gl,
  createShader(gl, gl.VERTEX_SHADER, shaderVertex()),
  createShader(gl, gl.FRAGMENT_SHADER, shaderFragment())
);
gl.useProgram(program);

var numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
for (var i=0; i<numAttribs; i++) {
  var info = gl.getActiveAttrib(program, i);
  console.log(i, info);
}

var uniforms = zip([
  'uTime', 'uColor', 'uIntensity', 'uLineWidth', 'uCameraZoom', 'uCameraRotation', 'uCameraOrigin'
], name => gl.getUniformLocation(program, name));

setUniforms(uniforms, {
  uCameraZoom: [1.0],
  uCameraOrigin: [0, 0],
  uLineWidth: [0.003],
  uIntensity: [1.0],
  uColor: [0.1, 1.0, 0.1, 1.0],
});

var vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

var attribsSpec = [
  ['aIdx', 1],
  ['aLine', 4],
  ['aTransform', 4],
  ['aDeltaTransform', 4],
  ['aColor', 4],
];
var vertexSize = attribsSpec.reduce((sum, [name, size]) => sum + size, 0);

var attribs = {};
var pos = 0;
attribsSpec.forEach(([name, size]) => {
  const attrib = attribs[name] = gl.getAttribLocation(program, name);
  gl.vertexAttribPointer(attrib, size, gl.FLOAT, false, vertexSize * 4, pos * 4);
  gl.enableVertexAttribArray(attrib)
  pos += size;
});

console.time('allocating buffer');
const buffer = new Float32Array(scene.reduce((acc, item) =>
  acc + (item.shape.length - 0.5) * vertexSize * 4, 0));
console.timeEnd('allocating buffer');
console.log('buffer alloc', buffer.length);

console.time('building buffer');
var vertexCount = 0;
var bufferPos = 0;
const bufferVertex = (shapeIdx, lineIdx, {
  shape, position, scale=0, rotation=0,
  deltaPosition=[0.0, 0.0], deltaScale=0.0, deltaRotation=0.0,
  color=[1, 1, 1, 1]
}) => {
  vertexCount++;
  buffer[bufferPos++] = lineIdx;
  buffer[bufferPos++] = shape[shapeIdx - 1][0];
  buffer[bufferPos++] = shape[shapeIdx - 1][1];
  buffer[bufferPos++] = shape[shapeIdx][0];
  buffer[bufferPos++] = shape[shapeIdx][1];
  buffer[bufferPos++] = position[0];
  buffer[bufferPos++] = position[1];
  buffer[bufferPos++] = scale;
  buffer[bufferPos++] = rotation;
  buffer[bufferPos++] = deltaPosition[0];
  buffer[bufferPos++] = deltaPosition[1];
  buffer[bufferPos++] = deltaScale;
  buffer[bufferPos++] = deltaRotation;
  buffer[bufferPos++] = color[0];
  buffer[bufferPos++] = color[1];
  buffer[bufferPos++] = color[2];
  buffer[bufferPos++] = color[3];
};
scene.forEach(sprite => {
  bufferVertex(1, 0, sprite);
  for (let shapeIdx = 1; shapeIdx < sprite.shape.length; shapeIdx += 1) {
    for (let lineIdx = 0; lineIdx < 4; lineIdx++) {
      bufferVertex(shapeIdx, lineIdx, sprite);
    }
  }
  bufferVertex(sprite.shape.length - 1, 3, sprite);
});
console.timeEnd('building buffer');
console.log('buffer used', bufferPos);

console.time('buffering');
gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
console.timeEnd('buffering');

var lastTick;
var currTime = 0;
function drawTick(ts) {
  if (!lastTick) lastTick = ts;
  currTime += ts - lastTick;
  if (currTime > 20000) currTime = 0;
  lastTick = ts;
  gl.uniform1f(uniforms.uTime, currTime);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
  gl.clearColor(0, 0, 0, 1.0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);

  window.requestAnimationFrame(drawTick);
};
window.requestAnimationFrame(drawTick);

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

  console.log('shader', type, 'failed to compile', gl.getShaderInfoLog(shader));
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

function shaderVertex() {
  return `
// see also: http://m1el.github.io/woscope-how/
precision mediump float;
#define EPS 1E-6

uniform float uTime;
uniform float uLineWidth;
uniform float uCameraZoom;
uniform float uCameraRotation;
uniform vec2 uCameraOrigin;

attribute float aIdx;
attribute vec4 aLine;
attribute vec4 aTransform;
attribute vec4 aDeltaTransform;
attribute vec4 aColor;

varying vec4 uvl;
varying vec4 vColor;
varying float vLen;

void main () {
  float c, s;

  c = cos(uCameraRotation);
  s = sin(uCameraRotation);
  mat3 mCameraRotation = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
  mat3 mCameraOrigin = mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, uCameraOrigin.x, uCameraOrigin.y, 1.0);
  mat3 mCameraZoom = mat3(uCameraZoom, 0.0, 0.0, 0.0, uCameraZoom, 0.0, 0.0, 0.0, 1.0);

  float dr = 0.001;
  float localRotation = dr * uTime;

  c = cos(aTransform.w + (aDeltaTransform.w * uTime));
  s = sin(aTransform.w + (aDeltaTransform.w * uTime));
  mat3 mRotation = mat3(
    c, -s, 0.0,
    s, c, 0.0,
    0.0, 0.0, 1.0
  );
  mat3 mPosition = mat3(
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    aTransform.x + (aDeltaTransform.x * uTime), aTransform.y + (aDeltaTransform.y * uTime), 1.0
  );
  mat3 mScale = mat3(
    aTransform.z + (aDeltaTransform.z * uTime), 0.0, 0.0,
    0.0, aTransform.z + (aDeltaTransform.z * uTime), 0.0,
    0.0, 0.0, 1.0
  );

  mat3 mAll = mCameraZoom * mCameraOrigin * mCameraRotation * mPosition * mScale * mRotation;
  vec2 tStart = (mAll * vec3(aLine.xy, 1)).xy;
  vec2 tEnd = (mAll * vec3(aLine.zw, 1)).xy;

  float tang;
  vec2 current;
  float idx = aIdx;
  if (idx == -1.0) {
    tang = 0.0;
  } else if (idx >= 2.0) {
    current = tEnd;
    tang = 1.0;
  } else {
    current = tStart;
    tang = -1.0;
  }

  float side = (mod(idx, 2.0)-0.5)*2.0;
  vec2 dir = tEnd-tStart;

  vColor = aColor;

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
  gl_Position = vec4((current+(tang*dir+norm*side)*uLineWidth),0.0,1.0);
}
`;
}

function shaderFragment() {
 return `
precision mediump float;
varying vec4 vColor;

void main (void)
{
    gl_FragColor = vColor;
}
`;
}
