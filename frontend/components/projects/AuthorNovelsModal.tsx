import React from 'react';
import styled from '@emotion/styled';
import type { Novel } from '../types';
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS } from '../../styles';

interface AuthorNovelsModalProps {
  isOpen: boolean;
  authorName: string;
  novels: Novel[];
  onClose: () => void;
  onSelectNovel: (novelId: string) => void;
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
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h2`
  margin: 0 0 ${SPACING.lg} 0;
  font-size: ${FONTS.sizeH2};
  color: ${COLORS.dark};
`;

const NovelList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const NovelItem = styled.li`
  padding: ${SPACING.md};
  border-bottom: 1px solid ${COLORS.gray200};
  transition: background-color 0.15s;

  &:hover {
    background-color: ${COLORS.gray100};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const NovelLink = styled.span`
  font-size: ${FONTS.sizeLarge};
  color: ${COLORS.primary};
  cursor: pointer;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

const NovelMeta = styled.div`
  margin-top: ${SPACING.xs};
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const EmptyMessage = styled.p`
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeBase};
  text-align: center;
  padding: ${SPACING.xl} 0;
`;

const CloseButton = styled.button`
  margin-top: ${SPACING.lg};
  padding: ${SPACING.sm} ${SPACING.lg};
  background-color: ${COLORS.gray300};
  color: ${COLORS.dark};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  font-size: ${FONTS.sizeBase};
  transition: background-color 0.2s;
  width: 100%;

  &:hover {
    background-color: ${COLORS.gray400};
  }
`;

const AuthorNovelsModal: React.FC<AuthorNovelsModalProps> = ({
  isOpen,
  authorName,
  novels,
  onClose,
  onSelectNovel,
}) => {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleNovelClick = (novelId: string) => {
    onSelectNovel(novelId);
    onClose();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClick={handleOverlayClick}>
      <ModalContent>
        <ModalTitle>作者：{authorName}</ModalTitle>
        {novels.length === 0 ? (
          <EmptyMessage>该作者暂无其他小说</EmptyMessage>
        ) : (
          <NovelList>
            {novels.map(novel => (
              <NovelItem key={novel.id}>
                <NovelLink onClick={() => handleNovelClick(novel.id)}>
                  {novel.title}
                </NovelLink>
                {(novel.category || novel.subcategory) && (
                  <NovelMeta>
                    {novel.category && `${novel.category}`}
                    {novel.category && novel.subcategory && ' / '}
                    {novel.subcategory && `${novel.subcategory}`}
                  </NovelMeta>
                )}
              </NovelItem>
            ))}
          </NovelList>
        )}
        <CloseButton onClick={onClose}>关闭</CloseButton>
      </ModalContent>
    </ModalOverlay>
  );
};

export default AuthorNovelsModal;
