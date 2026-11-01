import { useEffect, useState } from "react";
import "../App.css";
import { Link, useParams } from "react-router-dom";

import NavBar from "../components/NavBar.jsx";

const PAGE_SIZE = 10;

async function getJson(path) {
    const response = await fetch(path);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
}

function TeamDashboard() {
    const { teamId } = useParams();
    const [commits, setCommits] = useState([]);
    const [stats, setStats] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setPage(1);

        Promise.all([
            getJson(`/api/commits?teamId=${teamId}`),
            getJson(`/api/repositories/${teamId}/stats`),
        ])
            .then(([commitRows, statRows]) => {
                setCommits(commitRows);
                setStats(statRows);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [teamId]);

    const stat = (value) => (loading || error || !stats ? "—" : value);

    const pageCount = Math.max(1, Math.ceil(commits.length / PAGE_SIZE));
    const firstShown = (page - 1) * PAGE_SIZE + 1;
    const lastShown = Math.min(page * PAGE_SIZE, commits.length);
    const visibleCommits = commits.slice(firstShown - 1, lastShown);

    return (
        <div>
            <NavBar />

            <main className="team-page">
                {/* Team Header */}
                <section className="team-header">
                    <div>
                        <Link to="/section" className="back-link">← All repositories</Link>
                        <h1>{stats?.name ?? "Team"}</h1>
                        <p>{stats ? `${stats.members} ${stats.members === 1 ? "member" : "members"} · ${stats.url}` : ""}</p>
                    </div>

                    <button>last 30 days</button>
                </section>

                {/* Stats Overview */}
                <section className="stats-overview">
                    <div className="stat-card">
                        <span>COMMITS</span>
                        <strong>{stat(stats?.commits)}</strong>
                    </div>

                    <div className="stat-card">
                        <span>PRS MERGED</span>
                        <strong>{stat(stats?.prsMerged)}</strong>
                    </div>

                    <div className="stat-card">
                        <span>COMMENTS</span>
                        <strong>{stat(stats?.comments)}</strong>
                    </div>

                    <div className="stat-card">
                        <span>ISSUES CLOSED</span>
                        <strong>{stat(stats?.issuesClosed)}</strong>
                    </div>

                    <div className="stat-card">
                        <span>ALERTS</span>
                        <strong>9</strong>
                    </div>
                </section>

                <section className="two-columns">
                    {/* Alerts */}
                    <div className="container">
                        <h2>Alerts</h2>

                        <div className="content">
                            <div className="alert">
                                <div className="profile-button"></div>
                                <span>Student 2 - no commits in 12 days</span>
                            </div>

                            <div className="alert">
                                <div className="profile-button"></div>
                                <span>Student 4 - work below team's average amount</span>
                            </div>

                            <div className="alert">
                                <div className="profile-button"></div>
                                <span>Student 3 - all commits made near deadline</span>
                            </div>
                        </div>
                    </div>

                    {/* Members */}
                    <div className="container">
                        <h2>Members</h2>

                        <div className="content">
                            <div className="member">
                                <div className="profile-button"></div>
                                <span>Student 2 · username</span>
                            </div>

                            <div className="member">
                                <div className="profile-button"></div>
                                <span>Student 4 · username</span>
                            </div>

                            <div className="member">
                                <div className="profile-button"></div>
                                <span>Student 3 · username</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recent Significant Commits */}
                <section className="significant-commits">
                    <h2>Recent significant commits</h2>

                    <div className="commits-container">
                        <div className="commit">
                            <div className="commit-info">
                                <div className="profile-button"></div>

                                <div>
                                    <h3>Implemented OAuth login</h3>
                                    <p>Student 1  · src/auth</p>

                                    <div className="tags">
                                        <span>Core</span>
                                        <span>High Impact</span>
                                    </div>
                                </div>
                            </div>

                            <div className="commit-actions">
                                <button>Feedback</button>
                                <button>Tag</button>
                            </div>
                        </div>

                        <div className="commit">
                            <div className="commit-info">
                                <div className="profile-button"></div>

                                <div>
                                    <h3>Updated database schema</h3>
                                    <p>Student 2  · src/backend</p>

                                    <div className="tags">
                                        <span>Core</span>
                                        <span>High Impact</span>
                                    </div>
                                </div>
                            </div>

                            <div className="commit-actions">
                                <button>Feedback</button>
                                <button>Tag</button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Commit Log (live from /api/commits) */}
                <section className="significant-commits">
                    <h2>Commit log</h2>

                    {loading && <p>Loading commits…</p>}
                    {error && <p style={{ color: "red" }}>Could not load commits: {error}</p>}

                    {!loading && !error && (
                        <>
                            <table className="categories-table">
                                <thead>
                                    <tr>
                                        <th>Hash</th>
                                        <th>Subject</th>
                                        <th>Author</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {commits.length === 0 ? (
                                        <tr>
                                            <td colSpan={4}>No commits found for this repository.</td>
                                        </tr>
                                    ) : (
                                        visibleCommits.map((c) => (
                                            <tr key={c.commitHash}>
                                                <td><code>{c.commitHash.slice(0, 7)}</code></td>
                                                <td>{c.commitSubject}</td>
                                                <td>{c.author}</td>
                                                <td>{new Date(c.dateTime).toLocaleDateString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {pageCount > 1 && (
                                <div className="pager">
                                    <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1}>
                                        Previous
                                    </button>
                                    <span>
                                        Page {page} of {pageCount} · {firstShown}–{lastShown} of {commits.length}
                                    </span>
                                    <button type="button" onClick={() => setPage(page + 1)} disabled={page === pageCount}>
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </section>

                {/* Major Contribution Categories */}
                <section className="contribution-categories">
                    <h2>Major contribution categories</h2>

                    <table className="categories-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Files</th>
                                <th>Lines of Code</th>
                                <th>Contributors</th>
                                <th>Weight</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr>
                                <td>Database</td>
                                <td>prisma.schema</td>
                            </tr>

                            <tr>
                                <td>API Endpoints</td>
                            </tr>

                            <tr>
                                <td>UI</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

            </main>
        </div>
    );
}

export default TeamDashboard;