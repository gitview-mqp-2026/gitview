import assert from "node:assert/strict";
import test from "node:test";
import { teamCrumbs } from "./breadcrumbs.js";

const stats = { courseID: 1, name: "WPI-CS3733-2026C/team-14" };
const course = { courseID: 1, courseName: "CS 3733 Software Engineering" };

test("a team in a loaded course reads Courses / course / team, with every level but the last linked", () => {
    assert.deepEqual(teamCrumbs({ stats, course }), [
        { label: "Courses", to: "/" },
        { label: "CS 3733 Software Engineering", to: "/course/1" },
        { label: "team-14", title: "WPI-CS3733-2026C/team-14" },
    ]);
});

test("the course crumb still links to the right course while its name is loading or missing", () => {
    const crumbs = teamCrumbs({ stats, course: null });
    assert.deepEqual(crumbs[1], { label: "Course", to: "/course/1" });
});

test("a repository with no course skips the course crumb", () => {
    const crumbs = teamCrumbs({ stats: { courseID: null, name: "owner/solo" }, course: null });
    assert.deepEqual(crumbs.map((crumb) => crumb.label), ["Courses", "solo"]);
});

test("before the stats load, the trail is just Courses / Team and nothing crashes", () => {
    assert.deepEqual(teamCrumbs({ stats: null, course: null }), [
        { label: "Courses", to: "/" },
        { label: "Team", title: undefined },
    ]);
});

test("repository names without an org, or with stray slashes, still give a sensible label", () => {
    assert.equal(teamCrumbs({ stats: { name: "just-a-repo" }, course: null }).at(-1).label, "just-a-repo");
    assert.equal(teamCrumbs({ stats: { name: "org/repo/" }, course: null }).at(-1).label, "repo");
});

test("only the last crumb has no link", () => {
    const crumbs = teamCrumbs({ stats, course });
    assert.deepEqual(crumbs.map((crumb) => crumb.to !== undefined), [true, true, false]);
});
