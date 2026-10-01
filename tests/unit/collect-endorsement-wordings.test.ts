import { describe, expect, it } from "vitest";

import type { CarWording } from "~/lib/db/types";
import {
  collectCatalogueEndorsementWordings,
  collectCustomEndorsementWordings,
  collectEndorsementWordings,
} from "~/lib/pdf/merge-field-tables";

const catalogue: CarWording[] = [
  {
    carWordingId: 1,
    subject: "<p><strong>First</strong></p>",
    content: "<p>One</p>",
    sortOrder: 1,
  },
  {
    carWordingId: 2,
    subject: "<p><strong>Second</strong></p>",
    content: "<p>Two</p>",
    sortOrder: 2,
  },
  {
    carWordingId: 3,
    subject: "<p><strong>Third</strong></p>",
    content: "<p>Three</p>",
    sortOrder: 3,
  },
];

describe("collectEndorsementWordings", () => {
  it("orders catalogue rows by selectedWordingIds, then appends custom", () => {
    const rows = collectEndorsementWordings(
      {
        selectedWordingIds: [3, 1],
        customWordings: [
          {
            id: "c1",
            subject: "<p><strong>Custom title</strong></p>",
            content: "<p>Custom body</p>",
          },
        ],
      },
      catalogue,
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]?.subject).toContain("Third");
    expect(rows[1]?.subject).toContain("First");
    expect(rows[2]?.subject).toContain("Custom title");
    expect(rows[2]?.content).toContain("Custom body");
  });

  it("collectCustomEndorsementWordings returns only wizard custom blocks", () => {
    const custom = collectCustomEndorsementWordings({
      selectedWordingIds: [1],
      customWordings: [
        {
          id: "c1",
          subject: "<p><strong>Only custom</strong></p>",
          content: "<p>Body</p>",
        },
      ],
    });
    expect(custom).toHaveLength(1);
    expect(
      collectCatalogueEndorsementWordings(
        { selectedWordingIds: [1] },
        catalogue,
      ),
    ).toHaveLength(1);
  });
});
