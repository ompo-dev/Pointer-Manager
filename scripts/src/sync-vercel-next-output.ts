import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..", "..");
const sourceDir = resolve(rootDir, "apps", "web", ".next");
const targetDir = resolve(rootDir, ".next");

if (!existsSync(sourceDir)) {
  throw new Error(`Next output nao encontrado em ${sourceDir}`);
}

if (existsSync(targetDir)) {
  rmSync(targetDir, { recursive: true, force: true });
}

mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Sincronizado output do Next para ${targetDir}`);
