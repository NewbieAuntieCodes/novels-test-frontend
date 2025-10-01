import { PrismaClient } from '@prisma/client';

// 创建 Prisma Client 单例
const prisma = new PrismaClient();

export default prisma;
