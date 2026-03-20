import { PrismaClient } from '@prisma/client';

// instancia singleton de prisma para evitar múltiples conexiones a la DB
const prisma = new PrismaClient();

export default prisma;
