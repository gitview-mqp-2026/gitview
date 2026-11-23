import { AuthErrorStatus } from "./AuthStatus.jsx";

function AuthConfigurationError() {
    return (
        <AuthErrorStatus title="Auth0 is not configured">
            <p>
                Add <code>VITE_AUTH0_DOMAIN</code> and <code>VITE_AUTH0_CLIENT_ID</code> to
                the backend environment, then restart the development server.
            </p>
        </AuthErrorStatus>
    );
}

export default AuthConfigurationError;
