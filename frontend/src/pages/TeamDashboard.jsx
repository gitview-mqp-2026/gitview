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
            getJson(`/commits?teamId=${teamId}`),
            getJson(`/repositories/${teamId}/stats`),
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

        getJson(`/repositories/${teamId}/tree`)
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

    const fileLabelsByPath = useMemo(
        () => new Map((tree?.labels ?? []).map((label) => [label.path, label.category])),
        [tree],
    );
    const directoryLabelsByPath = useMemo(
        () => new Map((tree?.directoryLabels ?? []).map((label) => [label.path, label.category])),
        [tree],
    );

    const saveCategory = async (labelType, path, category) => {
        if (!tree || savingPaths.has(path)) return;

        const labelsKey = labelType === "directory" ? "directoryLabels" : "labels";
        const endpoint = labelType === "directory" ? "directory-labels" : "file-labels";
        const previousLabel = (tree[labelsKey] ?? []).find((label) => label.path === path) ?? null;
        const optimisticLabel = category ? { path, category, present: true } : null;
        setTree((current) => current && ({
            ...current,
            [labelsKey]: replaceFileLabel(current[labelsKey] ?? [], path, optimisticLabel),
        }));
        setSavingPaths((current) => new Set(current).add(path));
        setLabelErrors((current) => {
            const next = new Map(current);
            next.delete(path);
            return next;
        });

        try {
            const response = category
                ? await fetch(`/repositories/${teamId}/${endpoint}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path, category }),
                })
                : await fetch(`/repositories/${teamId}/${endpoint}?${new URLSearchParams({ path })}`, {
                    method: "DELETE",
                });
            const data = response.status === 204 ? null : await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
            if (data) {
                setTree((current) => current && ({
                    ...current,
                    [labelsKey]: replaceFileLabel(current[labelsKey] ?? [], path, data),
                }));
            }
            getJson(`/commits?teamId=${teamId}`)
                .then((rows) => {
                    setCommits(rows);
                    setError(null);
                })
                .catch((err) => setError(err.message));
        } catch (err) {
            setTree((current) => current && ({
                ...current,
                [labelsKey]: replaceFileLabel(current[labelsKey] ?? [], path, previousLabel),
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
                            fileLabelsByPath={fileLabelsByPath}
                            directoryLabelsByPath={directoryLabelsByPath}
                            savingPaths={savingPaths}
                            labelErrors={labelErrors}
                            onCategoryChange={saveCategory}
                        />
                    )}
                </div>
            </aside>

            <main className="team-page">
                {/* Team Header */}
                <section className="team-header">
                    <div>
                        <Link to={stats?.courseID ? `/course/${stats.courseID}` : "/"} className="back-link">← All repositories</Link>
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
                        <strong>{stat(stats?.alerts.length)}</strong>
                    </div>
                </section>

                <section className="two-columns">
                    <div className="container">
                        <h2>Alerts</h2>

                        <div className="content">
                            {!loading && !error && stats?.alerts.length === 0 && <span>No alerts</span>}
                            {stats?.alerts.map((alert) => (
                                <div className="alert" key={`${alert.type}-${alert.studentID}`}>
                                    <div className="profile-button"></div>
                                    <span>{alert.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="container">
                        <h2>Members</h2>

                        <div className="content">
                            {!loading && !error && stats?.teamMembers.length === 0 && <span>No members</span>}
                            {stats?.teamMembers.map((member) => (
                                <div className="member" key={member.userID}>
                                    <div className="profile-button"></div>
                                    <span>{member.displayName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Commit Log (live from /commits) */}
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
                                        <th>Categories from files</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {commits.length === 0 ? (
                                        <tr>
                                            <td colSpan={5}>No commits found for this repository.</td>
                                        </tr>
                                    ) : (
                                        visibleCommits.map((c) => (
                                            <tr key={c.commitHash}>
                                                <td><code>{c.commitHash.slice(0, 7)}</code></td>
                                                <td>{c.commitSubject}</td>
                                                <td>{c.author}</td>
                                                <td>{new Date(c.dateTime).toLocaleDateString()}</td>
                                                <td className="commit-tags-cell">
                                                    <div
                                                        className="commit-tag-summary"
                                                        title="Derived from labeled files changed by this commit"
                                                    >
                                                        {(c.tags ?? []).map((tag) => (
                                                            <span className="file-category-badge" key={tag}>{tag}</span>
                                                        ))}
                                                        {(c.tags ?? []).length === 0 && <span className="empty-category">None</span>}
                                                    </div>
                                                </td>
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
                                <th>Directly labeled paths</th>
                            </tr>
                        </thead>

                        <tbody>
                            {(tree?.categories ?? []).map((category) => {
                                const labels = [
                                    ...(tree.directoryLabels ?? [])
                                        .filter((label) => label.category === category)
                                        .map((label) => ({ ...label, labelType: "directory" })),
                                    ...tree.labels
                                        .filter((label) => label.category === category)
                                        .map((label) => ({ ...label, labelType: "file" })),
                                ];
                                return (
                                    <tr key={category}>
                                        <td>{category}</td>
                                        <td>
                                            {labels.length === 0 ? (
                                                <span className="empty-category">None</span>
                                            ) : (
                                                <ul className="category-paths">
                                                    {labels.map((label) => (
                                                        <li key={`${label.labelType}:${label.path}`}>
                                                            <code>{label.path}</code>
                                                            <span className="path-kind">{label.labelType}</span>
                                                            {!label.present && <span className="missing-path">Missing from branch</span>}
                                                            <button
                                                                type="button"
                                                                disabled={savingPaths.has(label.path)}
                                                                onClick={() => saveCategory(label.labelType, label.path, "")}
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
