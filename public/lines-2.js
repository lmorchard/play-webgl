function init() {

  console.time('scene');
  var shapes = {
    box: [
      [-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25], [-0.25, -0.25]
    ],
    star: [
      [0, 1], [0.25, 0.25], [1, 0], [0.25, -0.25], [0, -1], [-0.25, -0.25],
      [-1, 0], [-0.25, 0.25], [0, 1]
    ],
    plus: [
      [0, 1], [0.025, 0.025], [1, 0], [0.025, -0.025], [0, -1],
      [-0.025, -0.025], [-1, 0], [-0.025, 0.025], [0, 1]
    ],
    hero: [
      [-0.75, -0.75], [-0.5, 0.0], [-0.25, 0.5], [0.0, 0.25], [0.25, 0.5],
      [0.5, 0.0], [0.75, -0.75], [0.25, -0.25], [-0.25, -0.25], [-0.75, -0.75],
    ],
    enemy: [
      [0.0, 1], [-0.75, -1], [0.0, 0.0], [0.75, -1], [0.0, 1]
    ]
  };

  var scene = {
    hero: { shape: shapes.hero, position: [0, 0], scale: 0.125, deltaRotation: 0.002 },
    a001: { shape: shapes.plus, position: [0, 0], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a002: { shape: shapes.plus, position: [-0.5, -0.5], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a003: { shape: shapes.plus, position: [ 0.5, -0.5], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a004: { shape: shapes.plus, position: [-0.5,  0.5], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a005: { shape: shapes.plus, position: [ 0.5,  0.5], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a006: { shape: shapes.plus, position: [-1.0, -1.0], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a007: { shape: shapes.plus, position: [ 1.0, -1.0], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a008: { shape: shapes.plus, position: [-1.0,  1.0], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a009: { shape: shapes.plus, position: [ 1.0,  1.0], scale: 0.05, color: [0.3, 0.3, 0.3, 1.0] },
    a011: { shape: shapes.enemy, position: [0.5, 0.5], scale: 0.125, deltaRotation: -0.001 },
    a012: { shape: shapes.enemy, position: [-0.5, -0.5], scale: 0.125, deltaRotation: -0.001 },
    a013: { shape: shapes.enemy, position: [0.5, -0.5], scale: 0.125, deltaRotation: 0.001 },
    a014: { shape: shapes.enemy, position: [-0.5, 0.5], scale: 0.125, deltaRotation: 0.001 },
  };

  for (var i=0; i<200; i++) {
    scene[`b${i}`] = {
      shape: shapes.star,
      scale: 0.05,
      position: [1 - Math.random() * 2, 1 - Math.random() * 2],
      deltaPosition: [(0.5 - Math.random()) / 1000, (0.5 - Math.random()) / 1000],
      deltaRotation: Math.random() / 2,
      color: [Math.random(), Math.random(), Math.random(), 1.0]
    };
  }
  console.timeEnd('scene');

  console.time('initWebGL');
  var canvas = document.getElementById("c");
  const { gl, uniforms, attribs, vertexSize } = initWebGL(canvas);
  console.timeEnd('initWebGL');

  console.time('set initial uniforms');
  setUniforms(gl, uniforms, {
    uCameraZoom: [1.0],
    uCameraOrigin: [0, 0],
    uLineWidth: [0.003],
  });
  console.timeEnd('set initial uniforms');

  let buffer = new Float32Array(100000);

  let lastDrawTick;
  let currDrawTime = 0;

  function drawTick(ts) {
    if (!lastDrawTick) lastDrawTick = ts;
    currDrawTime += ts - lastDrawTick;
    lastDrawTick = ts;

    if (currDrawTime > 10000) currDrawTime = 0;

    gl.uniform1f(uniforms.uTime, currDrawTime);

    // Re-allocate larger buffer if current is too small for the scene.
    const bufferSize = calculateBufferSizeForScene(scene, vertexSize);
    if (bufferSize > buffer.length) {
      const oldSize = buffer.length;
      const newSize = Math.max(bufferSize * 1.5, buffer.length * 2);
      buffer = new Float32Array(newSize);
    }

    var vertexCount = fillBufferFromScene(scene, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1.0);
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);

    window.requestAnimationFrame(drawTick);
  };
  window.requestAnimationFrame(drawTick);
}

/* ---------------------------------------------------------------------- */

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants
const TYPE_SIZES = {
  0x1406: 1, // FLOAT
  0x8B50: 2, // FLOAT_VEC2
  0x8B51: 3, // FLOAT_VEC3
  0x8B52: 4  // FLOAT_VEC4
};

function initWebGL(canvas) {

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

  // Set up for data buffer
  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

  // First pass through attributes to count total vertex size and index by name
  var numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  var attribs = {};
  var vertexSize = 0;
  for (var i = 0; i < numAttribs; i++) {
    var info = gl.getActiveAttrib(program, i);
    var size = TYPE_SIZES[info.type];
    vertexSize += size;
    attribs[info.name] = i;
  }

  // Second pass through attributes to set up attribute pointers into the buffer
  var pos = 0;
  for (var i = 0; i < numAttribs; i++) {
    var info = gl.getActiveAttrib(program, i);
    var size = TYPE_SIZES[info.type];
    gl.vertexAttribPointer(i, size, gl.FLOAT, false, vertexSize * 4, pos * 4);
    gl.enableVertexAttribArray(i)
    pos += size;
  }

  // Index uniform locations by name
  var uniforms = {};
  var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < numUniforms; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }

  return { gl, uniforms, attribs, vertexSize };
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

function calculateBufferSizeForScene(scene, vertexSize) {
  return Object.values(scene).reduce((acc, item) =>
    acc + (item.shape.length - 0.5) * vertexSize * 4, 0);
}

function fillBufferFromScene(scene, buffer) {
  let vertexCount = 0;
  let bufferPos = 0;
  let shape, position, scale, rotation,
      deltaPosition, deltaScale, deltaRotation, color;

  const sceneKeys = Object.keys(scene);
  sceneKeys.sort();
  const sceneItems = sceneKeys.map(key => scene[key]);

  function bufferVertex(shapeIdx, lineIdx) {
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
  }

  for (let spriteIdx = 0; spriteIdx < sceneItems.length; spriteIdx++) {
    ({
      shape, position=[0.0, 0.0], scale=0, rotation=0,
      deltaPosition=[0.0, 0.0], deltaScale=0.0, deltaRotation=0.0,
      color=[1, 1, 1, 1]
    } = sceneItems[spriteIdx]);
    bufferVertex(1, 0);
    for (let shapeIdx = 1; shapeIdx < shape.length; shapeIdx += 1) {
      bufferVertex(shapeIdx, 0);
      bufferVertex(shapeIdx, 1);
      bufferVertex(shapeIdx, 2);
      bufferVertex(shapeIdx, 3);
    }
    bufferVertex(shape.length - 1, 3);
  }

  return vertexCount;
}

function setUniforms(gl, uniforms, data) {
  Object.keys(data).forEach(key =>
    gl[`uniform${data[key].length}f`]
      .call(gl, uniforms[key], ...data[key]));
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
  if (idx >= 2.0) {
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

init();
