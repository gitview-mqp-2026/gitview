import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthErrorStatus, AuthLoadingStatus } from "./AuthStatus.jsx";

function ProtectedRoute({ children }) {
    const { error, isAuthenticated, isLoading } = useAuth0();
    const location = useLocation();

    if (isLoading) {
        return <AuthLoadingStatus />;
    }

    if (error) {
        return (
            <AuthErrorStatus title="We could not verify your session">
                <p>{error.message}</p>
                <a className="auth-secondary-link" href="/login">Return to login</a>
            </AuthErrorStatus>
        );
    }

    if (!isAuthenticated) {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;

        return <Navigate to="/login" replace state={{ returnTo }} />;
    }

    return children;
}

export default ProtectedRoute;
