/**
 * Asset workspace for the drawer.
 *
 * The workspace owns the tree, import actions, and the one mount that prepares
 * the asset library. The inspector beside it only shows the selected image.
 */
import { useEffect, useRef } from "react";
import { useInspectorRuntime } from "../../../editor/workspace/runtime/providers/InspectorProvider.tsx";
import { AssetsPanel } from "./AssetsPanel.tsx";

/**
 * Renders the asset tree and import actions, and builds the library once per mount.
 *
 * The inspector beside it only shows the selected asset.
 */
export function GlobalAssetsWorkspace() {
  const inspector = useInspectorRuntime();
  const requested = useRef(false);
  useEffect(() => {
    if (!inspector || requested.current) {
      return;
    }
    requested.current = true;
    void inspector.assetLibrary.render();
  }, [inspector]);
  return <AssetsPanel showTitle={false} variant="tree" />;
}
