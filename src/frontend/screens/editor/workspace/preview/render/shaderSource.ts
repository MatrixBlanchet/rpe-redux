/**
 * The GLSL source adapter: one fragment-shader dialect in, a portable one out.
 *
 * Ported shader text arrives in the RPE dialect (`CC_Texture0`, `screenSize`, a
 * fixed `rectMin`/`rectMax` pair) and is rewritten so the pipeline can link it on
 * either WebGL version. That rewriting is pure string work with no GL state.
 */

/** Vertex shader shared by every compiled fragment program. */
export const VERTEX_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
varying vec4 v_fragmentColor;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
  v_fragmentColor = vec4(1.0);
}`;

/**
 * Rewrites one chart shader into a linkable fragment source.
 *
 * `webgl2` selects the GLSL ES 3.00 headers and the alternative coordinate
 * spellings; the returned text always exposes `rpeMain` plus the sampling
 * helpers the wrapper calls.
 */
export function fragmentSource(source: string, webgl2 = false): string {
  const portable = /uniform\s+sampler2D\s+screenTexture\b/.test(source);
  const origin = portable ? "vec2(0.0)" : "vec2(0.0, 0.0333)";
  const size = portable ? "vec2(1.0)" : "vec2(0.7031, 1.0 / 1.2)";
  const coordinate = portable ? "uv" : "v_texCoord";
  let body = source
    .replace(/^\s*#version[^\n]*\n/, "")
    .replaceAll("CC_Texture0", "u_texture")
    .replace(/\bscreenTexture\b/g, "u_texture")
    .replace(/\bscreenSize\b/g, "resolution");
  body = body.replace(/uniform\s+sampler2D\s+\w+\s*;/g, "");
  body = body.replace(
    /gl_FragCoord\.xy/g,
    "((v_texCoord - rpeRectMin) / (rpeRectMax - rpeRectMin) * resolution)",
  );
  if (portable) {
    body = body.replace(/\btime\b/g, "u_time");
  }
  body = body
    .replace(new RegExp(`varying\\s+(?:(?:lowp|mediump|highp)\\s+)?vec2\\s+${coordinate}\\s*;`), "")
    .replace(new RegExp(`\\b${coordinate}\\b`, "g"), "rpeCoordinate")
    .replace(/\btexture2DProj\s*\(/g, "rpeSampleProj(")
    .replace(/\btexture2D\s*\(/g, "rpeSample(")
    .replace(/void\s+main\s*\(\s*(?:void)?\s*\)/, "void rpeMain()");
  if (!portable) {
    body = body
      .replace(/const\s+vec2\s+rectMin\s*=\s*vec2\([^;]+\);/, `const vec2 rectMin = ${origin};`)
      .replace(
        /const\s+vec2\s+rectMax\s*=\s*vec2\([^;]+\);/,
        `const vec2 rectMax = ${origin} + ${size};`,
      );
  }
  const adapted = `precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_texCoord;
uniform vec2 rpeRectMin;
uniform vec2 rpeRectMax;
vec2 rpeCoordinate;
vec4 rpeSample(sampler2D source, vec2 coordinate) {
  vec2 local = (coordinate - ${origin}) / ${size};
  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) return vec4(0.0);
  return texture2D(source, mix(rpeRectMin, rpeRectMax, local));
}
vec4 rpeSampleProj(sampler2D source, vec4 coordinate) { return rpeSample(source, coordinate.xy / coordinate.w); }
vec4 rpeSampleProj(sampler2D source, vec3 coordinate) { return rpeSample(source, coordinate.xy / coordinate.z); }
${body}
void main() {
  if (v_texCoord.x < rpeRectMin.x || v_texCoord.x > rpeRectMax.x || v_texCoord.y < rpeRectMin.y || v_texCoord.y > rpeRectMax.y) gl_FragColor = vec4(0.0);
  else {
    rpeCoordinate = ${origin} + (v_texCoord - rpeRectMin) / (rpeRectMax - rpeRectMin) * ${size};
    rpeMain();
  }
}
`;
  return webgl2
    ? "#version 300 es\n" +
        adapted
          .replace(/varying\b/g, "in")
          .replace(/gl_FragColor\b/g, "rpeFragColor")
          .replace(/texture2D\b/g, "texture")
          .replace(
            "uniform sampler2D u_texture;",
            "out vec4 rpeFragColor;\nuniform sampler2D u_texture;",
          )
    : adapted;
}
