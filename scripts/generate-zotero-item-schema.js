// scripts/generate-types-from-file.ts
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { format } from "prettier";

const __dirname = path.resolve();

// Zotero Schema URL
const SCHEMA_URL = "https://api.zotero.org/schema";

async function generate() {
    const rawData = await axios.get(SCHEMA_URL);
    const schema = rawData.data;

    let output = `
/**
 * AUTO-GENERATED ZOTERO TYPES
 * Source: schema.json (v${schema.version})
 */

interface BaseZoteroItemData {
  key: string;
  version: number;
  itemType: string;
  parentItem?: string;
  title?: string;
  collections?: string[];
  dateAdded: string;
  dateModified: string;
  tags: Array<{ tag: string; type?: number }>;
  relations: { [key: string]: string | string[] };
  deleted: boolean;
}
`;

    const typeNames = [];
    const itemTypes = [];
    const primaryCreatorTypes = {};

    // Iterate over schema.itemTypes
    for (const typeDef of schema.itemTypes) {
        const itemType = typeDef.itemType;
        itemTypes.push(itemType);
        const interfaceName = pascalCase(itemType);
        typeNames.push(interfaceName);

        console.log(`Generating ${interfaceName}...`);

        let fieldsStr = "";

        // Process unique fields for this type
        for (const fieldObj of typeDef.fields) {
            const fieldName = fieldObj.field;
            const fieldType = "string"; // Default to string
            fieldsStr += `    ${fieldName}?: ${fieldType};\n`;
        }

        // Process creators
        if (typeDef.creatorTypes && typeDef.creatorTypes.length > 0) {
            const creatorTypeUnion = typeDef.creatorTypes
                .map((c) => `'${c.creatorType}'`)
                .join(" | ");

            fieldsStr += `    creators?: Array<{ creatorType: ${creatorTypeUnion}; firstName?: string; lastName?: string; name?: string; }>;\n`;

            // Find primary creator type
            const primary = typeDef.creatorTypes.find((c) => c.primary);
            if (primary) {
                primaryCreatorTypes[itemType] = primary.creatorType;
            }
        }

        // Generate Interface
        output += `
interface ${interfaceName}Data extends BaseZoteroItemData {
  itemType: '${itemType}';
  ${fieldsStr}
}
`;
    }

    // Generate Primary Creator Type Map
    output += `\n\nexport interface ZoteroPrimaryCreatorTypes {\n`;
    for (const [type, creator] of Object.entries(primaryCreatorTypes)) {
        output += `  ${type}: '${creator}';\n`;
    }
    output += `}\n`;

    // Generate Union Type
    output += `\nexport type ZoteroItemData = ${typeNames.map((t) => t + "Data").join(" | ")};\n`;

    // Generate Item Type Union & Guard
    output += `\nexport interface ZoteroItemDataTypeMap {
    ${itemTypes.map((t) => `'${t}': ${pascalCase(t)}Data`).join(" ;\n")}
  }\n`;

    output = await format(output, { parser: "typescript" });

    // Write to file
    fs.writeFileSync(
        path.join(__dirname, "./src/types/zotero-item.d.ts"),
        output,
    );

    format(
        `\nexport const Zotero_Item_Types: string[] = [${itemTypes.map((t) => `'${t}'`).join(",")}];\n`,
        { parser: "typescript" },
    ).then((formatted) => {
        fs.writeFileSync(
            path.join(__dirname, "./src/types/zotero-item-const.ts"),
            formatted,
        );
    });
    console.log("✅ Types generated!");
}

function pascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

generate();
