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

        return vectorStore;
    } catch (error) {
        console.error("Error initializing vector store:", error);
        throw error;
    }
};

// Load vector store from memory
export const loadVectorStore = async (
    documentId: string
): Promise<MemoryVectorStore | null> => {
    try {
        // Check if already in memory
        if (vectorStores[documentId]) {
            return vectorStores[documentId];
        }
        return null;
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
            // Only try loading from memory
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

        return true;
    } catch (error) {
        console.error(
            `Error deleting vector store for document ${documentId}:`,
            error
        );
        return false;
    }
};
