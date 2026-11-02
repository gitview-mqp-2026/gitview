import { useEffect, useState } from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";

import NavBar from "../components/NavBar.jsx";
import AddCourseForm from "../components/AddCourseForm.jsx";

function InstructorDashboard() {
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [showAddCourseForm, setShowAddCourseForm] = useState(false);
    const [courses, setCourses] = useState([]);

    const loadCourses = () => {
        fetch("/api/courses")
            .then((r) => (r.ok ? r.json() : []))
            .then(setCourses)
            .catch(() => setCourses([]));
    };

    useEffect(loadCourses, []);

    const handleAddCourse = (_course, note) => {
        setError(note);
        setShowAddCourseForm(false);
        loadCourses();
    }

    return (
        <div>
            <NavBar />

            <div className="courses">
                <div className="add-course">
                    <button onClick={() => setShowAddCourseForm(true)}>
                        Add Course
                    </button>
                </div>

                {error && <p className="repo-error" role="alert">{error}</p>}

                <div className="course-list">
                    {courses.map((course) => (
                        <Link
                            className="course-widget"
                            key={course.courseID}
                            to={`/course/${course.courseID}`}
                        >
                            <h2>{course.courseName}</h2>
                            <p>{course.courseTerm}</p>
                            {course.githubOrg && <p>{course.githubOrg}</p>}
                            <p>{course.repoCount} {course.repoCount === 1 ? "team" : "teams"}</p>
                        </Link>
                    ))}
                </div>

                {showAddCourseForm && (
                    <AddCourseForm  
                        onClose={() => setShowAddCourseForm(false)}
                        onAddCourse={handleAddCourse}
                    />
                )}
            </div>

            <div className="actions">
                <Link to="/alignment" className="link-button">
                    Go to File Alignment
                </Link>
            </div>
        </div>
    );
}

export default InstructorDashboard;
