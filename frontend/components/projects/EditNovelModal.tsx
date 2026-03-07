import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS } from '../../styles';

interface EditNovelModalProps {
  isOpen: boolean;
  novelTitle: string;
  novelAuthor: string | null | undefined;
  onClose: () => void;
  onSave: (title: string, author: string) => Promise<void>;
}

const ModalOverlay = styled.div<{ isOpen: boolean }>`
  display: ${props => (props.isOpen ? 'flex' : 'none')};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: ${COLORS.white};
  padding: ${SPACING.xl};
  border-radius: ${SPACING.md};
  box-shadow: ${SHADOWS.large};
  min-width: 400px;
  max-width: 500px;
`;

const ModalTitle = styled.h2`
  margin: 0 0 ${SPACING.lg} 0;
  font-size: ${FONTS.sizeH2};
  color: ${COLORS.dark};
`;

const FormGroup = styled.div`
  margin-bottom: ${SPACING.lg};
`;

const Label = styled.label`
  display: block;
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.text};
  margin-bottom: ${SPACING.sm};
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};
  box-sizing: border-box;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${SPACING.md};
  justify-content: flex-end;
  margin-top: ${SPACING.xl};
`;

const BaseButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: ${FONTS.sizeBase};
`;

const CancelButton = styled(BaseButton)`
  background-color: ${COLORS.gray300};
  color: ${COLORS.dark};

  &:hover {
    background-color: ${COLORS.gray400};
  }
`;

const SaveButton = styled(BaseButton)`
  background-color: ${COLORS.primary};
  color: ${COLORS.white};

  &:hover:not(:disabled) {
    background-color: ${COLORS.primaryHover};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray300};
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const ErrorMessage = styled.div`
  color: ${COLORS.danger};
  font-size: ${FONTS.sizeSmall};
  margin-top: ${SPACING.sm};
  padding: ${SPACING.sm};
  background-color: ${COLORS.danger}10;
  border-radius: ${BORDERS.radius};
  border: 1px solid ${COLORS.danger}40;
`;

const EditNovelModal: React.FC<EditNovelModalProps> = ({
  isOpen,
  novelTitle,
  novelAuthor,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(novelTitle);
  const [author, setAuthor] = useState(novelAuthor || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(novelTitle);
      setAuthor(novelAuthor || '');
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, novelTitle, novelAuthor]);

  const handleSave = async () => {
    if (title.trim()) {
      setIsSaving(true);
      setError(null);
      try {
        await onSave(title.trim(), author.trim());
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存失败，请重试');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClick={handleOverlayClick}>
      <ModalContent>
        <ModalTitle>编辑小说信息</ModalTitle>
        <FormGroup>
          <Label htmlFor="novel-title">小说标题</Label>
          <Input
            id="novel-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入小说标题"
            disabled={isSaving}
          />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="novel-author">作者</Label>
          <Input
            id="novel-author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="输入作者名称（可选）"
            disabled={isSaving}
          />
        </FormGroup>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <ButtonGroup>
          <CancelButton onClick={onClose} disabled={isSaving}>
            取消
          </CancelButton>
          <SaveButton onClick={handleSave} disabled={!title.trim() || isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </SaveButton>
        </ButtonGroup>
      </ModalContent>
    </ModalOverlay>
  );
};

export default EditNovelModal;
