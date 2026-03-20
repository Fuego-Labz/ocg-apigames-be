"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// instancia singleton de prisma para evitar múltiples conexiones a la DB
const prisma = new client_1.PrismaClient();
exports.default = prisma;
