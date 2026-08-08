/** Utilities shared by the PDF generators (jsPDF). */

/** Usable height of an A4 sheet before the bottom margin, in mm. */
export const PAGE_LIMIT = 275;

/**
 * Ensures there's space on the page: if `y` passed the limit, opens a new page and returns to the top.
 * Usage: `y = ensureSpace(doc, y);` before writing each line of a list.
 */
export function ensureSpace(doc, y, needed = 6, top = 20) {
  if (y + needed > PAGE_LIMIT) {
    doc.addPage();
    return top;
  }
  return y;
}
