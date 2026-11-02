import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

// /team has no repo id, so send the user to the most recently analyzed repo (or Home if there are none).
function TeamIndex() {
    const [target, setTarget] = useState(null);

    useEffect(() => {
        fetch("/repositories")
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
            .then((repos) => setTarget(repos.length ? `/team/${repos[0].teamID}` : "/"));
    }, []);

    if (target) {
        return <Navigate to={target} replace />;
    }

    return (
        <main className="auth-status" aria-live="polite">
            <p>Loading...</p>
        </main>
    );
}

export default TeamIndex;
