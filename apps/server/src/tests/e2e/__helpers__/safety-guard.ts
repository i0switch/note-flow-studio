/**
 * SafetyGuard — accidental real-post detection.
 *
 * Mock mode:  draftUrl MUST contain "/mock/"
 * Live mode:  draftUrl MUST contain "note.com" but NOT "/mock/"
 *             title MUST contain "__E2E__"
 *
 * Throws SAFETY_ABORT on any violation.
 */
export class SafetyGuard {
  constructor(private readonly mode: "mock" | "live") {}

  /** Call immediately after each API response. */
  check(draftUrl: string | undefined | null, title?: string): void {
    if (!draftUrl) {
      // No URL = no post happened — safe to pass through
      return;
    }

    if (this.mode === "mock") {
      if (!draftUrl.includes("/mock/")) {
        throw new Error(
          `SAFETY_ABORT: mock test received a real URL: ${draftUrl}. ` +
            "Ensure ENABLE_REAL_NOTE_AUTOMATION=false before running mock tests."
        );
      }
      return;
    }

    // live mode
    if (draftUrl.includes("/mock/")) {
      throw new Error(
        `SAFETY_ABORT: live test received a mock URL: ${draftUrl}. ` +
          "Ensure ENABLE_REAL_NOTE_AUTOMATION=true for live tests."
      );
    }

    if (!draftUrl.includes("note.com") && !draftUrl.includes("editor.note.com")) {
      throw new Error(
        `SAFETY_ABORT: live test received unexpected URL: ${draftUrl}.`
      );
    }

    if (title !== undefined && !title.includes("__E2E__")) {
      throw new Error(
        `SAFETY_ABORT: posted article title does not contain __E2E__: "${title}". ` +
          "This may be an accidental post of real content."
      );
    }
  }
}
