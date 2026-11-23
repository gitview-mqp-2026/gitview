import assert from "node:assert/strict";
import test from "node:test";
import { categoryLabel, checkWeights, parsePercent } from "./contributionWeights.js";

const categories = ["Database", "Routes/Endpoints", "Testing"];
const saved = { Database: 50, "Routes/Endpoints": 30, Testing: 20 };
const typed = (database, routes, testing) => ({ Database: database, "Routes/Endpoints": routes, Testing: testing });

test("parsePercent accepts whole numbers from 0 to 100 only", () => {
    assert.equal(parsePercent("0"), 0);
    assert.equal(parsePercent("25"), 25);
    assert.equal(parsePercent(" 100 "), 100);
    assert.equal(parsePercent("007"), 7);
    for (const bad of ["", " ", "5.5", "-3", "101", "1e2", "abc", "12%", "1000", null, undefined]) {
        assert.equal(parsePercent(bad), null, String(bad));
    }
});

test("checkWeights allows saving only when valid, totaling 100, and changed", () => {
    const unchanged = checkWeights(categories, typed("50", "30", "20"), saved);
    assert.equal(unchanged.totalOk, true);
    assert.equal(unchanged.changed, false);
    assert.equal(unchanged.canSave, false); // nothing to save yet

    const edited = checkWeights(categories, typed("40", "40", "20"), saved);
    assert.equal(edited.canSave, true);
    assert.equal(edited.message, "Adds up to 100%.");
});

test("checkWeights says how far off the total is, in both directions", () => {
    const short = checkWeights(categories, typed("40", "30", "20"), saved);
    assert.equal(short.total, 90);
    assert.equal(short.canSave, false);
    assert.equal(short.message, "Adds up to 90%. Add 10% more to reach 100%.");

    const over = checkWeights(categories, typed("60", "30", "20"), saved);
    assert.equal(over.total, 110);
    assert.equal(over.message, "Adds up to 110%. Remove 10% to reach 100%.");
});

test("checkWeights flags each bad box and blocks saving, without throwing", () => {
    const result = checkWeights(categories, typed("", "5.5", "20"), saved);
    assert.deepEqual(Object.keys(result.problems), ["Database", "Routes/Endpoints"]);
    assert.equal(result.parsed.Testing, 20);
    assert.equal(result.canSave, false);
    assert.equal(result.totalOk, false);
    assert.equal(result.message, "Fix the highlighted weights.");
});

test("checkWeights without a saved baseline treats any valid total of 100 as saveable", () => {
    assert.equal(checkWeights(categories, typed("50", "30", "20")).canSave, true);
});

test("a category can be set to 0 to leave it out", () => {
    const result = checkWeights(categories, typed("0", "80", "20"), saved);
    assert.equal(result.canSave, true);
    assert.equal(result.parsed.Database, 0);
});

test("categoryLabel shows the server name for App-setup as App Setup", () => {
    assert.equal(categoryLabel("App-setup"), "App Setup");
    assert.equal(categoryLabel("Database"), "Database");
    assert.equal(categoryLabel("Routes/Endpoints"), "Routes/Endpoints");
});
