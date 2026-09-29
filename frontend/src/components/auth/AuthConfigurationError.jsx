function AuthConfigurationError() {
    return (
        <main className="auth-status auth-status-error" role="alert">
            <h1>Auth0 is not configured</h1>
            <p>
                Add <code>VITE_AUTH0_DOMAIN</code> and <code>VITE_AUTH0_CLIENT_ID</code> to
                the backend environment, then restart the development server.
            </p>
        </main>
    );
}

export default AuthConfigurationError;
