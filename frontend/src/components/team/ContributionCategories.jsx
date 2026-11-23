import { CircleAlert, FolderTree, Tag, Trash2 } from "lucide-react";

function ContributionCategories({
    labelErrors,
    onCategoryChange,
    savingPaths,
    tree,
    treeError,
    treeLoading,
}) {
    const categories = tree?.categories ?? [];

    return (
        <section className="contribution-categories">
            <header className="section-heading">
                <div>
                    <span className="section-kicker">Repository labels</span>
                    <h2>Major contribution categories</h2>
                    <p>Direct labels define how changed files contribute to commit categories.</p>
                </div>
                {tree && <span className="status-badge">{categories.length} categories</span>}
            </header>

            {treeLoading && (
                <div className="section-state" role="status">
                    <FolderTree size={20} aria-hidden="true" />
                    Loading categories…
                </div>
            )}
            {treeError && (
                <div className="section-state section-state-error" role="alert">
                    <CircleAlert size={20} aria-hidden="true" />
                    Could not load categories: {treeError}
                </div>
            )}
            {tree && categories.length === 0 && (
                <div className="section-state">No contribution categories configured.</div>
            )}

            {tree && categories.length > 0 && (
                <div className="category-grid" aria-live="polite">
                    {categories.map((category) => {
                        const labels = [
                            ...(tree.directoryLabels ?? [])
                                .filter((label) => label.category === category)
                                .map((label) => ({ ...label, labelType: "directory" })),
                            ...tree.labels
                                .filter((label) => label.category === category)
                                .map((label) => ({ ...label, labelType: "file" })),
                        ];

                        return (
                            <article className="category-card" key={category}>
                                <header className="category-card-header">
                                    <h3><Tag size={17} aria-hidden="true" /> {category}</h3>
                                    <span className="status-badge">
                                        {labels.length} {labels.length === 1 ? "path" : "paths"}
                                    </span>
                                </header>

                                {labels.length === 0 ? (
                                    <span className="empty-state">No directly labeled paths</span>
                                ) : (
                                    <ul className="category-paths">
                                        {labels.map((label) => {
                                            const saving = savingPaths.has(label.path);
                                            return (
                                                <li key={`${label.labelType}:${label.path}`}>
                                                    <div className="category-path-copy">
                                                        <code>{label.path}</code>
                                                        <div className="category-path-meta">
                                                            <span className="path-kind">{label.labelType}</span>
                                                            {!label.present && (
                                                                <span className="missing-path">Missing from branch</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="remove-label-button"
                                                        type="button"
                                                        disabled={saving}
                                                        aria-label={`Remove ${category} label from ${label.path}`}
                                                        onClick={() => onCategoryChange(label.labelType, label.path, "")}
                                                    >
                                                        <Trash2 size={15} aria-hidden="true" />
                                                        {saving ? "Removing…" : "Remove"}
                                                    </button>
                                                    {labelErrors.get(label.path) && (
                                                        <span className="tree-save-error" role="alert">
                                                            {labelErrors.get(label.path)}
                                                        </span>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default ContributionCategories;
