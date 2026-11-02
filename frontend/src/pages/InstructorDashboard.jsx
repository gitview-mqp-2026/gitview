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

    const handleAddCourse = (newCourse) => {
        setCourses([...courses, newCourse]);
        setShowAddCourseForm(false);
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

                <div className="course-list">
                    {courses.map((course, index) => (
                        <div className="course-widget" key={index}>
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
