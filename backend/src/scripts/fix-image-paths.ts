
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fixing image paths...");

    // Find generations with old path format
    const generations = await prisma.generation.findMany({
        where: {
            imageUrl: {
                startsWith: '/generated/'
            }
        }
    });

    console.log(`Found ${generations.length} records to update.`);

    for (const gen of generations) {
        if (gen.imageUrl && gen.imageUrl.startsWith('/generated/')) {
            const newUrl = '/public' + gen.imageUrl;
            await prisma.generation.update({
                where: { id: gen.id },
                data: { imageUrl: newUrl }
            });
            console.log(`Updated ID ${gen.id}: ${gen.imageUrl} -> ${newUrl}`);
        }
    }

    console.log("Done.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
