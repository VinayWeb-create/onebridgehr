import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const connections = await prisma.googleDriveConnection.findMany();
  console.log(`Found ${connections.length} Google Drive connections.`);
  if (connections.length > 0) {
    console.log(JSON.stringify(connections, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
