import prisma from '../src/config/prisma';

// mapeo de proveedores conocidos: ID numérico -> nombre real
const KNOWN_PROVIDERS: Record<string, string> = {
  '0':  'Lucky Streak',
  '9':  'Fugaso',
  '10': 'Betsoft',
  '57': 'Pragmatic Play',
  '61': 'Evolution Gaming',
};

async function seedProviders() {
  console.log('Seeding providers...');

  for (const [id, name] of Object.entries(KNOWN_PROVIDERS)) {
    await prisma.provider.upsert({
      where: { id },
      update: { name },
      create: { id, name },
    });
    console.log(`  ✔ Provider ${id} -> "${name}"`);
  }

  console.log('Seed completado.');
}

seedProviders()
  .catch((e) => {
    console.error('Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
