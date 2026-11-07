/** Verifies the shared WebGL compile, link, buffer, attribute, and context-loss helpers. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  bindInstanceAttributes,
  compileShader,
  configureTextureSampling,
  createCornerBuffer,
  installContextLossHandlers,
  linkProgram,
} from "../../../frontend/screens/editor/canvas/webgl.ts";

/** Minimal WebGL stub that records every resource and state call. */
function fakeGL(options = {}) {
  const {
    compileStatus = true,
    linkStatus = true,
    shaderLog = "shader log",
    programLog = "program log",
  } = options;
  const calls = {
    shaderSources: [],
    compiled: [],
    deletedShaders: [],
    attached: [],
    linked: [],
    deletedPrograms: [],
    boundBuffers: [],
    bufferData: [],
    attributes: [],
    divisors: [],
    parameters: [],
  };
  const shaders = [];
  const programs = [];
  const buffers = [];
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    TEXTURE_2D: 7,
    TEXTURE_MIN_FILTER: 8,
    TEXTURE_MAG_FILTER: 9,
    TEXTURE_WRAP_S: 10,
    TEXTURE_WRAP_T: 11,
    LINEAR: 12,
    NEAREST: 13,
    CLAMP_TO_EDGE: 14,
    FLOAT: 15,
    createShader(type) {
      const shader = { type, index: shaders.length };
      shaders.push(shader);
      return shader;
    },
    shaderSource(shader, source) {
      calls.shaderSources.push({ shader, source });
    },
    compileShader(shader) {
      calls.compiled.push(shader);
    },
    getShaderParameter(shader, parameter) {
      return parameter === gl.COMPILE_STATUS ? compileStatus : false;
    },
    getShaderInfoLog() {
      return shaderLog;
    },
    deleteShader(shader) {
      calls.deletedShaders.push(shader);
    },
    createProgram() {
      const program = { index: programs.length };
      programs.push(program);
      return program;
    },
    attachShader(program, shader) {
      calls.attached.push({ program, shader });
    },
    linkProgram(program) {
      calls.linked.push(program);
    },
    getProgramParameter(program, parameter) {
      return parameter === gl.LINK_STATUS ? linkStatus : 0;
    },
    getProgramInfoLog() {
      return programLog;
    },
    deleteProgram(program) {
      calls.deletedPrograms.push(program);
    },
    createBuffer() {
      const buffer = { index: buffers.length };
      buffers.push(buffer);
      return buffer;
    },
    bindBuffer(target, buffer) {
      calls.boundBuffers.push({ target, buffer });
    },
    bufferData(target, data, usage) {
      calls.bufferData.push({ target, data, usage });
    },
    enableVertexAttribArray(location) {
      calls.attributes.push(["enable", location]);
    },
    vertexAttribPointer(location, size, type, normalized, stride, offset) {
      calls.attributes.push(["pointer", location, size, type, normalized, stride, offset]);
    },
    vertexAttribDivisor(location, divisor) {
      calls.divisors.push([location, divisor]);
    },
    texParameteri(target, parameter, value) {
      calls.parameters.push([target, parameter, value]);
    },
  };
  return { gl, calls };
}

/** Canvas stub with the two context lifecycle event channels. */
function fakeCanvas() {
  const listeners = new Map();
  return {
    canvas: {
      addEventListener(type, listener) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener(type, listener) {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
        );
      },
    },
    count(type) {
      return (listeners.get(type) ?? []).length;
    },
    dispatch(type) {
      const event = { type };
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
      return event;
    },
  };
}

test("compileShader returns a compiled stage and keeps it on success", () => {
  const { gl, calls } = fakeGL();
  const shader = compileShader(gl, gl.VERTEX_SHADER, "void main() {}");
  assert.equal(shader.type, gl.VERTEX_SHADER);
  assert.equal(calls.shaderSources.length, 1);
  assert.equal(calls.shaderSources[0].source, "void main() {}");
  assert.deepEqual(calls.compiled, [shader]);
  assert.deepEqual(calls.deletedShaders, []);
});

test("compileShader throws the driver log and releases a failed stage", () => {
  const { gl, calls } = fakeGL({ compileStatus: false, shaderLog: "bad vertex source" });
  assert.throws(
    () => compileShader(gl, gl.VERTEX_SHADER, "bad"),
    (error) => error instanceof Error && error.message === "bad vertex source",
  );
  assert.equal(calls.compiled.length, 1);
  assert.equal(calls.deletedShaders.length, 1);
  assert.equal(calls.deletedShaders[0], calls.compiled[0]);
  assert.equal(calls.linked.length, 0);
});

test("linkProgram links two sources and releases both stages", () => {
  const { gl, calls } = fakeGL();
  const program = linkProgram(gl, "vertex", "fragment");
  assert.deepEqual(
    calls.shaderSources.map((entry) => entry.source),
    ["vertex", "fragment"],
  );
  assert.equal(calls.attached.length, 2);
  assert.deepEqual(calls.linked, [program]);
  assert.equal(calls.deletedShaders.length, 2);
  assert.deepEqual(calls.deletedPrograms, []);
});

test("linkProgram throws the program log and releases the failed program", () => {
  const { gl, calls } = fakeGL({ linkStatus: false, programLog: "link mismatch" });
  assert.throws(
    () => linkProgram(gl, "vertex", "fragment"),
    (error) => error instanceof Error && error.message === "link mismatch",
  );
  assert.equal(calls.deletedShaders.length, 2);
  assert.equal(calls.deletedPrograms.length, 1);
  assert.equal(calls.deletedPrograms[0], calls.linked[0]);
});

test("createCornerBuffer uploads the unit quad and accepts custom vertices", () => {
  const { gl, calls } = fakeGL();
  const buffer = createCornerBuffer(gl);
  assert.equal(calls.boundBuffers[0].target, gl.ARRAY_BUFFER);
  assert.equal(calls.boundBuffers[0].buffer, buffer);
  assert.equal(calls.bufferData[0].target, gl.ARRAY_BUFFER);
  assert.equal(calls.bufferData[0].usage, gl.STATIC_DRAW);
  assert.deepEqual([...calls.bufferData[0].data], [0, 0, 1, 0, 0, 1, 1, 1]);

  const custom = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  createCornerBuffer(gl, custom);
  assert.equal(calls.bufferData[1].data, custom);
});

test("bindInstanceAttributes skips missing slots and uses float offsets", () => {
  const { gl, calls } = fakeGL();
  bindInstanceAttributes(
    gl,
    [
      { location: 3, size: 4, offsetFloats: 0 },
      { location: -1, size: 2, offsetFloats: 4 },
      { location: 5, size: 1, offsetFloats: 8 },
    ],
    9,
  );
  assert.deepEqual(calls.attributes, [
    ["enable", 3],
    ["pointer", 3, 4, gl.FLOAT, false, 36, 0],
    ["enable", 5],
    ["pointer", 5, 1, gl.FLOAT, false, 36, 32],
  ]);
  assert.deepEqual(calls.divisors, [
    [3, 1],
    [5, 1],
  ]);
});

test("configureTextureSampling applies linear clamp-to-edge parameters", () => {
  const { gl, calls } = fakeGL();
  configureTextureSampling(gl);
  assert.deepEqual(calls.parameters, [
    [gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR],
    [gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ]);
});

test("installContextLossHandlers forwards both events and uninstalls once", () => {
  const harness = fakeCanvas();
  const seen = [];
  const uninstall = installContextLossHandlers(harness.canvas, {
    onLost: (event) => seen.push(["lost", event.type]),
    onRestored: (event) => seen.push(["restored", event.type]),
  });
  assert.equal(harness.count("webglcontextlost"), 1);
  assert.equal(harness.count("webglcontextrestored"), 1);
  harness.dispatch("webglcontextlost");
  harness.dispatch("webglcontextrestored");
  assert.deepEqual(seen, [
    ["lost", "webglcontextlost"],
    ["restored", "webglcontextrestored"],
  ]);

  uninstall();
  assert.equal(harness.count("webglcontextlost"), 0);
  assert.equal(harness.count("webglcontextrestored"), 0);
  harness.dispatch("webglcontextlost");
  assert.equal(seen.length, 2);
  uninstall();
});
