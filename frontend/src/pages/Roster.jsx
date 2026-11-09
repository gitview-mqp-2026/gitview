import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import NavBar from "../components/NavBar.jsx"; 
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

    return (
        <div>
            <NavBar />
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
                    <div>
                        <table className="roster-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>GitHub Username</th>
                                    <th>Role</th>
                                    <th>Last Login</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roster.map((student) => (
                                    <tr key={student.userID}>
                                        <td>{student.name || "Unknown"}</td>
                                        <td>{student.username || "Unknown"}</td>
                                        <td>{student.role}</td>
                                        <td></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Roster;