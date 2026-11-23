import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, ExternalLink } from "lucide-react";

// The repository's name, member count and link. It stays above the Overview/Members tabs, so it shows on both.
function TeamHeader({ loading, stats }) {
    return (
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
    );
}

export default TeamHeader;
