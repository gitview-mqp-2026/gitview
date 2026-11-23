import assert from "node:assert/strict";
import test from "node:test";
import { courseCrumbs, HOME_CRUMBS, rosterCrumbs, teamCrumbs } from "./breadcrumbs.js";

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

test("the course page reads Courses / course name, linking back to the list", () => {
    assert.deepEqual(courseCrumbs({ course }), [{ label: "Courses", to: "/" }, { label: "CS 3733 Software Engineering" }]);
    assert.deepEqual(courseCrumbs({ course: null }), [{ label: "Courses", to: "/" }, { label: "Course" }]);
});

test("the roster page reads Courses / course name / Roster, with the course linking to its dashboard", () => {
    assert.deepEqual(rosterCrumbs({ course, courseId: "1" }), [
        { label: "Courses", to: "/" },
        { label: "CS 3733 Software Engineering", to: "/course/1" },
        { label: "Roster" },
    ]);
    assert.deepEqual(rosterCrumbs({ course: null, courseId: "7" })[1], { label: "Course", to: "/course/7" });
});

test("the courses list is the top level: a single crumb that is the current page", () => {
    assert.deepEqual(HOME_CRUMBS, [{ label: "Courses" }]);
});

test("no page's breadcrumb shows a raw id as a label", () => {
    const all = [...teamCrumbs({ stats, course: null }), ...courseCrumbs({ course: null }), ...rosterCrumbs({ course: null, courseId: "1" })];
    assert.ok(all.every((crumb) => !/^\d+$/.test(crumb.label)));
});
