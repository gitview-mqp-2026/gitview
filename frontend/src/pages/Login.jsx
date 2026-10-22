
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, useLocation } from "react-router-dom";
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
        return (
            <main className="auth-status" aria-live="polite">
                <div className="auth-spinner" aria-hidden="true" />
                <p>Checking your session...</p>
            </main>
        );
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
            <section
                className="login-card"
                aria-labelledby="login-heading"
            >
                <a
                    className="login-brand"
                    href="/login"
                    aria-label="GitView login"
                >
                    <span
                        className="login-brand-mark"
                        aria-hidden="true"
                    >
                        <span />
                        <span />
                        <span />
                    </span>
                    GitView
                </a>

                <div className="login-card-heading">
                    <h1 id="login-heading">Sign in</h1>
                    <p>
                        Connect your GitHub account to
                        continue to GitView.
                    </p>
                </div>

                {visibleError && (
                    <div className="login-error" role="alert">
                        {visibleError}
                    </div>
                )}

                <div className="login-actions">
                    <button
                        className="login-primary-button"
                        type="button"
                        disabled={isRedirecting}
                        aria-busy={isRedirecting}
                        onClick={startGithubLogin}
                    >
                        {isRedirecting ? (
                            <>
                                <span
                                    className="login-button-spinner"
                                    aria-hidden="true"
                                />
                                Connecting to GitHub...
                            </>
                        ) : (
                            <>
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.93c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 .1 2.62.76 3.26-.57.1-.73.39-1.23.71-1.51-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.44.11-3 0 0 .95-.3 3.1 1.16a10.7 10.7 0 0 1 5.64 0c2.15-1.46 3.1-1.16 3.1-1.16.61 1.56.23 2.72.11 3 .72.79 1.16 1.8 1.16 3.03 0 4.32-2.63 5.27-5.14 5.55.4.35.75 1.03.75 2.08v3.07c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" />
                                </svg>
                                Login with GitHub
                            </>
                        )}
                    </button>
                </div>
            </section>
        </main>
    );
}

export default Login;
