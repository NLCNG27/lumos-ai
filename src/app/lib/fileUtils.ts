// Utility functions for file handling

interface FileTypeInfo {
  extension: string;
  mimeType: string;
  language?: string;
}

// Map of language identifiers to file extensions and MIME types
export const languageToFileType: Record<string, FileTypeInfo> = {
  javascript: { extension: 'js', mimeType: 'text/javascript', language: 'javascript' },
  js: { extension: 'js', mimeType: 'text/javascript', language: 'javascript' },
  typescript: { extension: 'ts', mimeType: 'text/typescript', language: 'typescript' },
  ts: { extension: 'ts', mimeType: 'text/typescript', language: 'typescript' },
  jsx: { extension: 'jsx', mimeType: 'text/jsx', language: 'jsx' },
  tsx: { extension: 'tsx', mimeType: 'text/tsx', language: 'tsx' },
  html: { extension: 'html', mimeType: 'text/html', language: 'html' },
  css: { extension: 'css', mimeType: 'text/css', language: 'css' },
  json: { extension: 'json', mimeType: 'application/json', language: 'json' },
  python: { extension: 'py', mimeType: 'text/x-python', language: 'python' },
  py: { extension: 'py', mimeType: 'text/x-python', language: 'python' },
  java: { extension: 'java', mimeType: 'text/x-java', language: 'java' },
  c: { extension: 'c', mimeType: 'text/x-c', language: 'c' },
  cpp: { extension: 'cpp', mimeType: 'text/x-c++', language: 'cpp' },
  csharp: { extension: 'cs', mimeType: 'text/x-csharp', language: 'csharp' },
  cs: { extension: 'cs', mimeType: 'text/x-csharp', language: 'csharp' },
  go: { extension: 'go', mimeType: 'text/x-go', language: 'go' },
  rust: { extension: 'rs', mimeType: 'text/x-rust', language: 'rust' },
  php: { extension: 'php', mimeType: 'application/x-httpd-php', language: 'php' },
  ruby: { extension: 'rb', mimeType: 'text/x-ruby', language: 'ruby' },
  markdown: { extension: 'md', mimeType: 'text/markdown', language: 'markdown' },
  md: { extension: 'md', mimeType: 'text/markdown', language: 'markdown' },
  sql: { extension: 'sql', mimeType: 'text/x-sql', language: 'sql' },
  shell: { extension: 'sh', mimeType: 'text/x-sh', language: 'shell' },
  bash: { extension: 'sh', mimeType: 'text/x-sh', language: 'bash' },
  sh: { extension: 'sh', mimeType: 'text/x-sh', language: 'shell' },
  yaml: { extension: 'yaml', mimeType: 'text/yaml', language: 'yaml' },
  yml: { extension: 'yml', mimeType: 'text/yaml', language: 'yaml' },
  xml: { extension: 'xml', mimeType: 'application/xml', language: 'xml' },
  swift: { extension: 'swift', mimeType: 'text/x-swift', language: 'swift' },
  kotlin: { extension: 'kt', mimeType: 'text/x-kotlin', language: 'kotlin' },
  dart: { extension: 'dart', mimeType: 'text/x-dart', language: 'dart' },
  dockerfile: { extension: 'Dockerfile', mimeType: 'text/plain', language: 'dockerfile' },
  plaintext: { extension: 'txt', mimeType: 'text/plain', language: 'plaintext' },
  text: { extension: 'txt', mimeType: 'text/plain', language: 'plaintext' },
  txt: { extension: 'txt', mimeType: 'text/plain', language: 'plaintext' },
};

/**
 * Attempts to guess a suitable filename from code content
 * @param content The code content
 * @param language The language identifier
 * @returns A suggested filename with appropriate extension
 */
export const suggestFilename = (content: string, language: string): string => {
  const fileType = languageToFileType[language] || languageToFileType.txt;
  const extension = fileType.extension;
  
  // Define common filename patterns for different languages
  const patterns: Record<string, RegExp[]> = {
    // Look for class or component names in JavaScript/TypeScript files
    'js': [
      /class\s+([A-Z][A-Za-z0-9_]*)/,        // class ClassName
      /function\s+([A-Z][A-Za-z0-9_]*)/,      // function ComponentName
      /const\s+([A-Z][A-Za-z0-9_]*)\s*=/,     // const ComponentName =
      /export\s+default\s+function\s+([A-Za-z0-9_]+)/, // export default function Name
    ],
    'jsx': [
      /function\s+([A-Z][A-Za-z0-9_]*)/,      // function ComponentName
      /const\s+([A-Z][A-Za-z0-9_]*)\s*=/,     // const ComponentName =
      /class\s+([A-Z][A-Za-z0-9_]*)/,         // class ClassName
      /export\s+default\s+function\s+([A-Za-z0-9_]+)/, // export default function Name
    ],
    'ts': [
      /class\s+([A-Z][A-Za-z0-9_]*)/,        // class ClassName
      /function\s+([A-Za-z0-9_]+)/,          // function functionName
      /interface\s+([A-Z][A-Za-z0-9_]*)/,     // interface InterfaceName
      /type\s+([A-Z][A-Za-z0-9_]*)/,          // type TypeName
      /const\s+([A-Z][A-Za-z0-9_]*)\s*=/,     // const ComponentName =
      /export\s+default\s+function\s+([A-Za-z0-9_]+)/, // export default function Name
    ],
    'tsx': [
      /function\s+([A-Z][A-Za-z0-9_]*)/,      // function ComponentName
      /const\s+([A-Z][A-Za-z0-9_]*)\s*=/,     // const ComponentName =
      /class\s+([A-Z][A-Za-z0-9_]*)/,         // class ClassName
      /interface\s+([A-Z][A-Za-z0-9_]*)/,     // interface InterfaceName
      /type\s+([A-Z][A-Za-z0-9_]*)/,          // type TypeName  
      /export\s+default\s+function\s+([A-Za-z0-9_]+)/, // export default function Name
    ],
    'py': [
      /class\s+([A-Za-z0-9_]+)/, // class ClassName
      /def\s+([a-z][a-z0-9_]+)/, // def function_name
    ],
    'java': [
      /class\s+([A-Za-z0-9_]+)/, // class ClassName
      /interface\s+([A-Za-z0-9_]+)/, // interface InterfaceName
    ],
    'cs': [
      /class\s+([A-Za-z0-9_]+)/, // class ClassName
      /interface\s+([A-Za-z0-9_]+)/, // interface InterfaceName
    ],
    'html': [
      /<title>(.*?)<\/title>/, // <title>Page Title</title>
    ],
    'css': [
      /\/\*\s*(.*?)\s*\*\//, // /* Main stylesheet */
    ],
    'md': [
      /^#\s+(.*)$/, // # Document Title
    ],
    'sql': [
      /CREATE\s+TABLE\s+(\`|'|")?([A-Za-z0-9_]+)(\`|'|")?/, // CREATE TABLE tablename
    ],
  };
  
  // Try to find language-specific patterns
  const languageKey = language in patterns ? language : 
                    (fileType.language && fileType.language in patterns) ? fileType.language : null;
  
  if (languageKey) {
    for (const pattern of patterns[languageKey]) {
      const match = content.match(pattern);
      if (match && match[1]) {
        // Use the captured group (usually the name)
        return `${match[1]}.${extension}`;
      }
    }
  }
  
  // If we couldn't find a good name from the code, use a generic name
  return `file.${extension}`;
};

/**
 * Determines if a code block should be treated as a downloadable file
 * @param language The language identifier from the code block
 * @param content The content of the code block
 * @returns boolean indicating if the content should be downloadable
 */
export const isDownloadableCode = (language: string, content: string): boolean => {
  // If we have a known file type for this language
  if (languageToFileType[language]) {
    // If the content is substantial (more than just a few lines)
    // This helps filter out small code snippets that aren't complete files
    const lineCount = content.split('\n').length;
    return lineCount > 5;
  }
  return false;
};

/**
 * Creates a downloadable file from code content
 * @param content The content to download
 * @param language The language identifier
 * @param suggestedFilename Optional filename suggestion
 */
export const downloadCode = (content: string, language: string, suggestedFilename?: string): void => {
  const fileType = languageToFileType[language] || languageToFileType.txt;
  
  // Create filename - use the suggested filename or try to derive one from content
  const filename = suggestedFilename || suggestFilename(content, language);
  
  // Create blob
  const blob = new Blob([content], { type: fileType.mimeType });
  const url = URL.createObjectURL(blob);
  
  // Create download link and trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 100);
}; 