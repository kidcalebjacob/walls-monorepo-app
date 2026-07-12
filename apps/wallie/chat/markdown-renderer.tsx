"use client";

import { useMemo, type ReactElement } from 'react';
import { ExternalLink } from 'lucide-react';
import { normalizeMarkdownBlocks } from '@walls/wallie-core';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

type InlinePart = string | ReactElement;

type ElementWithChildren = ReactElement<{ children?: React.ReactNode; key?: string | number | null }>;

function getElementChildren(element: ElementWithChildren): React.ReactNode {
  return element.props.children;
}

/** GFM tables collapsed onto one line (common in LLM output) -> one row per line. */
function normalizeCollapsedMarkdownTables(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      const pipeCount = (line.match(/\|/g) ?? []).length;
      if (pipeCount < 4 || !line.includes("---")) return line;
      return line.replace(/\s\|\s(?=\|)/g, "\n|");
    })
    .join("\n");
}

function normalizeMarkdown(content: string): string {
  return normalizeMarkdownBlocks(normalizeCollapsedMarkdownTables(content), 4);
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function renderMarkdownTable(
  tableLines: string[],
  processInlineMarkdown: (text: string) => InlinePart[],
  tableKey: number
) {
  const headerCells = parseTableRow(tableLines[0]);
  const bodyStart = tableLines.length > 1 && isTableSeparator(tableLines[1]) ? 2 : 1;
  const bodyRows = tableLines.slice(bodyStart).map(parseTableRow);

  return (
    <div
      key={`table-${tableKey}`}
      className="my-4 overflow-x-auto overflow-hidden rounded-xl border border-neutral-200/50"
    >
      <table className="w-full min-w-[280px] text-sm">
        <thead>
          <tr className="border-b border-neutral-200/45 bg-neutral-100">
            {headerCells.map((cell, cellIndex) => (
              <th
                key={`th-${cellIndex}`}
                className="px-4 py-3 text-left text-xs font-normal uppercase tracking-wider text-neutral-500"
              >
                {processInlineMarkdown(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <tr key={`tr-${rowIndex}`} className="border-b border-neutral-200/40 last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={`td-${cellIndex}`}
                  className="px-4 py-3 align-top text-sm font-light leading-relaxed text-neutral-700"
                >
                  {processInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;

    const lines = normalizeMarkdown(content).split("\n");
    const elements: ReactElement[] = [];
    let currentParagraph: string[] = [];
    let key = 0;
    let partKeyCounter = 0;

    // Single inline markdown processor - used everywhere (paragraphs, headers, lists)
    const processInlineMarkdown = (text: string): InlinePart[] => {
      const parts: InlinePart[] = [];
      let remaining = text;
      let partKey = partKeyCounter++;

      // Process markdown in order: links first, then bold
      while (remaining.length > 0) {
        // Find the first occurrence of [ (link start) or ** (bold start)
        const linkIndex = remaining.indexOf('[');
        const boldIndex = remaining.indexOf('**');
        
        // Determine which comes first
        let nextIndex = -1;
        let nextType: 'link' | 'bold' | null = null;
        
        if (linkIndex !== -1 && (boldIndex === -1 || linkIndex < boldIndex)) {
          nextIndex = linkIndex;
          nextType = 'link';
        } else if (boldIndex !== -1) {
          nextIndex = boldIndex;
          nextType = 'bold';
        }
        
        if (nextIndex === -1) {
          // No more markdown, add remaining text
          if (remaining) {
            parts.push(remaining);
          }
          break;
        }

        // Add text before the markdown
        if (nextIndex > 0) {
          const beforeText = remaining.substring(0, nextIndex);
          if (beforeText) {
            parts.push(beforeText);
          }
        }

        if (nextType === 'link') {
          // Process markdown link [text](url)
          const afterBracket = remaining.substring(nextIndex + 1);
          const closingBracketIndex = afterBracket.indexOf(']');
          
          if (closingBracketIndex === -1) {
            // No closing bracket, treat as regular text
            parts.push(remaining.substring(0, nextIndex + 1));
            remaining = afterBracket;
            continue;
          }
          
          const linkText = afterBracket.substring(0, closingBracketIndex);
          const afterClosingBracket = afterBracket.substring(closingBracketIndex + 1);
          
          // Check for (url) after ]
          if (!afterClosingBracket.startsWith('(')) {
            // No opening paren, treat as regular text
            parts.push(remaining.substring(0, nextIndex + 1));
            remaining = afterBracket;
            continue;
          }
          
          const afterParen = afterClosingBracket.substring(1);
          const closingParenIndex = afterParen.indexOf(')');
          
          if (closingParenIndex === -1) {
            // No closing paren, treat as regular text
            parts.push(remaining.substring(0, nextIndex + 1));
            remaining = afterBracket;
            continue;
          }
          
          const linkUrl = afterParen.substring(0, closingParenIndex);
          
          // Create link element
          parts.push(
            <a 
              key={`link-${partKey++}`} 
              href={linkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-walls-sky hover:opacity-80 inline-flex items-center gap-1"
            >
              {linkText}
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-walls-sky" />
            </a>
          );
          
          // Continue with the rest of the text (after the closing ))
          remaining = afterParen.substring(closingParenIndex + 1);
        } else if (nextType === 'bold') {
          // Process bold text **text**
          const afterStart = remaining.substring(nextIndex + 2);
          const endIndex = afterStart.indexOf('**');
          
          if (endIndex === -1) {
            // No closing **, treat the ** as regular text and continue
            parts.push(remaining.substring(0, nextIndex + 2));
            remaining = afterStart;
            continue;
          }

          // Extract the bold text content
          const boldContent = afterStart.substring(0, endIndex);
          if (boldContent) {
            parts.push(
              <strong key={`bold-${partKey++}`} className="font-bold">
                {boldContent}
              </strong>
            );
          }

          // Continue with the rest of the text (after the closing **)
          remaining = afterStart.substring(endIndex + 2);
        }
      }

      return parts;
    };

    const renderParagraph = (paragraph: string[]) => {
      if (paragraph.length === 0) return null;
      
      const text = paragraph.join('\n').trim();
      if (!text) return null;

      const inlineContent = processInlineMarkdown(text);
      
      return (
        <p key={`p-${key++}`} className="mb-4 last:mb-0 leading-loose">
          {inlineContent.length > 0 ? inlineContent : text}
        </p>
      );
    };

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const trimmedLine = line.trim();

      if (isTableRow(trimmedLine)) {
        if (currentParagraph.length > 0) {
          const para = renderParagraph(currentParagraph);
          if (para) elements.push(para);
          currentParagraph = [];
        }

        const tableLines: string[] = [];
        while (index < lines.length && isTableRow(lines[index].trim())) {
          tableLines.push(lines[index].trim());
          index++;
        }
        index--;

        if (tableLines.length > 0) {
          elements.push(renderMarkdownTable(tableLines, processInlineMarkdown, key++));
        }
        continue;
      }

      // Check for horizontal rule (---)
      if (trimmedLine === '---' || trimmedLine.match(/^-{3,}$/)) {
        // Render any accumulated paragraph first
        if (currentParagraph.length > 0) {
          const para = renderParagraph(currentParagraph);
          if (para) elements.push(para);
          currentParagraph = [];
        }
        elements.push(
          <hr key={`hr-${key++}`} className="my-4 border-t border-gray-300" />
        );
        continue;
      }

      // Check for headers (check #### before ### since #### starts with ###)
      if (trimmedLine.startsWith('#### ')) {
        // Render any accumulated paragraph first
        if (currentParagraph.length > 0) {
          const para = renderParagraph(currentParagraph);
          if (para) elements.push(para);
          currentParagraph = [];
        }
        const headerText = trimmedLine.substring(5).trim();
        elements.push(
          <h4 key={`h4-${key++}`} className="text-xl font-semibold mt-5 mb-2">
            {processInlineMarkdown(headerText)}
          </h4>
        );
        continue;
      }

      if (trimmedLine.startsWith('### ')) {
        // Render any accumulated paragraph first
        if (currentParagraph.length > 0) {
          const para = renderParagraph(currentParagraph);
          if (para) elements.push(para);
          currentParagraph = [];
        }
        const headerText = trimmedLine.substring(4).trim();
        elements.push(
          <h3 key={`h3-${key++}`} className="text-2xl font-semibold mt-6 mb-3">
            {processInlineMarkdown(headerText)}
          </h3>
        );
        continue;
      }

      if (trimmedLine.startsWith('## ')) {
        // Render any accumulated paragraph first
        if (currentParagraph.length > 0) {
          const para = renderParagraph(currentParagraph);
          if (para) elements.push(para);
          currentParagraph = [];
        }
        const headerText = trimmedLine.substring(3).trim();
        elements.push(
          <h2 key={`h2-${key++}`} className="text-3xl font-semibold mt-6 mb-3">
            {processInlineMarkdown(headerText)}
          </h2>
        );
        continue;
      }

      if (trimmedLine.startsWith('# ')) {
        // Render any accumulated paragraph first
        if (currentParagraph.length > 0) {
          const para = renderParagraph(currentParagraph);
          if (para) elements.push(para);
          currentParagraph = [];
        }
        const headerText = trimmedLine.substring(2).trim();
        elements.push(
          <h1 key={`h1-${key++}`} className="text-4xl font-semibold mt-6 mb-3">
            {processInlineMarkdown(headerText)}
          </h1>
        );
        continue;
      }

      // Check for list items (starting with number or -)
      const listMatch = trimmedLine.match(/^(\d+\.|-|\*)\s(.+)$/);
      // Check for indented list items (sub-items with leading spaces)
      const indentedMatch = line.match(/^(\s+)(-|\*)\s(.+)$/);
      
      if (listMatch || indentedMatch) {
        // Render any accumulated paragraph first
        if (currentParagraph.length > 0) {
          const para = renderParagraph(currentParagraph);
          if (para) elements.push(para);
          currentParagraph = [];
        }
        
        const isIndented = !!indentedMatch;
        const match = indentedMatch || listMatch;
        if (!match) return;
        
        const listText = (indentedMatch?.[3] ?? listMatch?.[2] ?? "").trim();
        const isOrdered = listMatch ? /^\d+\./.test(listMatch[1]) : false;
        const listKey = `list-${key++}`;
        const itemKey = `li-${key++}`;
        
        // Process inline markdown for list text
        const processedListText = processInlineMarkdown(listText);
        const newLi = <li key={itemKey} className="ml-4 mb-1">{processedListText}</li>;
        
        // If this is an indented bullet item, try to nest it in the last numbered list item
        if (isIndented && !isOrdered) {
          const lastElement = elements[elements.length - 1] as ElementWithChildren;
          
          // Check if last element is an ordered list (ol)
          if (lastElement && lastElement.type === 'ol') {
            const existingList = getElementChildren(lastElement);
            const listItems = Array.isArray(existingList) ? existingList : [existingList];
            
            if (listItems.length > 0) {
              const lastListItem = listItems[listItems.length - 1] as ElementWithChildren;
              
              // Get the children of the last list item
              const liChildren = getElementChildren(lastListItem);
              const liChildrenArray = Array.isArray(liChildren) ? liChildren : [liChildren];
              
              // Check if there's already a nested ul
              const nestedUlIndex = liChildrenArray.findIndex((child: any) => child && child.type === 'ul');
              
              if (nestedUlIndex >= 0) {
                // Add to existing nested ul
                const nestedUl = liChildrenArray[nestedUlIndex] as ElementWithChildren;
                const nestedChildren = getElementChildren(nestedUl);
                const nestedListItems = Array.isArray(nestedChildren)
                  ? nestedChildren
                  : nestedChildren != null
                    ? [nestedChildren]
                    : [];
                
                const updatedNestedUl = (
                  <ul key={nestedUl.key ?? `nested-ul-${key++}`} className="list-disc ml-4 mb-1 mt-1">
                    {[...nestedListItems, newLi]}
                  </ul>
                );
                
                const updatedLiChildren = [
                  ...liChildrenArray.slice(0, nestedUlIndex),
                  updatedNestedUl,
                  ...liChildrenArray.slice(nestedUlIndex + 1)
                ];
                
                const updatedLi = <li key={lastListItem.key} className="ml-4 mb-1">{updatedLiChildren}</li>;
                const updatedListItems = [...listItems.slice(0, -1), updatedLi];
                elements[elements.length - 1] = (
                  <ol key={lastElement.key ?? listKey} className="list-decimal ml-4 mb-3">{updatedListItems}</ol>
                );
                continue;
              } else {
                // Create new nested ul inside the li
                const nestedUl = <ul key={`nested-ul-${key++}`} className="list-disc ml-4 mb-1 mt-1">{newLi}</ul>;
                const updatedLiChildren = [...liChildrenArray, nestedUl];
                const updatedLi = <li key={lastListItem.key} className="ml-4 mb-1">{updatedLiChildren}</li>;
                const updatedListItems = [...listItems.slice(0, -1), updatedLi];
                elements[elements.length - 1] = (
                  <ol key={lastElement.key ?? listKey} className="list-decimal ml-4 mb-3">{updatedListItems}</ol>
                );
                continue;
              }
            }
          }
        }
        
        // Regular list item handling (not nested)
        const lastElement = elements[elements.length - 1] as ElementWithChildren;
        const listType = isOrdered ? 'ol' : 'ul';

        if (lastElement && lastElement.type === listType) {
          // Add to existing list of the same type
          const existingList = getElementChildren(lastElement);
          const newListItems = Array.isArray(existingList) 
            ? [...existingList, newLi]
            : [existingList, newLi];
          elements[elements.length - 1] = isOrdered 
            ? <ol key={lastElement.key ?? listKey} className="list-decimal ml-4 mb-3">{newListItems}</ol>
            : <ul key={lastElement.key ?? listKey} className="list-disc ml-4 mb-3">{newListItems}</ul>;
        } else if (isOrdered && lastElement && lastElement.type === 'ul') {
          // Numbered item after sub-items (ul): append to the most recent ol so we get 1, 2, 3... not a new "1." each time
          let olIndex = -1;
          for (let i = elements.length - 1; i >= 0; i--) {
            if (elements[i].type === 'ol') {
              olIndex = i;
              break;
            }
          }
          if (olIndex >= 0) {
            const existingOl = elements[olIndex] as ElementWithChildren;
            const existingList = getElementChildren(existingOl);
            const newListItems = Array.isArray(existingList) 
              ? [...existingList, newLi]
              : [existingList, newLi];
            elements[olIndex] = (
              <ol key={existingOl.key ?? listKey} className="list-decimal ml-4 mb-3">{newListItems}</ol>
            );
          } else {
            elements.push(
              <ol key={listKey} className="list-decimal ml-4 mb-3">{newLi}</ol>
            );
          }
        } else {
          // Create new list
          elements.push(
            isOrdered 
              ? <ol key={listKey} className="list-decimal ml-4 mb-3">{newLi}</ol>
              : <ul key={listKey} className="list-disc ml-4 mb-3">{newLi}</ul>
          );
        }
        continue;
      }

      // Regular line - add to current paragraph
      if (trimmedLine) {
        currentParagraph.push(line);
      } else {
        // Empty line - render accumulated paragraph and start new one
        if (currentParagraph.length > 0) {
          const para = renderParagraph(currentParagraph);
          if (para) elements.push(para);
          currentParagraph = [];
        }
      }
    }

    // Render any remaining paragraph
    if (currentParagraph.length > 0) {
      const para = renderParagraph(currentParagraph);
      if (para) elements.push(para);
    }

    // If no elements were created (e.g., all text was in one paragraph), ensure we render something
    if (elements.length === 0 && content.trim()) {
      
      // Fallback: render the entire content as a paragraph
      const para = renderParagraph([content]);
      if (para) elements.push(para);
    }

    return elements;
  }, [content]);

  return (
    <div className={className}>
      {renderedContent}
    </div>
  );
}
