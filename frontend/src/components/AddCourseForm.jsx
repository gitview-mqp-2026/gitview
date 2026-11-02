import { useState } from "react";
import { X } from "lucide-react";
import "./AddCourseForm.css";

function AddCourseForm({ onClose, onAddCourse }) {
    const [courseName, setCourseName] = useState("");
    const [courseTerm, setCourseTerm] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            await onAddCourse({ courseName, courseTerm });

            setCourseName("");
            setCourseTerm("");
            onClose();
        } catch (err) {
            setError(err.message || "Failed to add course.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div onClick={onClose} className="popup-overlay">
            <div 
                className="add-course-popup" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="popup-header">
                    <h1>Add Course</h1>
                    <button type="button" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
            
                <form onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="courseName">
                            Course Name
                        </label>
                        <input
                            type="text"
                            id="courseName"
                            value={courseName}
                            onChange={(e) => setCourseName(e.target.value)}
                            placeholder="e.g. CS 3733 Software Engineering"
                            required
                        />

                        <label htmlFor="courseTerm">
                            Course Term
                        </label>
                        <input
                            type="text"
                            id="courseTerm"
                            value={courseTerm}
                            onChange={(e) => setCourseTerm(e.target.value)}
                            placeholder="e.g. C Term 2026"
                            required
                        />
                    </div>

                    <div>
                        <h2>Authorize GitHub Organization</h2>

                        {/* to be implemented */}
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <div className="popup-actions">
                        <button type="button" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Adding..." : "Add Course"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddCourseForm;