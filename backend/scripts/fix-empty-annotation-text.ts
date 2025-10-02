import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEmptyAnnotationText() {
  console.log('开始检查和修复空文本标注...');

  try {
    // 查找所有text为空或无效的标注
    const annotations = await prisma.annotation.findMany({
      include: {
        novel: {
          select: {
            text: true
          }
        }
      }
    });

    console.log(`总共找到 ${annotations.length} 条标注记录`);

    let fixedCount = 0;
    let emptyCount = 0;

    for (const annotation of annotations) {
      // 检查text是否为空、null或undefined
      if (!annotation.text || annotation.text.trim() === '') {
        emptyCount++;
        console.log(`\n发现空文本标注: ID=${annotation.id}`);
        console.log(`  位置: startIndex=${annotation.startIndex}, endIndex=${annotation.endIndex}`);

        // 尝试从小说文本中提取正确的文本
        const novelText = annotation.novel.text;
        if (novelText &&
            annotation.startIndex >= 0 &&
            annotation.endIndex <= novelText.length &&
            annotation.startIndex < annotation.endIndex) {

          const extractedText = novelText.substring(annotation.startIndex, annotation.endIndex);

          if (extractedText && extractedText.trim()) {
            // 更新标注的text字段
            await prisma.annotation.update({
              where: { id: annotation.id },
              data: { text: extractedText }
            });

            fixedCount++;
            console.log(`  ✓ 已修复，新文本: "${extractedText.substring(0, 50)}${extractedText.length > 50 ? '...' : ''}"`);
          } else {
            console.log(`  ✗ 无法提取有效文本（提取结果为空）`);
          }
        } else {
          console.log(`  ✗ 无法提取文本（索引无效或小说文本不存在）`);
        }
      }
    }

    console.log(`\n\n修复完成！`);
    console.log(`  发现空文本标注: ${emptyCount} 条`);
    console.log(`  成功修复: ${fixedCount} 条`);
    console.log(`  无法修复: ${emptyCount - fixedCount} 条`);

  } catch (error) {
    console.error('修复过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmptyAnnotationText();
