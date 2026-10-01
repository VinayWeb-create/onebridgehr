const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetId = '6a96afdca38c589daf154cad';
  console.log(`Deleting duplicate attendance record ID: ${targetId}...`);
  const deleted = await prisma.attendance.delete({
    where: { id: targetId },
  });
  console.log('Successfully deleted:', deleted);

  const remaining = await prisma.attendance.findMany({
    where: { employeeId: 'OBI0006' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('\n--- Remaining Records for OBI0006 ---');
  remaining.forEach((r, i) => {
    console.log(`[${i}] ID: ${r.id}, Date: ${r.date?.toISOString()}, CheckIn: ${r.checkIn?.toISOString()}, CheckOut: ${r.checkOut?.toISOString()}, Status: ${r.status}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
