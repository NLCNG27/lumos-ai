/**
 * Document extraction utility for Office documents (DOCX, XLSX, PPTX)
 * Provides text extraction capabilities for various document formats
 */

import { Buffer } from 'buffer';

// Define types for JSZip to fix linter errors
interface JSZipObject {
    dir: boolean;
    async(type: string): Promise<string>;
}

/**
 * Extract text from a DOCX (Word) document
 * @param buffer The document buffer
 * @returns Extracted text content as string
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
    try {
        // Use mammoth.js for Word documents
        const mammoth = await import("mammoth");

        // Try different extraction methods for Word docx
        try {
            // First try with standard options
            const result = await mammoth.extractRawText({ buffer });
            if (result.value && result.value.trim().length > 0) {
                return result.value;
            }

            // If that fails, try with html extraction
            const htmlResult = await mammoth.convertToHtml({ buffer });
            if (htmlResult.value && htmlResult.value.trim().length > 0) {
                // Simple HTML to text conversion
                return htmlResult.value
                    .replace(/<[^>]+>/g, " ") // Replace HTML tags with spaces
                    .replace(/\s+/g, " ") // Replace multiple spaces with single space
                    .trim(); // Trim leading/trailing whitespace
            }

            throw new Error("No content extracted from Word document");
        } catch (extractError) {
            console.error("Error in mammoth extraction:", extractError);
            
            // Try using an alternative method if available
            try {
                // Try ZIP-based extraction as fallback
                return await extractTextFromZipArchive(buffer);
            } catch (zipError) {
                console.error("Error in ZIP extraction fallback:", zipError);
                throw extractError; // Re-throw the original error
            }
        }
    } catch (error) {
        console.error("Error extracting text from Word document:", error);
        throw new Error("Failed to extract text from Word document");
    }
}

/**
 * Extract text from an XLSX (Excel) document
 * @param buffer The document buffer
 * @returns Extracted text content as string
 */
export async function extractXlsxText(buffer: Buffer): Promise<string> {
    try {
        // Use xlsx for Excel files
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        
        let text = `Excel Workbook with ${workbook.SheetNames.length} sheets:\n\n`;
        
        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            text += `Sheet: ${sheetName}\n`;
            text += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
        }
        
        return text;
    } catch (error) {
        console.error("Error extracting text from Excel file:", error);
        
        // Try ZIP-based extraction as fallback
        try {
            return await extractTextFromZipArchive(buffer);
        } catch (zipError) {
            console.error("ZIP fallback failed too:", zipError);
            throw new Error("Failed to extract text from Excel file");
        }
    }
}

/**
 * Extract text from a PPTX (PowerPoint) document
 * @param buffer The document buffer
 * @returns Extracted text content as string
 */
export async function extractPptxText(buffer: Buffer): Promise<string> {
    try {
        // PowerPoint extraction is more complex, use ZIP-based extraction
        const textContent = await extractTextFromZipArchive(buffer);
        
        if (textContent && textContent.trim().length > 0) {
            return `PowerPoint Presentation Content:\n\n${textContent}`;
        }
        
        throw new Error("No content extracted from PowerPoint file");
    } catch (error) {
        console.error("Error extracting text from PowerPoint file:", error);
        throw new Error("Failed to extract text from PowerPoint file");
    }
}

/**
 * Generic function to extract text from any Office document
 * @param buffer The document buffer
 * @param fileType The MIME type of the file
 * @param fileName The name of the file
 * @returns Extracted text content as string
 */
export async function extractOfficeDocumentText(
    buffer: Buffer,
    fileType: string,
    fileName: string
): Promise<string> {
    // Handle different office document types
    if (
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.toLowerCase().endsWith(".docx")
    ) {
        return await extractDocxText(buffer);
    } else if (
        fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        fileName.toLowerCase().endsWith(".xlsx")
    ) {
        return await extractXlsxText(buffer);
    } else if (
        fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        fileName.toLowerCase().endsWith(".pptx")
    ) {
        return await extractPptxText(buffer);
    } else {
        // Try generic extraction for other office formats
        try {
            return await extractTextFromZipArchive(buffer);
        } catch (error) {
            throw new Error("Unsupported office document format");
        }
    }
}

/**
 * Helper function to extract text from ZIP-based documents (like Office files)
 * @param buffer The document buffer
 * @returns Extracted text content as string
 */
async function extractTextFromZipArchive(buffer: Buffer): Promise<string> {
    try {
        // Use jszip for extraction
        const JSZipModule = await import("jszip");
        const JSZip = JSZipModule.default;
        const zip = await JSZip.loadAsync(buffer);
        
        let textContent = "";
        
        // Iterate through all files in the ZIP
        const entries = Object.entries(zip.files);
        for (const [relativePath, zipEntry] of entries) {
            // Skip directories and hidden files
            if ((zipEntry as JSZipObject).dir || relativePath.startsWith("_") || relativePath.includes("/.")) {
                continue;
            }
            
            // Only extract content from XML files that might contain text
            if (
                relativePath.endsWith(".xml") || 
                relativePath.includes("word/document.xml") ||
                relativePath.includes("xl/sharedStrings.xml") ||
                relativePath.includes("ppt/slides/") ||
                relativePath.includes("content.xml") ||
                relativePath.includes("docProps/")
            ) {
                try {
                    const content = await (zipEntry as JSZipObject).async("string");
                    
                    // Extract text from XML
                    const textMatches = content.match(/>([^<]+)</g);
                    if (textMatches) {
                        const extractedText = textMatches
                            .map((match: string) => match.replace(/>[^<]+</g, (m: string) => {
                                return m.substring(1, m.length - 1);
                            }))
                            .filter((text: string) => text.trim().length > 0)
                            .join(" ");
                        
                        if (extractedText.trim().length > 0) {
                            textContent += extractedText + "\n";
                        }
                    }
                } catch (err) {
                    console.warn(`Could not extract content from ${relativePath}`);
                }
            }
        }
        
        return textContent.trim();
    } catch (error) {
        console.error("Error extracting text from ZIP archive:", error);
        throw new Error("Failed to extract text from archive");
    }
}

/**
 * Extract metadata from an Office document
 * @param buffer The document buffer
 * @param fileType The MIME type of the file
 * @param fileName The name of the file
 * @returns Document metadata as a record
 */
export async function extractOfficeMetadata(
    buffer: Buffer, 
    fileType: string,
    fileName: string
): Promise<Record<string, any>> {
    try {
        // Use ZIP extraction to find metadata files
        const JSZipModule = await import("jszip");
        const JSZip = JSZipModule.default;
        const zip = await JSZip.loadAsync(buffer);
        
        let metadata: Record<string, any> = {
            fileName,
            fileType,
            extractionMethod: "zip"
        };
        
        // Look for core properties file
        if (zip.files["docProps/core.xml"]) {
            const coreXml = await (zip.files["docProps/core.xml"] as JSZipObject).async("string");
            
            // Extract title
            const titleMatch = coreXml.match(/<dc:title>(.*?)<\/dc:title>/);
            if (titleMatch && titleMatch[1]) metadata.title = titleMatch[1];
            
            // Extract creator/author
            const creatorMatch = coreXml.match(/<dc:creator>(.*?)<\/dc:creator>/);
            if (creatorMatch && creatorMatch[1]) metadata.author = creatorMatch[1];
            
            // Extract creation date
            const createdMatch = coreXml.match(/<dcterms:created>(.*?)<\/dcterms:created>/);
            if (createdMatch && createdMatch[1]) metadata.created = createdMatch[1];
            
            // Extract modification date
            const modifiedMatch = coreXml.match(/<dcterms:modified>(.*?)<\/dcterms:modified>/);
            if (modifiedMatch && modifiedMatch[1]) metadata.modified = modifiedMatch[1];
        }
        
        // Determine document type and add specific metadata
        if (fileType.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx")) {
            metadata.documentType = "Word Document";
            
            // Try to get page count and word count
            if (zip.files["docProps/app.xml"]) {
                const appXml = await (zip.files["docProps/app.xml"] as JSZipObject).async("string");
                
                const pagesMatch = appXml.match(/<Pages>(.*?)<\/Pages>/);
                if (pagesMatch && pagesMatch[1]) metadata.pageCount = parseInt(pagesMatch[1]);
                
                const wordsMatch = appXml.match(/<Words>(.*?)<\/Words>/);
                if (wordsMatch && wordsMatch[1]) metadata.wordCount = parseInt(wordsMatch[1]);
            }
        } else if (fileType.includes("spreadsheetml") || fileName.toLowerCase().endsWith(".xlsx")) {
            metadata.documentType = "Excel Spreadsheet";
            
            // Try to get sheet count
            if (zip.files["docProps/app.xml"]) {
                const appXml = await (zip.files["docProps/app.xml"] as JSZipObject).async("string");
                
                const sheetsMatch = appXml.match(/<Sheets>(.*?)<\/Sheets>/);
                if (sheetsMatch && sheetsMatch[1]) metadata.sheetCount = parseInt(sheetsMatch[1]);
            }
        } else if (fileType.includes("presentationml") || fileName.toLowerCase().endsWith(".pptx")) {
            metadata.documentType = "PowerPoint Presentation";
            
            // Try to get slide count
            if (zip.files["docProps/app.xml"]) {
                const appXml = await (zip.files["docProps/app.xml"] as JSZipObject).async("string");
                
                const slidesMatch = appXml.match(/<Slides>(.*?)<\/Slides>/);
                if (slidesMatch && slidesMatch[1]) metadata.slideCount = parseInt(slidesMatch[1]);
            }
        }
        
        return metadata;
    } catch (error) {
        console.error("Error extracting Office metadata:", error);
        return {
            fileName,
            fileType,
            error: "Failed to extract metadata"
        };
    }
} 