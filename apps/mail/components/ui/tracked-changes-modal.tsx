"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiffBlock {
  id: string;
  type: 'unchanged' | 'changed' | 'added' | 'removed';
  original?: string;
  replacement?: string;
}

export type Decision = 'pending' | 'accepted' | 'declined';

// ─── HTML utilities ───────────────────────────────────────────────────────────

/** Extract plain text from an HTML string for comparison purposes. */
export function getTextContent(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract inner HTML content from a block element (<p> or <div>). */
function getBlockInnerHtml(blockHtml: string): string {
  const match = blockHtml.match(/^<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>$/i);
  return match ? match[1] : blockHtml;
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

function splitIntoBlocks(html: string): string[] {
  const blocks: string[] = [];
  const regex = /<(div|p)([^>]*)>([\s\S]*?)<\/(div|p)>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    blocks.push(match[0]);
  }
  return blocks.length > 0 ? blocks : html.trim() ? [html.trim()] : [];
}

export function computeDiff(originalHtml: string, editedHtml: string): DiffBlock[] {
  const origBlocks = splitIntoBlocks(originalHtml);
  const editBlocks = splitIntoBlocks(editedHtml);

  const m = origBlocks.length;
  const n = editBlocks.length;

  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (getTextContent(origBlocks[i - 1]) === getTextContent(editBlocks[j - 1])) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  const ops: Array<{ op: 'keep' | 'del' | 'ins'; val: string }> = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && getTextContent(origBlocks[i - 1]) === getTextContent(editBlocks[j - 1])) {
      ops.unshift({ op: 'keep', val: origBlocks[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      ops.unshift({ op: 'ins', val: editBlocks[j - 1] });
      j--;
    } else {
      ops.unshift({ op: 'del', val: origBlocks[i - 1] });
      i--;
    }
  }

  const result: DiffBlock[] = [];
  let editCount = 0;
  let k = 0;
  while (k < ops.length) {
    if (ops[k].op === 'keep') {
      result.push({ id: `u-${k}`, type: 'unchanged', original: ops[k].val });
      k++;
    } else if (ops[k].op === 'del') {
      if (k + 1 < ops.length && ops[k + 1].op === 'ins') {
        result.push({ id: `e-${editCount++}`, type: 'changed', original: ops[k].val, replacement: ops[k + 1].val });
        k += 2;
      } else {
        result.push({ id: `e-${editCount++}`, type: 'removed', original: ops[k].val });
        k++;
      }
    } else {
      result.push({ id: `e-${editCount++}`, type: 'added', replacement: ops[k].val });
      k++;
    }
  }
  return result;
}

/** Build the final clean HTML from diff decisions (no tracked-change markup). */
export function buildFinalHtml(blocks: DiffBlock[], decisions: Record<string, Decision>): string {
  return blocks
    .map((block) => {
      if (block.type === 'unchanged') return block.original ?? '';
      const decision = decisions[block.id] ?? 'pending';
      switch (block.type) {
        case 'changed':
          if (decision === 'accepted') return block.replacement ?? '';
          if (decision === 'declined') return block.original ?? '';
          return (block.original ?? '') + (block.replacement ?? '');
        case 'added':
          if (decision === 'declined') return '';
          return block.replacement ?? '';
        case 'removed':
          if (decision === 'accepted') return '';
          return block.original ?? '';
        default:
          return '';
      }
    })
    .join('');
}

function inlineActionButtons(id: string): string {
  const acceptButton =
    'height:18px;min-width:18px;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:700;color:#047857;display:inline-flex;align-items:center;justify-content:center;line-height:1;padding:0;vertical-align:middle;user-select:none;';
  const declineButton =
    'height:18px;min-width:18px;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:700;color:#be185d;display:inline-flex;align-items:center;justify-content:center;line-height:1;padding:0;vertical-align:middle;user-select:none;';
  return (
    `<span contenteditable="false" style="display:inline-flex;align-items:center;gap:8px;margin-left:10px;vertical-align:middle;">` +
      `<button data-change-id="${id}" data-action="accept" contenteditable="false" style="${acceptButton}" title="Accept" aria-label="Accept">✓</button>` +
      `<button data-change-id="${id}" data-action="decline" contenteditable="false" style="${declineButton}" title="Decline" aria-label="Decline">✕</button>` +
    `</span>`
  );
}

function oldTextChip(inner: string): string {
  return (
    `<span style="display:inline-flex;align-items:center;gap:7px;border-radius:12px;padding:4px 9px;background:rgba(229,231,235,0.8);box-shadow:0 1px 6px rgba(107,114,128,0.12), inset 0 1px 0 rgba(255,255,255,0.65);">` +
      `<span style="text-decoration:line-through;text-decoration-thickness:1px;color:#94a3b8;">${inner}</span>` +
    `</span>`
  );
}

function newTextChip(inner: string): string {
  return (
    `<span style="display:inline-flex;align-items:center;gap:7px;border-radius:12px;padding:4px 9px;background:rgba(219,234,254,0.6);box-shadow:0 2px 10px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.8);">` +
      `<span style="color:#0f172a;">${inner}</span>` +
    `</span>`
  );
}

/**
 * Build display HTML to inject directly into the editor DOM for tracked-change
 * review. Uses inline styles so the browser renders del/ins visually regardless
 * of TipTap's schema (applied while editor is non-editable).
 * Pending blocks include inline ✓/✗ buttons rendered to the right of the text.
 */
export function buildTrackedChangesDisplayHtml(
  blocks: DiffBlock[],
  decisions: Record<string, Decision>
): string {
  return blocks
    .map((block) => {
      if (block.type === 'unchanged') return block.original ?? '';
      const decision = decisions[block.id] ?? 'pending';

      if (block.type === 'changed') {
        if (decision === 'accepted') return block.replacement ?? '';
        if (decision === 'declined') return block.original ?? '';
        const oldInner = getBlockInnerHtml(block.original ?? '');
        const newInner = getBlockInnerHtml(block.replacement ?? '');
        return (
          `<p class="editor-paragraph">${oldTextChip(oldInner)}</p>` +
          `<p class="editor-paragraph">${newTextChip(newInner)}${inlineActionButtons(block.id)}</p>`
        );
      }
      if (block.type === 'added') {
        if (decision === 'declined') return '';
        if (decision === 'accepted') return block.replacement ?? '';
        const newInner = getBlockInnerHtml(block.replacement ?? '');
        return `<p class="editor-paragraph">${newTextChip(newInner)}${inlineActionButtons(block.id)}</p>`;
      }
      if (block.type === 'removed') {
        if (decision === 'accepted') return '';
        if (decision === 'declined') return block.original ?? '';
        const oldInner = getBlockInnerHtml(block.original ?? '');
        return `<p class="editor-paragraph">${oldTextChip(oldInner)}${inlineActionButtons(block.id)}</p>`;
      }
      return '';
    })
    .join('');
}
