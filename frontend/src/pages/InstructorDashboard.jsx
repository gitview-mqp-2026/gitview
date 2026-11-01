import { useEffect, useState } from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";

import NavBar from "../components/NavBar.jsx";
import AddCourseForm from "../components/AddCourseForm.jsx";

function InstructorDashboard() {
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [showAddCourseForm, setShowAddCourseForm] = useState(false);

    return (
        <div>
            <NavBar />

            <div className="actions">
                <div className="add-course">
                    <button onClick={() => setShowAddCourseForm(true)}>
                        Add Course
                    </button>
                </div>

                {showAddCourseForm && (
                    <AddCourseForm  
                        onClose={() => setShowAddCourseForm(false)}
                    />
                )}
            
                <Link to="/section" className="link-button">
                    Go to Section Dashboard
                </Link>

                <Link to="/alignment" className="link-button">
                    Go to File Alignment
                </Link>
            </div>
        </div>
    );
}

export default InstructorDashboard;
