import prisma from '../src/utils/prisma';

/**
 * 迁移脚本：将现有标签与小说关联
 *
 * 由于之前标签是全局的，现在改成每个小说独立，需要：
 * 1. 将"待标注"标签设为全局（novelId=null）
 * 2. 删除其他所有标签（让用户重新创建）
 *
 * 或者更温和的方式：
 * 1. 保留"待标注"为全局标签
 * 2. 将其他标签分配给第一部小说（如果有的话）
 */

async function migrateTags() {
  console.log('开始迁移标签数据...');

  try {
    // 方案1：清理所有标签，只保留"待标注"
    const pendingTagName = '待标注';

    // 获取所有用户
    const users = await prisma.user.findMany();

    for (const user of users) {
      console.log(`处理用户 ${user.username} 的标签...`);

      // 删除该用户的所有非"待标注"标签
      const deletedTags = await prisma.tag.deleteMany({
        where: {
          userId: user.id,
          NOT: {
            name: pendingTagName,
          },
        },
      });

      console.log(`  删除了 ${deletedTags.count} 个标签`);

      // 确保"待标注"标签的 novelId 为 null
      await prisma.tag.updateMany({
        where: {
          userId: user.id,
          name: pendingTagName,
        },
        data: {
          novelId: null,
        },
      });

      console.log(`  已将"待标注"标签设为全局`);
    }

    console.log('标签迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateTags();
