export type CustomWordingItem = {
  id: string;
  subject: string;
  content: string;
};

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Prefer stored array; fall back to legacy subject/content pair fields. */
export function normalizeCustomWordings(
  items?: CustomWordingItem[] | null,
  legacy?: {
    subject?: string;
    content?: string;
    subject2?: string;
    content2?: string;
  },
): CustomWordingItem[] {
  if (items && items.length > 0) {
    return items.map((item) => ({
      id: item.id || newId(),
      subject: item.subject ?? "",
      content: item.content ?? "",
    }));
  }

  const out: CustomWordingItem[] = [];
  if (legacy?.subject || legacy?.content) {
    out.push({
      id: newId(),
      subject: legacy.subject ?? "",
      content: legacy.content ?? "",
    });
  }
  if (legacy?.subject2 || legacy?.content2) {
    out.push({
      id: newId(),
      subject: legacy.subject2 ?? "",
      content: legacy.content2 ?? "",
    });
  }
  return out;
}

/** First two items map to PDF Subject/Content / Subject2/Content2. */
export function flatCustomWordings(items: CustomWordingItem[]) {
  return {
    customWordingSubject: items[0]?.subject || undefined,
    customWordingContent: items[0]?.content || undefined,
    customWordingSubject2: items[1]?.subject || undefined,
    customWordingContent2: items[1]?.content || undefined,
  };
}

export function createEmptyCustomWording(): CustomWordingItem {
  return { id: newId(), subject: "", content: "" };
}
