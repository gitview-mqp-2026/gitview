// Crumbs for the team page: Courses / <course name> / <team>. A crumb with `to` is a link; the last one is the
// current page. The course name arrives separately from the team's stats, so until it loads (or if it cannot be
// found) that crumb reads "Course" and still links to the right place.
export function teamCrumbs({ stats, course }) {
    const crumbs = [{ label: "Courses", to: "/" }];
    if (stats?.courseID) {
        crumbs.push({ label: course?.courseName ?? "Course", to: `/course/${stats.courseID}` });
    }
    // Repositories are named "org/repo"; the repo part is enough here, and the full name stays in the tooltip.
    const shortName = stats?.name?.split("/").filter(Boolean).pop();
    crumbs.push({ label: shortName ?? "Team", title: stats?.name });
    return crumbs;
}
