import { useEffect, useMemo, useRef, useState } from "react";
import "../App.css";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PanelLeftOpen } from "lucide-react";
import AppHeader from "../components/AppHeader.jsx";
import LogoutButton from "../components/auth/LogoutButton.jsx";
import Profile from "../components/auth/Profile.jsx";
import MembersTab from "../components/MembersTab.jsx";
import CommitLog from "../components/team/CommitLog.jsx";
import ContributionCategories from "../components/team/ContributionCategories.jsx";
import ProjectStructurePanel from "../components/team/ProjectStructurePanel.jsx";
import TeamOverview from "../components/team/TeamOverview.jsx";
import { replaceFileLabel } from "../utils/fileLabels.js";

const PAGE_SIZE = 10;

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
    const [page, setPage] = useState(1);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab") : "overview";
    const memberParam = Number(searchParams.get("member"));
    const expandedMemberId = Number.isInteger(memberParam) && memberParam > 0 ? memberParam : null;
    const [members, setMembers] = useState(null);
    const [membersError, setMembersError] = useState(null);
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
        setMembers(null);
        setMembersError(null);
    }, [teamId]);

    // Contribution scores depend on file labels, so members are fetched again whenever labels change
    // (commitsVersion). The list is not cleared first, so open cards stay put while scores refresh.
    useEffect(() => {
        let cancelled = false;
        getJson(`/repositories/${teamId}/members`)
            .then((rows) => {
                if (cancelled) return;
                setMembers(rows);
                setMembersError(null);
            })
            .catch((err) => !cancelled && setMembersError(err.message));
        return () => {
            cancelled = true;
        };
    }, [teamId, commitsVersion]);

    const showMember = (userID) => setSearchParams(
        userID ? { tab: "members", member: String(userID) } : { tab: "members" },
        { replace: true },
    );

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

    const pageCount = Math.max(1, Math.ceil(commits.length / PAGE_SIZE));
    const firstShown = (page - 1) * PAGE_SIZE + 1;
    const lastShown = Math.min(page * PAGE_SIZE, commits.length);
    const visibleCommits = commits.slice(firstShown - 1, lastShown);

    return (
        <>
            <AppHeader actions={(
                <div className="nav-account">
                    <Profile />
                    <LogoutButton />
                </div>
            )}>
                <button
                    ref={treePanelToggle}
                    className="tree-panel-toggle"
                    type="button"
                    aria-controls="project-structure-panel"
                    aria-expanded={treePanelOpen}
                    aria-label="Project structure"
                    onClick={() => setTreePanelOpen((open) => !open)}
                >
                    <PanelLeftOpen size={16} aria-hidden="true" />
                    <span className="tree-panel-label tree-panel-label-long" aria-hidden="true">
                        Project structure
                    </span>
                    <span className="tree-panel-label tree-panel-label-short" aria-hidden="true">
                        Files
                    </span>
                </button>
                <div className="file-path" aria-label="Current location">
                    <Link to={stats?.courseID ? `/course/${stats.courseID}` : "/"}>
                        Repositories
                    </Link>
                    <span>/</span>
                    <strong>{stats?.name ?? "Team dashboard"}</strong>
                </div>
            </AppHeader>

            <ProjectStructurePanel
                isOpen={treePanelOpen}
                tree={tree}
                treeLoading={treeLoading}
                treeError={treeError}
                fileLabelsByPath={fileLabelsByPath}
                directoryLabelsByPath={directoryLabelsByPath}
                savingPaths={savingPaths}
                labelErrors={labelErrors}
                onCategoryChange={saveCategory}
                onClose={() => {
                    setTreePanelOpen(false);
                    treePanelToggle.current?.focus();
                }}
            />

            <main id="main-content" className="team-page">
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
                        <MembersTab
                            teamId={teamId}
                            members={members}
                            loading={!members && !membersError}
                            error={membersError}
                            expandedId={expandedMemberId}
                            onExpandedChange={showMember}
                            commitsVersion={commitsVersion}
                        />
                    </div>
                )}

                {activeTab === "overview" && (
                    <div role="tabpanel" id="team-tabpanel-overview" aria-labelledby="team-tab-overview">
                        <TeamOverview
                            stats={stats}
                            loading={loading}
                            error={error}
                            members={members}
                            membersError={membersError}
                            onShowMember={showMember}
                        />
                        <CommitLog
                            commits={commits}
                            visibleCommits={visibleCommits}
                            loading={loading}
                            error={error}
                            page={page}
                            pageCount={pageCount}
                            firstShown={firstShown}
                            lastShown={lastShown}
                            onPrevious={() => setPage(page - 1)}
                            onNext={() => setPage(page + 1)}
                        />
                        <ContributionCategories
                            tree={tree}
                            treeError={treeError}
                            treeLoading={treeLoading}
                            savingPaths={savingPaths}
                            labelErrors={labelErrors}
                            onCategoryChange={saveCategory}
                        />
                    </div>
                )}
            </main>
        </>
    );
}

export default TeamDashboard;
