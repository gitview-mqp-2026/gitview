import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CircleAlert, Users } from "lucide-react";
import CommitTable from "./CommitTable.jsx";
import ContributionBadge, { contributionDescription } from "./ContributionBadge.jsx";

async function getJson(path) {
    const response = await fetch(path);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
}

export function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
}

const percent = (value) => `${Number(value.toFixed(1))}%`;

// Why a member scored what they did: each category's weight, their share of the team's work in it, and the
// resulting index. Categories nobody worked in are listed as excluded; the rest carry rescaled weights. This is
// the narrow left column of an expanded card, so the table is compact and the explanation is kept short.
function ContributionBreakdown({ contribution }) {
    const rows = contribution.categories;
    const scored = rows.some((row) => row.included);
    const note = !scored || contribution.level === "gray"
        ? contributionDescription(contribution)
        : "1.00 is an equal share of the team's work in a category, capped at 1.25. Weights rescale when a category has no team activity.";

    return (
        <section className="member-breakdown" aria-label="Contribution by category">
            <header className="member-pane-heading">
                <div>
                    <span className="section-kicker">Fair-Share Index</span>
                    <h3>Contribution by category</h3>
                </div>
            </header>
            {scored && (
                <div className="table-scroll">
                    <table className="categories-table member-breakdown-table">
                        <thead>
                            <tr>
                                <th scope="col">Category</th>
                                <th scope="col">Weight</th>
                                <th scope="col">Share</th>
                                <th scope="col">Index</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => row.included ? (
                                <tr key={row.category}>
                                    <th scope="row">{row.category}</th>
                                    <td>{percent(row.effectiveWeight)}</td>
                                    <td>{percent(row.share * 100)}</td>
                                    <td>{row.index.toFixed(2)}</td>
                                </tr>
                            ) : (
                                <tr key={row.category} className="is-excluded">
                                    <th scope="row">{row.category}</th>
                                    <td colSpan={3}>{row.weight === 0 ? "Weight set to 0" : "No team activity"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="member-pane-note">{note}</p>
        </section>
    );
}

function MemberCard({ teamId, member, expanded, onToggle, commitsVersion }) {
    const [commits, setCommits] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!expanded) return undefined;
        let cancelled = false;
        setError(null);
        getJson(`/commits?teamId=${teamId}&studentId=${member.userID}`)
            .then((rows) => !cancelled && setCommits(rows))
            .catch((err) => !cancelled && setError(err.message));
        return () => {
            cancelled = true;
        };
    }, [expanded, teamId, member.userID, commitsVersion]);

    const mergeCount = commits === null ? 0 : commits.filter((commit) => commit.isMerge).length;
    const panelId = `member-detail-${member.userID}`;
    const Chevron = expanded ? ChevronUp : ChevronDown;
    return (
        <article className={`overview-card member-card${expanded ? " is-expanded" : ""}`}>
            <button
                type="button"
                className="member-card-header"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={onToggle}
            >
                <span className="member-avatar" aria-hidden="true">{initials(member.name)}</span>
                <span className="member-identity">
                    <strong>{member.name}</strong>
                    {member.username && <span className="member-username">@{member.username}</span>}
                </span>
                <ContributionBadge contribution={member.contribution} />
                <Chevron className="member-chevron" size={18} aria-hidden="true" />
            </button>

            <dl className="member-stats">
                <div><dt>Commits</dt><dd>{member.commits}</dd></div>
                <div><dt>PRs merged</dt><dd>{member.prsMerged}</dd></div>
                <div>
                    <dt>Fair-Share Index</dt>
                    <dd title={contributionDescription(member.contribution)}>
                        {member.contribution?.index == null ? "—" : `${Math.round(member.contribution.index * 100)}%`}
                    </dd>
                </div>
                <div><dt>Lines added</dt><dd>+{member.additions.toLocaleString()}</dd></div>
                <div><dt>Lines removed</dt><dd>−{member.deletions.toLocaleString()}</dd></div>
                <div>
                    <dt>Last commit</dt>
                    <dd>{member.lastCommitAt ? new Date(member.lastCommitAt).toLocaleDateString() : "—"}</dd>
                </div>
            </dl>

            {expanded && (
                <div id={panelId} className={`member-detail${member.contribution ? "" : " is-single"}`}>
                    {member.contribution && <ContributionBreakdown contribution={member.contribution} />}

                    <section className="member-commits" aria-label={`${member.name}'s commits`}>
                        <header className="member-pane-heading">
                            <div>
                                <span className="section-kicker">Repository history</span>
                                <h3>Commits</h3>
                            </div>
                            {!error && commits !== null && (
                                <span
                                    className="status-badge"
                                    title="Merge commits are listed here but not counted in the Commits stat above."
                                >
                                    {mergeCount > 0 ? `${commits.length - mergeCount} commits · ${mergeCount} merges` : `${commits.length} commits`}
                                </span>
                            )}
                        </header>
                        {error && (
                            <div className="section-state section-state-error" role="alert">
                                <CircleAlert size={20} aria-hidden="true" />
                                Could not load commits: {error}
                            </div>
                        )}
                        {!error && commits === null && (
                            <div className="section-state" role="status">Loading commits…</div>
                        )}
                        {!error && commits !== null && (
                            <CommitTable
                                commits={commits}
                                label={`${member.name}'s commits`}
                                emptyMessage="This member has no commits in this repository."
                            />
                        )}
                    </section>
                </div>
            )}
        </article>
    );
}

// Members and the open card are owned by the parent, so the Overview tab can link straight to one member.
// commitsVersion changes when file labels change, so open commit lists refetch their tags.
function MembersTab({ teamId, members, loading, error, expandedId, onExpandedChange, commitsVersion }) {
    const openCard = useRef(null);
    useEffect(() => {
        openCard.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, [expandedId, members]);

    if (error) {
        return (
            <div className="section-state section-state-error" role="alert">
                <CircleAlert size={20} aria-hidden="true" />
                Could not load members: {error}
            </div>
        );
    }
    if (loading || !members) {
        return (
            <div className="section-state" role="status">
                <Users size={20} aria-hidden="true" />
                Loading members…
            </div>
        );
    }
    if (members.length === 0) {
        return <div className="section-state">No members found for this repository.</div>;
    }

    return (
        <section className="members-tab">
            <header className="section-heading">
                <div>
                    <span className="section-kicker">Team</span>
                    <h2>Members</h2>
                    <p>Select a member to compare their work with the team's and browse their commits.</p>
                </div>
                <span className="status-badge">{members.length}</span>
            </header>

            <div className="members-list">
                {members.map((member) => (
                    <div key={member.userID} ref={expandedId === member.userID ? openCard : null}>
                        <MemberCard
                            teamId={teamId}
                            member={member}
                            expanded={expandedId === member.userID}
                            onToggle={() => onExpandedChange(expandedId === member.userID ? null : member.userID)}
                            commitsVersion={commitsVersion}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}

export default MembersTab;
