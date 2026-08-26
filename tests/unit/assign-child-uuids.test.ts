import { describe, expect, it } from "vitest";

import {
  assignPolicyDocumentIds,
  assignPolicyNoteIds,
} from "~/lib/db/assign-child-uuids";

describe("assignPolicyDocumentIds", () => {
  it("reuses uuid when document identity matches existing row", () => {
    const existingId = "11111111-1111-4111-8111-111111111111";
    const existing = [
      {
        documentId: existingId,
        templateKey: "schedule-annual",
        libraryDocumentId: null,
        filename: "sched.pdf",
        generationKey: "gen-a",
      },
    ];
    const rows = [
      {
        policyId: "policy-1",
        name: "Schedule",
        filename: "sched-v2.pdf",
        generationKey: "gen-a",
        content: "",
        generatedWhen: new Date(),
        generatedBy: "test",
        templateKey: "schedule-annual",
      },
    ];

    const assigned = assignPolicyDocumentIds(existing, rows);
    expect(assigned[0]?.documentId).toBe(existingId);
  });

  it("assigns fresh uuids for new identities", () => {
    const assigned = assignPolicyDocumentIds(
      [],
      [
        {
          policyId: "policy-1",
          name: "Schedule",
          filename: "sched.pdf",
          generationKey: "gen-a",
          content: "",
          generatedWhen: new Date(),
          generatedBy: "test",
          templateKey: "schedule-annual",
        },
      ],
    );

    expect(assigned[0]?.documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("reuses uuid from generationKey when client sends stale documentId", () => {
    const existingId = "11111111-1111-4111-8111-111111111111";
    const existing = [
      {
        documentId: existingId,
        templateKey: null,
        libraryDocumentId: null,
        filename: "legacy.pdf",
        generationKey: "legacy:43566",
      },
    ];
    const assigned = assignPolicyDocumentIds(existing, [
      {
        documentId: "55056",
        policyId: "policy-1",
        name: "Legacy doc",
        filename: "legacy.pdf",
        generationKey: "legacy:43566",
        content: "",
        generatedWhen: new Date(),
        generatedBy: "test",
      },
    ]);
    expect(assigned[0]?.documentId).toBe(existingId);
  });

  it("does not match by generationKey alone for non-legacy keys", () => {
    const existingId = "11111111-1111-4111-8111-111111111111";
    const existing = [
      {
        documentId: existingId,
        templateKey: "schedule-annual",
        libraryDocumentId: null,
        filename: "sched.pdf",
        generationKey: "gen-shared",
      },
    ];
    const assigned = assignPolicyDocumentIds(existing, [
      {
        policyId: "policy-1",
        name: "Other doc",
        filename: "other.pdf",
        generationKey: "gen-shared",
        content: "",
        generatedWhen: new Date(),
        generatedBy: "test",
        templateKey: "other-template",
      },
    ]);
    expect(assigned[0]?.documentId).not.toBe(existingId);
  });
});

describe("assignPolicyNoteIds", () => {
  it("preserves note uuid when client round-trips it", () => {
    const noteId = "22222222-2222-4222-8222-222222222222";
    const assigned = assignPolicyNoteIds(
      [{ noteId }],
      [
        {
          noteId,
          policyId: "policy-1",
          policyNoteTypeId: 3,
          description: "Broker note",
          createdWhen: new Date(),
          createdBy: "broker@demo.local",
        },
      ],
    );
    expect(assigned[0]?.noteId).toBe(noteId);
  });

  it("assigns uuid for new notes", () => {
    const assigned = assignPolicyNoteIds(
      [],
      [
        {
          policyId: "policy-1",
          policyNoteTypeId: 3,
          description: "New note",
          createdWhen: new Date(),
          createdBy: "broker@demo.local",
        },
      ],
    );
    expect(assigned[0]?.noteId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
