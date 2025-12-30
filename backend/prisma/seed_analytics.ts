import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding analytics data...');

    // Clear existing data (optional, but good for clean slate testing)
    // await prisma.generation.deleteMany();
    // await prisma.project.deleteMany();
    // await prisma.creditTransaction.deleteMany();
    // await prisma.user.deleteMany({ where: { role: 'USER' } }); 

    // Create 50 users over the last 30 days
    const users = [];
    const password = await bcrypt.hash('password123', 10);

    for (let i = 0; i < 50; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);

        const user = await prisma.user.create({
            data: {
                email: `user${i}_${Date.now()}@example.com`,
                password,
                role: 'USER',
                credits: Math.floor(Math.random() * 100),
                createdAt: date,
                lastLoginAt: Math.random() > 0.3 ? new Date(date.getTime() + 1000 * 60 * 60 * 24 * (Math.random() * (daysAgo - 1))) : null // Random login after creation
            }
        });
        users.push(user);
    }

    console.log(`Created ${users.length} users.`);

    // Create Projects and Generations
    const styles = ['Cyberpunk', 'Watercolor', 'Minimalist', 'Vintage', 'Anime'];
    const sources = ['PDF', 'EPUB', 'MP3'];

    for (const user of users) {
        // Random number of projects 0-5
        const numProjects = Math.floor(Math.random() * 6);
        for (let j = 0; j < numProjects; j++) {
            const projectDate = new Date(user.createdAt.getTime() + Math.random() * (Date.now() - user.createdAt.getTime()));

            const project = await prisma.project.create({
                data: {
                    userId: user.id,
                    sourceType: sources[Math.floor(Math.random() * sources.length)],
                    originalFilename: `book_${j}.pdf`,
                    status: 'READY',
                    createdAt: projectDate
                }
            });

            // Random generations 0-10
            const numGens = Math.floor(Math.random() * 11);
            for (let k = 0; k < numGens; k++) {
                const genDate = new Date(projectDate.getTime() + Math.random() * (Date.now() - projectDate.getTime()));
                const type = Math.random() > 0.8 ? 'FINAL' : 'PREVIEW'; // 20% finals

                await prisma.generation.create({
                    data: {
                        projectId: project.id,
                        type,
                        stylePreset: styles[Math.floor(Math.random() * styles.length)],
                        status: 'COMPLETED',
                        createdAt: genDate
                    }
                });

                // Credit transaction for generation
                await prisma.creditTransaction.create({
                    data: {
                        userId: user.id,
                        amount: type === 'FINAL' ? -5 : -1,
                        type: type,
                        createdAt: genDate
                    }
                });
            }
        }

        // Random Credit Purchases
        if (Math.random() > 0.7) {
            const purchaseDate = new Date(user.createdAt.getTime() + Math.random() * (Date.now() - user.createdAt.getTime()));
            const amount = [50, 100, 500][Math.floor(Math.random() * 3)];
            await prisma.creditTransaction.create({
                data: {
                    userId: user.id,
                    amount: amount,
                    type: 'PURCHASE',
                    createdAt: purchaseDate
                }
            });
        }
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
