
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@merchcrafter.com';
    const password = 'admin'; // Simple for dev
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: 'ADMIN' // Enforce Admin Role
        },
        create: {
            email,
            password: hashedPassword,
            role: 'ADMIN',
            credits: 9999
        }
    });

    console.log(`
    =============================================
    ✅ Admin User Ready
    =============================================
    Email:    ${email}
    Password: ${password}
    =============================================
    `);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
