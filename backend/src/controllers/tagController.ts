import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { CreateTagRequest, UpdateTagRequest } from '../types';

// 获取所有标签
export const getTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    res.json(tags);
  } catch (error) {
    console.error('获取标签列表错误:', error);
    res.status(500).json({ error: '获取标签列表失败' });
  }
};

// 创建标签
export const createTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, color, parentId }: CreateTagRequest = req.body;

    if (!name || !color) {
      res.status(400).json({ error: '标签名称和颜色不能为空' });
      return;
    }

    // 检查是否已存在同名标签
    const existingTag = await prisma.tag.findUnique({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
    });

    if (existingTag) {
      res.status(409).json({ error: '标签名称已存在' });
      return;
    }

    // 如果指定了父标签，验证父标签存在且属于当前用户
    if (parentId) {
      const parentTag = await prisma.tag.findFirst({
        where: { id: parentId, userId },
      });

      if (!parentTag) {
        res.status(404).json({ error: '父标签不存在' });
        return;
      }
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color,
        parentId: parentId || null,
        userId,
      },
    });

    res.status(201).json(tag);
  } catch (error) {
    console.error('创建标签错误:', error);
    res.status(500).json({ error: '创建标签失败' });
  }
};

// 更新标签
export const updateTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, color, parentId }: UpdateTagRequest = req.body;

    // 检查标签是否存在且属于当前用户
    const existingTag = await prisma.tag.findFirst({
      where: { id, userId },
    });

    if (!existingTag) {
      res.status(404).json({ error: '标签不存在' });
      return;
    }

    // 如果修改名称，检查新名称是否已被使用
    if (name && name !== existingTag.name) {
      const duplicateTag = await prisma.tag.findUnique({
        where: {
          userId_name: {
            userId,
            name,
          },
        },
      });

      if (duplicateTag) {
        res.status(409).json({ error: '标签名称已存在' });
        return;
      }
    }

    // 准备更新数据
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (parentId !== undefined) updateData.parentId = parentId;

    const tag = await prisma.tag.update({
      where: { id },
      data: updateData,
    });

    res.json(tag);
  } catch (error) {
    console.error('更新标签错误:', error);
    res.status(500).json({ error: '更新标签失败' });
  }
};

// 删除标签
export const deleteTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 检查标签是否存在且属于当前用户
    const existingTag = await prisma.tag.findFirst({
      where: { id, userId },
    });

    if (!existingTag) {
      res.status(404).json({ error: '标签不存在' });
      return;
    }

    // 删除标签（级联删除子标签和关联的标注）
    await prisma.tag.delete({
      where: { id },
    });

    res.json({ message: '标签删除成功' });
  } catch (error) {
    console.error('删除标签错误:', error);
    res.status(500).json({ error: '删除标签失败' });
  }
};
