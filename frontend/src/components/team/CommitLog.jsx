import { ChevronLeft, ChevronRight, CircleAlert, GitCommitHorizontal } from "lucide-react";

function CommitLog({
    commits,
    error,
    firstShown,
    lastShown,
    loading,
    onNext,
    onPrevious,
    page,
    pageCount,
    visibleCommits,
}) {
    return (
        <section className="significant-commits">
            <header className="section-heading">
                <div>
                    <span className="section-kicker">Repository history</span>
                    <h2>Commit log</h2>
                    <p>Categories are derived from the labeled paths changed by each commit.</p>
                </div>
                {!loading && !error && <span className="status-badge">{commits.length} total</span>}
            </header>

            {loading && (
                <div className="section-state" role="status">
                    <GitCommitHorizontal size={20} aria-hidden="true" />
                    Loading commits…
                </div>
            )}
            {error && (
                <div className="section-state section-state-error" role="alert">
                    <CircleAlert size={20} aria-hidden="true" />
                    Could not load commits: {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="table-scroll" tabIndex={commits.length > 0 ? 0 : undefined}>
                        <table className="categories-table commit-table">
                            <thead>
                                <tr>
                                    <th scope="col">Hash</th>
                                    <th scope="col">Subject</th>
                                    <th scope="col">Author</th>
                                    <th scope="col">Date</th>
                                    <th scope="col">Categories from files</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commits.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="table-empty">No commits found for this repository.</td>
                                    </tr>
                                ) : (
                                    visibleCommits.map((commit) => (
                                        <tr key={commit.commitHash}>
                                            <td><code>{commit.commitHash.slice(0, 7)}</code></td>
                                            <td className="commit-subject">{commit.commitSubject}</td>
                                            <td>{commit.author}</td>
                                            <td>{new Date(commit.dateTime).toLocaleDateString()}</td>
                                            <td className="commit-tags-cell">
                                                <div
                                                    className="commit-tag-summary"
                                                    title="Derived from labeled files changed by this commit"
                                                >
                                                    {(commit.tags ?? []).map((tag) => (
                                                        <span className="file-category-badge" key={tag}>{tag}</span>
                                                    ))}
                                                    {(commit.tags ?? []).length === 0 && (
                                                        <span className="empty-category">None</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pageCount > 1 && (
                        <nav className="pager" aria-label="Commit log pagination">
                            <button type="button" onClick={onPrevious} disabled={page === 1}>
                                <ChevronLeft size={16} aria-hidden="true" />
                                Previous
                            </button>
                            <span>
                                Page {page} of {pageCount} · {firstShown}–{lastShown} of {commits.length}
                            </span>
                            <button type="button" onClick={onNext} disabled={page === pageCount}>
                                Next
                                <ChevronRight size={16} aria-hidden="true" />
                            </button>
                        </nav>
                    )}
                </>
            )}
        </section>
    );
}

export default CommitLog;
