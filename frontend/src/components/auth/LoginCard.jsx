import { CircleAlert, ShieldCheck } from "lucide-react";

function LoginCard({ error, isRedirecting, onLogin }) {
    return (
        <section className="login-card" aria-labelledby="login-heading">
            <div className="login-brand" aria-label="GitView">
                <span className="login-brand-mark" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </span>
                GitView
            </div>

            <div className="login-card-heading">
                <p className="login-card-eyebrow">Repository intelligence</p>
                <h1 id="login-heading">Sign in to GitView</h1>
                <p>Access your courses, teams, and repository insights with your GitHub account.</p>
            </div>

            {error && (
                <div className="login-error" role="alert">
                    <CircleAlert size={18} aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            <div className="login-actions">
                <button
                    className="login-primary-button"
                    type="button"
                    disabled={isRedirecting}
                    aria-busy={isRedirecting}
                    aria-describedby="login-security-note"
                    onClick={onLogin}
                >
                    {isRedirecting ? (
                        <>
                            <span className="login-button-spinner" aria-hidden="true" />
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
                            Continue with GitHub
                        </>
                    )}
                </button>
            </div>

            <p className="login-security-note" id="login-security-note">
                <ShieldCheck size={16} aria-hidden="true" />
                You’ll continue to GitHub to sign in.
            </p>
        </section>
    );
}

export default LoginCard;
