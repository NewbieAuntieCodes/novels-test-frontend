import React, { useEffect, useMemo, useRef } from 'react';
import styled from '@emotion/styled';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { DOMParser as ProseMirrorDOMParser } from 'prosemirror-model';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Note } from '../../types';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS, globalPlaceholderTextStyles } from '../../styles';

interface NoteEditorProps {
  note: Note | null;
  isSaving?: boolean;
  error?: string | null;
  onSave: (html: string) => Promise<void>;
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
  align-items: flex-start;
  justify-content: space-between;
  gap: ${SPACING.sm};
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.xs};
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  word-break: break-word;
`;

const Meta = styled.div`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const Button = styled.button<{ $variant?: 'primary' | 'danger' | 'secondary' }>`
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => {
    if (props.$variant === 'danger') return COLORS.danger;
    if (props.$variant === 'primary') return COLORS.primary;
    return COLORS.border;
  }};
  background: ${props => {
    if (props.$variant === 'danger') return COLORS.danger;
    if (props.$variant === 'primary') return COLORS.primary;
    return COLORS.white;
  }};
  color: ${props => (props.$variant === 'secondary' ? COLORS.text : COLORS.white)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  white-space: nowrap;
  transition: background-color 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    box-shadow: ${SHADOWS.small};
    background: ${props => {
      if (props.$variant === 'danger') return COLORS.dangerHover;
      if (props.$variant === 'primary') return COLORS.primaryHover;
      return COLORS.gray100;
    }};
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
  const safe = escapeHtml(text || '');
  const withBreaks = safe.replace(/\n/g, '<br />');
  return `<p>${withBreaks}</p>`;
};

const isObviouslyMarkdown = (text: string) => {
  const normalized = (text || '').replace(/\r\n|\r/g, '\n');
  if (!normalized.trim()) return false;

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
      if (/^(?:\d{1,3}\.|[-*+])$/.test(trimmed)) {
        continue;
      }

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

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(
    d.getHours()
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const NoteEditor: React.FC<NoteEditorProps> = ({ note, isSaving, error, onSave }) => {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const initialContent = useMemo(() => note?.content || '', [note?.id]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: true }),
      Image,
      Placeholder.configure({
        placeholder: '在这里写笔记内容…',
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

        if (event.shiftKey) {
          event.preventDefault();
          insertHtml(plainTextToHtml(sourceText));
          return true;
        }

        if (html && !isTrivialHtml(html)) {
          return false;
        }

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
    editor.commands.setContent(note?.content || '', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

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

  if (!note) {
    return (
      <Container>
        <HeaderRow>
          <TitleBlock>
            <Title>笔记</Title>
            <Meta>请选择一个词条/卡片</Meta>
          </TitleBlock>
        </HeaderRow>
        <PlaceholderText>左侧选择一个词条，或点击“新建笔记”。</PlaceholderText>
      </Container>
    );
  }

  return (
    <Container>
      <HeaderRow>
        <TitleBlock>
          <Title>{note.title}</Title>
          <Meta>更新 {formatDateTime(note.updatedAt)}</Meta>
        </TitleBlock>
        <Button
          type="button"
          $variant="primary"
          onClick={() => editor && onSave(editor.getHTML())}
          disabled={!editor || Boolean(isSaving)}
        >
          {isSaving ? '保存中…' : '保存'}
        </Button>
      </HeaderRow>

      {error && <div style={{ color: COLORS.danger, fontSize: FONTS.sizeSmall }}>{error}</div>}

      <Toolbar>
        <ToolButton
          type="button"
          $active={editor?.isActive('heading', { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={!editor}
        >
          标题
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={!editor}
        >
          副标题
        </ToolButton>
        <ToolButton type="button" $active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} disabled={!editor}>
          加粗
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor}
        >
          斜体
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={!editor}
        >
          无序
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={!editor}
        >
          有序
        </ToolButton>
        <ToolButton
          type="button"
          $active={editor?.isActive('blockquote')}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          disabled={!editor}
        >
          引用
        </ToolButton>
        <ToolButton type="button" onClick={() => editor?.chain().focus().setHorizontalRule().run()} disabled={!editor}>
          分割线
        </ToolButton>
        <ToolButton type="button" onClick={insertImageFile} disabled={!editor}>
          图片
        </ToolButton>
        <ToolButton type="button" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor}>
          撤销
        </ToolButton>
        <ToolButton type="button" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor}>
          重做
        </ToolButton>
        <ToolButton type="button" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} disabled={!editor}>
          清除格式
        </ToolButton>
      </Toolbar>

      <EditorFrame>{editor ? <EditorContent editor={editor} /> : <PlaceholderText>正在加载编辑器…</PlaceholderText>}</EditorFrame>
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageInputChange} style={{ display: 'none' }} />
    </Container>
  );
};

export default NoteEditor;
