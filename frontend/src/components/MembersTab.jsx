import { useEffect, useRef, useState } from "react";
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
// resulting index. Categories nobody worked in are listed as excluded; the rest carry rescaled weights.
function ContributionBreakdown({ contribution }) {
    const rows = contribution.categories;
    if (!rows.some((row) => row.included)) {
        return (
            <div className="member-breakdown">
                <h3>Contribution</h3>
                <p>{contributionDescription(contribution)}</p>
            </div>
        );
    }
    return (
        <div className="member-breakdown">
            <h3>Contribution by category</h3>
            <p>
                {contribution.level === "gray"
                    ? contributionDescription(contribution)
                    : "An index of 1.00 is an equal share of the team's work in that category, capped at 1.25."}
                {" "}Weights are rescaled when a category has no team activity.
            </p>
            <table>
                <thead>
                    <tr><th scope="col">Category</th><th scope="col">Weight</th><th scope="col">Share of team</th><th scope="col">Index</th></tr>
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
                            <td colSpan={3}>{row.weight === 0 ? "Excluded: weight set to 0" : "Excluded: no team activity"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
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

    const panelId = `member-commits-${member.userID}`;
    return (
        <div className={`member-card${expanded ? " is-expanded" : ""}`}>
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
                <span className="member-chevron" aria-hidden="true">{expanded ? "▴" : "▾"}</span>
            </button>

            <dl className="member-stats">
                <div><dt>Commits</dt><dd>{member.commits}</dd></div>
                <div><dt>PRs merged</dt><dd>{member.prsMerged}</dd></div>
                <div>
                    <dt>Fair share</dt>
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
                <div id={panelId}>
                    {member.contribution && <ContributionBreakdown contribution={member.contribution} />}
                    <div className="member-commits">
                        <h3>{member.name}'s commits</h3>
                        {error && <p className="repo-error" role="alert">Could not load commits: {error}</p>}
                        {!error && commits === null && <p>Loading commits…</p>}
                        {!error && commits !== null && (
                            <CommitTable commits={commits} emptyMessage="This member has no commits in this repository." />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Members and the open card are owned by the parent, so the Overview tab can link straight to one member.
// commitsVersion changes when file labels change, so open commit lists refetch their tags.
function MembersTab({ teamId, members, loading, error, expandedId, onExpandedChange, commitsVersion }) {
    const openCard = useRef(null);
    useEffect(() => {
        openCard.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, [expandedId, members]);

    if (error) return <p className="repo-error" role="alert">Could not load members: {error}</p>;
    if (loading || !members) return <p>Loading members…</p>;
    if (members.length === 0) return <p>No members found for this repository.</p>;

    return (
        <section className="members-tab">
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
        </section>
    );
}

export default MembersTab;
