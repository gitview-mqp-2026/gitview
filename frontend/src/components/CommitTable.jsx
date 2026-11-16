import { useEffect, useState } from "react";

const PAGE_SIZE = 10;

// Paginated, tagged commit list shared by the team commit log and each member's commit list.
function CommitTable({ commits, emptyMessage = "No commits found." }) {
    const [page, setPage] = useState(1);
    useEffect(() => setPage(1), [commits.length]);

    const pageCount = Math.max(1, Math.ceil(commits.length / PAGE_SIZE));
    const firstShown = (page - 1) * PAGE_SIZE + 1;
    const lastShown = Math.min(page * PAGE_SIZE, commits.length);
    const visibleCommits = commits.slice(firstShown - 1, lastShown);

    return (
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
                            <td colSpan={5}>{emptyMessage}</td>
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
    );
}

export default CommitTable;
