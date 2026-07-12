import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { useTheme } from "@/context/ThemeContext";
import type { AppColors } from "@/constants/theme";
import { normalizeMarkdownBlocks } from "@walls/wallie-core";

interface MarkdownTextProps {
  content: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/** Convert our lightweight markdown dialect to selectable HTML. */
export function markdownToHtml(content: string): string {
  const lines = normalizeMarkdownBlocks(content, 3).split("\n");
  const parts: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (!listItems.length) return;
    const tag = listOrdered ? "ol" : "ul";
    parts.push(
      `<${tag}>${listItems.map((item) => `<li>${inlineToHtml(item)}</li>`).join("")}</${tag}>`,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    const isBullet = /^[-*]\s+/.test(trimmed);
    const isNumbered = /^\d+\.\s+/.test(trimmed);
    if (isBullet || isNumbered) {
      const ordered = isNumbered && !isBullet;
      if (listItems.length && listOrdered !== ordered) {
        flushList();
      }
      listOrdered = ordered;
      listItems.push(
        trimmed.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ""),
      );
      continue;
    }
    flushList();
    if (trimmed.startsWith("### ")) {
      parts.push(`<h3>${inlineToHtml(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      parts.push(`<h2>${inlineToHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      parts.push(`<h1>${inlineToHtml(trimmed.slice(2))}</h1>`);
    } else {
      parts.push(`<p>${inlineToHtml(trimmed)}</p>`);
    }
  }
  flushList();
  return parts.join("");
}

export function markdownToPlainText(content: string): string {
  return normalizeMarkdownBlocks(content, 3)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();
}

function buildDocument(colors: AppColors): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    color: ${colors.text};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 26px;
    -webkit-text-size-adjust: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  #content, #content * {
    -webkit-user-select: text !important;
    user-select: text !important;
    -webkit-touch-callout: default !important;
  }
  #content { padding: 0; margin: 0; min-height: 1px; }
  p { margin: 0 0 8px 0; }
  p:last-child { margin-bottom: 0; }
  h1 { font-size: 22px; line-height: 30px; font-weight: 700; margin: 0 0 8px 0; }
  h2 { font-size: 19px; line-height: 27px; font-weight: 700; margin: 0 0 8px 0; }
  h3 { font-size: 17px; line-height: 25px; font-weight: 600; margin: 0 0 8px 0; }
  strong { font-weight: 700; }
  a { color: ${colors.wallsSky}; text-decoration: underline; }
  ul, ol {
    margin: 0 0 8px 0;
    padding-left: 1.35em;
  }
  ul { list-style-type: disc; }
  ol { list-style-type: decimal; }
  ul:last-child, ol:last-child { margin-bottom: 0; }
  li { margin: 0 0 4px 0; padding-left: 0.15em; }
  li::marker { color: ${colors.textMuted}; font-size: 1.05em; }
</style>
</head>
<body>
  <div id="content"></div>
  <script>
    function postHeight() {
      var el = document.getElementById('content');
      var h = Math.ceil(el.getBoundingClientRect().height);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: Math.max(h, 1) }));
    }
    window.setMarkdownHtml = function(html) {
      document.getElementById('content').innerHTML = html;
      requestAnimationFrame(postHeight);
    };
    window.addEventListener('load', postHeight);
  </script>
</body>
</html>`;
}

/**
 * Renders markdown in a transparent WebView so users get ChatGPT-like
 * native selection (highlight + copy) while keeping bold/links/lists.
 * Content updates (including typing) are pushed via injectJavaScript.
 */
export function MarkdownText({ content }: MarkdownTextProps) {
  const { colors } = useTheme();
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const [height, setHeight] = useState(1);

  const bodyHtml = useMemo(() => markdownToHtml(content), [content]);
  const documentHtml = useMemo(
    () => buildDocument(colors),
    [colors.text, colors.textMuted, colors.wallsSky],
  );

  useEffect(() => {
    if (!readyRef.current) return;
    webRef.current?.injectJavaScript(
      `window.setMarkdownHtml(${JSON.stringify(bodyHtml)}); true;`,
    );
  }, [bodyHtml]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        height?: number;
      };
      if (data.type === "height" && typeof data.height === "number") {
        const next = Math.max(1, data.height);
        setHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
      }
    } catch {
      // ignore
    }
  };

  if (!content.trim()) return null;

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html: documentHtml }}
        style={[styles.web, { height }]}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        setSupportMultipleWindows={false}
        hideKeyboardAccessoryView
        onMessage={onMessage}
        onLoadEnd={() => {
          readyRef.current = true;
          webRef.current?.injectJavaScript(
            `window.setMarkdownHtml(${JSON.stringify(bodyHtml)}); true;`,
          );
        }}
        onShouldStartLoadWithRequest={(request) => {
          const { url } = request;
          if (
            url.startsWith("http://") ||
            url.startsWith("https://") ||
            url.startsWith("mailto:")
          ) {
            void Linking.openURL(url);
            return false;
          }
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  web: {
    width: "100%",
    backgroundColor: "transparent",
    opacity: 0.99,
  },
});
