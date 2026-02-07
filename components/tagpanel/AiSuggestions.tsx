import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import type { Tag, SelectionDetails } from "../types";
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';
import { getContrastingTextColor } from "../../utils";

interface AiSuggestionsProps {
  selection: SelectionDetails | null;
  onGetSuggestions: () => void;
  suggestions: Tag[];
  isLoading: boolean;
  error: string | null;
  onApplyTag: (tagId: string) => void;
}

const spinAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Container = styled.div`
  margin-bottom: ${SPACING.lg};
  padding: ${SPACING.md};
  border: 1px dashed ${COLORS.info};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.info}1A;
`;

const Title = styled.h4`
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.dark};
  margin: 0 0 ${SPACING.sm} 0;
`;

const SelectionInfo = styled.p`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  margin: 0 0 ${SPACING.sm} 0;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const SuggestionButton = styled.button`
  padding: ${SPACING.sm} ${SPACING.lg};
  width: 100%;
  background-color: ${COLORS.info};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  font-size: ${FONTS.sizeSmall};

  &:hover:not(:disabled) {
    background-color: ${COLORS.infoHover};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    background-color: ${COLORS.gray400};
    cursor: not-allowed;
    opacity: 0.8;
  }
`;

const LoadingSpinner = styled.div`
  border: 3px solid ${COLORS.gray200};
  border-top: 3px solid ${COLORS.info};
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: ${spinAnimation} 1s linear infinite;
  margin: ${SPACING.sm} auto;
`;

const ErrorText = styled.p`
  color: ${COLORS.danger};
  font-size: ${FONTS.sizeSmall};
  margin-top: ${SPACING.sm};
  text-align: center;
  width: 100%;
`;

const SuggestionsContainer = styled.div`
  margin-top: ${SPACING.sm};
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.sm};
`;

const SuggestionPill = styled.button`
  padding: ${SPACING.xs} ${SPACING.md};
  border-radius: 12px;
  font-size: ${FONTS.sizeSmall};
  margin: 0;
  display: inline-block;
  white-space: nowrap;
  border: 1px solid rgba(0,0,0,0.1);
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;

  &:hover {
    opacity: 0.85;
    transform: translateY(-1px);
    box-shadow: ${SHADOWS.small};
  }
`;

const NoSuggestionsText = styled.p`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLighter};
  margin: ${SPACING.sm} 0 0 0;
  text-align: center;
`;

const AiSuggestions: React.FC<AiSuggestionsProps> = ({
  selection,
  onGetSuggestions,
  suggestions,
  isLoading,
  error,
  onApplyTag,
}) => {
  if (!selection) {
    return null;
  }

  const hasSuggestionsOrHasBeenQueried = suggestions.length > 0 || isLoading || error !== null;

  return (
    <Container>
      <Title>AI 建议</Title>
      <SelectionInfo title={selection.text}>
        已选择: "{selection.text}"
      </SelectionInfo>

      {!hasSuggestionsOrHasBeenQueried && (
        <SuggestionButton onClick={onGetSuggestions} disabled={isLoading}>
          {isLoading ? '分析中...' : 'AI 建议标签'}
        </SuggestionButton>
      )}
      
      {isLoading && <LoadingSpinner aria-label="AI 正在分析" />}
      
      {error && <ErrorText>{error}</ErrorText>}

      {!isLoading && !error && hasSuggestionsOrHasBeenQueried && (
        suggestions.length > 0 ? (
          <SuggestionsContainer>
            {suggestions.map(tag => (
              <SuggestionPill
                key={tag.id}
                style={{
                  backgroundColor: tag.color,
                  color: getContrastingTextColor(tag.color),
                }}
                onClick={() => onApplyTag(tag.id)}
                title={`应用标签: ${tag.name}`}
              >
                {tag.name}
              </SuggestionPill>
            ))}
          </SuggestionsContainer>
        ) : (
          <NoSuggestionsText>AI 未找到合适的标签建议。</NoSuggestionsText>
        )
      )}
    </Container>
  );
};

export default AiSuggestions;
