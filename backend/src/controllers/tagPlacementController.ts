import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// 获取所有标签挂载（可按小说ID筛选）
export const getTagPlacements = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const userId = req.user!.id;
    const { novelId } = req.query;

    const where: any = { userId };

    if (novelId) {
      where.novelId = novelId as string;
    }

    console.log(`[getTagPlacements] 开始查询 userId=${userId}, novelId=${novelId || 'all'}`);
    const placements = await prisma.tagPlacement.findMany({
      where,
      include: {
        tag: true, // 包含标签定义
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' }
      ],
    });
    const duration = Date.now() - startTime;
    console.log(`[getTagPlacements] 查询完成，耗时: ${duration}ms, 返回数量: ${placements.length}`);

    res.json(placements);
  } catch (error) {
    console.error('获取标签挂载列表错误:', error);
    res.status(500).json({ error: '获取标签挂载列表失败' });
  }
};

// 创建标签挂载（引用现有标签）
export const createTagPlacement = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { tagId, parentPlacementId, novelId, displayOrder } = req.body;

    if (!tagId) {
      res.status(400).json({ error: '标签ID不能为空' });
      return;
    }

    // 验证标签存在且属于当前用户
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    });

    if (!tag) {
      res.status(404).json({ error: '标签不存在' });
      return;
    }

    // 如果指定了novelId，验证小说存在且属于当前用户
    if (novelId) {
      const novel = await prisma.novel.findFirst({
        where: { id: novelId, userId },
      });

      if (!novel) {
        res.status(404).json({ error: '小说不存在' });
        return;
      }
    }

    // 如果指定了父挂载，验证父挂载存在且属于当前用户和同一小说
    if (parentPlacementId) {
      const parentPlacement = await prisma.tagPlacement.findFirst({
        where: { id: parentPlacementId, userId, novelId: novelId || null },
      });

      if (!parentPlacement) {
        res.status(404).json({ error: '父挂载不存在' });
        return;
      }
    }

    // 检查是否已存在相同的挂载（同一位置同一标签）
    const existingPlacement = await prisma.tagPlacement.findFirst({
      where: {
        userId,
        novelId: novelId || null,
        tagId,
        parentPlacementId: parentPlacementId || null,
      },
    });

    if (existingPlacement) {
      res.status(409).json({ error: '该位置已存在此标签的挂载' });
      return;
    }

    const placement = await prisma.tagPlacement.create({
      data: {
        tagId,
        parentPlacementId: parentPlacementId || null,
        novelId: novelId || null,
        userId,
        displayOrder: displayOrder || 0,
      },
      include: {
        tag: true,
      },
    });

    res.status(201).json(placement);
  } catch (error) {
    console.error('创建标签挂载错误:', error);
    res.status(500).json({ error: '创建标签挂载失败' });
  }
};

// 创建新标签并立即挂载
export const createTagWithPlacement = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, color, parentPlacementId, novelId, displayOrder } = req.body;

    if (!name || !color) {
      res.status(400).json({ error: '标签名称和颜色不能为空' });
      return;
    }

    // 检查标签是否已存在（同一用户）
    let tag = await prisma.tag.findFirst({
      where: { userId, name },
    });

    // 如果标签不存在，创建新标签
    if (!tag) {
      tag = await prisma.tag.create({
        data: { name, color, userId },
      });
    }

    // 创建挂载
    const placement = await prisma.tagPlacement.create({
      data: {
        tagId: tag.id,
        parentPlacementId: parentPlacementId || null,
        novelId: novelId || null,
        userId,
        displayOrder: displayOrder || 0,
      },
      include: {
        tag: true,
      },
    });

    res.status(201).json(placement);
  } catch (error) {
    console.error('创建标签和挂载错误:', error);
    res.status(500).json({ error: '创建标签和挂载失败' });
  }
};

// 更新标签挂载
export const updateTagPlacement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { parentPlacementId, displayOrder } = req.body;

    // 检查挂载是否存在且属于当前用户
    const existingPlacement = await prisma.tagPlacement.findFirst({
      where: { id, userId },
    });

    if (!existingPlacement) {
      res.status(404).json({ error: '标签挂载不存在' });
      return;
    }

    const updateData: any = {};
    if (parentPlacementId !== undefined) updateData.parentPlacementId = parentPlacementId;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    const placement = await prisma.tagPlacement.update({
      where: { id },
      data: updateData,
      include: {
        tag: true,
      },
    });

    res.json(placement);
  } catch (error) {
    console.error('更新标签挂载错误:', error);
    res.status(500).json({ error: '更新标签挂载失败' });
  }
};

// 删除标签挂载（只删除挂载，不删除标签定义）
export const deleteTagPlacement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 检查挂载是否存在且属于当前用户
    const existingPlacement = await prisma.tagPlacement.findFirst({
      where: { id, userId },
    });

    if (!existingPlacement) {
      res.status(404).json({ error: '标签挂载不存在' });
      return;
    }

    // 删除挂载（级联删除子挂载）
    await prisma.tagPlacement.delete({
      where: { id },
    });

    res.json({ message: '标签挂载删除成功' });
  } catch (error) {
    console.error('删除标签挂载错误:', error);
    res.status(500).json({ error: '删除标签挂载失败' });
  }
};

// 获取标签的所有子孙挂载ID（用于聚合查询）
export const getDescendantPlacementIds = async (req: Request, res: Response): Promise<void> => {
  try {
    const { placementId } = req.params;
    const userId = req.user!.id;

    // 验证挂载存在
    const placement = await prisma.tagPlacement.findFirst({
      where: { id: placementId, userId },
    });

    if (!placement) {
      res.status(404).json({ error: '标签挂载不存在' });
      return;
    }

    // 递归获取所有子孙挂载
    const descendants: string[] = [];
    const queue: string[] = [placementId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await prisma.tagPlacement.findMany({
        where: { parentPlacementId: currentId, userId },
        select: { id: true },
      });

      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }

    res.json({ placementId, descendantIds: descendants });
  } catch (error) {
    console.error('获取子孙挂载错误:', error);
    res.status(500).json({ error: '获取子孙挂载失败' });
  }
};
