/** Path-to-project catalogue cleanup for local library deletion. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogIdFor,
  forgetCatalogProject,
  rememberCatalogPath,
} from "../core/global/library/libraryCatalog.ts";

function createStore(initial = {}) {
  let value = initial;
  return {
    read: () => value,
    write: (_section, next) => {
      value = next;
    },
  };
}

test("deleting a project removes every source path mapped to it", () => {
  const store = createStore();
  rememberCatalogPath("C:\\Charts\\turning.pez", "project-1", store);
  rememberCatalogPath("D:\\Backup\\turning.pez", "project-1", store);
  rememberCatalogPath("C:\\Charts\\other.pez", "project-2", store);

  forgetCatalogProject("project-1", store);

  assert.equal(catalogIdFor("c:/charts/turning.pez", store), undefined);
  assert.equal(catalogIdFor("d:/backup/turning.pez", store), undefined);
  assert.equal(catalogIdFor("c:/charts/other.pez", store), "project-2");
});
