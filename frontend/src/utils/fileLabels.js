export function replaceFileLabel(labels, path, replacement) {
    return [
        ...labels.filter((label) => label.path !== path),
        ...(replacement ? [replacement] : []),
    ];
}
