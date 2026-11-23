import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    CircleAlert,
    CircleCheckBig,
    GitCommitHorizontal,
    GitPullRequest,
    MessageSquare,
    Users,
} from "lucide-react";
import { withMemberQualifiers } from "../../utils/teamMembers.js";

const OVERVIEW_MEMBER_LIMIT = 5;

function TeamOverview({ error, loading, stats, members, membersError, onShowMember }) {
    // People who share a display name get a "Member <id>" qualifier. `members` below is the /members list with
    // commit counts; both are keyed by the same student id, so the qualifiers apply to it as well as to alerts.
    const qualifiedMembers = withMemberQualifiers(stats?.teamMembers ?? []);
    const membersById = new Map(qualifiedMembers.map((member) => [member.userID, member]));
    const metrics = [
        { label: "Commits", value: stats?.commits, icon: GitCommitHorizontal },
        { label: "PRs merged", value: stats?.prsMerged, icon: GitPullRequest },
        { label: "Comments", value: "Not tracked", icon: MessageSquare, unavailable: true },
        { label: "Issues closed", value: "Not tracked", icon: CircleCheckBig, unavailable: true },
        { label: "Alerts", value: stats?.alerts.length, icon: Bell },
    ];

    return (
        <>
            {error && (
                <div className="dashboard-state dashboard-state-error" role="alert">
                    <CircleAlert size={18} aria-hidden="true" />
                    <span>Could not load repository summary: {error}</span>
                </div>
            )}

            <section className="stats-overview" aria-label="Repository statistics" aria-busy={loading}>
                {metrics.map(({ label, value, icon: Icon, unavailable }) => (
                    <article className="stat-card" key={label}>
                        <div className="stat-card-header">
                            <span>{label}</span>
                            <Icon size={18} aria-hidden="true" />
                        </div>
                        {loading ? (
                            <span className="skeleton stat-skeleton" aria-hidden="true" />
                        ) : (
                            <strong className={unavailable ? "stat-untracked" : undefined}>
                                {error || !stats ? "—" : value}
                            </strong>
                        )}
                    </article>
                ))}
            </section>

            <section className="two-columns">
                <article className="overview-card">
                    <header className="overview-card-header">
                        <div>
                            <h2><Bell size={19} aria-hidden="true" /> Alerts</h2>
                            <p>Activity that may need attention</p>
                        </div>
                        {!loading && !error && (
                            <span className="status-badge status-badge-warning">{stats?.alerts.length ?? 0}</span>
                        )}
                    </header>
                    <div className="overview-list" aria-busy={loading}>
                        {loading && [0, 1, 2].map((item) => (
                            <span className="skeleton list-skeleton" aria-hidden="true" key={item} />
                        ))}
                        {error && <span className="empty-state">Alerts are unavailable.</span>}
                        {!loading && !error && stats?.alerts.length === 0 && (
                            <div className="empty-state empty-state-success">
                                <CheckCircle2 size={18} aria-hidden="true" />
                                No active alerts
                            </div>
                        )}
                        {!loading && !error && stats?.alerts.map((alert) => (
                            <div className="alert" key={`${alert.type}-${alert.studentID}`}>
                                <span className="alert-icon" aria-hidden="true">
                                    <AlertTriangle size={17} />
                                </span>
                                <span className="alert-copy">
                                    <span>{alert.message}</span>
                                    {membersById.get(alert.studentID)?.qualifier && (
                                        <small>{membersById.get(alert.studentID).qualifier}</small>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="overview-card">
                    <header className="overview-card-header">
                        <div>
                            <h2><Users size={19} aria-hidden="true" /> Members</h2>
                            <p>Contributors assigned to this team</p>
                        </div>
                        {!loading && !error && (
                            <span className="status-badge">{stats?.teamMembers.length ?? 0}</span>
                        )}
                    </header>
                    <div className="overview-list" aria-busy={loading || (!members && !membersError)}>
                        {loading && [0, 1, 2].map((item) => (
                            <span className="skeleton list-skeleton" aria-hidden="true" key={item} />
                        ))}
                        {error && <span className="empty-state">Members are unavailable.</span>}
                        {!loading && !error && membersError && (
                            <span className="empty-state" role="alert">Could not load members.</span>
                        )}
                        {!loading && !error && !membersError && !members && (
                            <span className="empty-state">Loading members…</span>
                        )}
                        {!loading && !error && members?.length === 0 && (
                            <div className="empty-state">No members assigned</div>
                        )}
                        {!loading && !error && (members ?? []).slice(0, OVERVIEW_MEMBER_LIMIT).map((member) => (
                            <div className="member" key={member.userID}>
                                <span className="member-avatar" aria-hidden="true">
                                    {member.name.trim().charAt(0).toUpperCase() || "?"}
                                </span>
                                <span className="member-copy">
                                    <button type="button" className="member-link" onClick={() => onShowMember(member.userID)}>
                                        {member.name}
                                    </button>
                                    {membersById.get(member.userID)?.qualifier && (
                                        <small>{membersById.get(member.userID).qualifier}</small>
                                    )}
                                </span>
                                <span className="member-quick-stats">
                                    {member.commits} {member.commits === 1 ? "commit" : "commits"} · {member.prsMerged} {member.prsMerged === 1 ? "PR" : "PRs"}
                                </span>
                            </div>
                        ))}
                        {!loading && !error && (members?.length ?? 0) > OVERVIEW_MEMBER_LIMIT && (
                            <button type="button" className="member-link member-view-all" onClick={() => onShowMember(null)}>
                                View all {members.length} members
                            </button>
                        )}
                    </div>
                </article>
            </section>
        </>
    );
}

export default TeamOverview;
