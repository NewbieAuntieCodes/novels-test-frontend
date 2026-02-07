import React, { useState } from 'react';
import styled from '@emotion/styled';
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS } from '../../styles';
import type { Novel } from '../types';

interface DeleteChaptersModalProps {
  isOpen: boolean;
  novel: Novel | null;
  onClose: () => void;
  onConfirm: (novelId: string, keepChapterCount: number) => Promise<void>;
}

const ModalOverlay = styled.div<{ isOpen: boolean }>`
  display: ${props => (props.isOpen ? 'flex' : 'none')};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: ${COLORS.white};
  padding: ${SPACING.xl};
  border-radius: ${BORDERS.radius};
  box-shadow: ${SHADOWS.large};
  min-width: 400px;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: ${SPACING.lg};
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
`;

const ModalText = styled.p`
  margin: 0;
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.text};
  line-height: 1.6;
`;

const WarningText = styled.p`
  margin: 0;
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.danger};
  font-weight: 500;
  line-height: 1.6;
`;

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.sm};
`;

const InputLabel = styled.label`
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.text};
  font-weight: 500;
`;

const NumberInput = styled.input`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeBase};

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${SPACING.md};
  margin-top: ${SPACING.md};
`;

const BaseButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  font-size: ${FONTS.sizeBase};
  transition: background-color 0.2s, box-shadow 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelButton = styled(BaseButton)`
  background-color: ${COLORS.gray300};
  color: ${COLORS.dark};

  &:hover:not(:disabled) {
    background-color: ${COLORS.gray400};
  }
`;

const ConfirmButton = styled(BaseButton)`
  background-color: ${COLORS.danger};
  color: ${COLORS.white};

  &:hover:not(:disabled) {
    background-color: ${COLORS.dangerHover};
    box-shadow: ${SHADOWS.small};
  }
`;

const ChapterInfo = styled.div`
  padding: ${SPACING.md};
  background-color: ${COLORS.gray100};
  border-radius: ${BORDERS.radius};
  border-left: 3px solid ${COLORS.info};
`;

const InfoText = styled.p`
  margin: ${SPACING.xs} 0;
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const DeleteChaptersModal: React.FC<DeleteChaptersModalProps> = ({
  isOpen,
  novel,
  onClose,
  onConfirm,
}) => {
  const [keepChapterCount, setKeepChapterCount] = useState<number>(4);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalChapters = novel?.chapters?.length || 0;
  const willDeleteCount = totalChapters - keepChapterCount;

  const handleConfirm = async () => {
    if (!novel || keepChapterCount < 1 || keepChapterCount >= totalChapters) {
      return;
    }

    try {
      setIsProcessing(true);
      await onConfirm(novel.id, keepChapterCount);
      onClose();
      setKeepChapterCount(4); // Reset for next time
    } catch (error) {
      console.error('删除章节失败:', error);
      alert('删除章节失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isProcessing) {
      onClose();
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClick={handleOverlayClick}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalTitle>删除后续章节</ModalTitle>

        <ModalText>
          小说：<strong>{novel?.title}</strong>
        </ModalText>

        <ChapterInfo>
          <InfoText>总章节数：{totalChapters} 章</InfoText>
          <InfoText>将保留：前 {keepChapterCount} 章</InfoText>
          <InfoText>将删除：第 {keepChapterCount + 1} 章及之后的所有内容（共 {willDeleteCount} 章）</InfoText>
        </ChapterInfo>

        <InputContainer>
          <InputLabel htmlFor="keep-chapter-count">
            保留章节数量：
          </InputLabel>
          <NumberInput
            id="keep-chapter-count"
            type="number"
            min={1}
            max={totalChapters - 1}
            value={keepChapterCount}
            onChange={(e) => setKeepChapterCount(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={isProcessing}
          />
        </InputContainer>

        <WarningText>
          ⚠️ 警告：此操作将删除指定章节之后的所有正文、标注和剧情锚点，且不可撤销！
        </WarningText>

        <WarningText>
          建议：操作前已自动备份数据库到 backend/prisma/ 目录
        </WarningText>

        <ButtonGroup>
          <CancelButton onClick={onClose} disabled={isProcessing}>
            取消
          </CancelButton>
          <ConfirmButton
            onClick={handleConfirm}
            disabled={isProcessing || keepChapterCount < 1 || keepChapterCount >= totalChapters}
          >
            {isProcessing ? '删除中...' : '确认删除'}
          </ConfirmButton>
        </ButtonGroup>
      </ModalContent>
    </ModalOverlay>
  );
};

export default DeleteChaptersModal;
