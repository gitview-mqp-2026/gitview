import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";
import { Link, useParams, useSearchParams } from "react-router-dom";
import RepositoryTree from "../components/RepositoryTree.jsx";
import CommitTable from "../components/CommitTable.jsx";
import MembersTab from "../components/MembersTab.jsx";
import { replaceFileLabel } from "../utils/fileLabels.js";

const TABS = [
    { id: "overview", label: "Overview" },
    { id: "members", label: "Members" },
];

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
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab") : "overview";
    const [commitsVersion, setCommitsVersion] = useState(0);
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
                    setCommitsVersion((v) => v + 1);
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

                <div className="team-tabs" role="tablist" aria-label="Team views">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`team-tab-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            aria-controls={`team-tabpanel-${tab.id}`}
                            className={`team-tab${activeTab === tab.id ? " is-active" : ""}`}
                            onClick={() => setSearchParams(tab.id === "overview" ? {} : { tab: tab.id }, { replace: true })}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === "members" && (
                    <div role="tabpanel" id="team-tabpanel-members" aria-labelledby="team-tab-members">
                        <MembersTab teamId={teamId} commitsVersion={commitsVersion} />
                    </div>
                )}

                {activeTab === "overview" && (
                <div role="tabpanel" id="team-tabpanel-overview" aria-labelledby="team-tab-overview">
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
                        <strong>—</strong>
                    </div>

                    <div className="stat-card">
                        <span>ISSUES CLOSED</span>
                        <strong>—</strong>
                    </div>

                    <div className="stat-card">
                        <span>ALERTS</span>
                        <strong>9</strong>
                    </div>
                </section>

                <section className="two-columns">
                    {/* Alerts (MOCKED) */}
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

                {/* Commit Log (live from /commits) */}
                <section className="significant-commits">
                    <h2>Commit log</h2>

                    {loading && <p>Loading commits…</p>}
                    {error && <p style={{ color: "red" }}>Could not load commits: {error}</p>}

                    {!loading && !error && (
                        <>
                            <CommitTable commits={commits} emptyMessage="No commits found for this repository." />
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
                </div>
                )}

            </main>
        </div>
    );
}

export default TeamDashboard;
