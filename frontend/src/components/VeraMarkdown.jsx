import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./VeraMarkdown.css";

const components = {
  table: ({ children }) => <div className="vera-table-scroll" tabIndex={0}><table>{children}</table></div>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  // Do not load remote images from model-generated URLs.
  img: ({ alt }) => <span>{alt}</span>,
};

export default function VeraMarkdown({ children }) {
  return <div className="vera-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>{children}</ReactMarkdown></div>;
}
