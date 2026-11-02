import { FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';
import FileList from "./FileList.jsx";
import { useState } from "react";

function FileNode({ directory }) {
    const [isOpen, setIsOpen] = useState(true);

    if (directory.subfolders) {
        return (
            <li>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    type="button"
                    className="file-node-button"
                >
                    {isOpen ? (
                        <FolderOpenIcon className="size-4 text-amber-500" /> 
                    ) : (
                        <FolderIcon className="size-4 text-amber-500" />
                    )}

                    <span>{directory.name}</span>
                </button>

                {isOpen && (
                    <div className="ml-6 border-l border-gray-700 relative pl-3">
                        <FileList fileList={directory.subfolders} />
                    </div>
                )}
            </li>
        );
    }

    return (
        <li>
            <div className="flex items-center gap-3 px-3 py-2 rounded">
                <FileIcon className="size-4 text-sky-300" />
                <span>{directory.name}</span>
            </div>
        </li>
    );
}

export default FileNode;