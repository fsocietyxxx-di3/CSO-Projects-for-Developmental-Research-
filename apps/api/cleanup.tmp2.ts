import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
await (async() {
  const removed = await prisma.user.deleteMany({ where: { authId: "dev-admin" } });
  console.log(`stray bypass rows removed: ${removed.count}`);
})()
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
