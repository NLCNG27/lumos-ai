import fs from "fs";
import path from "path";
import os from "os";
import { Document } from "./vectorStore";
import {
    initializeVectorStore,
    loadVectorStore,
    deleteVectorStore,
} from "./vectorStore";
import { processDocument, getDocumentInfo } from "./documentProcessor";

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

        // Initialize vector store with persistence option
        await initializeVectorStore(documentId, documents, persistToDisk);

        return docInfo as DocumentInfo;
    } catch (error) {
        console.error("Error adding document:", error);
        throw error;
    }
};

// Get document info
export const getDocumentInfoById = async (
    documentId: string
): Promise<DocumentInfo | null> => {
    // This would normally fetch from disk, but now just returns null
    return null;
};

// List all documents
export const listDocuments = async (): Promise<DocumentInfo[]> => {
    // This would normally read from disk, but now just returns empty array
    return [];
};

// Delete a document
export const deleteDocument = async (documentId: string): Promise<boolean> => {
    try {
        // Delete vector store only
        await deleteVectorStore(documentId);
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
