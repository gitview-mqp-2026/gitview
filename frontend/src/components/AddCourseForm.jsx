import { useEffect, useState } from "react";
import { X } from "lucide-react";
import "./AddCourseForm.css";

async function post(path, body) {
    const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed (HTTP ${response.status})`);
    }
    return data;
}

function AddCourseForm({ onClose, onAddCourse }) {
    const [courseName, setCourseName] = useState("");
    const [courseTerm, setCourseTerm] = useState("");
    const [githubOrg, setGithubOrg] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [installUrl, setInstallUrl] = useState(null);

    useEffect(() => {
        fetch("/api/github-app")
            .then((r) => (r.ok ? r.json() : {}))
            .then((data) => setInstallUrl(data.installUrl ?? null))
            .catch(() => setInstallUrl(null));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const course = await post("/api/courses", { courseName, courseTerm, githubOrg });

            // The course is saved; linking its repositories can still fail (e.g. the App isn't installed yet).
            let note = null;
            try {
                await post(`/api/courses/${course.courseID}/sync`);
                await post(`/api/courses/${course.courseID}/ingest`);
            } catch (err) {
                note = `${course.courseName} was saved, but its repositories could not be loaded: ${err.message}`;
            }

            onAddCourse(course, note);
        } catch (err) {
            setError(err.message);
            setSaving(false);
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
                            Course Name:
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
                            Course Term:
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

                        {installUrl && (
                            <p>
                                <strong>Step 1:</strong>{" "}
                                <a href={installUrl} target="_blank" rel="noreferrer">Install the GitView GitHub App</a>{" "}
                                on your organization and choose which repositories it can read.
                            </p>
                        )}

                        <label htmlFor="githubOrg">
                            {installUrl && <strong>Step 2: </strong>}
                            Enter the name of the organization you installed it on:
                        </label>
                        <input
                            type="text"
                            id="githubOrg"
                            value={githubOrg}
                            onChange={(e) => setGithubOrg(e.target.value)}
                            placeholder="e.g. WPI-CS3733-2026C"
                            required
                        />
                    </div>

                    {error && <p role="alert">{error}</p>}

                    <div className="popup-actions">
                        <button type="button" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}>
                            {saving ? "Adding..." : "Add Course"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddCourseForm;