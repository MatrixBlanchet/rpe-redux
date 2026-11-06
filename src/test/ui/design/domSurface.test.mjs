/**
 * Shared DOM surface factory behavior: ref registration, resolve errors, and
 * the provider/hook contract that replaces the four hand-written surfaces.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDomSurface } from "../../../frontend/contracts/domSurface.ts";

function probeSurface(options = {}) {
  return createDomSurface(["panel", "canvas"], {
    selector: (key) => `probe.${key}`,
    provider: "ProbeSurfaceProvider",
    ...options,
  });
}

test("attach fills refs and resolve returns the attached nodes", () => {
  const factory = probeSurface();
  const handle = factory.create();
  const panel = { kind: "panel" };
  const canvas = { kind: "canvas" };

  assert.equal(handle.refs.panel.current, null);
  assert.equal(handle.refs.canvas.current, null);
  handle.attach.panel(panel);
  handle.attach.canvas(canvas);

  assert.equal(handle.refs.panel.current, panel);
  assert.equal(handle.refs.canvas.current, canvas);
  assert.deepEqual(handle.resolve(), { panel, canvas });

  handle.attach.panel(null);
  assert.equal(handle.refs.panel.current, null);
});

test("resolve reports the first missing key in declaration order", () => {
  const handle = probeSurface().create();
  assert.throws(() => handle.resolve(), {
    message: "The editor shell is missing a DOM node: probe.panel",
  });

  handle.attach.panel({ kind: "panel" });
  assert.throws(() => handle.resolve(), {
    message: "The editor shell is missing a DOM node: probe.canvas",
  });
});

test("listMissing joins every missing selector in declaration order", () => {
  const handle = probeSurface({ listMissing: true }).create();
  assert.throws(() => handle.resolve(), {
    message: "The editor shell is missing a DOM node: probe.panel, probe.canvas",
  });
});

test("useSurface and useAttach throw outside their provider", () => {
  const factory = probeSurface();
  function SurfaceProbe() {
    factory.useSurface();
    return null;
  }
  function AttachProbe() {
    factory.useAttach("panel");
    return null;
  }

  assert.throws(() => renderToStaticMarkup(createElement(SurfaceProbe)), {
    message: "The editor shell is missing a DOM node: ProbeSurfaceProvider",
  });
  assert.throws(() => renderToStaticMarkup(createElement(AttachProbe)), {
    message: "The editor shell is missing a DOM node: ProbeSurfaceProvider",
  });
});

test("provider supplies the handle without changing child DOM attributes", () => {
  const factory = probeSurface();
  const handle = factory.create();

  function Probe() {
    const surface = factory.useSurface();
    const attach = factory.useAttach("canvas");
    return createElement(
      "span",
      { className: "probe", "data-keys": Object.keys(surface.attach).join(",") },
      String(attach === surface.attach.canvas),
    );
  }

  const markup = renderToStaticMarkup(
    createElement(factory.Provider, { surface: handle }, createElement(Probe)),
  );
  assert.equal(markup, '<span class="probe" data-keys="panel,canvas">true</span>');
});
