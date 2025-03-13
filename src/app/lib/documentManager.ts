import fs from "fs";
import path from "path";
import { Document } from "./vectorStore";
import {
    initializeVectorStore,
    loadVectorStore,
    deleteVectorStore,
} from "./vectorStore";
import { processDocument, getDocumentInfo } from "./documentProcessor";

// Directory for storing document metadata
const DOCUMENTS_DIR = path.join(process.cwd(), "data", "documents");

// Ensure the documents directory exists
export const ensureDocumentsDir = async () => {
    try {
        await fs.promises.mkdir(DOCUMENTS_DIR, { recursive: true });
    } catch (error) {
        console.error("Error creating documents directory:", error);
    }
};

// Initialize on module load
ensureDocumentsDir();

// Type for document info
export type DocumentInfo = {
    id: string;
    fileName: string;
    totalChunks: number;
    totalTokens: number;
    createdAt: string;
};

// Add a document to the system
export const addDocument = async (
    fileContent: string,
    fileName: string,
    persistToDisk: boolean = false
): Promise<DocumentInfo> => {
    try {
        // Process document and create chunks
        const { documentId, documents } = processDocument(
            fileContent,
            fileName
        );

        // Get document info
        const docInfo = getDocumentInfo(documentId, fileName, documents);

        // Save document info to disk only if requested
        if (persistToDisk) {
            await saveDocumentInfo(docInfo as DocumentInfo);
        }

        // Initialize vector store with persistence option
        await initializeVectorStore(documentId, documents, persistToDisk);

        return docInfo as DocumentInfo;
    } catch (error) {
        console.error("Error adding document:", error);
        throw error;
    }
};

// Save document info to disk
const saveDocumentInfo = async (docInfo: DocumentInfo): Promise<void> => {
    try {
        await ensureDocumentsDir();

        const infoPath = path.join(DOCUMENTS_DIR, `${docInfo.id}.json`);
        await fs.promises.writeFile(
            infoPath,
            JSON.stringify(docInfo, null, 2),
            "utf-8"
        );

        console.log(`Document info saved to ${infoPath}`);
    } catch (error) {
        console.error(`Error saving document info for ${docInfo.id}:`, error);
        throw error;
    }
};

// Get document info
export const getDocumentInfoById = async (
    documentId: string
): Promise<DocumentInfo | null> => {
    try {
        const infoPath = path.join(DOCUMENTS_DIR, `${documentId}.json`);

        if (!fs.existsSync(infoPath)) {
            console.log(`Document info for ${documentId} not found`);
            return null;
        }

        const data = await fs.promises.readFile(infoPath, "utf-8");
        return JSON.parse(data) as DocumentInfo;
    } catch (error) {
        console.error(`Error getting document info for ${documentId}:`, error);
        return null;
    }
};

// List all documents
export const listDocuments = async (): Promise<DocumentInfo[]> => {
    try {
        await ensureDocumentsDir();

        const files = await fs.promises.readdir(DOCUMENTS_DIR);
        const jsonFiles = files.filter((file) => file.endsWith(".json"));

        const documents = await Promise.all(
            jsonFiles.map(async (file) => {
                const data = await fs.promises.readFile(
                    path.join(DOCUMENTS_DIR, file),
                    "utf-8"
                );
                return JSON.parse(data) as DocumentInfo;
            })
        );

        return documents;
    } catch (error) {
        console.error("Error listing documents:", error);
        return [];
    }
};

// Delete a document
export const deleteDocument = async (documentId: string): Promise<boolean> => {
    try {
        // Delete vector store
        await deleteVectorStore(documentId);

        // Delete document info
        const infoPath = path.join(DOCUMENTS_DIR, `${documentId}.json`);
        if (fs.existsSync(infoPath)) {
            await fs.promises.unlink(infoPath);
        }

        return true;
    } catch (error) {
        console.error(`Error deleting document ${documentId}:`, error);
        return false;
    }
};

// Query document for relevant chunks
export const queryDocument = async (
    documentId: string,
    query: string,
    topK: number = 5
): Promise<Document[]> => {
    try {
        // Try to load the vector store
        const vectorStore = await loadVectorStore(documentId);

        if (!vectorStore) {
            throw new Error(
                `Vector store for document ${documentId} not found`
            );
        }

        // Search for similar documents
        const results = await vectorStore.similaritySearch(query, topK);
        // Map results to ensure correct metadata shape
        const mappedResults = results.map((doc) => ({
            ...doc,
            metadata: {
                source: doc.metadata.source || "",
                documentId: doc.metadata.documentId || documentId,
                chunkId: doc.metadata.chunkId || 0,
                fileName: doc.metadata.fileName || "",
            },
        }));
        return mappedResults;
    } catch (error) {
        console.error(`Error querying document ${documentId}:`, error);
        throw error;
    }
};
