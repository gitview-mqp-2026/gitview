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
            <section className="login-intro" aria-labelledby="login-heading">
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

                <div className="login-copy">
                    <p className="login-eyebrow">
                        Repository intelligence for instructors
                    </p>

                    <h1 id="login-heading">
                        See the work behind every commit.
                    </h1>

                    <p>
                        Turn repository activity into a clear view of team
                        momentum, contributions, and the moments that need your
                        attention.
                    </p>
                </div>

                <div
                    className="login-proof"
                    aria-label="GitView capabilities"
                >
                    <span>Contribution insights</span>
                    <span>Team-level signals</span>
                    <span>Secure access</span>
                </div>
            </section>

            <section className="login-panel" aria-label="Account access">
                <div className="login-card">
                    <div className="login-card-heading">
                        <p className="login-eyebrow">Welcome back</p>

                        <h2>Log in to GitView</h2>

                        <p>
                            Continue through Auth0 to securely access your
                            workspace.
                        </p>
                    </div>

                    {visibleError && (
                        <div className="login-error" role="alert">
                            {visibleError}
                        </div>
                    )}

                    <button
                        className="login-primary-button"
                        type="button"
                        disabled={isRedirecting}
                        onClick={() => startLogin()}
                    >
                        {isRedirecting
                            ? "Opening secure login..."
                            : "Continue to login"}

                        <span aria-hidden="true">→</span>
                    </button>

                    <div className="login-divider">
                        <span>New to GitView?</span>
                    </div>

                    <button
                        className="login-secondary-button"
                        type="button"
                        disabled={isRedirecting}
                        onClick={() => startLogin("signup")}
                    >
                        Create an account
                    </button>

                    {import.meta.env.DEV && (
                        <>
                            <div className="login-divider">
                                <span>Development</span>
                            </div>

                            <button
                                className="login-secondary-button"
                                type="button"
                                disabled={isRedirecting}
                                onClick={startDevLogin}
                            >
                                Developer Login
                            </button>
                        </>
                    )}

                    <p className="login-security-note">
                        Authentication is handled by Auth0. GitView never
                        receives your password.
                    </p>
                </div>
            </section>
        </main>
    );
}

export default Login;