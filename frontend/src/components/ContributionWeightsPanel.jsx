import { useEffect, useMemo, useState } from "react";
import { categoryLabel, checkWeights } from "../utils/contributionWeights.js";

async function request(path, options) {
    const response = await fetch(path, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
}

const asText = (weights) => Object.fromEntries(Object.entries(weights).map(([category, percent]) => [category, String(percent)]));

// How much each kind of work counts toward a student's contribution score. A course follows the defaults until an
// instructor saves their own, and saving only works once the weights add up to exactly 100%.
function ContributionWeightsPanel({ courseId }) {
    const [state, setState] = useState(null);
    const [values, setValues] = useState({});
    const [loadError, setLoadError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const adopt = (next) => {
        setState(next);
        setValues(asText(next.weights));
    };

    useEffect(() => {
        let cancelled = false;
        setState(null);
        setLoadError(null);
        setResult(null);
        request(`/courses/${courseId}/contribution-weights`)
            .then((next) => !cancelled && adopt(next))
            .catch((err) => !cancelled && setLoadError(err.message));
        return () => {
            cancelled = true;
        };
    }, [courseId]);

    const check = useMemo(
        () => (state ? checkWeights(state.categories, values, state.weights) : null),
        [state, values],
    );

    const save = async () => {
        if (!check?.canSave || busy) return;
        setBusy(true);
        setResult(null);
        try {
            adopt(await request(`/courses/${courseId}/contribution-weights`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ weights: check.parsed }),
            }));
            setResult({ ok: true, text: "Saved. Contribution scores now use these weights." });
        } catch (err) {
            setResult({ ok: false, text: `Could not save: ${err.message}` });
        } finally {
            setBusy(false);
        }
    };

    const reset = async () => {
        if (busy || state?.isDefault) return;
        if (!window.confirm("Reset to the default weights? Your saved weights for this course will be removed.")) return;
        setBusy(true);
        setResult(null);
        try {
            adopt(await request(`/courses/${courseId}/contribution-weights`, { method: "DELETE" }));
            setResult({ ok: true, text: "Reset. Contribution scores now use the default weights." });
        } catch (err) {
            setResult({ ok: false, text: `Could not reset: ${err.message}` });
        } finally {
            setBusy(false);
        }
    };

    const updated = state?.updatedAt ? new Date(state.updatedAt) : null;
    const updatedText = updated && !Number.isNaN(updated.getTime())
        ? updated.toLocaleDateString(undefined, { dateStyle: "medium" })
        : null;

    return (
        <details className="weights-panel">
            <summary>
                <span>Contribution weights</span>
                {state && <span className="status-badge">{state.isDefault ? "Default" : "Custom"}</span>}
            </summary>

            <div className="weights-body">
                <p className="weights-intro">
                    How much each kind of work counts toward a student's contribution score. If nobody on a team
                    worked in a category, it is left out of that team's scores and the rest scale up to 100%.
                </p>

                {loadError && <p className="repo-error" role="alert">Could not load the weights: {loadError}</p>}
                {!state && !loadError && <p className="weights-note" role="status">Loading weights…</p>}

                {state && check && (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            save();
                        }}
                    >
                        <ul className="weights-list">
                            {state.categories.map((category) => {
                                const id = `weight-${courseId}-${category.replace(/\W+/g, "-")}`;
                                const problem = check.problems[category];
                                return (
                                    <li key={category} className="weight-row">
                                        <label htmlFor={id}>{categoryLabel(category)}</label>
                                        <span className="weight-default">default {state.defaults[category]}%</span>
                                        <input
                                            id={id}
                                            className="weight-input"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            value={values[category] ?? ""}
                                            aria-invalid={Boolean(problem)}
                                            aria-describedby={problem ? `${id}-problem` : undefined}
                                            disabled={busy}
                                            onChange={(event) => {
                                                setValues((current) => ({ ...current, [category]: event.target.value }));
                                                setResult(null);
                                            }}
                                        />
                                        <span aria-hidden="true">%</span>
                                        {problem && <span id={`${id}-problem`} className="weight-problem" role="alert">{problem}</span>}
                                    </li>
                                );
                            })}
                        </ul>

                        <p className={`weights-total${check.totalOk ? " is-ok" : " is-off"}`} role="status">
                            <strong>Total {check.total}%</strong> · {check.message}
                        </p>

                        <div className="weights-actions">
                            <button className="repo-button" type="submit" disabled={!check.canSave || busy}>
                                {busy ? "Working…" : "Save weights"}
                            </button>
                            <button className="repo-button" type="button" onClick={reset} disabled={busy || state.isDefault}>
                                Reset to defaults
                            </button>
                            <span className="weights-note">
                                {updatedText ? `Last updated ${updatedText}` : "Using the default weights"}
                            </span>
                        </div>

                        {result && (
                            <p className={result.ok ? "weights-note" : "repo-error"} role={result.ok ? "status" : "alert"}>
                                {result.text}
                            </p>
                        )}
                    </form>
                )}
            </div>
        </details>
    );
}

export default ContributionWeightsPanel;
