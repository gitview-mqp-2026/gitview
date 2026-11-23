// Whole-number percentages typed into the weights panel. Values stay strings while typing, so an emptied box or a
// half-typed number is a problem to describe, not something to crash on.

// "25" is a percent; "", "5.5", "-3", "1e2", " " and "101" are not.
export function parsePercent(text) {
    const trimmed = String(text ?? "").trim();
    if (!/^\d{1,3}$/.test(trimmed)) return null;
    const value = Number(trimmed);
    return value <= 100 ? value : null;
}

// `values` maps each category to the text in its box. `saved` (optional) maps each category to the last saved
// percent, so the panel can tell whether anything has actually changed.
export function checkWeights(categories, values, saved = null) {
    const parsed = {};
    const problems = {};
    let total = 0;
    for (const category of categories) {
        const percent = parsePercent(values[category]);
        parsed[category] = percent;
        if (percent === null) problems[category] = "Enter a whole number from 0 to 100.";
        else total += percent;
    }

    const allValid = Object.keys(problems).length === 0;
    const changed = saved === null || categories.some((category) => parsed[category] !== saved[category]);
    let message;
    if (!allValid) message = "Fix the highlighted weights.";
    else if (total === 100) message = "Adds up to 100%.";
    else if (total < 100) message = `Adds up to ${total}%. Add ${100 - total}% more to reach 100%.`;
    else message = `Adds up to ${total}%. Remove ${total - 100}% to reach 100%.`;

    return {
        parsed,
        problems,
        total,
        totalOk: allValid && total === 100,
        message,
        canSave: allValid && total === 100 && changed,
        changed,
    };
}

// Categories are named for the server; this is how they read on screen.
const DISPLAY_NAMES = { "App-setup": "App Setup" };
export const categoryLabel = (category) => DISPLAY_NAMES[category] ?? category;
