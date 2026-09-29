import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children }) {
    const { error, isAuthenticated, isLoading } = useAuth0();
    const location = useLocation();

    if (isLoading) {
        return (
            <main className="auth-status" aria-live="polite">
                <div className="auth-spinner" aria-hidden="true" />
                <p>Checking your session...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="auth-status auth-status-error" role="alert">
                <h1>We could not verify your session</h1>
                <p>{error.message}</p>
                <a className="auth-secondary-link" href="/login">Return to login</a>
            </main>
        );
    }

    if (!isAuthenticated) {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;

        return <Navigate to="/login" replace state={{ returnTo }} />;
    }

    return children;
}

export default ProtectedRoute;
