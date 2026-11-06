/** Asset detail inspector for the drawer. */
import { AssetsPanel } from "./AssetsPanel.tsx";

/** Renders the selected asset's preview and actions in the drawer inspector. */
export function GlobalAssetsInspector() {
  return <AssetsPanel showTitle={false} variant="details" />;
}
