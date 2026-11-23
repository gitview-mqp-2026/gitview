import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import ContributionBadge, { contributionDescription } from "../components/ContributionBadge.jsx";
import { rosterCrumbs } from "../utils/breadcrumbs.js";
import "../App.css";

function Roster() {
    const { courseId } = useParams();
    const [course, setCourse] = useState(null);
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchRoster() {
            try {
                const [courseResponse, rosterResponse] = await Promise.all([
                    fetch(`/courses`),
                    fetch(`/courses/${courseId}/roster`)
                ]);

                if (!courseResponse.ok || !rosterResponse.ok) {
                    throw new Error("Failed to load course roster.");
                }

                const courses = await courseResponse.json();
                const roster = await rosterResponse.json();

                setCourse(courses.find((c) => String(c.courseID) === courseId) ?? null);
                setRoster(roster);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        }

        fetchRoster();
    }, [courseId]);

    // group students by teamID
    const groupedRoster = roster.reduce((teams, student) => {
        const teamID = student.teamID || "unassigned";

        if (!teams[teamID]) {
            teams[teamID] = [];
        }

        teams[teamID].push(student);
        return teams;
    }, {});

    // sort teams by teamID, with unassigned students at the end
    const sortedTeams = Object.entries(groupedRoster).sort(([a], [b]) => {
        if (a === "unassigned") return 1;
        if (b === "unassigned") return -1;

        return a.localeCompare(b);
    });

    return (
        <div>
            <NavBar crumbs={rosterCrumbs({ course, courseId })} />
                <Link to={`/course/${courseId}`} className="back-link">
                    ← Back to Course Dashboard
                </Link>
            <div className="roster-page">
                <div className="roster-header">
                    <h1>{course?.name} Roster</h1>
                    {course && (
                        <p>{course.courseName} · {course.courseTerm}</p>
                    )}

                    <span className="roster-count">
                        {roster.length} {roster.length === 1 ? "student" : "students"}
                    </span>
                </div>

                {loading && <p>Loading roster...</p>}
                {error && <p className="repo-error" role="alert">{error}</p>}

                {!loading && !error && (
                    <div className="roster-teams">
                        {sortedTeams.map(([teamID, students]) => (
                            <section key={teamID} className="roster-team">
                                <h2>{teamID === "unassigned" ? "Unassigned Students" : students[0].teamName ||`Team ${teamID}`}</h2>
                                
                                <table className="roster-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Contribution</th>
                                            <th>GitHub Username</th>
                                            <th>Role</th>
                                            <th>Last Login</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student) => (
                                            <tr key={student.userID}>
                                                <td>{student.name || "Unknown"}</td>
                                                <td>
                                                    {student.contribution && student.teamID ? (
                                                        <Link
                                                            to={`/team/${student.teamID}?tab=members&member=${student.userID}`}
                                                            className="fsi-link"
                                                            aria-label={`${student.name || "Unknown"}: ${contributionDescription(student.contribution)} Open their member details.`}
                                                        >
                                                            <ContributionBadge contribution={student.contribution} />
                                                        </Link>
                                                    ) : "—"}
                                                </td>
                                                <td>{student.username || "Unknown"}</td>
                                                <td>{student.role}</td>
                                                <td></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Roster;