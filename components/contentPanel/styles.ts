import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import {
  COLORS,
  SPACING,
  FONTS,
  SHADOWS,
  panelStyles,
  globalPlaceholderTextStyles,
  BORDERS,
} from '../../styles';

export const Panel = styled.div({
  ...panelStyles,
  minWidth: '280px',
});

export const Title = styled.h2`
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
  margin-bottom: ${SPACING.md};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
`;

export const WordCount = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  font-weight: normal;
  margin-left: ${SPACING.md};
`;

export const ChildTagToggleButton = styled.button<{ isActive: boolean }>`
  padding: ${SPACING.xs} ${SPACING.md};
  font-size: ${FONTS.sizeSmall};
  border: 1px solid ${props => (props.isActive ? COLORS.primary : COLORS.gray300)};
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
  white-space: nowrap;
  background-color: ${props => (props.isActive ? COLORS.primary : COLORS.gray200)};
  color: ${props => (props.isActive ? COLORS.white : COLORS.text)};

  &:hover {
    background-color: ${props => (props.isActive ? COLORS.primaryHover : COLORS.gray300)};
  }
`;

export const FindOpenButton = styled.button`
  padding: ${SPACING.xs} ${SPACING.md};
  font-size: ${FONTS.sizeSmall};
  border: 1px solid ${COLORS.gray300};
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
  white-space: nowrap;
  background-color: ${COLORS.gray200};
  color: ${COLORS.text};

  &:hover {
    background-color: ${COLORS.gray300};
  }
`;

export const FindBarContainer = styled.div`
  position: absolute;
  top: ${SPACING.sm};
  right: ${SPACING.sm};
  z-index: 20;
  display: flex;
  align-items: center;
  gap: ${SPACING.xs};
  padding: ${SPACING.xs} ${SPACING.sm};
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.white};
  box-shadow: ${SHADOWS.small};
`;

export const FindInput = styled.input<{ hasError?: boolean }>`
  width: 200px;
  padding: ${SPACING.xs} ${SPACING.sm};
  font-size: ${FONTS.sizeSmall};
  border: 1px solid ${props => (props.hasError ? COLORS.danger : COLORS.gray300)};
  border-radius: ${BORDERS.radius};
  outline: none;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}30;
  }
`;

export const FindStatus = styled.span`
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
  min-width: 72px;
  text-align: center;
  user-select: none;
`;

export const FindIconButton = styled.button`
  width: 28px;
  height: 28px;
  border: 1px solid ${COLORS.gray300};
  border-radius: ${BORDERS.radius};
  background-color: ${COLORS.gray100};
  color: ${COLORS.text};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background-color: ${COLORS.gray200};
    border-color: ${COLORS.gray400};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const FindMark = styled.span<{ isActive?: boolean }>`
  background-color: rgba(255, 235, 59, 0.85);
  border-radius: 2px;
  padding: 0 1px;
  cursor: pointer;
  outline: ${props => (props.isActive ? `2px solid ${COLORS.primary}` : '2px solid transparent')};
  outline-offset: 1px;
`;

export const NovelInput = styled.textarea`
  width: 100%;
  padding: ${SPACING.md};
  border: 1px solid ${COLORS.border};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  margin-bottom: ${SPACING.md};
  font-family: inherit;
  font-size: ${FONTS.sizeBase};
  line-height: 1.6;
  resize: vertical;
  background-color: ${COLORS.white};

  /* Always grow to fill the available space in the panel */
  flex-grow: 1;
  /* Set a reasonable minimum height */
  min-height: 300px;

  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

export const ContentPreviewContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0; // for flexbox overflow fix
`;

export const ContentDisplay = styled.div<{ isFullNovelEditMode?: boolean; isDragOver?: boolean }>`
  border: 1px solid ${COLORS.borderLight};
  padding: ${SPACING.md};
  overflow-y: auto;
  background-color: ${COLORS.white};
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: ${FONTS.sizeBase};
  line-height: 1.6;
  border-radius: ${BORDERS.radius};
  user-select: text;
  position: relative;
  transition: background-color 0.2s, border-color 0.2s;

  /* Default styles */
  flex-grow: 1;
  min-height: 200px;

  /* Minimized styles when full novel is being edited above */
  ${props =>
    props.isFullNovelEditMode &&
    `
    flex-grow: 0;
    flex-shrink: 0;
    height: 35%; /* Occupy a smaller portion of the panel */
    max-height: 250px;
    min-height: 150px;
  `}

  /* Drag over styles */
  ${props =>
    props.isDragOver &&
    `
    background-color: ${COLORS.primary}10;
    border-color: ${COLORS.primary};
    border-width: 2px;
  `}
`;

export const AnnotatedSpan = styled.span<{ isMisaligned?: boolean }>`
  padding: 0.1em 0; /* Remove horizontal padding */
  border-radius: 3px;
  margin: 0; /* Remove margin */

  /* Use a consistent outline style and only change color to prevent reflow. */
  outline: 2px solid transparent;
  outline-style: solid; /* Explicitly set for all states */
  transition: outline-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out;

  ${props => {
    if (props.isMisaligned)
      return `
      outline-color: ${COLORS.warning}; /* Changed from dashed to solid with warning color */
      box-shadow: 0 0 5px ${COLORS.warning}80;
    `;
    return '';
  }}
`;

export const Placeholder = styled.p(globalPlaceholderTextStyles);

export const ParagraphWrapper = styled.div`
  position: relative;
  margin-bottom: 1px; /* Small gap between paragraphs */
  padding-top: 2px; /* Space for the anchor line */

  &:hover .add-anchor-btn {
    opacity: 1;
  }
`;

export const AddAnchorButton = styled.button`
  position: absolute;
  left: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid ${COLORS.primary};
  background-color: ${COLORS.white};
  color: ${COLORS.primary};
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.2s, background-color 0.2s, box-shadow 0.2s;
  z-index: 5;
  box-shadow: ${SHADOWS.small};

  &:hover {
    background-color: ${COLORS.primary};
    color: ${COLORS.white};
  }
`;

export const AnchorLine = styled.div<{ color: string }>`
  position: absolute;
  left: 0;
  right: 0;
  top: -1px; /* Position between paragraphs */
  height: 3px;
  background-color: ${props => props.color};
  opacity: 0.7;
  pointer-events: none; /* Allow clicks to pass through */
`;

export const AnchorContainer = styled.div`
  position: relative;
  height: 0; /* Doesn't take up space in the flow */
`;

const flashAnimation = keyframes`
  0% { background-color: ${COLORS.primary}80; }
  100% { background-color: transparent; }
`;

export const AnchorMarker = styled.div<{ colors: string[] }>`
  position: absolute;
  top: 0px;
  left: -8px; /* Position to the left of the content */
  right: -8px;
  height: 5px;
  cursor: pointer;
  z-index: 2;

  &[data-is-scrolling-to='true'] {
    animation: ${flashAnimation} 1.5s ease-out;
  }

  &:hover .anchor-tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
`;

export const AnchorLineSegment = styled.div`
  height: 100%;
  float: left;
`;

export const AnchorTooltip = styled.div`
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  background-color: ${COLORS.dark};
  color: ${COLORS.white};
  padding: ${SPACING.xs} ${SPACING.sm};
  border-radius: ${BORDERS.radius};
  font-size: ${FONTS.sizeSmall};
  white-space: pre-wrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
  transform: translateY(4px);
`;

export const NextChapterButton = styled.button<{ visible: boolean }>`
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  font-size: 24px;
  cursor: pointer;
  box-shadow: ${SHADOWS.medium};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${props => (props.visible ? 0.85 : 0)};
  visibility: ${props => (props.visible ? 'visible' : 'hidden')};
  transition: opacity 0.3s ease, visibility 0.3s ease, background-color 0.2s ease, transform 0.2s ease;
  pointer-events: ${props => (props.visible ? 'auto' : 'none')};
  z-index: 10;

  &:hover {
    opacity: 1;
    background-color: ${COLORS.primaryDark};
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

