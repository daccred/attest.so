import { PrismaClient } from '@prisma/client';

const enablePrismaDebug =
  process.env.PRISMA_DEBUG === '1' ||
  process.env.PRISMA_DEBUG === 'true' ||
  process.env.NODE_ENV === 'development';

const prisma = new PrismaClient({
  log: enablePrismaDebug
    ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
    : ['error']
});

if (enablePrismaDebug) {
  (prisma as any).$on('query', (e: any) => {
    console.debug(`[prisma] ${e.duration}ms ${e.query}`, e.params);
  });
}

export default prisma;