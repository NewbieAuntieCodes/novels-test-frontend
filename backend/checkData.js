const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const annotationCount = await prisma.annotation.count();
  const tagPlacementCount = await prisma.tagPlacement.count();
  const annotationTagCount = await prisma.annotationTag.count();

  console.log('Annotation count:', annotationCount);
  console.log('TagPlacement count:', tagPlacementCount);
  console.log('AnnotationTag count:', annotationTagCount);

  // 检查前5个 AnnotationTag 记录
  const sampleAnnotationTags = await prisma.annotationTag.findMany({
    take: 5,
    include: {
      tagPlacement: {
        include: {
          tag: true
        }
      }
    }
  });

  console.log('\nSample AnnotationTag records:');
  sampleAnnotationTags.forEach(at => {
    console.log({
      annotationId: at.annotationId,
      placementId: at.placementId,
      tagPlacement: at.tagPlacement ? {
        id: at.tagPlacement.id,
        tagId: at.tagPlacement.tagId,
        tagName: at.tagPlacement.tag?.name
      } : null
    });
  });

  // 检查一个完整的标注
  const sampleAnnotation = await prisma.annotation.findFirst({
    include: {
      tags: {
        include: {
          tagPlacement: {
            include: {
              tag: true
            }
          }
        }
      }
    }
  });

  if (sampleAnnotation) {
    console.log('\nSample Annotation:');
    console.log(JSON.stringify(sampleAnnotation, null, 2));
  }

  await prisma.$disconnect();
}

checkData().catch(console.error);
