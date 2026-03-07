
import React, { useState, CSSProperties } from 'react';
import type { Novel } from '../types';
import { COLORS, SPACING, FONTS, baseButtonStyles, baseButtonHoverStyles, baseInputStyles, baseInputFocusStyles, inputGroupStyles } from '../styles';


interface NovelSelectorProps {
  novels: Novel[];
  selectedNovelId: string | null;
  onCreateNovel: (title: string) => Promise<string | undefined>;
  onUploadNovel: (title: string, text: string) => Promise<string | null | undefined>;
  onSelectNovel: (id: string) => void;
}

const styles: { [key: string]: CSSProperties } = {
  novelSelector: {
    padding: SPACING.md,
    border: `1px solid ${COLORS.border}`,
    borderRadius: FONTS.sizeSmall,
    backgroundColor: COLORS.panelBackground, // Consistent with other panels
  },
  title: {
    fontSize: FONTS.sizeH3,
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  novelActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  inputGroup: { ...inputGroupStyles },
  textInput: { ...baseInputStyles, flexGrow: 1 },
  createButton: { ...baseButtonStyles },
  uploadButton: { ...baseButtonStyles, backgroundColor: COLORS.success },
  uploadButtonHover: { backgroundColor: COLORS.successHover },
  fileInputHidden: { display: 'none' },
  novelSelectDropdown: {
    ...baseInputStyles, // Use base input styles for select
    marginTop: SPACING.md,
    width: '100%',
  },
};


const NovelSelector: React.FC<NovelSelectorProps> = ({ novels, selectedNovelId, onCreateNovel, onUploadNovel, onSelectNovel }) => {
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [isCreateHovered, setIsCreateHovered] = useState(false);
  const [isUploadHovered, setIsUploadHovered] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleCreate = async () => {
    if (newNovelTitle.trim()) {
      try {
        await onCreateNovel(newNovelTitle.trim());
        setNewNovelTitle('');
      } catch (error) {
        console.error('创建小说失败', error);
        alert('创建小说失败，请重试');
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const title = file.name.replace(/\.[^/.]+$/, "");
          if (text !== null && text !== undefined) {
             onUploadNovel(title || "未命名小说", text).catch(err => {
               console.error('上传小说失败', err);
               alert('上传小说失败，请重试');
             });
          } else {
            alert("文件内容为空或读取失败。");
          }
        };
        reader.onerror = () => alert("读取文件时出错。");
        reader.readAsText(file);
      } else {
        alert("请上传 .txt 格式的文本文件。");
      }
      event.target.value = '';
    }
  };

  return (
    <div style={styles.novelSelector}>
      <h3 style={styles.title}>我的小说 (Selector)</h3>
      <div style={styles.novelActions}>
        <div style={styles.inputGroup}>
          <input
            type="text"
            value={newNovelTitle}
            onChange={(e) => setNewNovelTitle(e.target.value)}
            placeholder="新的小说标题"
            aria-label="新的小说标题"
            style={{...styles.textInput, ...(focusedField === 'newNovelTitleSel' && baseInputFocusStyles)}}
            onFocus={() => setFocusedField('newNovelTitleSel')}
            onBlur={() => setFocusedField(null)}
          />
          <button 
            onClick={handleCreate} 
            style={{...styles.createButton, ...(isCreateHovered && baseButtonHoverStyles)}}
            onMouseEnter={() => setIsCreateHovered(true)}
            onMouseLeave={() => setIsCreateHovered(false)}
          >
            创建小说
          </button>
        </div>
        <div style={styles.inputGroup}>
          <input
            type="file"
            id="novel-file-input-selector" // Unique ID
            accept=".txt,text/plain"
            onChange={handleFileChange}
            style={styles.fileInputHidden}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => document.getElementById('novel-file-input-selector')?.click()}
            aria-label="上传小说文件"
            style={{...styles.uploadButton, ...(isUploadHovered && styles.uploadButtonHover)}}
            onMouseEnter={() => setIsUploadHovered(true)}
            onMouseLeave={() => setIsUploadHovered(false)}
          >
            上传小说文件 (.txt)
          </button>
        </div>
      </div>
      {novels.length > 0 && (
        <select
            value={selectedNovelId || ''}
            onChange={(e) => { if (e.target.value) onSelectNovel(e.target.value); }}
            aria-label="选择一本小说"
            style={{...styles.novelSelectDropdown, ...(focusedField === 'novelSelectDropdown' && baseInputFocusStyles)}}
            onFocus={() => setFocusedField('novelSelectDropdown')}
            onBlur={() => setFocusedField(null)}
        >
          <option value="" disabled={!selectedNovelId}>选择一本小说...</option>
          {novels.map(novel => (
            <option key={novel.id} value={novel.id}>{novel.title}</option>
          ))}
        </select>
      )}
    </div>
  );
};

export default NovelSelector;
