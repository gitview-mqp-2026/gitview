import { useCallback, useState } from "react";

function TreeNode({
    node,
    categories,
    labelsByPath,
    savingPaths,
    labelErrors,
    expandedPaths,
    activeFilePath,
    onDirectoryToggle,
    onFileToggle,
    onCategoryChange,
}) {
    if (node.kind === "submodule") {
        return (
            <li className="tree-submodule">
                <span aria-hidden="true">◇</span>
                <span>{node.name}</span>
                <small>submodule</small>
            </li>
        );
    }

    if (node.kind === "file") {
        const category = labelsByPath.get(node.path) ?? "";
        const active = activeFilePath === node.path;
        const saving = savingPaths.has(node.path);
        const error = labelErrors.get(node.path);
        const paletteId = `file-category-${encodeURIComponent(node.path)}`;

        return (
            <li className={`tree-file${active ? " is-active" : ""}`}>
                <div className="tree-file-row">
                    <span className="tree-entry-icon" aria-hidden="true">·</span>
                    <button
                        className="tree-file-button"
                        type="button"
                        aria-expanded={active}
                        aria-controls={active ? paletteId : undefined}
                        disabled={saving}
                        onClick={() => onFileToggle(node.path)}
                    >
                        <span className="tree-file-name">{node.name}</span>
                        <span className="sr-only">
                            {category ? `, categorized as ${category}` : ", uncategorized"}
                        </span>
                    </button>
                    {category && <span className="file-category-badge">{category}</span>}
                </div>

                {active && (
                    <div className="tree-file-editor">
                        <div id={paletteId} className="tree-tag-palette" role="group" aria-label={`Category for ${node.path}`}>
                            <button
                                type="button"
                                aria-pressed={!category}
                                disabled={saving}
                                onClick={() => onCategoryChange(node.path, "")}
                            >
                                Unlabeled
                            </button>
                            {categories.map((choice) => (
                                <button
                                    key={choice}
                                    type="button"
                                    aria-pressed={category === choice}
                                    disabled={saving}
                                    onClick={() => onCategoryChange(node.path, choice)}
                                >
                                    {choice}
                                </button>
                            ))}
                        </div>
                        {saving && <span className="tree-save-status" role="status">Saving…</span>}
                        {error && <span className="tree-save-error" role="alert">{error}</span>}
                    </div>
                )}
            </li>
        );
    }

    const expanded = expandedPaths.has(node.path);
    return (
        <li className="tree-directory">
            <details
                open={expanded}
                onToggle={(event) => onDirectoryToggle(node.path, event.currentTarget.open)}
            >
                <summary>{node.name}</summary>
                {expanded && (
                    <ul>
                        {node.children.map((child) => (
                            <TreeNode
                                key={child.path}
                                node={child}
                                categories={categories}
                                labelsByPath={labelsByPath}
                                savingPaths={savingPaths}
                                labelErrors={labelErrors}
                                expandedPaths={expandedPaths}
                                activeFilePath={activeFilePath}
                                onDirectoryToggle={onDirectoryToggle}
                                onFileToggle={onFileToggle}
                                onCategoryChange={onCategoryChange}
                            />
                        ))}
                    </ul>
                )}
            </details>
        </li>
    );
}

function RepositoryTree({ nodes, categories, labelsByPath, savingPaths, labelErrors, onCategoryChange }) {
    const [expandedPaths, setExpandedPaths] = useState(() => new Set());
    const [activeFilePath, setActiveFilePath] = useState(null);

    const handleDirectoryToggle = useCallback((path, expanded) => {
        setExpandedPaths((current) => {
            if (current.has(path) === expanded) return current;
            const next = new Set(current);
            if (expanded) next.add(path);
            else next.delete(path);
            return next;
        });
    }, []);

    const handleFileToggle = useCallback((path) => {
        setActiveFilePath((current) => current === path ? null : path);
    }, []);

    if (nodes.length === 0) return <p>This branch has no tracked files.</p>;

    return (
        <ul className="repository-tree">
            {nodes.map((node) => (
                <TreeNode
                    key={node.path}
                    node={node}
                    categories={categories}
                    labelsByPath={labelsByPath}
                    savingPaths={savingPaths}
                    labelErrors={labelErrors}
                    expandedPaths={expandedPaths}
                    activeFilePath={activeFilePath}
                    onDirectoryToggle={handleDirectoryToggle}
                    onFileToggle={handleFileToggle}
                    onCategoryChange={onCategoryChange}
                />
            ))}
        </ul>
    );
}

export default RepositoryTree;
