import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";

// Configure PDF.js worker
if (typeof window === "undefined") {
    // We're in a Node.js environment
    const pdfjsWorker = require("pdfjs-dist/build/pdf.worker.js");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * A PDF text extraction utility that uses pdfjs-dist for text extraction
 * and pdf-lib for metadata extraction
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
    try {
        // Use pdf-lib for metadata extraction
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pageCount = pdfDoc.getPageCount();

        let extractedText = `PDF Document with ${pageCount} pages.\n\n`;

        // Extract metadata
        try {
            const title = pdfDoc.getTitle();
            if (title) extractedText += `Title: ${title}\n`;

            const author = pdfDoc.getAuthor();
            if (author) extractedText += `Author: ${author}\n`;

            const subject = pdfDoc.getSubject();
            if (subject) extractedText += `Subject: ${subject}\n`;

            const keywords = pdfDoc.getKeywords();
            if (keywords) extractedText += `Keywords: ${keywords}\n`;

            const creationDate = pdfDoc.getCreationDate();
            if (creationDate)
                extractedText += `Created: ${creationDate.toISOString()}\n`;

            const modificationDate = pdfDoc.getModificationDate();
            if (modificationDate)
                extractedText += `Modified: ${modificationDate.toISOString()}\n`;

            extractedText += "\n";
        } catch (metadataError) {
            console.error("Error extracting PDF metadata:", metadataError);
        }

        // Use pdfjs-dist for text extraction
        try {
            // Load the PDF document with pdfjs
            const data = new Uint8Array(pdfBuffer);
            const loadingTask = pdfjs.getDocument({ data });
            const pdf = await loadingTask.promise;

            extractedText += `Content:\n`;

            // Extract text from each page (up to first 10 pages for performance)
            const maxPagesToExtract = Math.min(10, pdf.numPages);
            for (let i = 1; i <= maxPagesToExtract; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                extractedText += `\n--- Page ${i} ---\n`;

                // Extract text from the page
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(" ");

                extractedText += pageText + "\n";
            }

            // If there are more pages, add a note
            if (pdf.numPages > maxPagesToExtract) {
                extractedText += `\n[${
                    pdf.numPages - maxPagesToExtract
                } more pages not shown]\n`;
            }
        } catch (textExtractionError) {
            console.error(
                "Error extracting PDF text with pdfjs:",
                textExtractionError
            );

            // Fallback to basic information
            extractedText += `Content:\n`;
            extractedText += `This PDF has ${pageCount} pages. The text content could not be fully extracted, `;
            extractedText += `but the AI will analyze the document visually.\n\n`;

            // Add some generic content based on metadata to help with RAG
            if (pdfDoc.getTitle()) {
                extractedText += `This document is titled "${pdfDoc.getTitle()}". `;
            }

            if (pdfDoc.getAuthor()) {
                extractedText += `It was authored by ${pdfDoc.getAuthor()}. `;
            }

            if (pdfDoc.getSubject()) {
                extractedText += `The subject is: ${pdfDoc.getSubject()}. `;
            }

            if (pdfDoc.getKeywords()) {
                extractedText += `Keywords: ${pdfDoc.getKeywords()}. `;
            }
        }

        return extractedText;
    } catch (error) {
        console.error("Error extracting PDF text:", error);
        return "Error: Unable to extract text from this PDF file. The AI will analyze it visually instead.";
    }
}

/**
 * Extract just the basic metadata from a PDF
 */
export async function extractPdfMetadata(
    pdfBuffer: Buffer
): Promise<Record<string, any>> {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);

        const metadata = {
            pageCount: pdfDoc.getPageCount(),
            title: pdfDoc.getTitle() || "Unknown",
            author: pdfDoc.getAuthor() || "Unknown",
            subject: pdfDoc.getSubject() || "",
            keywords: pdfDoc.getKeywords() || "",
            creationDate: pdfDoc.getCreationDate()?.toISOString() || "Unknown",
            modificationDate:
                pdfDoc.getModificationDate()?.toISOString() || "Unknown",
        };

        return metadata;
    } catch (error) {
        console.error("Error extracting PDF metadata:", error);
        return { error: "Failed to extract metadata" };
    }
}

/**
 * Extract the structure of a PDF document
 */
export async function extractPdfStructure(pdfBuffer: Buffer): Promise<string> {
    try {
        // Load the PDF document
        const data = new Uint8Array(pdfBuffer);

        // Create loading options
        const loadingOptions = {
            data,
        };

        // Pass the options to getDocument
        const loadingTask = pdfjs.getDocument(loadingOptions);
        const pdf = await loadingTask.promise;

        let structure = "";
        const pageCount = pdf.numPages;

        // Extract outline/table of contents if available
        try {
            const outline = await pdf.getOutline();
            if (outline && outline.length > 0) {
                structure += "--- Document Outline ---\n";
                for (const item of outline) {
                    structure += `• ${item.title}\n`;
                    if (item.items && item.items.length > 0) {
                        for (const subItem of item.items) {
                            structure += `  - ${subItem.title}\n`;
                        }
                    }
                }
                structure += "\n";
            }
        } catch (e) {
            console.log("Could not extract outline");
        }

        // Extract page structure summary (first 5 pages max)
        structure += "--- Document Structure Summary ---\n";
        const maxPagesToAnalyze = Math.min(5, pageCount);

        for (let i = 1; i <= maxPagesToAnalyze; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Get page dimensions
            const viewport = page.getViewport({ scale: 1.0 });

            structure += `Page ${i} (${viewport.width.toFixed(
                0
            )}x${viewport.height.toFixed(0)}): `;

            // Extract headings or first few text items
            const items = textContent.items.slice(0, 3);
            if (items.length > 0) {
                const headings = items
                    .map((item: any) => item.str)
                    .filter((str: string) => str.trim().length > 0)
                    .join(" | ");
                structure += headings || "No text found";
            } else {
                structure += "No text content";
            }
            structure += "\n";
        }

        if (pageCount > maxPagesToAnalyze) {
            structure += `... and ${
                pageCount - maxPagesToAnalyze
            } more pages\n`;
        }

        return structure;
    } catch (error) {
        console.error("Error extracting PDF structure:", error);
        return "Could not analyze document structure";
    }
}
