"use client";

import React, { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";

interface EmailContentViewerProps {
  content: string;
  isPreview?: boolean;
  className?: string;
  showQuotedContent?: boolean;
}

export function EmailContentViewer({ content, isPreview = false, className, showQuotedContent = false }: EmailContentViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState('auto');
  const lastRenderRef = useRef<{ content: string; showQuotedContent: boolean } | null>(null);

  useEffect(() => {
    if (!iframeRef.current || !content) return;

    // Only skip rebuild when both content and showQuotedContent are unchanged
    // (so "Show full message" still triggers a proper update)
    if (
      lastRenderRef.current?.content === content &&
      lastRenderRef.current?.showQuotedContent === showQuotedContent
    ) {
      return;
    }
    lastRenderRef.current = { content, showQuotedContent };

    // Some senders wrap the *entire* message body in .gmail_quote.
    // Only collapse quote sections when they look like an actual quoted thread.
    const quoteStartRegex = /<div\s+class="gmail_quote|<blockquote\s+class="gmail_quote/i;
    const quoteMatch = content.match(quoteStartRegex);
    const quoteStartIndex = quoteMatch?.index ?? -1;
    const quoteHtml = quoteStartIndex >= 0 ? content.slice(quoteStartIndex) : "";
    const hasQuoteMarker = /(gmail_attr|yahoo_quoted|blockquote[^>]*type=["']cite["']|on\s.+wrote:|from:\s|sent:\s|subject:\s|-----\s*original message\s*-----)/i.test(quoteHtml);
    const shouldHideQuotedContent = !showQuotedContent && quoteStartIndex >= 0 && hasQuoteMarker;

    // Base CSS to be injected into iframe
    const baseStyles = `
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: ${isPreview ? '0.875rem' : '0.875rem'};
          line-height: 1.5;
          color: #202124;
          -webkit-font-smoothing: antialiased;
          padding: ${isPreview ? '0' : '1rem'};
        }
        img {
          max-width: 100%;
          height: auto;
        }
        pre, code {
          white-space: pre-wrap;
          word-wrap: break-word;
          font-family: monospace;
        }
        a {
          color: #1a73e8;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        blockquote {
          margin: 0;
          padding-left: 8px;
          border-left: 1px solid #dadce0;
          color: #5f6368;
        }
        p {
          margin: 0 0 1em 0;
        }
        p:last-child {
          margin-bottom: 0;
        }
        .gmail_quote, .gmail_attr, .yahoo_quoted,
        blockquote[type="cite"], blockquote[type='cite'] {
          display: ${shouldHideQuotedContent ? 'none' : 'block'};
        }
        .gmail_signature {
          margin-top: 12px;
        }
        /* Spintax styling */
        .spintax-preview {
          text-decoration: underline dotted black !important;
          text-decoration-color: black !important;
          text-decoration-style: dotted !important;
          cursor: pointer;
          position: relative;
          display: inline-block;
        }
        .spintax-preview .spintax-text {
          display: inline-block;
          transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 1;
          transform: translateY(0);
          text-decoration: inherit;
        }
      </style>
    `;

    // Split content at Gmail quote container (HTML only). Do not use text patterns like
    // "On .* wrote:" — they can match "on" in the body (e.g. "align on one point") and
    // greedily cut the main message short. We only want to cut at the actual quote block.
    let mainContent = content;
    if (shouldHideQuotedContent && quoteStartIndex >= 0) {
      mainContent = content.slice(0, quoteStartIndex).trimEnd();
    }

    // Sanitize and prepare content
    const isHtml = /<[a-z][\s\S]*>/i.test(mainContent);
    const sanitizedContent = isHtml
      ? mainContent
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/on\w+="[^"]*"/g, '')
      : mainContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\r\n/g, '<br>')
          .replace(/\n/g, '<br>');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${baseStyles}
        </head>
        <body>${sanitizedContent}</body>
      </html>
    `;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentWindow?.document;
    
    if (iframeDoc) {
      setHeight("0px");
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Strip trailing whitespace-only elements (blank <br>/<div> nodes that email clients
      // insert before their quoted block) so they don't inflate the iframe height.
      // Recursively remove from the end so we also clear empty nested divs inside a wrapper.
      if (!showQuotedContent) {
        const removeTrailingEmptyNodes = (container: Element) => {
          while (container.lastChild) {
            const last = container.lastChild;
            if (last.nodeType === Node.TEXT_NODE) {
              if ((last.textContent ?? '').trim() === '') {
                container.removeChild(last);
              } else {
                break;
              }
            } else if (last.nodeType === Node.ELEMENT_NODE) {
              const el = last as Element;
              if ((el.textContent ?? '').trim() === '') {
                container.removeChild(last);
              } else {
                removeTrailingEmptyNodes(el);
                break;
              }
            } else {
              break;
            }
          }
        };
        removeTrailingEmptyNodes(iframeDoc.body);
      }

      // Height: use body scroll/offset metrics only. Excluding html.clientHeight prevents
      // the previous render's iframe viewport size from leaking in before React applies
      // the setHeight("0px") reset (which is batched and hasn't hit the DOM yet).
      const updateHeight = () => {
        const body = iframeDoc.body;
        const html = iframeDoc.documentElement;
        const newHeight = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.scrollHeight,
          html.offsetHeight
        );
        setHeight(`${newHeight}px`);
      };
      // Resize after images load (tracking pixels, signatures, logos) so height isn't locked too early
      const resizeAfterImagesLoad = () => {
        const images = Array.from(iframeDoc.images);
        if (images.length === 0) {
          updateHeight();
          return;
        }
        let loadedCount = 0;
        const tryResize = () => {
          loadedCount++;
          if (loadedCount >= images.length) {
            updateHeight();
          }
        };
        images.forEach((img) => {
          if (img.complete) {
            tryResize();
          } else {
            img.addEventListener("load", tryResize);
            img.addEventListener("error", tryResize);
          }
        });
      };
      // ResizeObserver: update height whenever body size changes (images, fonts, dynamic content)
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(iframeDoc.body);
      }

      // When preview opens without loading (cached thread), the iframe can be measured before
      // it has its final width from layout, so we get a wrong height and huge gap below content.
      // Re-run height after layout has settled so we always get the correct height.
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (iframeDoc.body) updateHeight();
        });
      });

      // Handle clicks on links
      iframeDoc.body.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'A') {
          e.preventDefault();
          const href = target.getAttribute('href');
          if (href) {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
        }
      });

      // Rule #2: Run spintax processing BEFORE first paint
      // Process spintax synchronously so user never sees unprocessed version
      const processSpintax = () => {
        const SPINTAX_REGEX = /\{\{spin\.([^}]+)\}\}/g;
        
        // Walk through all text nodes in the document
        const walker = iframeDoc.createTreeWalker(
          iframeDoc.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        const textNodes: Text[] = [];
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            SPINTAX_REGEX.lastIndex = 0;
            if (SPINTAX_REGEX.test(node.textContent)) {
              textNodes.push(node as Text);
            }
          }
        }
        
        // Process each text node containing spintax
        textNodes.forEach((textNode) => {
          const parent = textNode.parentNode;
          if (!parent) return;
          
          const text = textNode.textContent || '';
          SPINTAX_REGEX.lastIndex = 0;
          const matches: Array<{ match: RegExpMatchArray; options: string[] }> = [];
          
          let match;
          while ((match = SPINTAX_REGEX.exec(text)) !== null) {
            const optionsString = match[1];
            const options = optionsString.split('|').map(opt => opt.trim());
            matches.push({ match, options });
          }
          
          if (matches.length === 0) return;
          
          // Create document fragment with processed content
          const fragment = iframeDoc.createDocumentFragment();
          let lastIndex = 0;
          
          matches.forEach(({ match, options }) => {
            // Add text before the match
            if (match.index! > lastIndex) {
              fragment.appendChild(iframeDoc.createTextNode(text.substring(lastIndex, match.index!)));
            }
            
            // Create spintax span - show only first option by default, all options on hover
            const spintaxSpan = iframeDoc.createElement('span');
            spintaxSpan.className = 'spintax-preview';
            const firstOption = options[0] || '';
            const allOptions = options.join(' / ');
            
            // Create inner span for smooth text transitions
            const textSpan = iframeDoc.createElement('span');
            textSpan.className = 'spintax-text';
            textSpan.textContent = firstOption;
            textSpan.setAttribute('data-first-option', firstOption);
            textSpan.setAttribute('data-all-options', allOptions);
            
            // Handle hover to show all options with smooth animation
            spintaxSpan.addEventListener('mouseenter', () => {
              // Fade out and move up
              textSpan.style.opacity = '0';
              textSpan.style.transform = 'translateY(-4px)';
              
              // After fade out completes, change text and fade in
              setTimeout(() => {
                textSpan.textContent = allOptions;
                // Force reflow to ensure transition works
                textSpan.offsetHeight;
                textSpan.style.opacity = '1';
                textSpan.style.transform = 'translateY(0)';
              }, 200); // Match transition duration
            });
            
            spintaxSpan.addEventListener('mouseleave', () => {
              // Fade out and move down
              textSpan.style.opacity = '0';
              textSpan.style.transform = 'translateY(4px)';
              
              // After fade out completes, change text and fade in
              setTimeout(() => {
                textSpan.textContent = firstOption;
                // Force reflow to ensure transition works
                textSpan.offsetHeight;
                textSpan.style.opacity = '1';
                textSpan.style.transform = 'translateY(0)';
              }, 200); // Match transition duration
            });
            
            spintaxSpan.appendChild(textSpan);
            fragment.appendChild(spintaxSpan);
            
            lastIndex = match.index! + match[0].length;
          });
          
          // Add remaining text
          if (lastIndex < text.length) {
            fragment.appendChild(iframeDoc.createTextNode(text.substring(lastIndex)));
          }
          
          // Replace the text node with the fragment
          parent.replaceChild(fragment, textNode);
        });
        
        // Rule #3: Update height once after all spintax processing is complete
        updateHeight();
      };
      
      // Rule #2: Run synchronously BEFORE first paint
      // document.write() blocks paint, so running spintax synchronously means
      // the user never sees the unprocessed version
      processSpintax();
      resizeAfterImagesLoad();

      return () => {
        cancelAnimationFrame(rafId);
        resizeObserver?.disconnect();
      };
    }
  }, [content, isPreview, showQuotedContent]);

  return (
    <iframe
      ref={iframeRef}
      className={cn(
        "w-full border-none bg-transparent",
        isPreview ? "max-h-20 overflow-hidden" : "",
        className
      )}
      style={{ height }}
      sandbox="allow-same-origin"
      title="email-content"
    />
  );
} 