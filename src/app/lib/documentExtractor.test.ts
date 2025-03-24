import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import { extractDocxText, extractXlsxText, extractPptxText, extractOfficeDocumentText, extractOfficeMetadata } from './documentExtractor';

// Mock the imported libraries
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({ value: 'Extracted DOCX content' }),
    convertToHtml: vi.fn().mockResolvedValue({ value: '<p>Extracted DOCX HTML content</p>' })
  }
}));

vi.mock('xlsx', () => ({
  default: {
    read: vi.fn().mockReturnValue({
      SheetNames: ['Sheet1', 'Sheet2'],
      Sheets: { 
        Sheet1: { A1: { v: 'Cell A1' } },
        Sheet2: { A1: { v: 'Cell A1 Sheet 2' } }
      }
    }),
    utils: {
      sheet_to_csv: vi.fn().mockReturnValue('A,B,C\n1,2,3')
    }
  }
}));

vi.mock('jszip', () => {
  // Mock file content for XML files
  const mockFiles = {
    'word/document.xml': '<w:document><w:body><w:p><w:t>Document content</w:t></w:p></w:body></w:document>',
    'xl/sharedStrings.xml': '<sst><si><t>Excel content</t></si></sst>',
    'ppt/slides/slide1.xml': '<p:sld><p:txBody><a:p><a:r><a:t>PowerPoint content</a:t></a:r></a:p></p:txBody></p:sld>',
    'docProps/core.xml': '<cp:coreProperties><dc:title>Test Document</dc:title><dc:creator>Test Author</dc:creator><dcterms:created>2023-01-01T00:00:00Z</dcterms:created><dcterms:modified>2023-01-02T00:00:00Z</dcterms:modified></cp:coreProperties>',
    'docProps/app.xml': '<Properties><Pages>10</Pages><Words>500</Words><Slides>5</Slides><Sheets>3</Sheets></Properties>'
  };

  // Create a mock implementation
  return {
    default: {
      loadAsync: vi.fn().mockResolvedValue({
        files: {
          'word/document.xml': {
            dir: false,
            async: vi.fn().mockImplementation((type) => Promise.resolve(mockFiles['word/document.xml']))
          },
          'xl/sharedStrings.xml': {
            dir: false,
            async: vi.fn().mockImplementation((type) => Promise.resolve(mockFiles['xl/sharedStrings.xml']))
          },
          'ppt/slides/slide1.xml': {
            dir: false,
            async: vi.fn().mockImplementation((type) => Promise.resolve(mockFiles['ppt/slides/slide1.xml']))
          },
          'docProps/core.xml': {
            dir: false,
            async: vi.fn().mockImplementation((type) => Promise.resolve(mockFiles['docProps/core.xml']))
          },
          'docProps/app.xml': {
            dir: false,
            async: vi.fn().mockImplementation((type) => Promise.resolve(mockFiles['docProps/app.xml']))
          }
        }
      })
    }
  };
});

describe('Document Extractor', () => {
  // Create a mock buffer for testing
  const testBuffer = Buffer.from('test document content');

  describe('extractDocxText', () => {
    it('should extract text from a DOCX file', async () => {
      const result = await extractDocxText(testBuffer);
      expect(result).toContain('Extracted DOCX content');
    });
  });

  describe('extractXlsxText', () => {
    it('should extract text from an XLSX file', async () => {
      const result = await extractXlsxText(testBuffer);
      expect(result).toContain('Excel Workbook with 2 sheets');
      expect(result).toContain('A,B,C\n1,2,3');
    });
  });

  describe('extractPptxText', () => {
    it('should extract text from a PPTX file', async () => {
      const result = await extractPptxText(testBuffer);
      expect(result).toContain('PowerPoint Presentation Content');
      expect(result).toContain('PowerPoint content');
    });
  });

  describe('extractOfficeDocumentText', () => {
    it('should extract text from a DOCX file', async () => {
      const result = await extractOfficeDocumentText(
        testBuffer, 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test.docx'
      );
      expect(result).toContain('Extracted DOCX content');
    });

    it('should extract text from an XLSX file', async () => {
      const result = await extractOfficeDocumentText(
        testBuffer, 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'test.xlsx'
      );
      expect(result).toContain('Excel Workbook with 2 sheets');
    });

    it('should extract text from a PPTX file', async () => {
      const result = await extractOfficeDocumentText(
        testBuffer, 
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'test.pptx'
      );
      expect(result).toContain('PowerPoint Presentation Content');
    });
  });

  describe('extractOfficeMetadata', () => {
    it('should extract metadata from a DOCX file', async () => {
      const result = await extractOfficeMetadata(
        testBuffer, 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test.docx'
      );
      expect(result.title).toBe('Test Document');
      expect(result.author).toBe('Test Author');
      expect(result.documentType).toBe('Word Document');
      expect(result.pageCount).toBe(10);
      expect(result.wordCount).toBe(500);
    });

    it('should extract metadata from an XLSX file', async () => {
      const result = await extractOfficeMetadata(
        testBuffer, 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'test.xlsx'
      );
      expect(result.title).toBe('Test Document');
      expect(result.documentType).toBe('Excel Spreadsheet');
      expect(result.sheetCount).toBe(3);
    });

    it('should extract metadata from a PPTX file', async () => {
      const result = await extractOfficeMetadata(
        testBuffer, 
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'test.pptx'
      );
      expect(result.title).toBe('Test Document');
      expect(result.documentType).toBe('PowerPoint Presentation');
      expect(result.slideCount).toBe(5);
    });
  });
}); 