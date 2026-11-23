
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, useLocation } from "react-router-dom";
import AsciiStreamBackground from "../components/AsciiStreamBackground.jsx";
import { AuthLoadingStatus } from "../components/auth/AuthStatus.jsx";
import LoginCard from "../components/auth/LoginCard.jsx";
import { getSafeReturnPath } from "../utils/authNavigation.js";
import "../App.css";

function Login() {
    const {
        error,
        isAuthenticated,
        isLoading,
        loginWithRedirect,
    } = useAuth0();

    const location = useLocation();
    const [requestError, setRequestError] = useState("");
    const [isRedirecting, setIsRedirecting] = useState(false);

    const returnTo = getSafeReturnPath(location.state?.returnTo);

    if (isLoading) {
        return <AuthLoadingStatus />;
    }

    if (isAuthenticated) {
        return <Navigate to={returnTo} replace />;
    }

    const startGithubLogin = async () => {
        setRequestError("");
        setIsRedirecting(true);

        try {
            await loginWithRedirect({
                appState: { returnTo },
                authorizationParams: {
                    connection: "github",
                },
            });
        } catch (loginError) {
            setRequestError(
                loginError instanceof Error
                    ? loginError.message
                    : "Unable to start GitHub login."
            );
            setIsRedirecting(false);
        }
    };

    const visibleError = requestError || error?.message;

    return (
        <main className="login-page">
            <AsciiStreamBackground />
            <LoginCard
                error={visibleError}
                isRedirecting={isRedirecting}
                onLogin={startGithubLogin}
            />
        </main>
    );
}

export default Login;
