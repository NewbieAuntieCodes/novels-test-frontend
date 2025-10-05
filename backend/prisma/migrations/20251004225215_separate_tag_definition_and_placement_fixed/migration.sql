-- ============================================================
-- 修复版迁移脚本：Tag 定义与 Placement 分离
-- 核心修复：确保所有外键引用有效，保留所有原始数据
-- ============================================================

PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;

-- ============================================================
-- 第一步：创建新的 Tag 表（只存储定义）
-- ============================================================
CREATE TABLE "new_Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 插入唯一的标签定义（每个用户的每个标签名只保留一个）
-- 使用 MIN(id) 确保 ID 稳定，优先使用最早创建的标签
INSERT INTO "new_Tag" ("id", "name", "color", "userId", "createdAt")
SELECT
    MIN(id) as id,           -- 使用最早创建的标签的 ID
    name,
    MAX(color) as color,     -- 如果颜色不同，使用字典序最大的
    userId,
    MIN(createdAt) as createdAt
FROM "Tag"
GROUP BY userId, name;

-- ============================================================
-- 第二步：创建标签映射表（old_id -> new_id）
-- ============================================================
CREATE TEMPORARY TABLE tag_id_mapping AS
SELECT
    t.id as old_id,
    (
        SELECT nt.id
        FROM "new_Tag" nt
        WHERE nt.userId = t.userId
          AND nt.name = t.name
        LIMIT 1
    ) as new_id
FROM "Tag" t;

-- ============================================================
-- 第三步：创建 TagPlacement 表
-- ============================================================
CREATE TABLE "TagPlacement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "parentPlacementId" TEXT,
    "novelId" TEXT,
    "userId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TagPlacement_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "new_Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TagPlacement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TagPlacement_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TagPlacement_parentPlacementId_fkey" FOREIGN KEY ("parentPlacementId") REFERENCES "TagPlacement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 为每个原始标签创建一个 placement 记录
INSERT INTO "TagPlacement" ("id", "tagId", "parentPlacementId", "novelId", "userId", "displayOrder", "createdAt")
SELECT
    'placement_' || t.id as id,
    (SELECT new_id FROM tag_id_mapping WHERE old_id = t.id) as tagId,
    CASE
        WHEN t.parentId IS NOT NULL THEN 'placement_' || t.parentId
        ELSE NULL
    END as parentPlacementId,
    t.novelId,
    t.userId,
    0 as displayOrder,
    t.createdAt
FROM "Tag" t;

-- ============================================================
-- 第四步：更新 AnnotationTag 表的外键引用
-- ============================================================
-- AnnotationTag 中的 tagId 需要更新为新的标签 ID
CREATE TABLE "new_AnnotationTag" (
    "annotationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    PRIMARY KEY ("annotationId", "tagId"),
    CONSTRAINT "AnnotationTag_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "Annotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnotationTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "new_Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 迁移数据，使用映射表更新 tagId
INSERT INTO "new_AnnotationTag" ("annotationId", "tagId")
SELECT DISTINCT
    at.annotationId,
    (SELECT new_id FROM tag_id_mapping WHERE old_id = at.tagId) as tagId
FROM "AnnotationTag" at;

-- ============================================================
-- 第五步：替换旧表
-- ============================================================
DROP TABLE "AnnotationTag";
ALTER TABLE "new_AnnotationTag" RENAME TO "AnnotationTag";

DROP TABLE "Tag";
ALTER TABLE "new_Tag" RENAME TO "Tag";

-- ============================================================
-- 第六步：创建索引和唯一约束
-- ============================================================
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

CREATE INDEX "AnnotationTag_tagId_idx" ON "AnnotationTag"("tagId");
CREATE INDEX "AnnotationTag_annotationId_idx" ON "AnnotationTag"("annotationId");

CREATE INDEX "TagPlacement_userId_idx" ON "TagPlacement"("userId");
CREATE INDEX "TagPlacement_novelId_idx" ON "TagPlacement"("novelId");
CREATE INDEX "TagPlacement_tagId_idx" ON "TagPlacement"("tagId");
CREATE UNIQUE INDEX "TagPlacement_userId_novelId_tagId_parentPlacementId_key" ON "TagPlacement"("userId", "novelId", "tagId", "parentPlacementId");

-- ============================================================
-- 清理
-- ============================================================
DROP TABLE tag_id_mapping;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
