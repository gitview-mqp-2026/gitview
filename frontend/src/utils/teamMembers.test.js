import assert from "node:assert/strict";
import test from "node:test";
import { withMemberQualifiers } from "./teamMembers.js";

test("withMemberQualifiers only disambiguates repeated display names", () => {
    assert.deepEqual(withMemberQualifiers([
        { userID: 1, displayName: "KTKyle" },
        { userID: 3, displayName: "Kaylie Quach" },
        { userID: 5, displayName: " Kaylie Quach " },
    ]), [
        { userID: 1, displayName: "KTKyle", qualifier: null },
        { userID: 3, displayName: "Kaylie Quach", qualifier: "Member 3" },
        { userID: 5, displayName: "Kaylie Quach", qualifier: "Member 5" },
    ]);
});

test("withMemberQualifiers supplies the existing student fallback", () => {
    assert.deepEqual(withMemberQualifiers([
        { userID: 7, displayName: "" },
        { userID: 8, displayName: null },
    ]), [
        { userID: 7, displayName: "Student 7", qualifier: null },
        { userID: 8, displayName: "Student 8", qualifier: null },
    ]);
});
