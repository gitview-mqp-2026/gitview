const LEVELS = {
    green: { glyph: "✓", word: "on track" },
    yellow: { glyph: "!", word: "below fair share" },
    red: { glyph: "✕", word: "well below fair share" },
    gray: { glyph: "–", word: "not scored" },
};

const GRAY_REASONS = {
    "no-labeled-work": "No labeled work yet. Label files in the project structure to score contributions.",
    "low-coverage": "Too little of this team's work is labeled to score fairly. Label more files in the project structure.",
    "low-data": "This team has too little labeled work so far to judge contributions.",
};

// The text behind a badge: the percent of an equal share, and what the color means.
export function contributionDescription(contribution) {
    if (!contribution) return "";
    const { index, level, reason } = contribution;
    if (level === "gray") return GRAY_REASONS[reason] ?? "Contribution is not scored yet.";
    return `Contribution ${index.toFixed(2)}, ${Math.round(index * 100)}% of an equal share: ${LEVELS[level].word}.`;
}

// Fair-Share Index badge. 1.00 means an equal share of the team's work. The glyph and the tooltip repeat the
// level, so the meaning never depends on color alone.
function ContributionBadge({ contribution }) {
    if (!contribution) return null;
    const level = LEVELS[contribution.level] ? contribution.level : "gray";
    const scored = level !== "gray" && contribution.index !== null;
    const description = contributionDescription(contribution);

    return (
        <span className={`fsi-badge fsi-${level}`} title={description} aria-label={description} role="img">
            <span className="fsi-glyph" aria-hidden="true">{LEVELS[level].glyph}</span>
            <span aria-hidden="true">{scored ? contribution.index.toFixed(2) : "—"}</span>
        </span>
    );
}

export default ContributionBadge;
