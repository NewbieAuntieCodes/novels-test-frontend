import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { CreateNovelRequest, UpdateNovelRequest } from '../types';

// 获取所有小说
export const getNovels = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const novels = await prisma.novel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(novels);
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

    const novel = await prisma.novel.create({
      data: {
        title,
        text: normalizedText,
        chapters: chapters || null,
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
    const { title, text, chapters, storylines, plotAnchors }: UpdateNovelRequest = req.body;

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
