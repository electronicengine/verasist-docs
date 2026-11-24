import { Children, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCode } from "@/lib/codePanels";
import "./VeraMarkdown.css";

function CodeBlock({ children, lang }) {
  const code = Children.toArray(children)[0];
  const source = typeof code?.props?.children === "string" ? code.props.children : "";
  const language = code?.props?.className?.match(/language-([\w+-]+)/)?.[1] || "";
  const highlighted = useMemo(() => highlightCode(source, language), [source, language]);
  const [status, setStatus] = useState("");
  const en = lang === "en";
  useEffect(() => { setStatus(""); }, [source]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return <div className="vera-code-block">
    <div className="vera-code-header">
      <span className="vera-code-language">{language || (en ? "Code" : "Kod")}</span>
      <button type="button" onClick={copy} aria-label={en ? "Copy code" : "Kodu kopyala"}>
        {status === "copied" ? (en ? "Copied" : "Kopyalandı") : (en ? "Copy" : "Kopyala")}
      </button>
      <span className="sr-only" role="status">{status === "copied"
        ? (en ? "Code copied" : "Kod kopyalandı")
        : status === "failed" ? (en ? "Copy failed; select the code to copy it" : "Kopyalanamadı; kodu seçerek kopyalayın") : ""}</span>
    </div>
    <pre tabIndex={0} aria-label={language || (en ? "Code" : "Kod")}>
      {highlighted === null ? children : <code className={`hljs language-${language}`}
        // Only highlight.js output is HTML; it escapes the original code.
        dangerouslySetInnerHTML={{ __html: highlighted }} />}
    </pre>
  </div>;
}

const components = {
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  // Do not load remote images from model-generated URLs.
  img: ({ alt }) => <span>{alt}</span>,
};

export default function VeraMarkdown({ children, lang = "tr" }) {
  const renderers = useMemo(() => ({
    ...components,
    table: ({ children }) => <div className="vera-table-scroll" tabIndex={0} role="region" aria-label={lang === "en" ? "Table" : "Tablo"}><table>{children}</table></div>,
    pre: ({ children }) => <CodeBlock lang={lang}>{children}</CodeBlock>,
  }), [lang]);
  return <div className="vera-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={renderers} skipHtml>{children}</ReactMarkdown></div>;
}
