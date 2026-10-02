import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, useLocation } from "react-router-dom";
import { getSafeReturnPath } from "../utils/authNavigation.js";
import "../App.css";

function Login() {
    const { error, isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
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

    const startLogin = async (screenHint) => {
        setRequestError("");
        setIsRedirecting(true);

        try {
            await loginWithRedirect({
                appState: { returnTo },
                authorizationParams: screenHint
                    ? { screen_hint: screenHint }
                    : undefined,
            });
        } catch (loginError) {
            setRequestError(
                loginError instanceof Error
                    ? loginError.message
                    : "Unable to start login."
            );
            setIsRedirecting(false);
        }
    };

    const startDevLogin = async () => {
        setRequestError("");
        setIsRedirecting(true);

        try {
            await loginWithRedirect({
                appState: { returnTo },
                authorizationParams: {
                    connection: "GitView-Development-Users",
                },
            });
        } catch (loginError) {
            setRequestError(
                loginError instanceof Error
                    ? loginError.message
                    : "Unable to start developer login."
            );
            setIsRedirecting(false);
        }
    };

    const visibleError = requestError || error?.message;

    return (
        <main className="login-page">
            <section className="login-card" aria-labelledby="login-heading">
                <a
                    className="login-brand"
                    href="/login"
                    aria-label="GitView login"
                >
                    <span className="login-brand-mark" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </span>
                    GitView
                </a>

                <div className="login-card-heading">
                    <h1 id="login-heading">Sign in</h1>
                    <p>Continue to your GitView workspace.</p>
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
                        onClick={() => startLogin()}
                    >
                        {isRedirecting ? (
                            <>
                                <span
                                    className="login-button-spinner"
                                    aria-hidden="true"
                                />
                                Opening login...
                            </>
                        ) : (
                            "Continue with Auth0"
                        )}
                    </button>

                    <button
                        className="login-secondary-button"
                        type="button"
                        disabled={isRedirecting}
                        onClick={() => startLogin("signup")}
                    >
                        Create account
                    </button>
                </div>

                {import.meta.env.DEV && (
                    <button
                        className="login-dev-button"
                        type="button"
                        disabled={isRedirecting}
                        onClick={startDevLogin}
                    >
                        Developer login
                    </button>
                )}
            </section>
        </main>
    );
}

export default Login;
