import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { DOMParser as ProseMirrorDOMParser } from 'prosemirror-model';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Chapter } from '../../types';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS, globalPlaceholderTextStyles } from '../../styles';

interface ChapterRichTextEditorProps {
  chapter: Chapter | null;
  onSave: (html: string) => Promise<void>;
  placeholder?: string;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
  min-height: 0;
  height: 100%;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${SPACING.sm};
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => (props.$variant === 'primary' ? COLORS.primary : COLORS.border)};
  background: ${props => (props.$variant === 'primary' ? COLORS.primary : COLORS.white)};
  color: ${props => (props.$variant === 'primary' ? COLORS.white : COLORS.text)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  white-space: nowrap;
  transition: background-color 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    box-shadow: ${SHADOWS.small};
    background: ${props => (props.$variant === 'primary' ? COLORS.primaryHover : COLORS.gray100)};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.xs};
  padding: ${SPACING.xs};
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  background: ${COLORS.white};
`;

const ToolButton = styled.button<{ $active?: boolean }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => (props.$active ? COLORS.primary : COLORS.border)};
  background: ${props => (props.$active ? COLORS.primary : COLORS.white)};
  color: ${props => (props.$active ? COLORS.white : COLORS.text)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  transition: background-color 0.2s, box-shadow 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    box-shadow: ${SHADOWS.small};
    background: ${props => (props.$active ? COLORS.primaryHover : COLORS.gray100)};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const EditorFrame = styled.div`
  width: 100%;
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  background-color: ${COLORS.white};
  flex: 1;
  min-height: 0;
  overflow: auto;

  & .ProseMirror {
    padding: ${SPACING.sm};
    min-height: 100%;
    outline: none;
    font-size: ${FONTS.sizeSmall};
    line-height: 1.7;
    color: ${COLORS.text};
  }

  & .ProseMirror p {
    margin: 0 0 ${SPACING.sm} 0;
  }

  & .ProseMirror p:last-child {
    margin-bottom: 0;
  }

  & .ProseMirror h1,
  & .ProseMirror h2,
  & .ProseMirror h3,
  & .ProseMirror h4,
  & .ProseMirror h5,
  & .ProseMirror h6 {
    margin: ${SPACING.md} 0 ${SPACING.sm} 0;
    line-height: 1.4;
  }

  & .ProseMirror ul,
  & .ProseMirror ol {
    margin: 0 0 ${SPACING.sm} 0;
    padding-left: 1.5em;
  }

  & .ProseMirror li > p {
    margin: 0;
  }
`;

const PlaceholderText = styled.div(globalPlaceholderTextStyles);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const plainTextToHtml = (text: string) => {
  const safe = escapeHtml(text);
  const withBreaks = safe.replace(/\n/g, '<br />');
  return `<p>${withBreaks}</p>`;
};

const getInitialHtml = (chapter: Chapter | null) => {
  const html = chapter?.htmlContent || '';
  if (html.trim()) return html;
  const plain = chapter?.content || '';
  if (!plain.trim()) return '';
  return plainTextToHtml(plain);
};

const isObviouslyMarkdown = (text: string) => {
  const normalized = (text || '').replace(/\r\n|\r/g, '\n');
  if (!normalized.trim()) return false;

  // 强特征：标题 / 列表 / 引用 / 代码块 / 分割线 / 链接
  if (/(^|\n)\s{0,3}#{1,6}\s+\S/.test(normalized)) return true;
  if (/(^|\n)\s{0,3}>\s+\S/.test(normalized)) return true;
  if (/(^|\n)\s{0,3}([-*+]|(\d{1,3}\.))\s+\S/.test(normalized)) return true;
  if (/```[\s\S]*```/.test(normalized)) return true;
  if (/(^|\n)\s{0,3}([-*_]\s*){3,}\s*(\n|$)/.test(normalized)) return true;
  if (/\[[^\]]+\]\([^)]+\)/.test(normalized)) return true;

  return false;
};

const normalizeMarkdownForPaste = (text: string) => {
  const normalized = (text || '').replace(/\r\n|\r/g, '\n').replace(/\u00A0/g, ' ');
  const lines = normalized.split('\n');
  const output: string[] = [];
  let inFence = false;
  let blankCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      output.push(line);
      blankCount = 0;
      continue;
    }

    if (!inFence) {
      // 去掉“空的列表项”，避免出现 1./3./5. 这种空行编号
      if (/^(?:\d{1,3}\.|[-*+])$/.test(trimmed)) {
        continue;
      }

      // 统一有序列表编号（Markdown 中数字本身不重要），避免从 2/4 开始导致显示怪异
      const normalizedOrderedListLine = line.replace(/^(\s*)\d{1,3}\.(\s+)/, '$11.$2');

      if (!normalizedOrderedListLine.trim()) {
        blankCount += 1;
        if (blankCount > 1) continue;
        output.push('');
      } else {
        blankCount = 0;
        output.push(normalizedOrderedListLine);
      }

      continue;
    }

    output.push(line);
  }

  return output.join('\n').trimEnd();
};

const isTrivialHtml = (html: string) => {
  const raw = (html || '').trim();
  if (!raw) return true;
  // 仅用于判断是否“只是把纯文本包了一层 HTML”，避免把已经有格式的 HTML 再当 Markdown 转换
  return !/<(h[1-6]|ul|ol|li|blockquote|pre|code|table|thead|tbody|tr|td|th|a|img|strong|b|em|i|hr)\b/i.test(raw);
};

const sanitizeRichHtml = (html: string) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'hr',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'img',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
  });
};

const ChapterRichTextEditor: React.FC<ChapterRichTextEditorProps> = ({ chapter, onSave, placeholder }) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialContent = useMemo(() => getInitialHtml(chapter), [chapter?.id]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: true }),
      Image,
      Placeholder.configure({
        placeholder: placeholder || '在这里写章节内容…',
      }),
    ],
    content: initialContent,
    editorProps: {
      handlePaste(view, event) {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;

        const html = clipboard.getData('text/html') || '';
        const markdown = clipboard.getData('text/markdown') || '';
        const text = clipboard.getData('text/plain') || '';
        const sourceText = markdown || text;
        const normalizedMarkdown = normalizeMarkdownForPaste(sourceText);

        const insertHtml = (rawHtml: string) => {
          const parser = ProseMirrorDOMParser.fromSchema(view.state.schema);
          const wrapper = document.createElement('div');
          wrapper.innerHTML = rawHtml;
          const slice = parser.parseSlice(wrapper, { preserveWhitespace: 'full' });
          view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
        };

        // Shift+粘贴：强制纯文本（不解析 Markdown，也不走 HTML 粘贴）
        if (event.shiftKey) {
          event.preventDefault();
          insertHtml(plainTextToHtml(sourceText));
          return true;
        }

        // HTML 已经有格式：交给默认粘贴逻辑处理（保留编辑器支持的格式）
        if (html && !isTrivialHtml(html)) {
          return false;
        }

        // 仅在“明显是 Markdown”时才转换
        if (isObviouslyMarkdown(normalizedMarkdown)) {
          event.preventDefault();
          const rendered =
            typeof marked.parse === 'function'
              ? marked.parse(normalizedMarkdown, { gfm: true, breaks: true })
              : normalizedMarkdown;
          const clean = sanitizeRichHtml(String(rendered));
          insertHtml(clean);
          return true;
        }

        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(getInitialHtml(chapter), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.id]);

  const insertImageFile = () => {
    imageInputRef.current?.click();
  };

  const handleImageInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && editor) {
        editor.chain().focus().setImage({ src: result }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!editor || !chapter) return;
    setIsSaving(true);
    try {
      await onSave(editor.getHTML());
    } finally {
      setIsSaving(false);
    }
  };

  if (!chapter) {
    return <PlaceholderText>请先在左侧选择章节，或点击“新建章节”。</PlaceholderText>;
  }

  return (
    <Container>
      <HeaderRow>
        <Button type="button" $variant="primary" onClick={handleSave} disabled={!editor || isSaving}>
          {isSaving ? '保存中…' : '保存'}
        </Button>
      </HeaderRow>

      <Toolbar>
        <ToolButton
          type="button"
          $active={editor?.isActive('heading', { level: 1 })}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={!editor}
        >
          标题
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('heading', { level: 2 })}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={!editor}
        >
          副标题
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('bold')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor}
        >
          加粗
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('italic')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor}
        >
          斜体
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('bulletList')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={!editor}
        >
          无序
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('orderedList')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={!editor}
        >
          有序
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('blockquote')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          disabled={!editor}
        >
          引用
        </ToolButton>
        <ToolButton
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={!editor}
        >
          分割线
        </ToolButton>
        <ToolButton type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertImageFile} disabled={!editor}>
          图片
        </ToolButton>
        <ToolButton type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().undo().run()} disabled={!editor}>
          撤销
        </ToolButton>
        <ToolButton type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().redo().run()} disabled={!editor}>
          重做
        </ToolButton>
        <ToolButton
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
          disabled={!editor}
        >
          清除格式
        </ToolButton>
      </Toolbar>

      <EditorFrame>{editor ? <EditorContent editor={editor} /> : <PlaceholderText>正在加载编辑器…</PlaceholderText>}</EditorFrame>
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageInputChange} style={{ display: 'none' }} />
    </Container>
  );
};

export default ChapterRichTextEditor;
