import { useState } from "react";
import { ChevronRight, CircleAlert, FolderTree, Tag, Trash2 } from "lucide-react";

const MAX_VISIBLE_LABELS = 5;

function ContributionCategories({
    labelErrors,
    onCategoryChange,
    savingPaths,
    tree,
    treeError,
    treeLoading,
}) {
    const [pendingRemoval, setPendingRemoval] = useState(null);
    const categories = tree?.categories ?? [];
    const categoryGroups = categories.map((category) => ({
        category,
        labels: [
            ...(tree?.directoryLabels ?? [])
                .filter((label) => label.category === category)
                .map((label) => ({ ...label, labelType: "directory" })),
            ...(tree?.labels ?? [])
                .filter((label) => label.category === category)
                .map((label) => ({ ...label, labelType: "file" })),
        ],
    }));
    const removeLabel = async (label, removalKey) => {
        await onCategoryChange(label.labelType, label.path, "");
        setPendingRemoval((current) => current === removalKey ? null : current);
    };

    return (
        <section className="contribution-categories">
            <header className="section-heading">
                <div>
                    <span className="section-kicker">Repository labels</span>
                    <h2>Major contribution categories</h2>
                    <p>Open a category to view its labeled paths. File labels override directory labels; long lists scroll within the category.</p>
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
                    {categoryGroups.map(({ category, labels }) => (
                        <details className="category-card" key={category} name="contribution-category">
                            <summary className="category-card-header">
                                <span className="category-card-title">
                                    <ChevronRight className="category-disclosure-icon" size={17} aria-hidden="true" />
                                    <Tag size={17} aria-hidden="true" />
                                    {category}
                                </span>
                                <span className="status-badge">
                                    {labels.length} {labels.length === 1 ? "path" : "paths"}
                                </span>
                            </summary>

                            {labels.length === 0 ? (
                                <p className="empty-state">No directly labeled paths</p>
                            ) : (
                                <ul className={`category-paths${labels.length > MAX_VISIBLE_LABELS ? " is-scrollable" : ""}`}>
                                    {labels.map((label) => {
                                        const saving = savingPaths.has(label.path);
                                        const removalKey = `${label.labelType}:${label.path}`;
                                        const confirming = pendingRemoval === removalKey;
                                        return (
                                            <li key={removalKey}>
                                                <div className="category-path-copy">
                                                    <code>{label.path}</code>
                                                    <div className="category-path-meta">
                                                        <span className="path-kind">{label.labelType}</span>
                                                        {!label.present && (
                                                            <span className="missing-path">Missing from branch</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="remove-label-actions">
                                                    <button
                                                        className={`remove-label-button${confirming ? " is-confirming" : ""}`}
                                                        type="button"
                                                        disabled={saving}
                                                        aria-label={`${confirming ? "Confirm removal of" : "Remove"} ${category} label from ${label.path}`}
                                                        onClick={() => confirming
                                                            ? removeLabel(label, removalKey)
                                                            : setPendingRemoval(removalKey)}
                                                    >
                                                        <Trash2 size={15} aria-hidden="true" />
                                                        {saving ? "Removing…" : confirming ? "Confirm remove" : "Remove"}
                                                    </button>
                                                    {confirming && (
                                                        <button
                                                            className="cancel-label-button"
                                                            type="button"
                                                            disabled={saving}
                                                            onClick={() => setPendingRemoval(null)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
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
                        </details>
                    ))}
                </div>
            )}
        </section>
    );
}

export default ContributionCategories;
