import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface LocalBookProject {
    projectId: string;
    sourceType: 'PDF' | 'EPUB' | 'MP3';
    originalFilename: string;
    pageCount: number;
    createdAt: number;
    // For MP3s
    duration?: number;
}

interface LocalPage {
    projectId: string;
    pageIndex: number;
    imageBlob: Blob;
    text?: string;
}

interface MerchCrafterDB extends DBSchema {
    projects: {
        key: string; // projectId
        value: LocalBookProject;
    };
    pages: {
        key: [string, number]; // [projectId, pageIndex]
        value: LocalPage;
        indexes: { 'by-project': string };
    };
}

const DB_NAME = 'merchcrafter-local-db';
const DB_VERSION = 1;

class LocalStore {
    private dbPromise: Promise<IDBPDatabase<MerchCrafterDB>>;

    constructor() {
        this.dbPromise = openDB<MerchCrafterDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Store project metadata
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'projectId' });
                }
                // Store page images/text
                if (!db.objectStoreNames.contains('pages')) {
                    const pageStore = db.createObjectStore('pages', { keyPath: ['projectId', 'pageIndex'] });
                    pageStore.createIndex('by-project', 'projectId');
                }
            },
        });
    }

    async saveProject(project: LocalBookProject): Promise<void> {
        const db = await this.dbPromise;
        await db.put('projects', project);
    }

    async getProject(projectId: string): Promise<LocalBookProject | undefined> {
        const db = await this.dbPromise;
        return db.get('projects', projectId);
    }

    async savePage(page: LocalPage): Promise<void> {
        const db = await this.dbPromise;
        await db.put('pages', page);
    }

    async getPage(projectId: string, pageIndex: number): Promise<LocalPage | undefined> {
        const db = await this.dbPromise;
        return db.get('pages', [projectId, pageIndex]);
    }

    async getProjectPages(projectId: string): Promise<LocalPage[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex('pages', 'by-project', projectId);
    }

    async getAllProjects(): Promise<LocalBookProject[]> {
        const db = await this.dbPromise;
        return db.getAll('projects');
    }
    async deleteProject(projectId: string): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(['projects', 'pages'], 'readwrite');
        await tx.objectStore('projects').delete(projectId);

        // Delete all pages for this project
        // IDB index delete support varies, standard way is iterate keys
        const pageStore = tx.objectStore('pages');
        const index = pageStore.index('by-project');
        let cursor = await index.openKeyCursor(projectId);
        while (cursor) {
            await pageStore.delete(cursor.primaryKey);
            cursor = await cursor.continue();
        }
        await tx.done;
    }
}

export const localStore = new LocalStore();
export type { LocalBookProject, LocalPage };
