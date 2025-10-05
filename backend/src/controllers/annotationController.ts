import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { CreateAnnotationRequest, UpdateAnnotationRequest } from '../types';

// 获取标注列表（支持按小说和标签筛选）
export const getAnnotations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { novelId, tagId } = req.query;

    const where: any = { userId };

    if (novelId) {
      where.novelId = novelId as string;
    }

    let annotations = await prisma.annotation.findMany({
      where,
      include: {
        tags: {
          include: {
            tagPlacement: {
              include: {
                tag: true,
              },
            },
          },
        },
        novel: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 如果指定了tagId，筛选包含该标签的标注（支持按placementId或tagId筛选）
    if (tagId) {
      annotations = annotations.filter((annotation) =>
        annotation.tags.some((at) =>
          at.placementId === tagId || at.tagPlacement.tagId === tagId
        )
      );
    }

    // 转换格式以匹配前端期望
    const formattedAnnotations = annotations.map((annotation) => ({
      id: annotation.id,
      text: annotation.text,
      startIndex: annotation.startIndex,
      endIndex: annotation.endIndex,
      isPotentiallyMisaligned: annotation.isPotentiallyMisaligned,
      novelId: annotation.novelId,
      userId: annotation.userId,
      createdAt: annotation.createdAt,
      tagIds: annotation.tags.map((at) => at.placementId),
      tags: annotation.tags.map((at) => ({
        id: at.placementId,
        name: at.tagPlacement.tag.name,
        color: at.tagPlacement.tag.color,
        userId: at.tagPlacement.userId,
        novelId: at.tagPlacement.novelId,
        parentId: at.tagPlacement.parentPlacementId,
        createdAt: at.tagPlacement.createdAt,
      })),
      novel: annotation.novel,
    }));

    res.json(formattedAnnotations);
  } catch (error: any) {
    console.error('获取标注列表错误:', error);
    console.error('错误堆栈:', error.stack);
    console.error('错误消息:', error.message);
    res.status(500).json({ error: '获取标注列表失败', details: error.message });
  }
};

// 创建标注
export const createAnnotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      novelId,
      text,
      startIndex,
      endIndex,
      tagIds,
      isPotentiallyMisaligned,
    }: CreateAnnotationRequest = req.body;

    if (!novelId || !text || startIndex === undefined || endIndex === undefined) {
      res.status(400).json({ error: '缺少必需字段' });
      return;
    }

    if (!tagIds || tagIds.length === 0) {
      res.status(400).json({ error: '至少需要一个标签' });
      return;
    }

    // 验证小说存在且属于当前用户
    const novel = await prisma.novel.findFirst({
      where: { id: novelId, userId },
    });

    if (!novel) {
      res.status(404).json({ error: '小说不存在' });
      return;
    }

    // 验证所有标签放置点存在且属于当前用户
    const placements = await prisma.tagPlacement.findMany({
      where: {
        id: { in: tagIds },
        userId,
      },
      include: {
        tag: true,
      },
    });

    if (placements.length !== tagIds.length) {
      res.status(404).json({ error: '部分标签不存在' });
      return;
    }

    // 创建标注和关联
    const annotation = await prisma.annotation.create({
      data: {
        text,
        startIndex,
        endIndex,
        isPotentiallyMisaligned: isPotentiallyMisaligned || false,
        novelId,
        userId,
        tags: {
          create: tagIds.map((placementId) => ({
            placementId,
          })),
        },
      },
      include: {
        tags: {
          include: {
            tagPlacement: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
    });

    // 格式化返回
    const formattedAnnotation = {
      ...annotation,
      tagIds: annotation.tags.map((at) => at.placementId),
      tags: annotation.tags.map((at) => ({
        id: at.placementId,
        name: at.tagPlacement.tag.name,
        color: at.tagPlacement.tag.color,
        userId: at.tagPlacement.userId,
        novelId: at.tagPlacement.novelId,
        parentId: at.tagPlacement.parentPlacementId,
        createdAt: at.tagPlacement.createdAt,
      })),
    };

    res.status(201).json(formattedAnnotation);
  } catch (error) {
    console.error('创建标注错误:', error);
    res.status(500).json({ error: '创建标注失败' });
  }
};

// 更新标注
export const updateAnnotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const {
      text,
      startIndex,
      endIndex,
      tagIds,
      isPotentiallyMisaligned,
    }: UpdateAnnotationRequest = req.body;

    // 检查标注是否存在且属于当前用户
    const existingAnnotation = await prisma.annotation.findFirst({
      where: { id, userId },
    });

    if (!existingAnnotation) {
      res.status(404).json({ error: '标注不存在' });
      return;
    }

    // 准备更新数据
    const updateData: any = {};
    if (text !== undefined) updateData.text = text;
    if (startIndex !== undefined) updateData.startIndex = startIndex;
    if (endIndex !== undefined) updateData.endIndex = endIndex;
    if (isPotentiallyMisaligned !== undefined)
      updateData.isPotentiallyMisaligned = isPotentiallyMisaligned;

    // 如果需要更新标签
    if (tagIds !== undefined) {
      // 验证所有标签放置点存在且属于当前用户
      const placements = await prisma.tagPlacement.findMany({
        where: {
          id: { in: tagIds },
          userId,
        },
      });

      if (placements.length !== tagIds.length) {
        res.status(404).json({ error: '部分标签不存在' });
        return;
      }

      // 删除旧的关联，创建新的关联
      await prisma.annotationTag.deleteMany({
        where: { annotationId: id },
      });

      await prisma.annotationTag.createMany({
        data: tagIds.map((placementId) => ({
          annotationId: id,
          placementId,
        })),
      });
    }

    const annotation = await prisma.annotation.update({
      where: { id },
      data: updateData,
      include: {
        tags: {
          include: {
            tagPlacement: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
    });

    // 格式化返回
    const formattedAnnotation = {
      ...annotation,
      tagIds: annotation.tags.map((at) => at.placementId),
      tags: annotation.tags.map((at) => ({
        id: at.placementId,
        name: at.tagPlacement.tag.name,
        color: at.tagPlacement.tag.color,
        userId: at.tagPlacement.userId,
        novelId: at.tagPlacement.novelId,
        parentId: at.tagPlacement.parentPlacementId,
        createdAt: at.tagPlacement.createdAt,
      })),
    };

    res.json(formattedAnnotation);
  } catch (error) {
    console.error('更新标注错误:', error);
    res.status(500).json({ error: '更新标注失败' });
  }
};

// 删除标注
export const deleteAnnotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 检查标注是否存在且属于当前用户
    const existingAnnotation = await prisma.annotation.findFirst({
      where: { id, userId },
    });

    if (!existingAnnotation) {
      res.status(404).json({ error: '标注不存在' });
      return;
    }

    // 删除标注（级联删除关联）
    await prisma.annotation.delete({
      where: { id },
    });

    res.json({ message: '标注删除成功' });
  } catch (error) {
    console.error('删除标注错误:', error);
    res.status(500).json({ error: '删除标注失败' });
  }
};

// 全局搜索标注
export const searchAnnotations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { keyword } = req.query;

    if (!keyword) {
      res.status(400).json({ error: '搜索关键词不能为空' });
      return;
    }

    const annotations = await prisma.annotation.findMany({
      where: {
        userId,
        text: {
          contains: keyword as string,
          mode: 'insensitive',
        },
      },
      include: {
        tags: {
          include: {
            tagPlacement: {
              include: {
                tag: true,
              },
            },
          },
        },
        novel: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 格式化返回
    const formattedAnnotations = annotations.map((annotation) => ({
      ...annotation,
      tagIds: annotation.tags.map((at) => at.placementId),
      tags: annotation.tags.map((at) => ({
        id: at.placementId,
        name: at.tagPlacement.tag.name,
        color: at.tagPlacement.tag.color,
        userId: at.tagPlacement.userId,
        novelId: at.tagPlacement.novelId,
        parentId: at.tagPlacement.parentPlacementId,
        createdAt: at.tagPlacement.createdAt,
      })),
    }));

    res.json(formattedAnnotations);
  } catch (error) {
    console.error('搜索标注错误:', error);
    res.status(500).json({ error: '搜索标注失败' });
  }
};
