import { prisma } from './src/services/db';

async function checkUser() {
    const email = 'u.walker@hotmail.com';
    const user = await prisma.user.findUnique({ where: { email } });
    console.log(user ? `User found: ${user.email} (Role: ${user.role})` : 'User NOT found');
}

checkUser()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
