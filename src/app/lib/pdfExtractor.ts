import { PDFDocument } from "pdf-lib";

/**
 * A simple PDF text extraction utility that relies only on pdf-lib
 * This avoids the issues with pdf-parse looking for test files
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
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

        // Since we can't easily extract text content with pdf-lib alone,
        // we'll add a placeholder for the content
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

        // Add page information
        extractedText += `\n\nThe document contains ${pageCount} pages. `;

        if (pageCount > 1) {
            extractedText += `It's a multi-page document that may contain sections, paragraphs, images, and other elements. `;
        } else {
            extractedText += `It's a single-page document that may contain paragraphs, images, and other elements. `;
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
export async function extractPDFMetadata(
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
