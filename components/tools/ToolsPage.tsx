import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';

type RemoveBlankLinesFileResult =
  | { cancelled: true; inputPath?: string }
  | {
      cancelled: false;
      inputPath: string;
      outputPath: string;
      beforeLines: number;
      removedLines: number;
      afterLines: number;
      bytesIn?: number;
      bytesOut?: number;
    };

interface ToolsPageProps {
  onBack: () => void;
}

const Page = styled.div`
  padding: ${SPACING.xl};
  height: 100%;
  overflow-y: auto;
  background: ${COLORS.background};
  box-sizing: border-box;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${SPACING.lg};
  margin-bottom: ${SPACING.xl};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${FONTS.sizeH2};
  color: ${COLORS.dark};
`;

const BaseButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${SPACING.sm} ${SPACING.lg};
  border-radius: ${BORDERS.radius};
  border: 1px solid ${props => (props.variant === 'secondary' ? COLORS.border : COLORS.primary)};
  background: ${props => (props.variant === 'secondary' ? COLORS.white : COLORS.primary)};
  color: ${props => (props.variant === 'secondary' ? COLORS.text : COLORS.white)};
  cursor: pointer;
  font-size: ${FONTS.sizeSmall};
  transition: background-color 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    background: ${props => (props.variant === 'secondary' ? COLORS.gray100 : COLORS.primaryHover)};
    box-shadow: ${SHADOWS.small};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ToolGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: ${SPACING.lg};
`;

const ToolCard = styled.div`
  background: ${COLORS.white};
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  padding: ${SPACING.lg};
  box-shadow: ${SHADOWS.small};
  display: flex;
  flex-direction: column;
  gap: ${SPACING.md};
`;

const ToolTitle = styled.h3`
  margin: 0;
  font-size: ${FONTS.sizeH3};
  color: ${COLORS.dark};
`;

const ToolDesc = styled.p`
  margin: 0;
  font-size: ${FONTS.sizeBase};
  color: ${COLORS.textLight};
  line-height: 1.6;
`;

const ResultBox = styled.pre`
  margin: 0;
  padding: ${SPACING.md};
  background: ${COLORS.gray100};
  border: 1px solid ${COLORS.borderLight};
  border-radius: ${BORDERS.radius};
  color: ${COLORS.text};
  font-size: ${FONTS.sizeSmall};
  white-space: pre-wrap;
  word-break: break-word;
`;

const DropZone = styled.div<{ $active?: boolean; $disabled?: boolean }>`
  padding: ${SPACING.lg};
  border-radius: ${BORDERS.radius};
  border: 2px dashed ${props => (props.$active ? COLORS.primary : COLORS.border)};
  background: ${props => (props.$active ? COLORS.highlightBackground : COLORS.gray100)};
  color: ${COLORS.text};
  text-align: center;
  user-select: none;
  cursor: ${props => (props.$disabled ? 'not-allowed' : 'pointer')};
  opacity: ${props => (props.$disabled ? 0.6 : 1)};
`;

function formatBytes(bytes?: number) {
  if (!bytes && bytes !== 0) return '';
  const kb = 1024;
  const mb = kb * 1024;
  if (bytes >= mb) return `${(bytes / mb).toFixed(2)} MB`;
  if (bytes >= kb) return `${(bytes / kb).toFixed(2)} KB`;
  return `${bytes} B`;
}

const ToolsPage: React.FC<ToolsPageProps> = ({ onBack }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<RemoveBlankLinesFileResult | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragHandlerMissing, setIsDragHandlerMissing] = useState(false);
  const dragCounter = useRef(0);

  const isElectronAvailable = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.removeBlankLinesFile || api?.tools?.removeBlankLinesFileFromPath);
  }, []);

  const canRunFromPath = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.removeBlankLinesFileFromPath);
  }, []);

  const dropDisabled = !isElectronAvailable || isRunning || !canRunFromPath || isDragHandlerMissing;

  useEffect(() => {
    const preventDefault = (event: DragEvent) => {
      event.preventDefault();
    };

    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  const runRemoveBlankLines = async () => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.removeBlankLinesFile) {
      alert('该工具需要在 Electron 桌面版中运行。');
      return;
    }

    setIsRunning(true);
    try {
      const result = (await api.tools.removeBlankLinesFile()) as RemoveBlankLinesFileResult;
      setLastResult(result);
    } catch (error) {
      console.error(error);
      alert(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runRemoveBlankLinesFromPath = async (inputPath: string) => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.removeBlankLinesFileFromPath) {
      alert('当前 Electron 版本不支持“拖拽文件处理”，请点击按钮选择文件。');
      return;
    }

    setIsRunning(true);
    try {
      const result = (await api.tools.removeBlankLinesFileFromPath(inputPath)) as RemoveBlankLinesFileResult;
      setLastResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No handler registered for 'tools:removeBlankLinesFileFromPath'")) {
        setIsDragHandlerMissing(true);
        alert('拖拽功能需要重启 Electron 主进程后才会生效（不是刷新网页）。已自动切换为“选择文件”模式。');
        if (api?.tools?.removeBlankLinesFile) {
          const fallback = (await api.tools.removeBlankLinesFile()) as RemoveBlankLinesFileResult;
          setLastResult(fallback);
        }
      } else {
        console.error(error);
        alert(`处理失败: ${message || '未知错误'}`);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const onDragEnter: React.DragEventHandler<HTMLDivElement> = event => {
    if (dropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current += 1;
    setIsDragActive(true);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = event => {
    if (dropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = event => {
    if (dropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragActive(false);
    }
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = async event => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setIsDragActive(false);

    if (dropDisabled) {
      if (!isElectronAvailable) alert('该工具需要在 Electron 桌面版中运行。');
      else if (!canRunFromPath) alert('当前 Electron 版本不支持“拖拽文件处理”，请更新 Electron。');
      return;
    }

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const droppedPath = (file as any)?.path as string | undefined;
    if (!droppedPath) {
      alert('浏览器环境无法获取本地文件路径，请在 Electron 桌面版中使用拖拽。');
      return;
    }

    if (!droppedPath.toLowerCase().endsWith('.txt')) {
      alert('仅支持 .txt 文件。');
      return;
    }

    await runRemoveBlankLinesFromPath(droppedPath);
  };

  const resultText = useMemo(() => {
    if (!lastResult) return '';
    if (lastResult.cancelled) {
      return `已取消${lastResult.inputPath ? `\n输入文件: ${lastResult.inputPath}` : ''}`;
    }
    return [
      `输入文件: ${lastResult.inputPath}`,
      `输出文件: ${lastResult.outputPath}`,
      `总行数: ${lastResult.beforeLines}`,
      `删除空行: ${lastResult.removedLines}`,
      `保留行数: ${lastResult.afterLines}`,
      lastResult.bytesIn !== undefined ? `输入大小: ${formatBytes(lastResult.bytesIn)}` : '',
      lastResult.bytesOut !== undefined ? `输出大小: ${formatBytes(lastResult.bytesOut)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [lastResult]);

  return (
    <Page>
      <Header>
        <BaseButton variant="secondary" type="button" onClick={onBack}>
          返回
        </BaseButton>
        <Title>工具辅助</Title>
        <div style={{ width: 90 }} />
      </Header>

      {!isElectronAvailable && (
        <ToolCard>
          <ToolTitle>提示</ToolTitle>
          <ToolDesc>当前页面检测不到 Electron 能力（window.electronAPI）。请用 Electron 打开本项目再使用工具。</ToolDesc>
        </ToolCard>
      )}

      <ToolGrid>
        <ToolCard>
          <ToolTitle>删除空行（TXT）</ToolTitle>
          <ToolDesc>选择或拖拽一个 `.txt` 小说文件，生成一个“去空行”后的新文件（不会覆盖原文件）。</ToolDesc>
          <DropZone
            $active={isDragActive}
            $disabled={dropDisabled}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            aria-disabled={dropDisabled}
            title={
              isDragHandlerMissing
                ? '拖拽功能需要重启 Electron 后生效'
                : canRunFromPath
                  ? '拖拽 .txt 文件到这里'
                  : '当前 Electron 版本不支持拖拽处理'
            }
          >
            {canRunFromPath
              ? isDragHandlerMissing
                ? '拖拽功能未就绪（请重启 Electron）'
                : isDragActive
                  ? '松开鼠标开始处理'
                  : '拖拽 .txt 文件到这里'
              : '拖拽处理不可用（请更新 Electron）'}
          </DropZone>
          <BaseButton type="button" onClick={runRemoveBlankLines} disabled={!isElectronAvailable || isRunning}>
            {isRunning ? '处理中...' : '选择文件并生成新文件'}
          </BaseButton>
          {resultText && <ResultBox>{resultText}</ResultBox>}
        </ToolCard>
      </ToolGrid>
    </Page>
  );
};

export default ToolsPage;
