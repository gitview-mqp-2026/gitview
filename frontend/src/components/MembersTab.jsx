import { useEffect, useState } from "react";
import CommitTable from "./CommitTable.jsx";

async function getJson(path) {
    const response = await fetch(path);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
}

function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
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
                <span className="member-chevron" aria-hidden="true">{expanded ? "▴" : "▾"}</span>
            </button>

            <dl className="member-stats">
                <div><dt>Commits</dt><dd>{member.commits}</dd></div>
                <div><dt>PRs merged</dt><dd>{member.prsMerged}</dd></div>
                <div><dt>Lines added</dt><dd>+{member.additions.toLocaleString()}</dd></div>
                <div><dt>Lines removed</dt><dd>−{member.deletions.toLocaleString()}</dd></div>
                <div>
                    <dt>Last commit</dt>
                    <dd>{member.lastCommitAt ? new Date(member.lastCommitAt).toLocaleDateString() : "—"}</dd>
                </div>
            </dl>

            {expanded && (
                <div id={panelId} className="member-commits">
                    <h3>{member.name}'s commits</h3>
                    {error && <p className="repo-error" role="alert">Could not load commits: {error}</p>}
                    {!error && commits === null && <p>Loading commits…</p>}
                    {!error && commits !== null && (
                        <CommitTable commits={commits} emptyMessage="This member has no commits in this repository." />
                    )}
                </div>
            )}
        </div>
    );
}

// commitsVersion changes when file labels change, so open commit lists refetch their tags.
function MembersTab({ teamId, commitsVersion }) {
    const [members, setMembers] = useState(null);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setMembers(null);
        setError(null);
        setExpandedId(null);
        getJson(`/repositories/${teamId}/members`)
            .then((rows) => !cancelled && setMembers(rows))
            .catch((err) => !cancelled && setError(err.message));
        return () => {
            cancelled = true;
        };
    }, [teamId]);

    if (error) return <p className="repo-error" role="alert">Could not load members: {error}</p>;
    if (!members) return <p>Loading members…</p>;
    if (members.length === 0) return <p>No members found for this repository.</p>;

    return (
        <section className="members-tab">
            {members.map((member) => (
                <MemberCard
                    key={member.userID}
                    teamId={teamId}
                    member={member}
                    expanded={expandedId === member.userID}
                    onToggle={() => setExpandedId(expandedId === member.userID ? null : member.userID)}
                    commitsVersion={commitsVersion}
                />
            ))}
        </section>
    );
}

export default MembersTab;
