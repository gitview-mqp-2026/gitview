export function replaceFileLabel(labels, path, replacement) {
    return [
        ...labels.filter((label) => label.path !== path),
        ...(replacement ? [replacement] : []),
    ];
}

export function inheritedDirectoryCategory(labelsByPath, path) {
    let parentEnd = path.lastIndexOf("/");
    while (parentEnd !== -1) {
        const category = labelsByPath.get(path.slice(0, parentEnd));
        if (category) return category;
        parentEnd = path.lastIndexOf("/", parentEnd - 1);
    }
    return "";
}
