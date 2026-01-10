import { prisma } from './src/services/db';
import bcrypt from 'bcryptjs';

async function resetPassword() {
    const email = 'u.walker@hotmail.com';
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
    });
    console.log(`Password reset for ${user.email} to '${newPassword}'`);
}

resetPassword()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
