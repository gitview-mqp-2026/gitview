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

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const response = await fetch("/api/courses");

                if (!response.ok) {
                    throw new Error(`Failed to get courses`);
                }

                const data = await response.json();
                setCourses(data);
            } catch (err) {
                setError(err.message);
            }
        }
        fetchCourses();
    }, []);

    const handleAddCourse = async (newCourse) => {
        const response = await fetch("/api/courses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newCourse),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to add course");
        }

        setCourses([...courses, newCourse]);
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

                {error && <p className="error-message">{error}</p>}

                <div className="course-list">
                    {courses.map((course) => (
                        <div 
                            className="course-widget" 
                            key={course.courseID}
                            onClick={() => navigate("/course")}  // update to be course specific
                            style={{ cursor: "pointer" }}
                        >
                            <h2>{course.courseName}</h2>
                            <p>{course.courseTerm}</p>
                        </div>
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
                <Link to="/course" className="link-button">
                    Go to Course Dashboard
                </Link>

                <Link to="/alignment" className="link-button">
                    Go to File Alignment
                </Link>
            </div>
        </div>
    );
}

export default InstructorDashboard;
