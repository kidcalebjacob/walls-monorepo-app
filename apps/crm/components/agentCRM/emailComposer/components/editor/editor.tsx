// components/agent-mail/email-composer/components/editor/editor.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { useEditor, EditorContent, Editor as TipTapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Extension } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import ListItem from '@tiptap/extension-list-item';

// Custom ListItem extension to modify rendering
const CustomListItem = ListItem.extend({
  renderHTML({ node, HTMLAttributes }) {
    return ['li', HTMLAttributes, ['span', { style: 'white-space: pre-wrap;' }, 0]]
  }
});

// Custom extension for font size and background color
const CustomStyle = Extension.create({
  name: 'customStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: element => element.style.backgroundColor,
            renderHTML: attributes => {
              if (!attributes.backgroundColor) return {};
              return {
                style: `background-color: ${attributes.backgroundColor}`,
              };
            },
          },
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize,
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
});


interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export type EditorRef = {
  getEditor: () => TipTapEditor | null;
};

const PARAGRAPH_MARGIN_STYLE = 'margin: 0 0 0.75em 0;';

const GMAIL_DEFAULT_LINK_STYLE = 'color: #1155CC; text-decoration: underline;';

/**
 * Normalize editor HTML only when sending so paragraph spacing is preserved in email
 * (Gmail and others often strip default margins; inline styles + one <p> per block fix it).
 * Editor content and appearance are unchanged.
 */
export function normalizeEmailHtmlForSend(html: string): string {
  if (!html || !html.trim()) return html;
  let out = html;

  // 1) Split double (or more) <br> into separate paragraphs so "one <p> with <br><br>" becomes
  //    multiple <p> with a blank line — prevents Gmail from collapsing spacing
  out = out.replace(/(<br\s*\/?>\s*){2,}/gi, () =>
    `</p><p style="${PARAGRAPH_MARGIN_STYLE}"></p><p style="${PARAGRAPH_MARGIN_STYLE}">`
  );

  // 2) Add inline margin to every <p> so email clients show space between paragraphs
  out = out.replace(/<p(\s[^>]*)?>/gi, (match) => {
    if (match.includes('style=')) {
      return match.replace(/style="([^"]*)"/, (_m, styles) =>
        styles.includes('margin:') ? `style="${styles}"` : `style="${styles}; ${PARAGRAPH_MARGIN_STYLE}"`
      );
    }
    return match.replace(/<p/, `<p style="${PARAGRAPH_MARGIN_STYLE}"`);
  });

  // 3) Prevent empty paragraphs from collapsing so blank lines show in email
  out = out.replace(/<p([^>]*)>\s*<\/p>/gi, `<p$1>&nbsp;</p>`);

  return out;
}

const Editor = forwardRef<EditorRef, EditorProps>(
  ({ content, onChange, placeholder }, ref) => {
    const editor = useEditor({
      extensions: [
        CustomListItem.configure({
          HTMLAttributes: {
            class: 'list-item',
          },
        }),
        StarterKit.configure({
          bulletList: {
            keepMarks: true,
            keepAttributes: false,
            HTMLAttributes: {
              class: 'bullet-list',
            },
          },
          listItem: false,
          orderedList: {
            keepMarks: true,
            keepAttributes: false,
            HTMLAttributes: {
              class: 'ordered-list',
            },
          },
          paragraph: {
            HTMLAttributes: {
              class: 'editor-paragraph',
            },
          },
        }),
        TextStyle,
        Color,
        FontFamily,
        TextAlign.configure({
          types: ['paragraph', 'heading'],
        }),
        Underline,
        CustomStyle,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer',
            style: GMAIL_DEFAULT_LINK_STYLE,
          },
        }),
      ],
      content: content || '<p></p>',
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'flex-1 px-2 py-2 outline-none whitespace-pre-wrap text-[13px] font-[Arial] leading-[1.4285714286] overflow-y-auto min-h-[200px]',
          style: 'word-break: break-word;',
        },
        // Clean up pasted HTML from external sources like ChatGPT
        handleDOMEvents: {
          // TipTap openOnClick:false removes its handler; still block native navigation on <a> in the editable surface
          click: (view, event) => {
            const target = event.target as HTMLElement | undefined;
            const anchor = target?.closest?.('a');
            if (anchor?.getAttribute('href') && view.dom.contains(anchor)) {
              event.preventDefault();
            }
            return false;
          },
        },
        transformPastedHTML(html) {
          let cleaned = html;
          
          // Remove ChatGPT's special formatting and code blocks
          cleaned = cleaned.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
            // Convert code blocks to plain text with line breaks
            const text = match.replace(/<[^>]+>/g, '').trim();
            return text.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');
          });
          
          // Convert multiple consecutive <br> tags to single paragraph breaks
          cleaned = cleaned.replace(/(<br\s*\/?>\s*){2,}/gi, '</p><p>');
          
          // Convert divs to paragraphs for consistency
          cleaned = cleaned.replace(/<div[^>]*>/gi, '<p>');
          cleaned = cleaned.replace(/<\/div>/gi, '</p>');
          
          // Remove empty spans and clean up nested empty elements
          cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');
          
          // Remove excessive whitespace between tags
          cleaned = cleaned.replace(/>\s+</g, '><');
          
          // Clean up consecutive empty paragraphs
          cleaned = cleaned.replace(/(<p>\s*<\/p>\s*){2,}/g, '<p></p>');
          cleaned = cleaned.replace(/(<p>\s*<br\s*\/?>\s*<\/p>\s*){2,}/g, '<p><br></p>');
          
          // Remove any style attributes that might cause issues
          cleaned = cleaned.replace(/\s*style="[^"]*"/gi, '');
          
          // Remove class attributes from pasted content
          cleaned = cleaned.replace(/\s*class="[^"]*"/gi, '');
          
          return cleaned;
        },
        handleKeyDown: (view, event) => {
          if (event.key === 'Enter') {
            const { selection } = view.state;
            const { $from } = selection;
            
            // Check if we're in a list
            if ($from.parent.type.name === 'listItem') {
              const node = $from.parent;
              
              if (node.textContent.trim() === '') {
                event.preventDefault();
                if (editor) {
                  editor.chain()
                    .focus()
                    .liftListItem('listItem')
                    .setParagraph()
                    .run();
                }
                return true;
              }
            }
            return false;
          }
          return false;
        },
      },
    });

    useImperativeHandle(ref, () => ({
      getEditor: () => editor,
    }));

    // Update content when it changes externally
    useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        editor.commands.setContent(content || '<p></p>');
      }
    }, [content, editor]);

    return (
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <EditorContent 
          editor={editor} 
          className="flex-1 overflow-y-auto"
        />
        <style>{`
          .ProseMirror {
            min-height: 200px;
            height: 100%;
            outline: none;
            padding-top: 1em;
            overflow-y: auto;
            color: #1f2937;
            font-weight: 500;
          }
          
          .ProseMirror > * {
            margin: 0;
            padding: 0;
          }

          /* Ensure first paragraph has no top spacing */
          .ProseMirror > p:first-child {
            padding-top: 0;
          }

          /* Set consistent paragraph spacing */
          .ProseMirror p {
            padding: 0;
            min-height: 1.4285714286em;
            line-height: 1.4285714286;
          }

          /* Add space between paragraphs */
          .ProseMirror p + p {
            padding-top: 0em;
          }

          /* List styling */
          .ProseMirror ul,
          .ProseMirror ol {
            padding-left: 1.5em;
            padding-top: 0em;
          }
          
          .ProseMirror ul {
            list-style-type: disc;
          }
          
          .ProseMirror ol {
            list-style-type: decimal;
          }
          
          .ProseMirror li {
            padding: 0;
            line-height: 1.4285714286;
          }

          /* Reduced spacing between list items */
          .ProseMirror li + li {
            padding-top: 0em;
          }

          .ProseMirror li p {
            display: inline;
            margin: 0;
            padding: 0;
          }

          /* Placeholder styling */
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--kenoo-yellow);
            opacity: 0.8;
            pointer-events: none;
            height: 0;
          }

          /* Ensure consistent spacing before lists */
          .ProseMirror p + ul,
          .ProseMirror p + ol {
            padding-top: 1.5em;
          }

          /* Ensure consistent spacing after lists */
          .ProseMirror ul + p,
          .ProseMirror ol + p {
            padding-top: 1.5em;
          }
        `}</style>
      </div>
    );
  }
);

Editor.displayName = 'Editor';

export default Editor;
