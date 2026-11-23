// How much of a team's work sits under a file or folder label. Contribution scores only count labeled files, so
// this shows an instructor what labeling would unlock and where to start. It lives only in the project
// structure panel, next to the tree where labeling happens.
function LabelingCoverage({ coverage, error }) {
    if (error) {
        return (
            <p className="label-coverage coverage-note" role="alert">
                Could not load label coverage: {error}
            </p>
        );
    }
    if (!coverage) {
        return <p className="label-coverage coverage-note" role="status">Checking label coverage…</p>;
    }
    if (coverage.totalLines === 0) {
        return <p className="label-coverage coverage-note">No work recorded for this team yet, so there is nothing to label.</p>;
    }

    const { coveredPercent, minCoveragePercent, unlabeledFolders } = coverage;
    const low = coveredPercent < minCoveragePercent;

    return (
        <section className="label-coverage" aria-label="Label coverage">
            <p className="coverage-headline">
                <strong>{coveredPercent}%</strong> of this team's work is labeled
            </p>
            <div
                className={`coverage-bar${low ? " is-low" : ""}`}
                role="meter"
                aria-label="Share of this team's work that is labeled"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={coveredPercent}
                aria-valuetext={`${coveredPercent}% labeled; scores need at least ${minCoveragePercent}%`}
            >
                <span className="coverage-fill" style={{ width: `${coveredPercent}%` }} />
                <span className="coverage-threshold" style={{ left: `${minCoveragePercent}%` }} aria-hidden="true" />
            </div>
            <p className="coverage-note">
                {low
                    ? `Contribution scores stay hidden until at least ${minCoveragePercent}% is labeled.`
                    : `Enough is labeled to score contributions (minimum ${minCoveragePercent}%).`}
            </p>

            {unlabeledFolders.length > 0 && (
                <details className="coverage-folders" open={low}>
                    <summary>Largest unlabeled folders ({unlabeledFolders.length})</summary>
                    <p className="coverage-note">Label a folder in the tree below to cover everything inside it.</p>
                    <ul>
                        {unlabeledFolders.map((folder) => (
                            <li key={folder.path || "(root)"}>
                                <code title={folder.path === "" ? "Files in the repository root can only be labeled one by one." : folder.path}>
                                    {folder.path === "" ? "(repository root files)" : folder.path}
                                </code>
                                <span>{folder.percent}% of work</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}

export default LabelingCoverage;
