export function AuthLoadingStatus() {
    return (
        <main className="auth-status" aria-live="polite">
            <div className="auth-spinner" aria-hidden="true" />
            <p>Checking your session...</p>
        </main>
    );
}

export function AuthErrorStatus({ title, children }) {
    return (
        <main className="auth-status auth-status-error" role="alert">
            <h1>{title}</h1>
            {children}
        </main>
    );
}
