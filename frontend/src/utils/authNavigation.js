export function getSafeReturnPath(path) {
    const isLocalPath = (
        typeof path === "string"
        && path.startsWith("/")
        && !path.startsWith("//")
        && !path.includes("\\")
    );

    return isLocalPath ? path : "/";
}
