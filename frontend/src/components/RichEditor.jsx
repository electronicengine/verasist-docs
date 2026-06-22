import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useEffect, useState, useRef } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Code2,
  Undo,
  Redo,
  Palette,
} from "lucide-react";

function Btn({ active, onClick, label, children, testid }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      data-testid={testid}
      onClick={onClick}
      className={`p-2 rounded transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "hover:bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const COLORS = [
  { name: "Varsayılan", value: null },
  { name: "Marka", value: "#2B50B8" },
  { name: "Mavi", value: "#4B6FD4" },
  { name: "Açık mavi", value: "#7D9EF0" },
  { name: "Yeşil", value: "#16a34a" },
  { name: "Turuncu", value: "#f97316" },
  { name: "Kırmızı", value: "#dc2626" },
  { name: "Mor", value: "#8b5cf6" },
  { name: "Gri", value: "#64748b" },
];

function cleanWordHtml(html) {
  if (!html) return html;
  // Remove MS Office conditional comments
  html = html.replace(/<!--\[if[\s\S]*?\[endif\]-->/g, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  // Strip Word-specific tags
  html = html.replace(/<\/?(o:p|w:[a-z]+|m:[a-z]+|v:[a-z]+)[^>]*>/gi, "");
  // Remove mso-* inline style declarations
  html = html.replace(/style="([^"]*)"/gi, (m, styles) => {
    const cleaned = styles
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !/^mso-/i.test(s) && !/font-family/i.test(s))
      .join("; ");
    return cleaned ? `style="${cleaned}"` : "";
  });
  // Remove class names that look like MsoNormal
  html = html.replace(/class="Mso[^"]*"/gi, "");
  return html;
}

export default function RichEditor({ value, onChange, placeholder = "İçeriği yazın..." }) {
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (colorRef.current && !colorRef.current.contains(e.target)) setColorOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noreferrer" } }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      transformPastedHTML: (html) => cleanWordHtml(html),
    },
  });

  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Bağlantı URL'si:");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const setColor = (c) => {
    if (c) editor.chain().focus().setColor(c).run();
    else editor.chain().focus().unsetColor().run();
    setColorOpen(false);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface" data-testid="rich-editor">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-secondary/40">
        <Btn label="Geri" testid="editor-undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="w-4 h-4" />
        </Btn>
        <Btn label="İleri" testid="editor-redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="w-4 h-4" />
        </Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn label="Başlık 2" testid="editor-h2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-4 h-4" />
        </Btn>
        <Btn label="Başlık 3" testid="editor-h3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="w-4 h-4" />
        </Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn label="Kalın" testid="editor-bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-4 h-4" />
        </Btn>
        <Btn label="İtalik" testid="editor-italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-4 h-4" />
        </Btn>
        <Btn label="Üstü çizili" testid="editor-strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="w-4 h-4" />
        </Btn>
        <Btn label="Satır içi kod" testid="editor-code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code className="w-4 h-4" />
        </Btn>

        {/* Color picker */}
        <div className="relative" ref={colorRef}>
          <Btn label="Yazı rengi" testid="editor-color" active={editor.isActive("textStyle")} onClick={() => setColorOpen((v) => !v)}>
            <Palette className="w-4 h-4" />
          </Btn>
          {colorOpen && (
            <div
              className="absolute z-50 top-full mt-1 left-0 p-2 rounded-lg border border-border bg-popover shadow-lg grid grid-cols-3 gap-1.5 w-44"
              data-testid="color-palette"
            >
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.value)}
                  title={c.name}
                  className="flex flex-col items-center gap-1 p-1.5 rounded hover:bg-secondary text-xs"
                  data-testid={`color-${c.name}`}
                >
                  <span
                    className="w-6 h-6 rounded-full border border-border"
                    style={{ background: c.value || "transparent" }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border mx-1" />
        <Btn label="Madde işaretli liste" testid="editor-ul" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </Btn>
        <Btn label="Numaralı liste" testid="editor-ol" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-4 h-4" />
        </Btn>
        <Btn label="Alıntı" testid="editor-blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="w-4 h-4" />
        </Btn>
        <Btn label="Kod bloğu" testid="editor-codeblock" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code2 className="w-4 h-4" />
        </Btn>
        <Btn label="Bağlantı" testid="editor-link" active={editor.isActive("link")} onClick={addLink}>
          <LinkIcon className="w-4 h-4" />
        </Btn>
      </div>
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
      <div className="px-4 py-2 border-t border-border bg-secondary/30 text-[11px] text-muted-foreground">
        💡 Word'den kopyala-yapıştır destekli — biçimler otomatik temizlenir.
      </div>
    </div>
  );
}
