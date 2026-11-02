import FileNode from "./FileNode.jsx";

function FileList({ fileList }) {
    return (
        <ul>
            {fileList.map((directory) => (
                <FileNode key={directory.path} directory={directory} />
            ))}
        </ul>
    );
}

export default FileList;