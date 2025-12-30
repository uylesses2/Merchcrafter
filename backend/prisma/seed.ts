import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@merchcrafter.com';
    const password = 'adminpassword';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: { role: 'ADMIN' },
        create: {
            email,
            password: hashedPassword,
            role: 'ADMIN',
            credits: 9999,
        },
    });

    console.log({ user });
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
