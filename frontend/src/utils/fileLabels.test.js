import assert from "node:assert/strict";
import test from "node:test";
import { replaceFileLabel } from "./fileLabels.js";

test("replaceFileLabel creates, replaces, and removes one exact file label", () => {
    const initial = [{ path: "src/App.jsx", category: "App-setup", present: true }];
    const created = replaceFileLabel(initial, "src/App.test.jsx", {
        path: "src/App.test.jsx",
        category: "Testing",
        present: true,
    });
    assert.equal(created.length, 2);

    const replaced = replaceFileLabel(created, "src/App.jsx", {
        path: "src/App.jsx",
        category: "Templates/Components",
        present: true,
    });
    assert.deepEqual(replaced.find((label) => label.path === "src/App.jsx"), {
        path: "src/App.jsx",
        category: "Templates/Components",
        present: true,
    });

    const removed = replaceFileLabel(replaced, "src/App.jsx", null);
    assert.equal(removed.some((label) => label.path === "src/App.jsx"), false);
    assert.equal(removed.some((label) => label.path === "src/App.test.jsx"), true);
});
