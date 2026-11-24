import { Link } from "react-router-dom";
import {
    AlertTriangle,
    ArrowLeft,
    Bell,
    CalendarDays,
    CheckCircle2,
    CircleAlert,
    CircleCheckBig,
    ExternalLink,
    GitCommitHorizontal,
    GitPullRequest,
    MessageSquare,
    Users,
} from "lucide-react";
import { withMemberQualifiers } from "../../utils/teamMembers.js";

function TeamOverview({ error, loading, stats }) {
    const members = withMemberQualifiers(stats?.teamMembers ?? []);
    const membersById = new Map(members.map((member) => [member.userID, member]));
    const metrics = [
        { label: "Commits", value: stats?.commits, icon: GitCommitHorizontal },
        { label: "PRs merged", value: stats?.prsMerged, icon: GitPullRequest },
        { label: "Comments", value: "Not tracked", icon: MessageSquare, unavailable: true },
        { label: "Issues closed", value: "Not tracked", icon: CircleCheckBig, unavailable: true },
        { label: "Alerts", value: stats?.alerts.length, icon: Bell },
    ];

    return (
        <>
            <section className="team-header">
                <div className="team-heading">
                    <Link
                        to={stats?.courseID ? `/course/${stats.courseID}` : "/"}
                        className="back-link"
                    >
                        <ArrowLeft size={15} aria-hidden="true" />
                        All repositories
                    </Link>
                    <span className="section-kicker">Repository overview</span>
                    <h1>{stats?.name ?? (loading ? "Loading repository…" : "Repository")}</h1>
                    {stats && (
                        <p className="repo-meta">
                            <span>{stats.members} {stats.members === 1 ? "member" : "members"}</span>
                            <span aria-hidden="true">·</span>
                            <a href={stats.url} target="_blank" rel="noreferrer" className="repo-link">
                                GitHub repository
                                <ExternalLink size={14} aria-hidden="true" />
                            </a>
                        </p>
                    )}
                </div>

                <span className="activity-range">
                    <CalendarDays size={16} aria-hidden="true" />
                    All recorded activity
                </span>
            </section>

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
                    <div className="overview-list" aria-busy={loading}>
                        {loading && [0, 1, 2].map((item) => (
                            <span className="skeleton list-skeleton" aria-hidden="true" key={item} />
                        ))}
                        {error && <span className="empty-state">Members are unavailable.</span>}
                        {!loading && !error && stats?.teamMembers.length === 0 && (
                            <div className="empty-state">No members assigned</div>
                        )}
                        {!loading && !error && members.map((member) => (
                            <div className="member" key={member.userID}>
                                <span className="member-avatar" aria-hidden="true">
                                    {member.displayName.trim().charAt(0).toUpperCase() || "?"}
                                </span>
                                <span className="member-copy">
                                    <span>{member.displayName}</span>
                                    {member.qualifier && <small>{member.qualifier}</small>}
                                </span>
                            </div>
                        ))}
                    </div>
                </article>
            </section>
        </>
    );
}

export default TeamOverview;
