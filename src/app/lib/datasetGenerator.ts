/**
 * Utility functions for generating random datasets in various formats
 */

import fs from "fs";
import path from "path";
import os from "os";

interface DatasetOptions {
    rows?: number;
    columns?: number;
    format?: string;
    schema?: Record<string, string>;
    seed?: number;
    includeHeaders?: boolean;
    min?: number;
    max?: number;
    precision?: number;
    distribution?: "uniform" | "normal" | "exponential";
    categories?: string[];
    dateStart?: string;
    dateEnd?: string;
    missingValueProbability?: number;
    [key: string]: any; // Allow for additional format-specific options
}

interface GeneratedDataset {
    content: string;
    format: string;
    filename: string;
    mimeType: string;
}

// Map of format to file extension and MIME type
const formatInfo: Record<string, { extension: string; mimeType: string }> = {
    csv: { extension: "csv", mimeType: "text/csv" },
    json: { extension: "json", mimeType: "application/json" },
    xml: { extension: "xml", mimeType: "application/xml" },
    yaml: { extension: "yaml", mimeType: "text/yaml" },
    sql: { extension: "sql", mimeType: "text/plain" },
    txt: { extension: "txt", mimeType: "text/plain" },
    markdown: { extension: "md", mimeType: "text/markdown" },
    html: { extension: "html", mimeType: "text/html" },
    tsv: { extension: "tsv", mimeType: "text/tab-separated-values" },
};

// Data type generators
const generateRandomValue = (type: string, options: DatasetOptions): any => {
    const {
        min = 0,
        max = 100,
        precision = 0,
        categories = [],
        dateStart = "2020-01-01",
        dateEnd = "2023-12-31",
    } = options;

    switch (type.toLowerCase()) {
        case "integer":
        case "int":
            return Math.floor(Math.random() * (max - min + 1)) + min;

        case "float":
        case "decimal":
        case "number":
            const value = Math.random() * (max - min) + min;
            return Number(value.toFixed(precision));

        case "boolean":
        case "bool":
            return Math.random() > 0.5;

        case "string":
        case "text":
            const length = Math.floor(Math.random() * 10) + 5;
            return Array(length)
                .fill(0)
                .map(() =>
                    String.fromCharCode(97 + Math.floor(Math.random() * 26))
                )
                .join("");

        case "date":
            const start = new Date(dateStart).getTime();
            const end = new Date(dateEnd).getTime();
            const randomDate = new Date(start + Math.random() * (end - start));
            return randomDate.toISOString().split("T")[0];

        case "datetime":
            const startDt = new Date(dateStart).getTime();
            const endDt = new Date(dateEnd).getTime();
            const randomDt = new Date(
                startDt + Math.random() * (endDt - startDt)
            );
            return randomDt.toISOString();

        case "category":
        case "enum":
            if (categories.length === 0) {
                return ["A", "B", "C", "D", "E"][Math.floor(Math.random() * 5)];
            }
            return categories[Math.floor(Math.random() * categories.length)];

        case "name":
            const firstNames = [
                "John",
                "Jane",
                "Michael",
                "Emily",
                "David",
                "Sarah",
                "Robert",
                "Lisa",
            ];
            const lastNames = [
                "Smith",
                "Johnson",
                "Williams",
                "Jones",
                "Brown",
                "Davis",
                "Miller",
                "Wilson",
            ];
            return `${
                firstNames[Math.floor(Math.random() * firstNames.length)]
            } ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;

        case "email":
            const domains = [
                "gmail.com",
                "yahoo.com",
                "hotmail.com",
                "outlook.com",
                "example.com",
            ];
            const username = Array(8)
                .fill(0)
                .map(() =>
                    String.fromCharCode(97 + Math.floor(Math.random() * 26))
                )
                .join("");
            return `${username}@${
                domains[Math.floor(Math.random() * domains.length)]
            }`;

        case "phone":
            return `(${Math.floor(Math.random() * 900) + 100})-${
                Math.floor(Math.random() * 900) + 100
            }-${Math.floor(Math.random() * 9000) + 1000}`;

        case "address":
            const streets = [
                "Main St",
                "Oak Ave",
                "Maple Rd",
                "Washington Blvd",
                "Park Lane",
            ];
            const cities = [
                "New York",
                "Los Angeles",
                "Chicago",
                "Houston",
                "Phoenix",
            ];
            const states = ["NY", "CA", "IL", "TX", "AZ"];
            return `${Math.floor(Math.random() * 9000) + 1000} ${
                streets[Math.floor(Math.random() * streets.length)]
            }, ${cities[Math.floor(Math.random() * cities.length)]}, ${
                states[Math.floor(Math.random() * states.length)]
            }`;

        default:
            return `Value-${Math.floor(Math.random() * 1000)}`;
    }
};

// Generate a dataset with the specified schema
const generateDataset = (options: DatasetOptions): any[][] => {
    const {
        rows = 10,
        schema = { id: "integer", name: "string", value: "float" },
        missingValueProbability = 0,
    } = options;

    const headers = Object.keys(schema);
    const data: any[][] = [headers];

    for (let i = 0; i < rows; i++) {
        const row: any[] = [];
        for (const field of headers) {
            // Randomly generate missing values based on probability
            if (Math.random() < missingValueProbability) {
                row.push(null);
            } else {
                row.push(generateRandomValue(schema[field], options));
            }
        }
        data.push(row);
    }

    return data;
};

// Format converters
const formatAsCSV = (data: any[][], options: DatasetOptions): string => {
    const { includeHeaders = true } = options;
    const startIndex = includeHeaders ? 0 : 1;
    
    return data.slice(startIndex).map(row => 
        row.map(cell => {
            if (cell === null) return '';
            const cellStr = String(cell);
            // Properly escape CSV values - if the cell contains commas, quotes, or newlines, wrap it in quotes
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(',')
    ).join('\n');
};

const formatAsJSON = (data: any[][], options: DatasetOptions): string => {
    const { includeHeaders = true } = options;
    const headers = data[0];
    const jsonData = data.slice(1).map((row) => {
        const obj: Record<string, any> = {};
        row.forEach((cell, index) => {
            obj[headers[index]] = cell;
        });
        return obj;
    });

    return JSON.stringify(jsonData, null, 2);
};

const formatAsXML = (data: any[][], options: DatasetOptions): string => {
    const { includeHeaders = true } = options;
    const headers = data[0];
    const rootElement = options.rootElement || "dataset";
    const rowElement = options.rowElement || "record";

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootElement}>\n`;

    data.slice(1).forEach((row) => {
        xml += `  <${rowElement}>\n`;
        row.forEach((cell, index) => {
            const fieldName = headers[index].replace(/[^a-zA-Z0-9_]/g, "_");
            xml += `    <${fieldName}>${
                cell === null
                    ? ""
                    : String(cell)
                          .replace(/&/g, "&amp;")
                          .replace(/</g, "&lt;")
                          .replace(/>/g, "&gt;")
            }</${fieldName}>\n`;
        });
        xml += `  </${rowElement}>\n`;
    });

    xml += `</${rootElement}>`;
    return xml;
};

const formatAsYAML = (data: any[][], options: DatasetOptions): string => {
    const headers = data[0];
    let yaml = "";

    data.slice(1).forEach((row, rowIndex) => {
        yaml += `- # Record ${rowIndex + 1}\n`;
        row.forEach((cell, index) => {
            const fieldName = headers[index];
            const value =
                cell === null
                    ? "null"
                    : typeof cell === "string"
                    ? `"${cell.replace(/"/g, '\\"')}"`
                    : String(cell);
            yaml += `  ${fieldName}: ${value}\n`;
        });
    });

    return yaml;
};

const formatAsSQL = (data: any[][], options: DatasetOptions): string => {
    const headers = data[0];
    const tableName = options.tableName || "generated_data";

    // Generate CREATE TABLE statement
    let sql = `CREATE TABLE ${tableName} (\n`;
    headers.forEach((header, index) => {
        const fieldType = options.schema?.[header] || "TEXT";
        const sqlType = fieldType.toLowerCase().includes("int")
            ? "INTEGER"
            : fieldType.toLowerCase().includes("float") ||
              fieldType.toLowerCase().includes("decimal")
            ? "REAL"
            : fieldType.toLowerCase().includes("bool")
            ? "BOOLEAN"
            : fieldType.toLowerCase().includes("date")
            ? "DATE"
            : "TEXT";
        sql += `  ${header} ${sqlType}${
            index < headers.length - 1 ? "," : ""
        }\n`;
    });
    sql += ");\n\n";

    // Generate INSERT statements
    data.slice(1).forEach((row) => {
        sql += `INSERT INTO ${tableName} (${headers.join(", ")}) VALUES (`;
        row.forEach((cell, index) => {
            if (cell === null) {
                sql += "NULL";
            } else if (typeof cell === "string") {
                sql += `'${cell.replace(/'/g, "''")}'`;
            } else {
                sql += String(cell);
            }

            if (index < row.length - 1) {
                sql += ", ";
            }
        });
        sql += ");\n";
    });

    return sql;
};

const formatAsTSV = (data: any[][], options: DatasetOptions): string => {
    const { includeHeaders = true } = options;
    const startIndex = includeHeaders ? 0 : 1;
    return data
        .slice(startIndex)
        .map((row) =>
            row
                .map((cell) => {
                    if (cell === null) return "";
                    return String(cell).replace(/\t/g, " ");
                })
                .join("\t")
        )
        .join("\n");
};

const formatAsMarkdown = (data: any[][], options: DatasetOptions): string => {
    const headers = data[0];
    let markdown = "| " + headers.join(" | ") + " |\n";
    markdown += "| " + headers.map(() => "---").join(" | ") + " |\n";

    data.slice(1).forEach((row) => {
        markdown +=
            "| " +
            row.map((cell) => (cell === null ? "" : String(cell))).join(" | ") +
            " |\n";
    });

    return markdown;
};

const formatAsHTML = (data: any[][], options: DatasetOptions): string => {
    const title = options.title || "Generated Dataset";
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead>
      <tr>
`;

    // Add headers
    data[0].forEach((header) => {
        html += `        <th>${header}</th>\n`;
    });

    html += `      </tr>
    </thead>
    <tbody>
`;

    // Add data rows
    data.slice(1).forEach((row) => {
        html += "      <tr>\n";
        row.forEach((cell) => {
            html += `        <td>${cell === null ? "" : String(cell)}</td>\n`;
        });
        html += "      </tr>\n";
    });

    html += `    </tbody>
  </table>
</body>
</html>`;

    return html;
};

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

/**
 * Generate a random dataset based on the provided options
 * @param options Configuration options for the dataset
 * @returns Generated dataset with content and metadata
 */
export const generateRandomDataset = (
    options: DatasetOptions
): GeneratedDataset => {
    const format = (options.format || "csv").toLowerCase();
    const datasetName = options.name || "dataset";

    // Generate the raw data
    const data = generateDataset(options);

    // Format the data according to the requested format
    let content = "";
    switch (format) {
        case "json":
            content = formatAsJSON(data, options);
            break;
        case "xml":
            content = formatAsXML(data, options);
            break;
        case "yaml":
        case "yml":
            content = formatAsYAML(data, options);
            break;
        case "sql":
            content = formatAsSQL(data, options);
            break;
        case "tsv":
            content = formatAsTSV(data, options);
            break;
        case "markdown":
        case "md":
            content = formatAsMarkdown(data, options);
            break;
        case "html":
            content = formatAsHTML(data, options);
            break;
        case "csv":
        default:
            content = formatAsCSV(data, options);
            break;
    }

    // Get the file extension and MIME type
    const { extension, mimeType } = formatInfo[format] || formatInfo.csv;

    return {
        content,
        format,
        filename: `${datasetName}.${extension}`,
        mimeType,
    };
};

export default {
    generateRandomDataset,
};
