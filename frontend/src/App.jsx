import "./App.css";

function App() {
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
                        <strong>900</strong>
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