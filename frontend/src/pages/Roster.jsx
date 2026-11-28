import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import "../App.css";

function Roster() {
    const { courseId } = useParams();
    const [course, setCourse] = useState(null);
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // edit popup
    const [popup, setPopup] = useState(null); // team being edited
    const [drafts, setDrafts] = useState({}); // editable fields per student
    const [merges, setMerges] = useState({}); // pending merges
    const [removals, setRemovals] = useState({}); // pending removals (by userID)
    const [popupError, setPopupError] = useState(null);
    const [saving, setSaving] = useState(false);

    // csv export/import
    const [importing, setImporting] = useState(false);
    const [csvMessage, setCsvMessage] = useState(null);
    const fileInput = useRef(null);

    const loadRoster = useCallback(async () => {
        try {
            const [courseResponse, rosterResponse] = await Promise.all([
                fetch(`/courses`),
                fetch(`/courses/${courseId}/roster`)
            ]);

            if (!courseResponse.ok || !rosterResponse.ok) {
                throw new Error("Failed to load course roster.");
            }

            const courses = await courseResponse.json();
            const roster = await rosterResponse.json();

            setCourse(courses.find((c) => String(c.courseID) === courseId) ?? null);
            setRoster(roster);
            setError(null);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    useEffect(() => {
        loadRoster();
    }, [loadRoster]);

    function openTeamEditor(teamID, teamName, students) {
        const initial = {};

        for (const s of students) {
            initial[s.userID] = { name: s.name ?? "", username: s.username ?? "", email: s.email ?? "" };
        }
        
        setDrafts(initial);
        setMerges({});
        setRemovals({});
        setPopupError(null);
        setPopup({ teamID, teamName, students });
    }

    function closePopup() {
        if (!saving) setPopup(null);
    }

    function setField(userID, field, value) {
        setDrafts((drafts) => ({ ...drafts, [userID]: { ...drafts[userID], [field]: value } }));
    }

    // userID is the student being merged away, keepID is the student being kept (or null to cancel the merge)
    function setMerge(userID, keepID) {
        setMerges((merges) => {
            const next = { ...merges };
            if (keepID) {
                next[userID] = Number(keepID);
            } else {
                delete next[userID];
            }
            return next;
        });
    }

    // marks a student to be removed on save (or undoes it)
    function toggleRemoval(userID) {
        setRemovals((removals) => {
            const next = { ...removals };
            if (next[userID]) {
                delete next[userID];
            } else {
                next[userID] = true;
            }
            return next;
        });
        setMerge(userID, null); // a removed student can't be merged
    }

    async function send(url, method, body) {
        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Something went wrong.");
        }
    }

    async function save(event) {
        event.preventDefault();

        const removeIDs = Object.keys(removals);
        if (removeIDs.length > 0) {
            const count = removeIDs.length;
            const ok = window.confirm(
                `Permanently remove ${count} ${count === 1 ? "student" : "students"} and all of their commits, alerts and feedback? This can't be undone.`
            );
            if (!ok) return;
        }

        setSaving(true);
        setPopupError(null);

        try {
            // edits first (skipping students that are about to be merged away or removed), then merges, then removals.
            for (const s of popup.students) {
                if (merges[s.userID] || removals[s.userID]) continue;

                const d = drafts[s.userID];
                const changed = d.name !== (s.name ?? "") || d.username !== (s.username ?? "") || d.email !== (s.email ?? "");

                if (changed) {
                    await send(`/courses/${courseId}/roster/${s.userID}`, "PATCH", d);
                }
            }

            for (const [mergeUserID, keepUserID] of Object.entries(merges)) {
                await send(`/courses/${courseId}/roster/merge`, "POST", {
                    keepUserID,
                    mergeUserID: Number(mergeUserID)
                });
            }

            for (const removeUserID of removeIDs) {
                await send(`/courses/${courseId}/roster/${removeUserID}`, "DELETE");
            }

            setPopup(null);
            await loadRoster();
        } catch (err) {
            setPopupError(err.message);
            await loadRoster();
        } finally {
            setSaving(false);
        }
    }

    async function exportCsv() {
        setCsvMessage(null);

        try {
            const response = await fetch(`/courses/${courseId}/roster/export`);
            if (!response.ok) {
                throw new Error("Failed to export the roster.");
            }

            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a"); // temporary link for the download
            link.href = url;
            link.download = `${course?.name ?? "course"}-roster.csv`; // default filename
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setCsvMessage({ error: true, text: err.message });
        }
    }

    async function importCsv(event) {
        const file = event.target.files[0];
        event.target.value = ""; // allows picking the same file again
        if (!file) return;

        setImporting(true);
        setCsvMessage(null);

        try {
            const response = await fetch(`/courses/${courseId}/roster/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ csv: await file.text() })
            });
            
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Failed to import the roster.");

            setCsvMessage({
                error: false,
                text: `Imported: ${data.updated} updated, ${data.added} added, ${data.unchanged} unchanged.`
            });
            await loadRoster();
        } catch (err) {
            setCsvMessage({ error: true, text: err.message });
        } finally {
            setImporting(false);
        }
    }

    // group students by teamID
    const groupedRoster = roster.reduce((teams, student) => {
        const teamID = student.teamID || "unassigned";

        if (!teams[teamID]) {
            teams[teamID] = [];
        }

        teams[teamID].push(student);
        return teams;
    }, {});

    // sort teams by teamID, with unassigned students at the end
    const sortedTeams = Object.entries(groupedRoster).sort(([a], [b]) => {
        if (a === "unassigned") return 1;
        if (b === "unassigned") return -1;

        return a.localeCompare(b);
    });

    const label = (student) => student.name || student.username || student.email || `Student ${student.userID}`;
    const mergeTargets = new Set(Object.values(merges));

    return (
        <div>
            <NavBar />
                <Link to={`/course/${courseId}`} className="back-link">
                    ← Back to Course Dashboard
                </Link>
            <div className="roster-page">
                <div className="roster-header">
                    <div className="roster-header-info">
                        <h1>{course?.name} Roster</h1>
                        {course && (
                            <p>{course.courseName} · {course.courseTerm}</p>
                        )}

                        <span className="roster-count">
                            {roster.length} {roster.length === 1 ? "student" : "students"}
                        </span>
                    </div>

                    <div className="roster-csv">
                        <div className="roster-csv-actions">
                            <button type="button" className="repo-button" onClick={exportCsv} disabled={loading || !!error}>
                                Export CSV
                            </button>
                            <button
                                type="button"
                                className="repo-button"
                                onClick={() => fileInput.current.click()}
                                disabled={loading || !!error || importing}
                            >
                                {importing ? "Importing…" : "Import CSV"}
                            </button>
                            <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={importCsv} />
                        </div>
                        {csvMessage && (
                            <p className={csvMessage.error ? "repo-error" : "roster-csv-success"} role="alert">
                                {csvMessage.text}
                            </p>
                        )}
                    </div>
                </div>

                {loading && <p>Loading roster...</p>}
                {error && <p className="repo-error" role="alert">{error}</p>}

                {!loading && !error && (
                    <div className="roster-teams">
                        {sortedTeams.map(([teamID, students]) => {
                            const teamName =
                                teamID === "unassigned" ? "Unassigned Students" : students[0].teamName || `Team ${teamID}`;
                            return (
                                <section key={teamID} className="roster-team">
                                    <div className="roster-team-header">
                                        <h2>{teamName}</h2>
                                        <button
                                            type="button"
                                            className="repo-button"
                                            onClick={() => openTeamEditor(teamID, teamName, students)}
                                        >
                                            Edit
                                        </button>
                                    </div>

                                    <table className="roster-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>GitHub Username</th>
                                                <th>Role</th>
                                                <th>Last Login</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student) => (
                                                <tr key={student.userID}>
                                                    <td>{student.name || "Unknown"}</td>
                                                    <td>{student.username || "Unknown"}</td>
                                                    <td>{student.role}</td>
                                                    <td></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>

            {popup && (
                <div className="roster-popup-backdrop" onClick={closePopup}>
                    <form className="roster-popup roster-popup-wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
                        <h2>Edit {popup.teamName}</h2>
                        <p> Change student information, merge one student profile into another, or remove a student.</p>

                        <div className="roster-popup-list">
                            <table className="roster-edit-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>GitHub Username</th>
                                        <th>Email</th>
                                        <th>Merge Into</th>
                                        <th>Remove</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {popup.students.map((s) => {
                                        const mergedInto = merges[s.userID];
                                        const removed = !!removals[s.userID];
                                        const d = drafts[s.userID];
                                        return (
                                            <tr key={s.userID} className={mergedInto || removed ? "is-merged" : undefined}>
                                                <td>
                                                    <input
                                                        value={d.name}
                                                        disabled={!!mergedInto || removed}
                                                        onChange={(e) => setField(s.userID, "name", e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        value={d.username}
                                                        disabled={!!mergedInto || removed}
                                                        onChange={(e) => setField(s.userID, "username", e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="email"
                                                        required
                                                        value={d.email}
                                                        disabled={!!mergedInto || removed}
                                                        onChange={(e) => setField(s.userID, "email", e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <select
                                                        value={mergedInto ?? ""}
                                                        disabled={mergeTargets.has(s.userID) || removed}
                                                        onChange={(e) => setMerge(s.userID, e.target.value)}
                                                    >
                                                        <option value="">Don't merge</option>
                                                        {popup.students
                                                            .filter((o) => o.userID !== s.userID && !merges[o.userID] && !removals[o.userID])
                                                            .map((o) => (
                                                                <option key={o.userID} value={o.userID}>{label(o)}</option>
                                                            ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="roster-remove-button"
                                                        disabled={mergeTargets.has(s.userID)}
                                                        title={mergeTargets.has(s.userID) ? "Another student is being merged into this one" : undefined}
                                                        onClick={() => toggleRemoval(s.userID)}
                                                    >
                                                        {removed ? "Undo" : "Remove"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {Object.keys(merges).length > 0 && (
                                <p className="roster-merge-note">On save, merged students are removed and their commits move to the student they are merged into.</p>
                            )}
                            {Object.keys(removals).length > 0 && (
                                <p className="roster-merge-note">On save, removed students are permanently deleted along with their commits, alerts and feedback. If their commits are still in the repository, the next sync may add them back.</p>
                            )}
                        </div>

                        {popupError && <p className="repo-error" role="alert">{popupError}</p>}
                        <div className="roster-popup-actions">
                            <button type="button" className="repo-button" onClick={closePopup} disabled={saving}>Cancel</button>
                            <button type="submit" className="repo-button" disabled={saving}>
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default Roster;
