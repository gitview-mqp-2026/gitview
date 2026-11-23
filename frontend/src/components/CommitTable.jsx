import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

// One member's commits, paginated and tagged like the team commit log. There is no Author column because every
// row belongs to the same person.
function CommitTable({ commits, emptyMessage = "No commits found.", label = "Commits" }) {
    const [page, setPage] = useState(1);
    useEffect(() => setPage(1), [commits.length]);

    const pageCount = Math.max(1, Math.ceil(commits.length / PAGE_SIZE));
    const firstShown = (page - 1) * PAGE_SIZE + 1;
    const lastShown = Math.min(page * PAGE_SIZE, commits.length);
    const visibleCommits = commits.slice(firstShown - 1, lastShown);

    return (
        <>
            <div
                className="table-scroll"
                role="region"
                aria-label={label}
                tabIndex={commits.length > 0 ? 0 : undefined}
            >
                <table className="categories-table commit-table member-commit-table">
                    <thead>
                        <tr>
                            <th scope="col">Hash</th>
                            <th scope="col">Subject</th>
                            <th scope="col">Date</th>
                            <th scope="col">Categories from files</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commits.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="table-empty">{emptyMessage}</td>
                            </tr>
                        ) : (
                            visibleCommits.map((commit) => (
                                <tr key={commit.commitHash}>
                                    <td><code>{commit.commitHash.slice(0, 7)}</code></td>
                                    <td className="commit-subject">{commit.commitSubject}</td>
                                    <td>{new Date(commit.dateTime).toLocaleDateString()}</td>
                                    <td className="commit-tags-cell">
                                        <div
                                            className="commit-tag-summary"
                                            title="Derived from labeled files changed by this commit"
                                        >
                                            {(commit.tags ?? []).map((tag) => (
                                                <span className="file-category-badge" key={tag}>{tag}</span>
                                            ))}
                                            {(commit.tags ?? []).length === 0 && <span className="empty-category">None</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {pageCount > 1 && (
                <nav className="pager" aria-label={`${label} pagination`}>
                    <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1}>
                        <ChevronLeft size={16} aria-hidden="true" />
                        Previous
                    </button>
                    <span>
                        Page {page} of {pageCount} · {firstShown}–{lastShown} of {commits.length}
                    </span>
                    <button type="button" onClick={() => setPage(page + 1)} disabled={page === pageCount}>
                        Next
                        <ChevronRight size={16} aria-hidden="true" />
                    </button>
                </nav>
            )}
        </>
    );
}

export default CommitTable;
