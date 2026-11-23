import RepositoryTree from "../RepositoryTree.jsx";
import { X } from "lucide-react";

function ProjectStructurePanel({
    directoryLabelsByPath,
    fileLabelsByPath,
    isOpen,
    labelErrors,
    onCategoryChange,
    onClose,
    savingPaths,
    tree,
    treeError,
    treeLoading,
}) {
    return (
        <>
            <div
                className={`project-structure-scrim${isOpen ? " is-open" : ""}`}
                aria-hidden="true"
                onClick={onClose}
            />
            <aside
                id="project-structure-panel"
                className={`project-structure-panel${isOpen ? " is-open" : ""}`}
                aria-label="Project structure"
                aria-hidden={!isOpen}
                aria-busy={treeLoading}
                inert={!isOpen}
            >
            <div className="project-structure-panel-header">
                <div>
                    <h2>Project structure</h2>
                    {tree && (
                        <code title={tree.commitHash}>
                            {tree.branch} @ {tree.commitHash.slice(0, 7)}
                        </code>
                    )}
                </div>
                <button
                    className="project-structure-panel-close"
                    type="button"
                    aria-label="Close project structure"
                    onClick={onClose}
                >
                    <X size={18} aria-hidden="true" />
                </button>
            </div>

            <div className="tree-container">
                {treeLoading && <p>Loading project structure…</p>}
                {treeError && (
                    <p className="repo-error" role="alert">
                        Could not load project structure: {treeError}
                    </p>
                )}
                {tree && (
                    <RepositoryTree
                        key={tree.commitHash}
                        nodes={tree.nodes}
                        categories={tree.categories}
                        fileLabelsByPath={fileLabelsByPath}
                        directoryLabelsByPath={directoryLabelsByPath}
                        savingPaths={savingPaths}
                        labelErrors={labelErrors}
                        onCategoryChange={onCategoryChange}
                    />
                )}
            </div>
            </aside>
        </>
    );
}

export default ProjectStructurePanel;
