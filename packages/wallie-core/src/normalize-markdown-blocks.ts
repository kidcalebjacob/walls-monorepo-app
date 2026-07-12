const MONTH_NAME =
  /(?:January|February|March|April|May|June|July|August|September|October|November|December)$/i;

const INLINE_LIST_MARKER = /(?:^|\s)(\d{1,2})\.\s+(?=\S)/g;

function isMonthDayPeriod(line: string, digitStart: number): boolean {
  const beforeDigits = line.slice(0, digitStart).trimEnd();
  return MONTH_NAME.test(beforeDigits);
}

function collectInlineListMarkers(line: string): number[] {
  const nums: number[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(INLINE_LIST_MARKER.source, INLINE_LIST_MARKER.flags);

  while ((match = re.exec(line)) !== null) {
    const num = Number.parseInt(match[1], 10);
    const digitStart = match.index + match[0].indexOf(match[1]);
    if (isMonthDayPeriod(line, digitStart)) continue;
    if (num > 20) continue;
    nums.push(num);
  }

  return nums;
}

function looksLikeInlineNumberedList(nums: number[]): boolean {
  if (nums.length < 2) return false;
  if (!nums.includes(1) || !nums.includes(2)) return false;

  const sorted = [...nums].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }

  return true;
}

/** Split collapsed `1. … 2. …` lists without breaking dates like `July 14.` */
export function normalizeInlineNumberedLists(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      const markerNums = collectInlineListMarkers(line);
      if (!looksLikeInlineNumberedList(markerNums)) return line;

      return line.replace(/([^\n])(\s+)(\d{1,2})\.\s+(?=\S)/g, (full, before, _space, num, offset) => {
        const digitStart = offset + before.length;
        if (isMonthDayPeriod(line, digitStart)) return full;
        const parsed = Number.parseInt(num, 10);
        if (!markerNums.includes(parsed)) return full;
        return `${before}\n${num}. `;
      });
    })
    .join("\n");
}

export function normalizeMarkdownBlocks(content: string, headingLevels = 3): string {
  const headingPattern = new RegExp(`([^\\n])\\s+(#{1,${headingLevels}}\\s+)`, "g");

  return normalizeInlineNumberedLists(content.replace(/\r\n/g, "\n")).replace(
    headingPattern,
    "$1\n\n$2",
  );
}
