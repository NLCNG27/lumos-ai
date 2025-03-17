import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import fs from "fs";
import path from "path";
import os from "os";

// Define a type for the document with metadata
export type Document = {
    pageContent: string;
    metadata: {
        source: string;
        documentId: string;
        chunkId: number;
        fileName: string;
    };
};

// In-memory stores by document ID
const vectorStores: Record<string, MemoryVectorStore> = {};
const documentsById: Record<string, Document[]> = {};

// Function to get the appropriate data directory based on environment
const getDataDirectory = () => {
    // Check if we're in a serverless environment (like Vercel/AWS Lambda)
    if (process.env.NODE_ENV === 'production') {
        // Use the OS temp directory which is writable in most serverless environments
        return path.join(os.tmpdir(), 'lumos-data');
    } else {
        // In development, use the local data directory
        return path.join(process.cwd(), 'data');
    }
};

// Directory for storing vector stores
const VECTOR_STORE_DIR = path.join(getDataDirectory(), "vector-stores");

// Ensure the vector store directory exists
export const ensureVectorStoreDir = async () => {
    try {
        console.log(`Creating vector store directory: ${VECTOR_STORE_DIR}`);
        await fs.promises.mkdir(VECTOR_STORE_DIR, { recursive: true });
        console.log(`Successfully created vector store directory: ${VECTOR_STORE_DIR}`);
    } catch (error) {
        console.error("Error creating vector store directory:", error);
        throw error; // Re-throw to make sure the error is handled properly
    }
};

// Initialize on module load - but don't block execution
(async () => {
    try {
        console.log(`Using data directory: ${getDataDirectory()}`);
        await ensureVectorStoreDir();
    } catch (error) {
        console.error("Failed to initialize vector store directory:", error);
    }
})();

// Initialize the vector store for a document
export const initializeVectorStore = async (
    documentId: string,
    documents: Document[],
    persistToDisk: boolean = false
) => {
    try {
        const embeddings = new OpenAIEmbeddings();
        const vectorStore = await MemoryVectorStore.fromDocuments(
            documents,
            embeddings
        );

        // Store in memory
        vectorStores[documentId] = vectorStore;
        documentsById[documentId] = documents;

        // Persist to disk only if requested
        if (persistToDisk) {
            await persistVectorStore(documentId);
        }

        return vectorStore;
    } catch (error) {
        console.error("Error initializing vector store:", error);
        throw error;
    }
};

// Persist vector store to disk
export const persistVectorStore = async (documentId: string) => {
    try {
        if (!vectorStores[documentId] || !documentsById[documentId]) {
            console.error(`Vector store for document ${documentId} not found`);
            return;
        }

        // Ensure directory exists
        await ensureVectorStoreDir();

        // Save documents with their embeddings
        const storePath = path.join(VECTOR_STORE_DIR, `${documentId}.json`);
        await fs.promises.writeFile(
            storePath,
            JSON.stringify({ documents: documentsById[documentId] }),
            "utf-8"
        );

        console.log(
            `Vector store for document ${documentId} persisted to ${storePath}`
        );
    } catch (error) {
        console.error(
            `Error persisting vector store for document ${documentId}:`,
            error
        );
    }
};

// Load vector store from disk
export const loadVectorStore = async (
    documentId: string
): Promise<MemoryVectorStore | null> => {
    try {
        // Check if already in memory
        if (vectorStores[documentId]) {
            return vectorStores[documentId];
        }

        // Try to load from disk
        const storePath = path.join(VECTOR_STORE_DIR, `${documentId}.json`);

        if (!fs.existsSync(storePath)) {
            console.log(`Vector store file for ${documentId} not found`);
            return null;
        }

        const data = JSON.parse(await fs.promises.readFile(storePath, "utf-8"));
        const documents = data.documents as Document[];

        // Recreate the vector store
        const embeddings = new OpenAIEmbeddings();
        const vectorStore = await MemoryVectorStore.fromDocuments(
            documents,
            embeddings
        );

        // Cache in memory
        vectorStores[documentId] = vectorStore;
        documentsById[documentId] = documents;

        return vectorStore;
    } catch (error) {
        console.error(
            `Error loading vector store for document ${documentId}:`,
            error
        );
        return null;
    }
};

// Search for relevant documents
export const searchDocuments = async (
    documentId: string,
    query: string,
    topK: number = 5
): Promise<Document[]> => {
    try {
        // Make sure vector store is loaded
        let vectorStore = vectorStores[documentId];
        if (!vectorStore) {
            // Only try loading from disk if we don't have it in memory
            const loadedStore = await loadVectorStore(documentId);
            if (!loadedStore) {
                throw new Error(
                    `Vector store for document ${documentId} not found`
                );
            }
            vectorStore = loadedStore;
        }

        // Search for similar documents
        const results = (await vectorStore.similaritySearch(
            query,
            topK
        )) as Document[];
        return results;
    } catch (error) {
        console.error(`Error searching in document ${documentId}:`, error);
        throw error;
    }
};

// Delete a vector store
export const deleteVectorStore = async (
    documentId: string
): Promise<boolean> => {
    try {
        // Remove from memory
        delete vectorStores[documentId];
        delete documentsById[documentId];

        // Remove from disk
        const storePath = path.join(VECTOR_STORE_DIR, `${documentId}.json`);
        if (fs.existsSync(storePath)) {
            await fs.promises.unlink(storePath);
        }

        return true;
    } catch (error) {
        console.error(
            `Error deleting vector store for document ${documentId}:`,
            error
        );
        return false;
    }
};
