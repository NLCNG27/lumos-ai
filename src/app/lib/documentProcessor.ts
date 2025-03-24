import { Document } from "./vectorStore";
import crypto from "crypto";

// Default chunking parameters
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

// Generate a document ID from the file content
export const generateDocumentId = (
    fileContent: string,
    fileName: string
): string => {
    const hash = crypto
        .createHash("md5")
        .update(`${fileName}-${fileContent.slice(0, 1000)}`) // Use first 1000 chars to identify the document
        .digest("hex");

    return hash;
};

// Process file content and create chunked documents
export const processDocument = (
    fileContent: string,
    fileName: string,
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    chunkOverlap: number = DEFAULT_CHUNK_OVERLAP
): {
    documentId: string;
    documents: Document[];
} => {
    // Generate a document ID
    const documentId = generateDocumentId(fileContent, fileName);

    // Special handling for PDFs - preserve metadata at the beginning
    let chunks: string[] = [];

    if (fileName.toLowerCase().endsWith(".pdf")) {
        // For PDFs, keep metadata in the first chunk
        const metadataMatch = fileContent.match(/^(PDF Document.*?Content:)/);

        if (metadataMatch && metadataMatch[0]) {
            const metadata = metadataMatch[0];
            // The first chunk contains metadata plus some content
            const firstContentChunk = fileContent
                .substring(metadata.length)
                .trim();

            // Split the rest of the content
            const remainingChunks = chunkText(
                firstContentChunk,
                chunkSize,
                chunkOverlap
            );

            // Create the first chunk with metadata
            const firstChunkSize = Math.max(chunkSize - metadata.length, 200);
            const firstChunk =
                metadata +
                (remainingChunks.length > 0
                    ? remainingChunks[0].substring(0, firstChunkSize)
                    : "");

            // Add it to our chunks
            chunks = [firstChunk];

            // If we took content from the first chunk, adjust it
            if (
                remainingChunks.length > 0 &&
                firstChunkSize < remainingChunks[0].length
            ) {
                remainingChunks[0] =
                    remainingChunks[0].substring(firstChunkSize);
            }

            // Add the remaining chunks
            chunks = chunks.concat(remainingChunks);
        } else {
            // Fallback to normal chunking if no metadata found
            chunks = chunkText(fileContent, chunkSize, chunkOverlap);
        }
    } 
    else if (fileName.toLowerCase().endsWith(".docx") || 
             fileName.toLowerCase().includes("word")) {
        // For Word documents, preserve document structure if present
        const metadataMatch = fileContent.match(/^\[DOCX Document:.*?\]\s*\n\n/);
        
        if (metadataMatch && metadataMatch[0]) {
            const metadata = metadataMatch[0];
            // The first chunk contains metadata plus some content
            const firstContentChunk = fileContent
                .substring(metadata.length)
                .trim();

            // Split the rest of the content
            const remainingChunks = chunkText(
                firstContentChunk,
                chunkSize,
                chunkOverlap
            );

            // Create the first chunk with metadata
            const firstChunkSize = Math.max(chunkSize - metadata.length, 200);
            const firstChunk =
                metadata +
                (remainingChunks.length > 0
                    ? remainingChunks[0].substring(0, firstChunkSize)
                    : "");

            // Add it to our chunks
            chunks = [firstChunk];

            // If we took content from the first chunk, adjust it
            if (
                remainingChunks.length > 0 &&
                firstChunkSize < remainingChunks[0].length
            ) {
                remainingChunks[0] =
                    remainingChunks[0].substring(firstChunkSize);
            }

            // Add the remaining chunks
            chunks = chunks.concat(remainingChunks);
        } else {
            // Fallback to normal chunking if no metadata found
            chunks = chunkText(fileContent, chunkSize, chunkOverlap);
        }
    }
    else if (fileName.toLowerCase().endsWith(".xlsx") || 
             fileName.toLowerCase().includes("excel") || 
             fileName.toLowerCase().endsWith(".pptx") ||
             fileName.toLowerCase().includes("powerpoint")) {
        // For Excel and PowerPoint documents, similar approach as DOCX
        const metadataMatch = fileContent.match(/^\[(Excel|PowerPoint) Document:.*?\]\s*\n\n/);
        
        if (metadataMatch && metadataMatch[0]) {
            const metadata = metadataMatch[0];
            // The first chunk contains metadata plus some content
            const firstContentChunk = fileContent
                .substring(metadata.length)
                .trim();

            // Split the rest of the content
            const remainingChunks = chunkText(
                firstContentChunk,
                chunkSize,
                chunkOverlap
            );

            // Create the first chunk with metadata
            const firstChunkSize = Math.max(chunkSize - metadata.length, 200);
            const firstChunk =
                metadata +
                (remainingChunks.length > 0
                    ? remainingChunks[0].substring(0, firstChunkSize)
                    : "");

            // Add it to our chunks
            chunks = [firstChunk];

            // If we took content from the first chunk, adjust it
            if (
                remainingChunks.length > 0 &&
                firstChunkSize < remainingChunks[0].length
            ) {
                remainingChunks[0] =
                    remainingChunks[0].substring(firstChunkSize);
            }

            // Add the remaining chunks
            chunks = chunks.concat(remainingChunks);
        } else {
            // Fallback to normal chunking if no metadata found
            chunks = chunkText(fileContent, chunkSize, chunkOverlap);
        }
    }
    else {
        // Normal chunking for non-PDF files
        chunks = chunkText(fileContent, chunkSize, chunkOverlap);
    }

    // Convert to document format
    const documents = chunks.map((chunk, index) => ({
        pageContent: chunk,
        metadata: {
            source: determineDocumentSource(fileName),
            documentId,
            chunkId: index,
            fileName: fileName,
        },
    }));

    return { documentId, documents };
};

// Helper function to determine document source type
const determineDocumentSource = (fileName: string): string => {
    const lowerFileName = fileName.toLowerCase();
    if (lowerFileName.endsWith(".pdf")) {
        return "pdf";
    } else if (lowerFileName.endsWith(".docx") || lowerFileName.includes("word")) {
        return "docx";
    } else if (lowerFileName.endsWith(".xlsx") || lowerFileName.includes("excel")) {
        return "xlsx";
    } else if (lowerFileName.endsWith(".pptx") || lowerFileName.includes("powerpoint")) {
        return "pptx";
    } else {
        return "text";
    }
};

// Function to chunk text
const chunkText = (
    text: string,
    chunkSize: number,
    overlap: number
): string[] => {
    const chunks: string[] = [];

    // Handle empty or small content
    if (!text || text.length <= chunkSize) {
        return [text];
    }

    // Split by paragraphs first to maintain context
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = "";

    for (const paragraph of paragraphs) {
        // If adding this paragraph exceeds chunk size, save the current chunk and start new one
        if (currentChunk.length + paragraph.length > chunkSize) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
                // Keep the overlapping portion
                const words = currentChunk.split(/\s+/);
                if (words.length > overlap / 10) {
                    // Approx word count for overlap
                    currentChunk = words
                        .slice(-Math.floor(overlap / 10))
                        .join(" ");
                } else {
                    currentChunk = "";
                }
            }
        }

        // Add paragraph to current chunk with space
        if (currentChunk.length > 0 && !currentChunk.endsWith(" ")) {
            currentChunk += " ";
        }
        currentChunk += paragraph;

        // If current chunk is already over chunk size, save it
        if (currentChunk.length >= chunkSize) {
            chunks.push(currentChunk);
            // Keep the overlapping portion
            const words = currentChunk.split(/\s+/);
            if (words.length > overlap / 10) {
                currentChunk = words.slice(-Math.floor(overlap / 10)).join(" ");
            } else {
                currentChunk = "";
            }
        }
    }

    // Add the last chunk if not empty
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
};

// Create a summary of the document
export const createDocumentSummary = (documents: Document[]): string => {
    // Combine first portions of each chunk to create a summary
    const summaryText = documents
        .slice(0, 3) // Take first 3 chunks
        .map((doc) => doc.pageContent.slice(0, 200)) // Take first 200 chars of each
        .join("\n...\n");

    return `Document Summary (preview):\n${summaryText}\n...\n(Document contains ${documents.length} chunks of content in total)`;
};

// Get structured document info
export const getDocumentInfo = (
    documentId: string,
    fileName: string,
    documents: Document[]
): Record<string, any> => {
    return {
        id: documentId,
        fileName,
        totalChunks: documents.length,
        totalTokens: documents.reduce(
            (sum, doc) => sum + Math.ceil(doc.pageContent.length / 4),
            0
        ), // Rough token estimate
        createdAt: new Date().toISOString(),
    };
};
