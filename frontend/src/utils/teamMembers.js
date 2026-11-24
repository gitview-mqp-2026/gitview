export function withMemberQualifiers(members) {
    const prepared = members.map((member) => ({
        ...member,
        displayName: member.displayName?.trim() || `Student ${member.userID}`,
    }));
    const nameCounts = new Map();

    for (const member of prepared) {
        const key = member.displayName.toLowerCase();
        nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }

    return prepared.map((member) => ({
        ...member,
        qualifier: nameCounts.get(member.displayName.toLowerCase()) > 1
            ? `Member ${member.userID}`
            : null,
    }));
}
