import { useEffect, useRef } from "react";
import RepositoryTree from "../RepositoryTree.jsx";
import { X } from "lucide-react";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

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
    const panelRef = useRef(null);
    const closeButtonRef = useRef(null);

    useEffect(() => {
        if (isOpen) closeButtonRef.current?.focus();
    }, [isOpen]);

    const keepFocusInside = (event) => {
        if (event.key !== "Tab") return;

        const controls = [...(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
        if (controls.length === 0) return;

        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <>
            <div
                className={`project-structure-scrim${isOpen ? " is-open" : ""}`}
                aria-hidden="true"
                onClick={onClose}
            />
            <aside
                ref={panelRef}
                id="project-structure-panel"
                className={`project-structure-panel${isOpen ? " is-open" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="project-structure-heading"
                aria-hidden={!isOpen}
                aria-busy={treeLoading}
                inert={!isOpen}
                onKeyDown={keepFocusInside}
            >
            <div className="project-structure-panel-header">
                <div>
                    <h2 id="project-structure-heading">Project structure</h2>
                    {tree && (
                        <code title={tree.commitHash}>
                            {tree.branch} @ {tree.commitHash.slice(0, 7)}
                        </code>
                    )}
                </div>
                <button
                    ref={closeButtonRef}
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
