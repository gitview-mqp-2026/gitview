import { useEffect, useState } from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";

function CourseDashboard() {
    const navigate = useNavigate();
    const [url, setUrl] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const [repos, setRepos] = useState([]);
    const [showAddCourseForm, setShowAddCourseForm] = useState(false);

    useEffect(() => {
        fetch("/api/repositories")
            .then((r) => (r.ok ? r.json() : []))
            .then(setRepos)
            .catch(() => setRepos([]));
    }, []);

    const analyze = async (event) => {
        event.preventDefault();
        setAnalyzing(true);
        setError(null);

        try {
            const response = await fetch("/api/repositories/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || `Analysis failed (HTTP ${response.status})`);
            }
            navigate(`/team/${data.teamID}`);
        } catch (err) {
            setError(err.message);
            setAnalyzing(false);
        }
    };

    return (
        <div>
            <NavBar />

            <div>
                <Link to="/" className="back-link">← All Courses</Link>
            </div>
                    
            <div className="actions">
                <form className="analyze-repo" onSubmit={analyze}>
                    <input
                        className="repo-input"
                        type="text"
                        placeholder="https://github.com/owner/repo"
                        aria-label="Repository URL"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        disabled={analyzing}
                    />

                    <button className="repo-button" type="submit" disabled={analyzing || !url.trim()}>
                        {analyzing ? "Analyzing..." : "Analyze Repo"}
                    </button>
                </form>

                {error && <p className="repo-error" role="alert">{error}</p>}

                {repos.length > 0 && (
                    <section className="repo-widgets">
                        <h2>Analyzed repositories</h2>

                        <div className="repo-widget-grid">
                            {repos.map((repo) => (
                                <Link key={repo.teamID} to={`/team/${repo.teamID}`} className="repo-widget">
                                    <strong>{repo.name}</strong>
                                    <span>{repo.url}</span>
                                    <span>
                                        {repo.commitCount} commits
                                        {repo.lastCommitAt && ` · last ${new Date(repo.lastCommitAt).toLocaleDateString()}`}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <Link to="/alignment" className="link-button">
                    Go to File Alignment
                </Link>
            </div>
        </div>
    );
}

export default CourseDashboard;
