/**
 * Registers the document drawer pages.
 *
 * The inspector's drawer mode reads this registry, so a page joins it from
 * beside its own surface rather than from the shell. Importing the module is the
 * registration, which is what lets the frame render a page without naming one.
 */
import "./sections/assets/drawer.tsx";
import "./sections/timing/drawer.tsx";
import "./sections/lines/drawer.tsx";
