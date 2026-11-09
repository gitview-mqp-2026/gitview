import { useCallback, useState } from "react";
import { inheritedDirectoryCategory } from "../utils/fileLabels.js";

function CategoryEditor({ paletteId, path, categories, directCategory, inheritedCategory, saving, error, onCategoryChange }) {
    return (
        <div className="tree-file-editor">
            <div id={paletteId} className="tree-tag-palette" role="group" aria-label={`Category for ${path}`}>
                <button
                    type="button"
                    aria-pressed={!directCategory}
                    disabled={saving}
                    onClick={() => onCategoryChange("")}
                >
                    {inheritedCategory ? "Use inherited" : "Unlabeled"}
                </button>
                {categories.map((choice) => (
                    <button
                        key={choice}
                        type="button"
                        aria-pressed={directCategory === choice}
                        disabled={saving}
                        onClick={() => onCategoryChange(choice)}
                    >
                        {choice}
                    </button>
                ))}
            </div>
            {saving && <span className="tree-save-status" role="status">Saving…</span>}
            {error && <span className="tree-save-error" role="alert">{error}</span>}
        </div>
    );
}

function TreeNode({
    node,
    categories,
    fileLabelsByPath,
    directoryLabelsByPath,
    savingPaths,
    labelErrors,
    expandedPaths,
    activePath,
    onDirectoryToggle,
    onEntryToggle,
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
        const directCategory = fileLabelsByPath.get(node.path) ?? "";
        const inheritedCategory = inheritedDirectoryCategory(directoryLabelsByPath, node.path);
        const category = directCategory || inheritedCategory;
        const active = activePath === node.path;
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
                        onClick={() => onEntryToggle(node.path)}
                    >
                        <span className="tree-file-name">{node.name}</span>
                        <span className="sr-only">
                            {category ? `, categorized as ${category}` : ", uncategorized"}
                        </span>
                    </button>
                    {category && <span className="file-category-badge">{category}</span>}
                </div>

                {active && (
                    <CategoryEditor
                        paletteId={paletteId}
                        path={node.path}
                        categories={categories}
                        directCategory={directCategory}
                        inheritedCategory={inheritedCategory}
                        saving={saving}
                        error={error}
                        onCategoryChange={(choice) => onCategoryChange("file", node.path, choice)}
                    />
                )}
            </li>
        );
    }

    const directCategory = directoryLabelsByPath.get(node.path) ?? "";
    const inheritedCategory = inheritedDirectoryCategory(directoryLabelsByPath, node.path);
    const category = directCategory || inheritedCategory;
    const expanded = expandedPaths.has(node.path);
    const active = activePath === node.path;
    const saving = savingPaths.has(node.path);
    const error = labelErrors.get(node.path);
    const paletteId = `directory-category-${encodeURIComponent(node.path)}`;

    return (
        <li className="tree-directory">
            <details
                open={expanded}
                onToggle={(event) => onDirectoryToggle(node.path, event.currentTarget.open)}
            >
                <summary>
                    <span>{node.name}</span>
                    {category && <span className="file-category-badge">{category}</span>}
                    <span className="sr-only">
                        {category ? `, categorized as ${category}` : ", uncategorized"}
                    </span>
                </summary>
                <div className="tree-directory-toolbar">
                    <button
                        type="button"
                        aria-expanded={active}
                        aria-controls={active ? paletteId : undefined}
                        disabled={saving}
                        onClick={() => onEntryToggle(node.path)}
                    >
                        Tag directory
                    </button>
                </div>
                {active && (
                    <CategoryEditor
                        paletteId={paletteId}
                        path={node.path}
                        categories={categories}
                        directCategory={directCategory}
                        inheritedCategory={inheritedCategory}
                        saving={saving}
                        error={error}
                        onCategoryChange={(choice) => onCategoryChange("directory", node.path, choice)}
                    />
                )}
                {expanded && (
                    <ul>
                        {node.children.map((child) => (
                            <TreeNode
                                key={child.path}
                                node={child}
                                categories={categories}
                                fileLabelsByPath={fileLabelsByPath}
                                directoryLabelsByPath={directoryLabelsByPath}
                                savingPaths={savingPaths}
                                labelErrors={labelErrors}
                                expandedPaths={expandedPaths}
                                activePath={activePath}
                                onDirectoryToggle={onDirectoryToggle}
                                onEntryToggle={onEntryToggle}
                                onCategoryChange={onCategoryChange}
                            />
                        ))}
                    </ul>
                )}
            </details>
        </li>
    );
}

function RepositoryTree({
    nodes,
    categories,
    fileLabelsByPath,
    directoryLabelsByPath,
    savingPaths,
    labelErrors,
    onCategoryChange,
}) {
    const [expandedPaths, setExpandedPaths] = useState(() => new Set());
    const [activePath, setActivePath] = useState(null);

    const handleDirectoryToggle = useCallback((path, expanded) => {
        setExpandedPaths((current) => {
            if (current.has(path) === expanded) return current;
            const next = new Set(current);
            if (expanded) next.add(path);
            else next.delete(path);
            return next;
        });
    }, []);

    const handleEntryToggle = useCallback((path) => {
        setActivePath((current) => current === path ? null : path);
    }, []);

    if (nodes.length === 0) return <p>This branch has no tracked files.</p>;

    return (
        <ul className="repository-tree">
            {nodes.map((node) => (
                <TreeNode
                    key={node.path}
                    node={node}
                    categories={categories}
                    fileLabelsByPath={fileLabelsByPath}
                    directoryLabelsByPath={directoryLabelsByPath}
                    savingPaths={savingPaths}
                    labelErrors={labelErrors}
                    expandedPaths={expandedPaths}
                    activePath={activePath}
                    onDirectoryToggle={handleDirectoryToggle}
                    onEntryToggle={handleEntryToggle}
                    onCategoryChange={onCategoryChange}
                />
            ))}
        </ul>
    );
}

export default RepositoryTree;
