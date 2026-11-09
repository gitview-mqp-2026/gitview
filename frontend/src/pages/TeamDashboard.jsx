import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";
import { Link, useParams } from "react-router-dom";
import RepositoryTree from "../components/RepositoryTree.jsx";
import { replaceFileLabel } from "../utils/fileLabels.js";

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
    const [tree, setTree] = useState(null);
    const [treeLoading, setTreeLoading] = useState(true);
    const [treeError, setTreeError] = useState(null);
    const [savingPaths, setSavingPaths] = useState(() => new Set());
    const [labelErrors, setLabelErrors] = useState(() => new Map());
    const [treePanelOpen, setTreePanelOpen] = useState(false);
    const treePanelToggle = useRef(null);

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

    useEffect(() => {
        if (!treePanelOpen) return undefined;

        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setTreePanelOpen(false);
                treePanelToggle.current?.focus();
            }
        };
        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [treePanelOpen]);

    useEffect(() => {
        let cancelled = false;
        setTree(null);
        setTreeLoading(true);
        setTreeError(null);
        setSavingPaths(new Set());
        setLabelErrors(new Map());

        getJson(`/api/repositories/${teamId}/tree`)
            .then((data) => {
                if (!cancelled) setTree(data);
            })
            .catch((err) => {
                if (!cancelled) setTreeError(err.message);
            })
            .finally(() => {
                if (!cancelled) setTreeLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [teamId]);

    const labelsByPath = useMemo(
        () => new Map((tree?.labels ?? []).map((label) => [label.path, label.category])),
        [tree],
    );

    const saveFileCategory = async (path, category) => {
        if (!tree || savingPaths.has(path)) return;

        const previousLabel = tree.labels.find((label) => label.path === path) ?? null;
        const optimisticLabel = category ? { path, category, present: true } : null;
        setTree((current) => current && ({
            ...current,
            labels: replaceFileLabel(current.labels, path, optimisticLabel),
        }));
        setSavingPaths((current) => new Set(current).add(path));
        setLabelErrors((current) => {
            const next = new Map(current);
            next.delete(path);
            return next;
        });

        try {
            const response = category
                ? await fetch(`/api/repositories/${teamId}/file-labels`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path, category }),
                })
                : await fetch(`/api/repositories/${teamId}/file-labels?${new URLSearchParams({ path })}`, {
                    method: "DELETE",
                });
            const data = response.status === 204 ? null : await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
            if (data) {
                setTree((current) => current && ({
                    ...current,
                    labels: replaceFileLabel(current.labels, path, data),
                }));
            }
        } catch (err) {
            setTree((current) => current && ({
                ...current,
                labels: replaceFileLabel(current.labels, path, previousLabel),
            }));
            setLabelErrors((current) => new Map(current).set(path, err.message));
        } finally {
            setSavingPaths((current) => {
                const next = new Set(current);
                next.delete(path);
                return next;
            });
        }
    };

    const stat = (value) => (loading || error || !stats ? "—" : value);

    const pageCount = Math.max(1, Math.ceil(commits.length / PAGE_SIZE));
    const firstShown = (page - 1) * PAGE_SIZE + 1;
    const lastShown = Math.min(page * PAGE_SIZE, commits.length);
    const visibleCommits = commits.slice(firstShown - 1, lastShown);

    return (
        <div>
            <header className="nav-bar">
                <Link to="/" className="logo">GitView</Link>
                <button
                    ref={treePanelToggle}
                    className="tree-panel-toggle"
                    type="button"
                    aria-controls="project-structure-panel"
                    aria-expanded={treePanelOpen}
                    onClick={() => setTreePanelOpen((open) => !open)}
                >
                    Project structure
                </button>
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

            <aside
                id="project-structure-panel"
                className={`project-structure-panel${treePanelOpen ? " is-open" : ""}`}
                aria-hidden={!treePanelOpen}
                inert={!treePanelOpen}
            >
                <div className="project-structure-panel-header">
                    <div>
                        <h2>Project structure</h2>
                        {tree && (
                            <code title={tree.commitHash}>
                                {tree.branch} @ {tree.commitHash.slice(0, 7)}
                            </code>
                        )}
                    </div>
                    <button
                        className="project-structure-panel-close"
                        type="button"
                        aria-label="Close project structure"
                        onClick={() => {
                            setTreePanelOpen(false);
                            treePanelToggle.current?.focus();
                        }}
                    >
                        ×
                    </button>
                </div>

                <div className="tree-container">
                    {treeLoading && <p>Loading project structure…</p>}
                    {treeError && <p className="repo-error" role="alert">Could not load project structure: {treeError}</p>}
                    {tree && (
                        <RepositoryTree
                            key={tree.commitHash}
                            nodes={tree.nodes}
                            categories={tree.categories}
                            labelsByPath={labelsByPath}
                            savingPaths={savingPaths}
                            labelErrors={labelErrors}
                            onCategoryChange={saveFileCategory}
                        />
                    )}
                </div>
            </aside>

            <main className="team-page">
                {/* Team Header */}
                <section className="team-header">
                    <div>
                        <Link to="/" className="back-link">← All repositories</Link>
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
                                <th>Directly labeled files</th>
                            </tr>
                        </thead>

                        <tbody>
                            {(tree?.categories ?? []).map((category) => {
                                const labels = tree.labels.filter((label) => label.category === category);
                                return (
                                    <tr key={category}>
                                        <td>{category}</td>
                                        <td>
                                            {labels.length === 0 ? (
                                                <span className="empty-category">None</span>
                                            ) : (
                                                <ul className="category-paths">
                                                    {labels.map((label) => (
                                                        <li key={label.path}>
                                                            <code>{label.path}</code>
                                                            {!label.present && <span className="missing-path">Missing from branch</span>}
                                                            <button
                                                                type="button"
                                                                disabled={savingPaths.has(label.path)}
                                                                onClick={() => saveFileCategory(label.path, "")}
                                                            >
                                                                Remove
                                                            </button>
                                                            {labelErrors.get(label.path) && (
                                                                <span className="tree-save-error" role="alert">
                                                                    {labelErrors.get(label.path)}
                                                                </span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!tree && (
                                <tr>
                                    <td colSpan={2}>{treeLoading ? "Loading categories…" : "Categories unavailable."}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </section>

            </main>
        </div>
    );
}

export default TeamDashboard;
