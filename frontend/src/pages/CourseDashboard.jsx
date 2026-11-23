import { useEffect, useState } from "react";
import "../App.css";
import { Link, useNavigate, useParams } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import ContributionWeightsPanel from "../components/ContributionWeightsPanel.jsx";

async function post(path) {
    const response = await fetch(path, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed (HTTP ${response.status})`);
    }
    return data;
}

function CourseDashboard() {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [url, setUrl] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const [repos, setRepos] = useState([]);
    const [course, setCourse] = useState(null);
    const [job, setJob] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [notice, setNotice] = useState(null);

    const loadRepos = () => {
        fetch(`/repositories?courseId=${courseId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then(setRepos)
            .catch(() => setRepos([]));
    };

    useEffect(() => {
        fetch("/courses")
            .then((r) => (r.ok ? r.json() : []))
            .then((courses) => setCourse(courses.find((c) => String(c.courseID) === courseId) ?? null))
            .catch(() => setCourse(null));
        fetch(`/courses/${courseId}/ingest`)
            .then((r) => (r.ok ? r.json() : null))
            .then(setJob)
            .catch(() => setJob(null));
        loadRepos();
    }, [courseId]);

    // While an ingest runs, poll its progress and refresh the repo widgets as commits arrive.
    useEffect(() => {
        if (job?.status !== "running") return undefined;
        const timer = setInterval(() => {
            fetch(`/courses/${courseId}/ingest`)
                .then((r) => r.json())
                .then((next) => {
                    setJob(next);
                    loadRepos();
                })
                .catch(() => {});
        }, 3000);
        return () => clearInterval(timer);
    }, [job?.status, courseId]);

    const syncRepos = async () => {
        setSyncing(true);
        setError(null);
        setNotice(null);
        try {
            const result = await post(`/courses/${courseId}/sync`);
            setNotice(`Found ${result.matched} team repositories (${result.created} new).`);
            loadRepos();
        } catch (err) {
            setError(err.message);
        } finally {
            setSyncing(false);
        }
    };

    const ingestAll = async () => {
        setError(null);
        setNotice(null);
        try {
            setJob(await post(`/courses/${courseId}/ingest`));
        } catch (err) {
            setError(err.message);
        }
    };

    const running = job?.status === "running";
    const failed = job?.results?.filter((r) => !r.ok) ?? [];

    const analyze = async (event) => {
        event.preventDefault();
        setAnalyzing(true);
        setError(null);

        try {
            const response = await fetch("/repositories/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, courseId }),
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
                    
            <div className="course-page">
                <div className="course-header">
                    <div>
                        {course && <h1>{course.courseName}</h1>}
                        {course && <p>{course.courseTerm}{course.githubOrg && ` · ${course.githubOrg}`}</p>}
                    </div>

                    <div className="course-actions">
                        <button className="repo-button" type="button" onClick={() => navigate(`/course/${courseId}/roster`)}>
                            View Roster
                        </button>

                        <button className="repo-button" type="button" onClick={syncRepos} disabled={syncing || running}>
                            {syncing ? "Syncing..." : "Sync from GitHub"}
                        </button>

                        <button className="repo-button" type="button" onClick={ingestAll} disabled={syncing || running || repos.length === 0}>
                            {running ? `Ingesting ${job.completed} / ${job.total}...` : "Ingest all"}
                        </button>
                    </div>
                </div>

                {notice && <p className="course-status">{notice}</p>}
                {job?.status === "done" && (
                    <p className="course-status">
                        Last ingest finished: {job.results.length - failed.length} of {job.results.length} repositories
                        {failed.length > 0 && `, ${failed.length} failed`}.
                    </p>
                )}

                <ContributionWeightsPanel courseId={courseId} />

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
                        <h2>Team repositories</h2>

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
            </div>
        </div>
    );
}

export default CourseDashboard;
