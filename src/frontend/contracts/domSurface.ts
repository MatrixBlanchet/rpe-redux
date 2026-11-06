/**
 * Shared ref/context factory for imperative DOM surfaces.
 *
 * Each feature declares its element keys and missing-node selector text; this
 * module owns the ref map, attach callbacks, context, resolve check, and the
 * error used when a host node has not mounted.
 */
import {
  createContext,
  createElement,
  useContext,
  type ReactElement,
  type ReactNode,
  type RefCallback,
  type RefObject,
} from "react";
import { t } from "../../i18n/index.ts";

/** Mutable ref set for every key in one DOM surface. */
export type DomSurfaceRefs<T extends Record<keyof T, Element>> = {
  readonly [K in keyof T]: RefObject<T[K] | null>;
};

/** Attach callbacks and resolved nodes for one DOM surface. */
export interface DomSurfaceHandle<T extends Record<keyof T, Element>> {
  readonly attach: { readonly [K in keyof T]: RefCallback<T[K]> };
  readonly refs: DomSurfaceRefs<T>;
  resolve(): T;
}

/** Props shared by every surface provider. */
export interface DomSurfaceProviderProps<T extends Record<keyof T, Element>> {
  readonly surface: DomSurfaceHandle<T>;
  readonly children: ReactNode;
}

/** Missing-node naming and provider label for one surface. */
export interface DomSurfaceOptions<T extends Record<keyof T, Element>> {
  /** Selector text for one key, such as `timeline.stage`. */
  readonly selector: (key: keyof T) => string;
  /** Provider label reported when `useSurface` runs outside its tree. */
  readonly provider: string;
  /** Report every missing key at once instead of stopping at the first. */
  readonly listMissing?: boolean;
}

/** React-facing contract returned by `createDomSurface`. */
export interface DomSurface<T extends Record<keyof T, Element>> {
  /** Create the mutable handle for one mounted editor. */
  create(): DomSurfaceHandle<T>;
  /** Provide a created handle to its subtree. */
  Provider(props: DomSurfaceProviderProps<T>): ReactElement;
  /** Attach callback for one key from the enclosing surface. */
  useAttach<K extends keyof T>(key: K): RefCallback<T[K]>;
  /** The enclosing surface handle. */
  useSurface(): DomSurfaceHandle<T>;
}

/** Mutable ref holder for one DOM node. */
function cell<T extends Element>(): RefObject<T | null> {
  return { current: null };
}

/**
 * Create the ref cells and attach callbacks for one surface.
 *
 * `keys` preserves the declaration order used by the resolve error and the
 * returned surface object.
 */
function createHandle<T extends Record<keyof T, Element>>(
  keys: readonly (keyof T)[],
  options: DomSurfaceOptions<T>,
): DomSurfaceHandle<T> {
  const refs = Object.fromEntries(keys.map((key) => [key, cell<Element>()])) as DomSurfaceRefs<T>;
  const attach = Object.fromEntries(
    keys.map((key) => [
      key,
      (node: Element | null) => {
        (refs[key] as RefObject<Element | null>).current = node;
      },
    ]),
  ) as DomSurfaceHandle<T>["attach"];
  return {
    refs,
    attach,
    resolve() {
      const missing = keys.filter((key) => !refs[key].current);
      if (missing.length > 0) {
        const selectors = missing.map((key) => options.selector(key));
        throw new Error(
          t("editor.app.error.missingShellNode", {
            selector: options.listMissing ? selectors.join(", ") : selectors[0],
          }),
        );
      }
      return Object.fromEntries(keys.map((key) => [key, refs[key].current])) as unknown as T;
    },
  };
}

/**
 * Build one surface factory with its own React context.
 *
 * Every feature gets an isolated context, while the ref map, attach set,
 * resolve check, and missing-node error stay identical across surfaces.
 */
export function createDomSurface<T extends Record<keyof T, Element>>(
  keys: readonly (keyof T)[],
  options: DomSurfaceOptions<T>,
): DomSurface<T> {
  const Context = createContext<DomSurfaceHandle<T> | null>(null);

  /** Provide one surface handle to its subtree without adding a DOM node. */
  function Provider({ surface, children }: DomSurfaceProviderProps<T>): ReactElement {
    return createElement(Context.Provider, { value: surface }, children);
  }

  /** Read the enclosing surface handle. */
  function useSurface(): DomSurfaceHandle<T> {
    const surface = useContext(Context);
    if (!surface) {
      throw new Error(t("editor.app.error.missingShellNode", { selector: options.provider }));
    }
    return surface;
  }

  /** Read one attach callback from the enclosing surface handle. */
  function useAttach<K extends keyof T>(key: K): RefCallback<T[K]> {
    return useSurface().attach[key];
  }

  return {
    create: () => createHandle(keys, options),
    Provider,
    useAttach,
    useSurface,
  };
}
