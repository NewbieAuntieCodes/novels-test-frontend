import prisma from '../src/utils/prisma';

/**
 * 清理孤立的标注（引用了不存在的标签）
 */

async function cleanOrphanAnnotations() {
  console.log('开始清理孤立的标注...');

  try {
    // 获取所有标注
    const annotations = await prisma.annotation.findMany({
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    let deletedCount = 0;

    for (const annotation of annotations) {
      // 如果标注没有任何有效的标签，删除它
      if (annotation.tags.length === 0) {
        await prisma.annotation.delete({
          where: { id: annotation.id }
        });
        deletedCount++;
      }
    }

    console.log(`清理完成！删除了 ${deletedCount} 个孤立标注`);
  } catch (error) {
    console.error('清理失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanOrphanAnnotations();
