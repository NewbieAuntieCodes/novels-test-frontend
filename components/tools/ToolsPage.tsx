import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { COLORS, SPACING, FONTS, BORDERS, SHADOWS } from '../../styles';

type RemoveBlankLinesFileResult =
  | { cancelled: true; inputPath?: string; batch?: boolean; inputCount?: number }
  | {
      cancelled: false;
      batch?: false;
      inputPath: string;
      outputPath: string;
      beforeLines: number;
      removedLines: number;
      afterLines: number;
      bytesIn?: number;
      bytesOut?: number;
    }
  | {
      cancelled: false;
      batch: true;
      outputDir: string;
      total: number;
      successCount: number;
      failCount: number;
      items: Array<
        | {
            ok: true;
            inputPath: string;
            outputPath: string;
            beforeLines: number;
            removedLines: number;
            afterLines: number;
            bytesIn?: number;
            bytesOut?: number;
          }
        | {
            ok: false;
            inputPath: string;
            error: string;
          }
      >;
    };

type ConvertEpubToTxtResult =
  | { cancelled: true; inputPath?: string; batch?: boolean; inputCount?: number }
  | {
      cancelled: false;
      batch?: false;
      inputPath: string;
      outputPath: string;
      chapterCount: number;
      charCount: number;
      bytesIn?: number;
      bytesOut?: number;
    }
  | {
      cancelled: false;
      batch: true;
      outputDir: string;
      total: number;
      successCount: number;
      failCount: number;
      items: Array<
        | {
            ok: true;
            inputPath: string;
            outputPath: string;
            chapterCount: number;
            charCount: number;
            bytesIn?: number;
            bytesOut?: number;
          }
        | {
            ok: false;
            inputPath: string;
            error: string;
          }
      >;
    };

type SplitTxtByChaptersResult =
  | { cancelled: true; inputPath?: string; batch?: boolean; inputCount?: number }
  | {
      cancelled: false;
      batch?: false;
      inputPath: string;
      outputDir: string;
      chapterCount: number;
      charCount: number;
      bytesIn?: number;
      bytesOutTotal?: number;
      items: Array<{
        index: number;
        title: string;
        outputPath: string;
        charCount: number;
        bytesOut?: number;
      }>;
    }
  | {
      cancelled: false;
      batch: true;
      outputDir: string;
      total: number;
      successCount: number;
      failCount: number;
      items: Array<
        | {
            ok: true;
            inputPath: string;
            outputDir: string;
            chapterCount: number;
            charCount: number;
            bytesIn?: number;
            bytesOutTotal?: number;
          }
        | {
            ok: false;
            inputPath: string;
            error: string;
          }
      >;
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

function basename(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

function collectDroppedPaths(event: React.DragEvent<HTMLDivElement>, extension: '.txt' | '.epub') {
  const files = Array.from(event.dataTransfer?.files || []);
  const paths = files
    .map(file => ((file as any)?.path as string | undefined) || '')
    .filter(Boolean)
    .map(filePath => filePath.trim())
    .filter(filePath => filePath.toLowerCase().endsWith(extension));

  return [...new Set(paths)];
}

const ToolsPage: React.FC<ToolsPageProps> = ({ onBack }) => {
  const [isRunningRemoveBlankLines, setIsRunningRemoveBlankLines] = useState(false);
  const [lastRemoveBlankLinesResult, setLastRemoveBlankLinesResult] = useState<RemoveBlankLinesFileResult | null>(null);
  const [isTxtDragActive, setIsTxtDragActive] = useState(false);
  const [isTxtDragHandlerMissing, setIsTxtDragHandlerMissing] = useState(false);
  const txtDragCounter = useRef(0);

  const [isRunningEpubToTxt, setIsRunningEpubToTxt] = useState(false);
  const [lastEpubToTxtResult, setLastEpubToTxtResult] = useState<ConvertEpubToTxtResult | null>(null);
  const [isEpubDragActive, setIsEpubDragActive] = useState(false);
  const [isEpubDragHandlerMissing, setIsEpubDragHandlerMissing] = useState(false);
  const epubDragCounter = useRef(0);

  const [isRunningSplitTxtByChapters, setIsRunningSplitTxtByChapters] = useState(false);
  const [lastSplitTxtByChaptersResult, setLastSplitTxtByChaptersResult] = useState<SplitTxtByChaptersResult | null>(null);
  const [isSplitTxtDragActive, setIsSplitTxtDragActive] = useState(false);
  const [isSplitTxtDragHandlerMissing, setIsSplitTxtDragHandlerMissing] = useState(false);
  const splitTxtDragCounter = useRef(0);

  const isElectronAvailable = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(
        api?.tools?.removeBlankLinesFile ||
        api?.tools?.removeBlankLinesFileFromPath ||
        api?.tools?.removeBlankLinesBatch ||
        api?.tools?.removeBlankLinesBatchFromPaths ||
        api?.tools?.splitTxtByChapters ||
        api?.tools?.splitTxtByChaptersFromPath ||
        api?.tools?.splitTxtByChaptersBatch ||
        api?.tools?.splitTxtByChaptersBatchFromPaths ||
        api?.tools?.convertEpubToTxt ||
        api?.tools?.convertEpubToTxtFromPath ||
        api?.tools?.convertEpubToTxtBatch ||
        api?.tools?.convertEpubToTxtBatchFromPaths
    );
  }, []);

  const canRunTxtFromPath = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.removeBlankLinesFileFromPath);
  }, []);

  const canRunTxtBatch = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.removeBlankLinesBatch);
  }, []);

  const canRunTxtBatchFromPaths = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.removeBlankLinesBatchFromPaths);
  }, []);

  const canRunEpubFromPath = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.convertEpubToTxtFromPath);
  }, []);

  const canRunEpubBatch = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.convertEpubToTxtBatch);
  }, []);

  const canRunEpubBatchFromPaths = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.convertEpubToTxtBatchFromPaths);
  }, []);

  const canRunSplitTxtByChaptersBatch = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.splitTxtByChaptersBatch);
  }, []);

  const canRunSplitTxtByChaptersFromPath = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.splitTxtByChaptersFromPath);
  }, []);

  const canRunSplitTxtByChaptersBatchFromPaths = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.splitTxtByChaptersBatchFromPaths);
  }, []);

  const canRunSplitTxtByChapters = useMemo(() => {
    const api = (window as any)?.electronAPI;
    return Boolean(api?.tools?.splitTxtByChapters);
  }, []);

  const canRunTxtDrop = canRunTxtFromPath || canRunTxtBatchFromPaths;
  const canRunEpubDrop = canRunEpubFromPath || canRunEpubBatchFromPaths;
  const canRunSplitTxtDrop = canRunSplitTxtByChaptersFromPath || canRunSplitTxtByChaptersBatchFromPaths;

  const isAnyRunning = isRunningRemoveBlankLines || isRunningEpubToTxt || isRunningSplitTxtByChapters;
  const txtDropDisabled = !isElectronAvailable || isAnyRunning || !canRunTxtDrop || isTxtDragHandlerMissing;
  const epubDropDisabled = !isElectronAvailable || isAnyRunning || !canRunEpubDrop || isEpubDragHandlerMissing;
  const splitTxtDropDisabled =
    !isElectronAvailable || isAnyRunning || !canRunSplitTxtDrop || isSplitTxtDragHandlerMissing;

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

    setIsRunningRemoveBlankLines(true);
    try {
      const result = (await api.tools.removeBlankLinesFile()) as RemoveBlankLinesFileResult;
      setLastRemoveBlankLinesResult(result);
    } catch (error) {
      console.error(error);
      alert(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsRunningRemoveBlankLines(false);
    }
  };

  const runRemoveBlankLinesBatch = async () => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.removeBlankLinesBatch) {
      alert('当前 Electron 版本不支持“批量处理”，请更新 Electron。');
      return;
    }

    setIsRunningRemoveBlankLines(true);
    try {
      const result = (await api.tools.removeBlankLinesBatch()) as RemoveBlankLinesFileResult;
      setLastRemoveBlankLinesResult(result);
    } catch (error) {
      console.error(error);
      alert(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsRunningRemoveBlankLines(false);
    }
  };

  const runRemoveBlankLinesBatchFromPaths = async (inputPaths: string[]) => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.removeBlankLinesBatchFromPaths) {
      alert('当前 Electron 版本不支持“拖拽批量处理”，请更新 Electron。');
      return;
    }
    if (!inputPaths.length) return;

    setIsRunningRemoveBlankLines(true);
    try {
      const result = (await api.tools.removeBlankLinesBatchFromPaths(inputPaths)) as RemoveBlankLinesFileResult;
      setLastRemoveBlankLinesResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No handler registered for 'tools:removeBlankLinesBatchFromPaths'")) {
        setIsTxtDragHandlerMissing(true);
        alert('拖拽批量功能需要重启 Electron 主进程后生效。已切换为手动批量选择。');
        if (api?.tools?.removeBlankLinesBatch) {
          const fallback = (await api.tools.removeBlankLinesBatch()) as RemoveBlankLinesFileResult;
          setLastRemoveBlankLinesResult(fallback);
        }
      } else {
        console.error(error);
        alert(`处理失败: ${message || '未知错误'}`);
      }
    } finally {
      setIsRunningRemoveBlankLines(false);
    }
  };

  const runRemoveBlankLinesFromPath = async (inputPath: string) => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.removeBlankLinesFileFromPath) {
      alert('当前 Electron 版本不支持“拖拽文件处理”，请点击按钮选择文件。');
      return;
    }

    setIsRunningRemoveBlankLines(true);
    try {
      const result = (await api.tools.removeBlankLinesFileFromPath(inputPath)) as RemoveBlankLinesFileResult;
      setLastRemoveBlankLinesResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No handler registered for 'tools:removeBlankLinesFileFromPath'")) {
        setIsTxtDragHandlerMissing(true);
        alert('拖拽功能需要重启 Electron 主进程后才会生效（不是刷新网页）。已自动切换为“选择文件”模式。');
        if (api?.tools?.removeBlankLinesFile) {
          const fallback = (await api.tools.removeBlankLinesFile()) as RemoveBlankLinesFileResult;
          setLastRemoveBlankLinesResult(fallback);
        }
      } else {
        console.error(error);
        alert(`处理失败: ${message || '未知错误'}`);
      }
    } finally {
      setIsRunningRemoveBlankLines(false);
    }
  };

  const runSplitTxtByChapters = async () => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.splitTxtByChapters) {
      alert('当前 Electron 版本不支持“按章节拆分 TXT”，请更新 Electron。');
      return;
    }

    setIsRunningSplitTxtByChapters(true);
    try {
      const result = (await api.tools.splitTxtByChapters()) as SplitTxtByChaptersResult;
      setLastSplitTxtByChaptersResult(result);
    } catch (error) {
      console.error(error);
      alert(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsRunningSplitTxtByChapters(false);
    }
  };

  const runSplitTxtByChaptersBatch = async () => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.splitTxtByChaptersBatch) {
      alert('当前 Electron 版本不支持“批量拆章节”，请更新 Electron。');
      return;
    }

    setIsRunningSplitTxtByChapters(true);
    try {
      const result = (await api.tools.splitTxtByChaptersBatch()) as SplitTxtByChaptersResult;
      setLastSplitTxtByChaptersResult(result);
    } catch (error) {
      console.error(error);
      alert(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsRunningSplitTxtByChapters(false);
    }
  };

  const runSplitTxtByChaptersBatchFromPaths = async (inputPaths: string[]) => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.splitTxtByChaptersBatchFromPaths) {
      alert('当前 Electron 版本不支持“拖拽批量拆分”，请更新 Electron。');
      return;
    }
    if (!inputPaths.length) return;

    setIsRunningSplitTxtByChapters(true);
    try {
      const result = (await api.tools.splitTxtByChaptersBatchFromPaths(inputPaths)) as SplitTxtByChaptersResult;
      setLastSplitTxtByChaptersResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No handler registered for 'tools:splitTxtByChaptersBatchFromPaths'")) {
        setIsSplitTxtDragHandlerMissing(true);
        alert('拖拽批量功能需要重启 Electron 主进程后生效。已切换为手动批量选择。');
        if (api?.tools?.splitTxtByChaptersBatch) {
          const fallback = (await api.tools.splitTxtByChaptersBatch()) as SplitTxtByChaptersResult;
          setLastSplitTxtByChaptersResult(fallback);
        }
      } else {
        console.error(error);
        alert(`处理失败: ${message || '未知错误'}`);
      }
    } finally {
      setIsRunningSplitTxtByChapters(false);
    }
  };

  const runSplitTxtByChaptersFromPath = async (inputPath: string) => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.splitTxtByChaptersFromPath) {
      alert('当前 Electron 版本不支持“拖拽文件拆分”，请点击按钮选择文件。');
      return;
    }

    setIsRunningSplitTxtByChapters(true);
    try {
      const result = (await api.tools.splitTxtByChaptersFromPath(inputPath)) as SplitTxtByChaptersResult;
      setLastSplitTxtByChaptersResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No handler registered for 'tools:splitTxtByChaptersFromPath'")) {
        setIsSplitTxtDragHandlerMissing(true);
        alert('拖拽功能需要重启 Electron 主进程后才会生效（不是刷新网页）。已自动切换为“选择文件”模式。');
        if (api?.tools?.splitTxtByChapters) {
          const fallback = (await api.tools.splitTxtByChapters()) as SplitTxtByChaptersResult;
          setLastSplitTxtByChaptersResult(fallback);
        }
      } else {
        console.error(error);
        alert(`处理失败: ${message || '未知错误'}`);
      }
    } finally {
      setIsRunningSplitTxtByChapters(false);
    }
  };

  const runConvertEpubToTxt = async () => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.convertEpubToTxt) {
      alert('该工具需要在 Electron 桌面版中运行。');
      return;
    }

    setIsRunningEpubToTxt(true);
    try {
      const result = (await api.tools.convertEpubToTxt()) as ConvertEpubToTxtResult;
      setLastEpubToTxtResult(result);
    } catch (error) {
      console.error(error);
      alert(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsRunningEpubToTxt(false);
    }
  };

  const runConvertEpubToTxtBatch = async () => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.convertEpubToTxtBatch) {
      alert('当前 Electron 版本不支持“批量处理”，请更新 Electron。');
      return;
    }

    setIsRunningEpubToTxt(true);
    try {
      const result = (await api.tools.convertEpubToTxtBatch()) as ConvertEpubToTxtResult;
      setLastEpubToTxtResult(result);
    } catch (error) {
      console.error(error);
      alert(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsRunningEpubToTxt(false);
    }
  };

  const runConvertEpubToTxtBatchFromPaths = async (inputPaths: string[]) => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.convertEpubToTxtBatchFromPaths) {
      alert('当前 Electron 版本不支持“拖拽批量转换”，请更新 Electron。');
      return;
    }
    if (!inputPaths.length) return;

    setIsRunningEpubToTxt(true);
    try {
      const result = (await api.tools.convertEpubToTxtBatchFromPaths(inputPaths)) as ConvertEpubToTxtResult;
      setLastEpubToTxtResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No handler registered for 'tools:convertEpubToTxtBatchFromPaths'")) {
        setIsEpubDragHandlerMissing(true);
        alert('拖拽批量功能需要重启 Electron 主进程后生效。已切换为手动批量选择。');
        if (api?.tools?.convertEpubToTxtBatch) {
          const fallback = (await api.tools.convertEpubToTxtBatch()) as ConvertEpubToTxtResult;
          setLastEpubToTxtResult(fallback);
        }
      } else {
        console.error(error);
        alert(`处理失败: ${message || '未知错误'}`);
      }
    } finally {
      setIsRunningEpubToTxt(false);
    }
  };

  const runConvertEpubToTxtFromPath = async (inputPath: string) => {
    const api = (window as any)?.electronAPI;
    if (!api?.tools?.convertEpubToTxtFromPath) {
      alert('当前 Electron 版本不支持“拖拽文件处理”，请点击按钮选择文件。');
      return;
    }

    setIsRunningEpubToTxt(true);
    try {
      const result = (await api.tools.convertEpubToTxtFromPath(inputPath)) as ConvertEpubToTxtResult;
      setLastEpubToTxtResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No handler registered for 'tools:convertEpubToTxtFromPath'")) {
        setIsEpubDragHandlerMissing(true);
        alert('拖拽功能需要重启 Electron 主进程后才会生效（不是刷新网页）。已自动切换为“选择文件”模式。');
        if (api?.tools?.convertEpubToTxt) {
          const fallback = (await api.tools.convertEpubToTxt()) as ConvertEpubToTxtResult;
          setLastEpubToTxtResult(fallback);
        }
      } else {
        console.error(error);
        alert(`处理失败: ${message || '未知错误'}`);
      }
    } finally {
      setIsRunningEpubToTxt(false);
    }
  };

  const onTxtDragEnter: React.DragEventHandler<HTMLDivElement> = event => {
    if (txtDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    txtDragCounter.current += 1;
    setIsTxtDragActive(true);
  };

  const onTxtDragOver: React.DragEventHandler<HTMLDivElement> = event => {
    if (txtDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const onTxtDragLeave: React.DragEventHandler<HTMLDivElement> = event => {
    if (txtDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    txtDragCounter.current -= 1;
    if (txtDragCounter.current <= 0) {
      txtDragCounter.current = 0;
      setIsTxtDragActive(false);
    }
  };

  const onTxtDrop: React.DragEventHandler<HTMLDivElement> = async event => {
    event.preventDefault();
    event.stopPropagation();
    txtDragCounter.current = 0;
    setIsTxtDragActive(false);

    if (txtDropDisabled) {
      if (!isElectronAvailable) alert('该工具需要在 Electron 桌面版中运行。');
      else if (!canRunTxtDrop) alert('当前 Electron 版本不支持“拖拽文件处理”，请更新 Electron。');
      return;
    }

    const droppedPaths = collectDroppedPaths(event, '.txt');
    if (droppedPaths.length === 0) {
      alert('浏览器环境无法获取本地文件路径，请在 Electron 桌面版中使用拖拽。');
      return;
    }

    if (droppedPaths.length > 1) {
      if (!canRunTxtBatchFromPaths) {
        alert('当前 Electron 版本不支持“拖拽批量处理”，请重启后重试或使用批量选择按钮。');
        return;
      }
      await runRemoveBlankLinesBatchFromPaths(droppedPaths);
      return;
    }

    if (!canRunTxtFromPath) {
      if (canRunTxtBatchFromPaths) {
        await runRemoveBlankLinesBatchFromPaths(droppedPaths);
        return;
      }
      alert('当前 Electron 版本不支持“拖拽文件处理”，请更新 Electron。');
      return;
    }

    await runRemoveBlankLinesFromPath(droppedPaths[0]);
  };

  const onEpubDragEnter: React.DragEventHandler<HTMLDivElement> = event => {
    if (epubDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    epubDragCounter.current += 1;
    setIsEpubDragActive(true);
  };

  const onEpubDragOver: React.DragEventHandler<HTMLDivElement> = event => {
    if (epubDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const onEpubDragLeave: React.DragEventHandler<HTMLDivElement> = event => {
    if (epubDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    epubDragCounter.current -= 1;
    if (epubDragCounter.current <= 0) {
      epubDragCounter.current = 0;
      setIsEpubDragActive(false);
    }
  };

  const onEpubDrop: React.DragEventHandler<HTMLDivElement> = async event => {
    event.preventDefault();
    event.stopPropagation();
    epubDragCounter.current = 0;
    setIsEpubDragActive(false);

    if (epubDropDisabled) {
      if (!isElectronAvailable) alert('该工具需要在 Electron 桌面版中运行。');
      else if (!canRunEpubDrop) alert('当前 Electron 版本不支持“拖拽文件处理”，请更新 Electron。');
      return;
    }

    const droppedPaths = collectDroppedPaths(event, '.epub');
    if (droppedPaths.length === 0) {
      alert('浏览器环境无法获取本地文件路径，请在 Electron 桌面版中使用拖拽。');
      return;
    }

    if (droppedPaths.length > 1) {
      if (!canRunEpubBatchFromPaths) {
        alert('当前 Electron 版本不支持“拖拽批量转换”，请重启后重试或使用批量选择按钮。');
        return;
      }
      await runConvertEpubToTxtBatchFromPaths(droppedPaths);
      return;
    }

    if (!canRunEpubFromPath) {
      if (canRunEpubBatchFromPaths) {
        await runConvertEpubToTxtBatchFromPaths(droppedPaths);
        return;
      }
      alert('当前 Electron 版本不支持“拖拽文件处理”，请更新 Electron。');
      return;
    }

    await runConvertEpubToTxtFromPath(droppedPaths[0]);
  };

  const onSplitTxtDragEnter: React.DragEventHandler<HTMLDivElement> = event => {
    if (splitTxtDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    splitTxtDragCounter.current += 1;
    setIsSplitTxtDragActive(true);
  };

  const onSplitTxtDragOver: React.DragEventHandler<HTMLDivElement> = event => {
    if (splitTxtDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const onSplitTxtDragLeave: React.DragEventHandler<HTMLDivElement> = event => {
    if (splitTxtDropDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    splitTxtDragCounter.current -= 1;
    if (splitTxtDragCounter.current <= 0) {
      splitTxtDragCounter.current = 0;
      setIsSplitTxtDragActive(false);
    }
  };

  const onSplitTxtDrop: React.DragEventHandler<HTMLDivElement> = async event => {
    event.preventDefault();
    event.stopPropagation();
    splitTxtDragCounter.current = 0;
    setIsSplitTxtDragActive(false);

    if (splitTxtDropDisabled) {
      if (!isElectronAvailable) alert('该工具需要在 Electron 桌面版中运行。');
      else if (!canRunSplitTxtDrop) alert('当前 Electron 版本不支持“拖拽文件处理”，请更新 Electron。');
      return;
    }

    const droppedPaths = collectDroppedPaths(event, '.txt');
    if (droppedPaths.length === 0) {
      alert('浏览器环境无法获取本地文件路径，请在 Electron 桌面版中使用拖拽。');
      return;
    }

    if (droppedPaths.length > 1) {
      if (!canRunSplitTxtByChaptersBatchFromPaths) {
        alert('当前 Electron 版本不支持“拖拽批量拆分”，请重启后重试或使用批量选择按钮。');
        return;
      }
      await runSplitTxtByChaptersBatchFromPaths(droppedPaths);
      return;
    }

    if (!canRunSplitTxtByChaptersFromPath) {
      if (canRunSplitTxtByChaptersBatchFromPaths) {
        await runSplitTxtByChaptersBatchFromPaths(droppedPaths);
        return;
      }
      alert('当前 Electron 版本不支持“拖拽文件处理”，请更新 Electron。');
      return;
    }

    await runSplitTxtByChaptersFromPath(droppedPaths[0]);
  };

  const removeBlankLinesResultText = useMemo(() => {
    if (!lastRemoveBlankLinesResult) return '';
    if (lastRemoveBlankLinesResult.cancelled) {
      if (lastRemoveBlankLinesResult.batch) {
        return `已取消批量处理${lastRemoveBlankLinesResult.inputCount ? `\n已选文件数: ${lastRemoveBlankLinesResult.inputCount}` : ''}`;
      }
      return `已取消${lastRemoveBlankLinesResult.inputPath ? `\n输入文件: ${lastRemoveBlankLinesResult.inputPath}` : ''}`;
    }

    if (lastRemoveBlankLinesResult.batch) {
      const previewItems = lastRemoveBlankLinesResult.items.slice(0, 12).map((item, index) => {
        if (item.ok) {
          return `${index + 1}. OK ${basename(item.inputPath)} -> ${basename(item.outputPath)}`;
        }
        return `${index + 1}. FAIL ${basename(item.inputPath)}: ${item.error}`;
      });
      const extraCount = Math.max(0, lastRemoveBlankLinesResult.items.length - previewItems.length);

      return [
        '批量处理结果（TXT 去空行）',
        `输出目录: ${lastRemoveBlankLinesResult.outputDir}`,
        `总数: ${lastRemoveBlankLinesResult.total}`,
        `成功: ${lastRemoveBlankLinesResult.successCount}`,
        `失败: ${lastRemoveBlankLinesResult.failCount}`,
        '',
        ...previewItems,
        extraCount > 0 ? `... 还有 ${extraCount} 条未展开` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    return [
      `输入文件: ${lastRemoveBlankLinesResult.inputPath}`,
      `输出文件: ${lastRemoveBlankLinesResult.outputPath}`,
      `总行数: ${lastRemoveBlankLinesResult.beforeLines}`,
      `删除空行: ${lastRemoveBlankLinesResult.removedLines}`,
      `保留行数: ${lastRemoveBlankLinesResult.afterLines}`,
      lastRemoveBlankLinesResult.bytesIn !== undefined ? `输入大小: ${formatBytes(lastRemoveBlankLinesResult.bytesIn)}` : '',
      lastRemoveBlankLinesResult.bytesOut !== undefined ? `输出大小: ${formatBytes(lastRemoveBlankLinesResult.bytesOut)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [lastRemoveBlankLinesResult]);

  const epubToTxtResultText = useMemo(() => {
    if (!lastEpubToTxtResult) return '';
    if (lastEpubToTxtResult.cancelled) {
      if (lastEpubToTxtResult.batch) {
        return `已取消批量转换${lastEpubToTxtResult.inputCount ? `\n已选文件数: ${lastEpubToTxtResult.inputCount}` : ''}`;
      }
      return `已取消${lastEpubToTxtResult.inputPath ? `\n输入文件: ${lastEpubToTxtResult.inputPath}` : ''}`;
    }

    if (lastEpubToTxtResult.batch) {
      const previewItems = lastEpubToTxtResult.items.slice(0, 12).map((item, index) => {
        if (item.ok) {
          return `${index + 1}. OK ${basename(item.inputPath)} -> ${basename(item.outputPath)} (章节 ${item.chapterCount})`;
        }
        return `${index + 1}. FAIL ${basename(item.inputPath)}: ${item.error}`;
      });
      const extraCount = Math.max(0, lastEpubToTxtResult.items.length - previewItems.length);

      return [
        '批量转换结果（EPUB -> TXT）',
        `输出目录: ${lastEpubToTxtResult.outputDir}`,
        `总数: ${lastEpubToTxtResult.total}`,
        `成功: ${lastEpubToTxtResult.successCount}`,
        `失败: ${lastEpubToTxtResult.failCount}`,
        '',
        ...previewItems,
        extraCount > 0 ? `... 还有 ${extraCount} 条未展开` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    return [
      `输入文件: ${lastEpubToTxtResult.inputPath}`,
      `输出文件: ${lastEpubToTxtResult.outputPath}`,
      `提取章节: ${lastEpubToTxtResult.chapterCount}`,
      `输出字符数: ${lastEpubToTxtResult.charCount}`,
      lastEpubToTxtResult.bytesIn !== undefined ? `输入大小: ${formatBytes(lastEpubToTxtResult.bytesIn)}` : '',
      lastEpubToTxtResult.bytesOut !== undefined ? `输出大小: ${formatBytes(lastEpubToTxtResult.bytesOut)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [lastEpubToTxtResult]);

  const splitTxtByChaptersResultText = useMemo(() => {
    if (!lastSplitTxtByChaptersResult) return '';
    if (lastSplitTxtByChaptersResult.cancelled) {
      if (lastSplitTxtByChaptersResult.batch) {
        return `已取消批量拆分${lastSplitTxtByChaptersResult.inputCount ? `\n已选文件数: ${lastSplitTxtByChaptersResult.inputCount}` : ''}`;
      }
      return `已取消${lastSplitTxtByChaptersResult.inputPath ? `\n输入文件: ${lastSplitTxtByChaptersResult.inputPath}` : ''}`;
    }

    if (lastSplitTxtByChaptersResult.batch) {
      const previewItems = lastSplitTxtByChaptersResult.items.slice(0, 12).map((item, index) => {
        if (item.ok) {
          return `${index + 1}. OK ${basename(item.inputPath)} -> ${item.chapterCount} 章 (${basename(item.outputDir)})`;
        }
        return `${index + 1}. FAIL ${basename(item.inputPath)}: ${item.error}`;
      });
      const extraCount = Math.max(0, lastSplitTxtByChaptersResult.items.length - previewItems.length);

      return [
        '批量拆分结果（TXT 按章节）',
        `输出根目录: ${lastSplitTxtByChaptersResult.outputDir}`,
        `总数: ${lastSplitTxtByChaptersResult.total}`,
        `成功: ${lastSplitTxtByChaptersResult.successCount}`,
        `失败: ${lastSplitTxtByChaptersResult.failCount}`,
        '',
        ...previewItems,
        extraCount > 0 ? `... 还有 ${extraCount} 条未展开` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    const previewItems = lastSplitTxtByChaptersResult.items.slice(0, 10).map(item => {
      return `${String(item.index).padStart(3, '0')}. ${basename(item.outputPath)} (${item.charCount} 字符)`;
    });
    const extraCount = Math.max(0, lastSplitTxtByChaptersResult.items.length - previewItems.length);

    return [
      `输入文件: ${lastSplitTxtByChaptersResult.inputPath}`,
      `输出目录: ${lastSplitTxtByChaptersResult.outputDir}`,
      `拆分章节: ${lastSplitTxtByChaptersResult.chapterCount}`,
      `输出字符数: ${lastSplitTxtByChaptersResult.charCount}`,
      lastSplitTxtByChaptersResult.bytesIn !== undefined ? `输入大小: ${formatBytes(lastSplitTxtByChaptersResult.bytesIn)}` : '',
      lastSplitTxtByChaptersResult.bytesOutTotal !== undefined ? `输出总大小: ${formatBytes(lastSplitTxtByChaptersResult.bytesOutTotal)}` : '',
      '',
      ...previewItems,
      extraCount > 0 ? `... 还有 ${extraCount} 章未展开` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [lastSplitTxtByChaptersResult]);

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
          <ToolDesc>支持单文件和批量处理：选择或拖拽 `.txt` 文件，生成“去空行”后的新文件（不会覆盖原文件）。</ToolDesc>
          <DropZone
            $active={isTxtDragActive}
            $disabled={txtDropDisabled}
            onDragEnter={onTxtDragEnter}
            onDragOver={onTxtDragOver}
            onDragLeave={onTxtDragLeave}
            onDrop={onTxtDrop}
            role="button"
            tabIndex={0}
            aria-disabled={txtDropDisabled}
            title={
              isTxtDragHandlerMissing
                ? '拖拽功能需要重启 Electron 后生效'
                : canRunTxtDrop
                  ? '拖拽一个或多个 .txt 文件到这里'
                  : '当前 Electron 版本不支持拖拽处理'
            }
          >
            {canRunTxtDrop
              ? isTxtDragHandlerMissing
                ? '拖拽功能未就绪（请重启 Electron）'
                : isTxtDragActive
                  ? '松开鼠标开始处理'
                  : '拖拽一个或多个 .txt 文件到这里'
              : '拖拽处理不可用（请更新 Electron）'}
          </DropZone>
          <BaseButton type="button" onClick={runRemoveBlankLines} disabled={!isElectronAvailable || isAnyRunning}>
            {isRunningRemoveBlankLines ? '处理中...' : '选择文件并生成新文件'}
          </BaseButton>
          <BaseButton
            type="button"
            variant="secondary"
            onClick={runRemoveBlankLinesBatch}
            disabled={!isElectronAvailable || !canRunTxtBatch || isAnyRunning}
          >
            {isRunningRemoveBlankLines ? '处理中...' : '批量选择 TXT 并处理'}
          </BaseButton>
          {removeBlankLinesResultText && <ResultBox>{removeBlankLinesResultText}</ResultBox>}
        </ToolCard>

        <ToolCard>
          <ToolTitle>EPUB 转 TXT</ToolTitle>
          <ToolDesc>支持单文件和批量转换：选择或拖拽 `.epub`，提取正文并生成 `.txt`（不会覆盖原文件）。</ToolDesc>
          <DropZone
            $active={isEpubDragActive}
            $disabled={epubDropDisabled}
            onDragEnter={onEpubDragEnter}
            onDragOver={onEpubDragOver}
            onDragLeave={onEpubDragLeave}
            onDrop={onEpubDrop}
            role="button"
            tabIndex={0}
            aria-disabled={epubDropDisabled}
            title={
              isEpubDragHandlerMissing
                ? '拖拽功能需要重启 Electron 后生效'
                : canRunEpubDrop
                  ? '拖拽一个或多个 .epub 文件到这里'
                  : '当前 Electron 版本不支持拖拽处理'
            }
          >
            {canRunEpubDrop
              ? isEpubDragHandlerMissing
                ? '拖拽功能未就绪（请重启 Electron）'
                : isEpubDragActive
                  ? '松开鼠标开始转换'
                  : '拖拽一个或多个 .epub 文件到这里'
              : '拖拽处理不可用（请更新 Electron）'}
          </DropZone>
          <BaseButton type="button" onClick={runConvertEpubToTxt} disabled={!isElectronAvailable || isAnyRunning}>
            {isRunningEpubToTxt ? '转换中...' : '选择 EPUB 并导出 TXT'}
          </BaseButton>
          <BaseButton
            type="button"
            variant="secondary"
            onClick={runConvertEpubToTxtBatch}
            disabled={!isElectronAvailable || !canRunEpubBatch || isAnyRunning}
          >
            {isRunningEpubToTxt ? '转换中...' : '批量选择 EPUB 并导出 TXT'}
          </BaseButton>
          {epubToTxtResultText && <ResultBox>{epubToTxtResultText}</ResultBox>}
        </ToolCard>

        <ToolCard>
          <ToolTitle>TXT 按章节拆分</ToolTitle>
          <ToolDesc>支持单文件和批量拆分：选择或拖拽 `.txt` 文件，自动输出为“每章一个 TXT 文件”（不会覆盖原文件）。</ToolDesc>
          <DropZone
            $active={isSplitTxtDragActive}
            $disabled={splitTxtDropDisabled}
            onDragEnter={onSplitTxtDragEnter}
            onDragOver={onSplitTxtDragOver}
            onDragLeave={onSplitTxtDragLeave}
            onDrop={onSplitTxtDrop}
            role="button"
            tabIndex={0}
            aria-disabled={splitTxtDropDisabled}
            title={
              isSplitTxtDragHandlerMissing
                ? '拖拽功能需要重启 Electron 后生效'
                : canRunSplitTxtDrop
                  ? '拖拽一个或多个 .txt 文件到这里'
                  : '当前 Electron 版本不支持拖拽处理'
            }
          >
            {canRunSplitTxtDrop
              ? isSplitTxtDragHandlerMissing
                ? '拖拽功能未就绪（请重启 Electron）'
                : isSplitTxtDragActive
                  ? '松开鼠标开始拆分'
                  : '拖拽一个或多个 .txt 文件到这里'
              : '拖拽处理不可用（请更新 Electron）'}
          </DropZone>
          <BaseButton
            type="button"
            onClick={runSplitTxtByChapters}
            disabled={!isElectronAvailable || !canRunSplitTxtByChapters || isAnyRunning}
          >
            {isRunningSplitTxtByChapters ? '拆分中...' : '选择 TXT 并拆分章节'}
          </BaseButton>
          <BaseButton
            type="button"
            variant="secondary"
            onClick={runSplitTxtByChaptersBatch}
            disabled={!isElectronAvailable || !canRunSplitTxtByChaptersBatch || isAnyRunning}
          >
            {isRunningSplitTxtByChapters ? '拆分中...' : '批量选择 TXT 并拆分章节'}
          </BaseButton>
          {splitTxtByChaptersResultText && <ResultBox>{splitTxtByChaptersResultText}</ResultBox>}
        </ToolCard>
      </ToolGrid>
    </Page>
  );
};

export default ToolsPage;
