import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";
import { app } from "../../apps/api/src/app";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, "..", "..");
const outputJsonFile = path.join(
  workspaceRoot,
  "packages",
  "contracts",
  "openapi",
  "point-manager.json",
);
const outputYamlFile = path.join(
  workspaceRoot,
  "packages",
  "contracts",
  "openapi",
  "point-manager.yaml",
);

async function main() {
  const response = await app.handle(new Request("http://localhost/docs/json"));

  if (!response.ok) {
    throw new Error(`Nao foi possivel gerar o OpenAPI. Status ${response.status}.`);
  }

  const document = sanitizeOpenApiDocument(await response.json());
  const outputDirectory = path.dirname(outputJsonFile);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputJsonFile, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await writeFile(outputYamlFile, stringifyYaml(document), "utf8");
  console.log(`OpenAPI gerado em ${outputJsonFile}`);
  console.log(`OpenAPI YAML gerado em ${outputYamlFile}`);
}

function sanitizeSchemaNode(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSchemaNode(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, sanitizeSchemaNode(nestedValue)]),
  ) as Record<string, unknown>;

  if (record.responses && typeof record.responses === "object" && !Array.isArray(record.responses)) {
    record.responses = Object.fromEntries(
      Object.entries(record.responses).map(([statusCode, responseValue]) => {
        if (!responseValue || typeof responseValue !== "object" || Array.isArray(responseValue)) {
          return [statusCode, { description: "Success" }];
        }

        const normalizedResponseValue =
          "content" in responseValue &&
          responseValue.content &&
          typeof responseValue.content === "object" &&
          !Array.isArray(responseValue.content)
            ? {
                description:
                  (responseValue as { description?: string }).description ?? "Success",
                content: responseValue.content,
                headers:
                  "headers" in responseValue ? responseValue.headers : undefined,
                links: "links" in responseValue ? responseValue.links : undefined,
              }
            : responseValue;

        return [
          statusCode,
          {
            ...normalizedResponseValue,
            description:
              (normalizedResponseValue as { description?: string }).description ?? "Success",
          },
        ];
      }),
    );
  }

  if (record.content && typeof record.content === "object" && !Array.isArray(record.content)) {
    const content = record.content as Record<string, unknown>;
    const preferredJsonContent = content["application/json"];

    if (preferredJsonContent) {
      record.content = {
        "application/json": preferredJsonContent,
      };
    }
  }

  if (Array.isArray(record.anyOf)) {
    const nonNullMembers = record.anyOf.filter(
      (item) => !(item && typeof item === "object" && "type" in item && item.type === "null"),
    );

    if (nonNullMembers.length !== record.anyOf.length) {
      if (nonNullMembers.length === 1 && nonNullMembers[0] && typeof nonNullMembers[0] === "object") {
        return {
          ...(nonNullMembers[0] as Record<string, unknown>),
          nullable: true,
        };
      }

      record.anyOf = nonNullMembers;
      record.nullable = true;
    }
  }

  return record;
}

function sanitizeOpenApiDocument(document: unknown) {
  return sanitizeSchemaNode(document);
}

await main();
