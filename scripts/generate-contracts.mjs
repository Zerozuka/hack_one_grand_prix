import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import openapiTS from "openapi-typescript";

const inputPath = resolve("packages/contracts/openapi.json");
const outputPath = resolve("packages/contracts/src/generated/api-types.ts");

const schema = JSON.parse(await readFile(inputPath, "utf8"));
const output = await openapiTS(schema);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");
console.log(`Generated ${outputPath}`);

