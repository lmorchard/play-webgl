const shaderVertex = `
// see also: http://m1el.github.io/woscope-how/
precision highp float;
#define EPS 1E-6

uniform float uTime;
uniform float uLineWidth;
uniform float uCameraZoom;
uniform float uCameraRotation;
uniform vec2 uCameraOrigin;

attribute vec2 aStart, aEnd;
attribute float aIdx;
attribute vec4 aTransform;
attribute vec4 aDeltaTransform;

varying vec4 uvl;
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
  vec2 tStart = (mAll * vec3(aStart, 1)).xy;
  vec2 tEnd = (mAll * vec3(aEnd, 1)).xy;

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
uniform float uLineWidth;
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
  vec2 xy = vec2((len/2.0+uLineWidth)*uvl.x+len/2.0, uLineWidth*uvl.y);
  float alpha;

  float sigma = uLineWidth/4.0;
  if (len < EPS) {
    // If the beam segment is too short, just calculate intensity at the position.
    alpha = exp(-pow(length(xy),2.0)/(2.0*sigma*sigma))/2.0/sqrt(uLineWidth);
  } else {
    // Otherwise, use analytical integral for accumulated intensity.
    alpha = erf((len-xy.x)/SQRT2/sigma) + erf(xy.x/SQRT2/sigma);
    alpha *= exp(-xy.y*xy.y/(2.0*sigma*sigma))/2.0/len*uLineWidth;
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

var shapes = {
  box: [
    [-0.25, -0.25],
    [0.25, -0.25],
    [0.25, 0.25],
    [-0.25, 0.25],
    [-0.25, -0.25]
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

var scene = [
  { shape: shapes.box, position: [0, 0], scale: 0.025 },
  { shape: shapes.box, position: [-1.0, -1.0], scale: 0.025 },
  { shape: shapes.box, position: [ 1.0, -1.0], scale: 0.025 },
  { shape: shapes.box, position: [-1.0,  1.0], scale: 0.025 },
  { shape: shapes.box, position: [ 1.0,  1.0], scale: 0.025 },
  { shape: shapes.hero, position: [0, 0], scale: 0.25, deltaRotation: 0.002 },
  { shape: shapes.enemy, position: [0.5, 0.5], deltaPosition: [-0.0002, -0.0002], scale: 0.25, deltaRotation: -0.001 }
];

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
  'uTime', 'uColor', 'uIntensity', 'uLineWidth', 'uCameraZoom', 'uCameraRotation', 'uCameraOrigin'
], name => gl.getUniformLocation(program, name));

setUniforms(uniforms, {
  uCameraZoom: [0.75],
  uCameraOrigin: [0, 0],
  uLineWidth: [0.004],
  uIntensity: [1.0],
  uColor: [0.1, 1.0, 0.1, 1.0],
});

var vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

var attribsSpec = [
  ['aIdx', 1],
  ['aStart', 2],
  ['aEnd', 2],
  ['aTransform', 4],
  ['aDeltaTransform', 4]
];

var attribs = {};
var pos = 0;
var indexSize = attribsSpec.reduce((sum, [name, size]) => sum + size, 0);
attribsSpec.forEach(([name, size]) => {
  const attrib = attribs[name] = gl.getAttribLocation(program, name);
  gl.vertexAttribPointer(attrib, size, gl.FLOAT, false, indexSize * 4, pos * 4);
  gl.enableVertexAttribArray(attrib)
  pos += size;
});

var data = [];
var dataCount = 0;
scene.forEach(({
  shape, position, scale, rotation,
  deltaPosition=[], deltaScale, deltaRotation
}) => {
  var toAdd = shape
    .slice(2)
    .reduce(
      (a, p) => a.concat([[a[a.length-1][1], p]]),
      [[shape[0], shape[1]]]
    )
    .reduce((acc, line) => {
      var sx = line[0][0];
      var sy = line[0][1];
      var ex = line[1][0];
      var ey = line[1][1];
      dataCount += 4;
      var common = [
        sx, sy, ex, ey,
        position[0], position[1], scale || 0, rotation || 0,
        deltaPosition[0] || 0, deltaPosition[1] || 0, deltaScale || 0, deltaRotation || 0
      ];
      return acc.concat(...[0, 1, 2, 3].map(idx => [idx].concat(common)));
    }, []);

  // Add degenerate triangles between shapes to disconnect them.
  dataCount += 2;
  const firstV = toAdd.slice(0, indexSize);
  const lastV = toAdd.slice(toAdd.length - indexSize, toAdd.length);
  data = data.concat(firstV.concat(toAdd, lastV));
});
data = new Float32Array(data);

gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

var lastTick;
var currTime = 0;
function drawTick(ts) {
  if (!lastTick) lastTick = ts;
  currTime += ts - lastTick;
  lastTick = ts;
  gl.uniform1f(uniforms.uTime, currTime);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
  gl.clearColor(0, 0, 0, 1.0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, dataCount);

  window.requestAnimationFrame(drawTick);
};
window.requestAnimationFrame(drawTick);

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
