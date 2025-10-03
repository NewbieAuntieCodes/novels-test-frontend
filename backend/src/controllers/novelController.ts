import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { CreateNovelRequest, UpdateNovelRequest } from '../types';
import { splitTextIntoChapters } from '../utils/chapterSplitter';

// 获取所有小说（只返回元数据，不含全文）
export const getNovels = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const novels = await prisma.novel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        chapters: true,  // 只返回章节元数据
        storylines: true,
        plotAnchors: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        subcategory: true,
        // 不返回 text 字段（全文）
      },
    });

    // 添加空 text 占位符（保持前端类型兼容）
    const novelsWithPlaceholder = novels.map(novel => ({
      ...novel,
      text: '', // 空字符串占位，打开编辑器时再加载
    }));

    res.json(novelsWithPlaceholder);
  } catch (error) {
    console.error('获取小说列表错误:', error);
    res.status(500).json({ error: '获取小说列表失败' });
  }
};

// 获取单个小说
export const getNovel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const novel = await prisma.novel.findFirst({
      where: { id, userId },
    });

    if (!novel) {
      res.status(404).json({ error: '小说不存在' });
      return;
    }

    res.json(novel);
  } catch (error) {
    console.error('获取小说错误:', error);
    res.status(500).json({ error: '获取小说失败' });
  }
};

// 创建小说
export const createNovel = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { title, text, chapters, storylines, plotAnchors }: CreateNovelRequest = req.body;

    if (!title || !text) {
      res.status(400).json({ error: '标题和内容不能为空' });
      return;
    }

    // 标准化换行符
    const normalizedText = text.replace(/\r\n|\r/g, '\n');

    // 如果前端没有提供章节，后端自动分章（性能优化）
    const finalChapters = chapters || splitTextIntoChapters(normalizedText);

    const novel = await prisma.novel.create({
      data: {
        title,
        text: normalizedText,
        chapters: finalChapters as any,
        storylines: storylines || null,
        plotAnchors: plotAnchors || null,
        userId,
      },
    });

    res.status(201).json(novel);
  } catch (error) {
    console.error('创建小说错误:', error);
    res.status(500).json({ error: '创建小说失败' });
  }
};

// 更新小说
export const updateNovel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { title, text, chapters, storylines, plotAnchors, category, subcategory }: UpdateNovelRequest = req.body;

    // 检查小说是否存在且属于当前用户
    const existingNovel = await prisma.novel.findFirst({
      where: { id, userId },
    });

    if (!existingNovel) {
      res.status(404).json({ error: '小说不存在' });
      return;
    }

    // 准备更新数据
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (text !== undefined) updateData.text = text.replace(/\r\n|\r/g, '\n');
    if (chapters !== undefined) updateData.chapters = chapters;
    if (storylines !== undefined) updateData.storylines = storylines;
    if (plotAnchors !== undefined) updateData.plotAnchors = plotAnchors;
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;

    const novel = await prisma.novel.update({
      where: { id },
      data: updateData,
    });

    res.json(novel);
  } catch (error) {
    console.error('更新小说错误:', error);
    res.status(500).json({ error: '更新小说失败' });
  }
};

// 删除小说
export const deleteNovel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 检查小说是否存在且属于当前用户
    const existingNovel = await prisma.novel.findFirst({
      where: { id, userId },
    });

    if (!existingNovel) {
      res.status(404).json({ error: '小说不存在' });
      return;
    }

    // 删除小说（级联删除关联的标注）
    await prisma.novel.delete({
      where: { id },
    });

    res.json({ message: '小说删除成功' });
  } catch (error) {
    console.error('删除小说错误:', error);
    res.status(500).json({ error: '删除小说失败' });
  }
};

// 🆕 获取单章内容和该章的标注
export const getChapterContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { novelId, chapterId } = req.params;
    const userId = req.user!.id;

    // 1. 验证小说所有权
    const novel = await prisma.novel.findFirst({
      where: { id: novelId, userId },
      select: { text: true, chapters: true },
    });

    if (!novel) {
      res.status(404).json({ error: '小说不存在' });
      return;
    }

    // 2. 从 chapters JSON 中找到目标章节
    const chapters = novel.chapters as any[];
    const chapter = chapters?.find((ch: any) => ch.id === chapterId);

    if (!chapter) {
      res.status(404).json({ error: '章节不存在' });
      return;
    }

    // 3. 提取该章节的文本内容
    const chapterText = novel.text.substring(
      chapter.originalStartIndex,
      chapter.originalEndIndex
    );

    // 4. 查询该章节的标注（通过索引范围筛选）
    const annotations = await prisma.annotation.findMany({
      where: {
        novelId,
        userId,
        startIndex: {
          gte: chapter.originalStartIndex,
          lt: chapter.originalEndIndex,
        },
      },
      orderBy: { startIndex: 'asc' },
    });

    res.json({
      chapter: {
        ...chapter,
        content: chapterText,
      },
      annotations,
    });
  } catch (error) {
    console.error('获取章节内容错误:', error);
    res.status(500).json({ error: '获取章节内容失败' });
  }
};

// 追加内容到现有小说
export const appendNovelContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { text, chapters }: { text: string; chapters?: any[] } = req.body;

    if (!text) {
      res.status(400).json({ error: '追加内容不能为空' });
      return;
    }

    // 检查小说是否存在且属于当前用户
    const existingNovel = await prisma.novel.findFirst({
      where: { id, userId },
    });

    if (!existingNovel) {
      res.status(404).json({ error: '小说不存在' });
      return;
    }

    // 标准化换行符
    const normalizedText = text.replace(/\r\n|\r/g, '\n');

    // 拼接新文本（使用两个换行符分隔，避免章节粘连）
    const oldTextLength = existingNovel.text.length;
    const appendedText = existingNovel.text + '\n\n' + normalizedText;

    // 对新增文本进行分章
    const newChapters = chapters || splitTextIntoChapters(normalizedText);

    // 将新章节的索引整体加上旧文本长度偏移（+2 是因为添加了 \n\n）
    const offset = oldTextLength + 2;
    const offsetNewChapters = newChapters.map((chapter: any) => ({
      ...chapter,
      originalStartIndex: chapter.originalStartIndex + offset,
      originalEndIndex: chapter.originalEndIndex + offset,
    }));

    // 合并章节列表
    const existingChapters = (existingNovel.chapters as any[]) || [];
    const finalChapters = [...existingChapters, ...offsetNewChapters];

    // 更新小说（保留所有其他字段）
    const updatedNovel = await prisma.novel.update({
      where: { id },
      data: {
        text: appendedText,
        chapters: finalChapters as any,
        updatedAt: new Date(),
      },
    });

    res.json({
      novel: updatedNovel,
      appendedChaptersCount: offsetNewChapters.length,
    });
  } catch (error) {
    console.error('追加小说内容错误:', error);
    res.status(500).json({ error: '追加小说内容失败' });
  }
};
