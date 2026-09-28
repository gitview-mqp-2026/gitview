import { useState, useEffect } from "react";
import "./App.css";

function App() {
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/commits')
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((data) => {
                setCommits(data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    return (
        <div>
            <header className="nav-bar">
                <div className="logo">GitView</div>
                <div className="file-path">
                    <span>CS3733 Software Engineering</span>
                    <span>/</span>
                    <span>A26</span>
                    <span>/</span>
                    <span>Section 02</span>
                    <span>/</span>
                    <strong>Team 1</strong>
                </div>

                <div className="nav-actions">
                    <div className="inbox-button"></div>
                    <div className="profile-button"></div>
                </div>
            </header>

            <main className="team-page">
                {/* Team Header */}
                <section className="team-header">
                    <div>
                        <h1>Team 1</h1>
                        <p>4 members · github.com/cs3733-soft-eng/team-1</p>
                    </div>

                    <button>last 30 days</button>
                </section>

                {/* Stats Overview */}
                <section className="stats-overview">
                    <div className="stat-card">
                        <span>COMMITS</span>
                        <strong>{commits.length || '—'}</strong>
                    </div>

                    <div className="stat-card">
                        <span>PRS MERGED</span>
                        <strong>24</strong>
                    </div>

                    <div className="stat-card">
                        <span>COMMENTS</span>
                        <strong>31</strong>
                    </div>

                    <div className="stat-card">
                        <span>ISSUES CLOSED</span>
                        <strong>47</strong>
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

                {/* Commit Log Table */}
                <section className="significant-commits">
                    <h2>Commit log</h2>

                    {loading && <p>Loading commits…</p>}
                    {error && <p style={{ color: 'red' }}>Could not load commits: {error}</p>}

                    {!loading && !error && (
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
                                        <td colSpan={4}>No commits ingested yet. Run <code>npm run ingest</code> in the backend.</td>
                                    </tr>
                                ) : (
                                    commits.map((c) => (
                                        <tr key={c.hash}>
                                            <td><code>{c.hash.slice(0, 7)}</code></td>
                                            <td>{c.subject}</td>
                                            <td>{c.authorName}</td>
                                            <td>{new Date(c.committedAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
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

export default App;
