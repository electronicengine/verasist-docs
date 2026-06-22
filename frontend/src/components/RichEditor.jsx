import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
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

export default function RichEditor({ value, onChange, placeholder = "İçeriği yazın..." }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noreferrer" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
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
        <Btn
          label="Başlık 2"
          testid="editor-h2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-4 h-4" />
        </Btn>
        <Btn
          label="Başlık 3"
          testid="editor-h3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
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
    </div>
  );
}
