import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

function runPrismaGenerate() {
  const prismaCliPath = require.resolve("prisma/build/index.js");
  const result = spawnSync(
    process.execPath,
    [prismaCliPath, "generate", "--schema", "apps/api/prisma/schema.prisma"],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

class InlineWorker {
  constructor(workerPath, options = {}) {
    const workerModule = require(workerPath);
    const exposedMethods = options.exposedMethods ?? [];

    for (const method of exposedMethods) {
      this[method] = async (...args) => {
        const candidate =
          workerModule[method] ??
          workerModule.default?.[method] ??
          workerModule.default;

        if (typeof candidate !== "function") {
          throw new Error(
            `Metodo "${method}" nao encontrado no worker inline: ${workerPath}`,
          );
        }

        return candidate(...args);
      };
    }
  }

  end() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

async function main() {
  runPrismaGenerate();

  const workerModulePath = require.resolve("next/dist/lib/worker");
  require.cache[workerModulePath] = {
    id: workerModulePath,
    filename: workerModulePath,
    loaded: true,
    exports: {
      Worker: InlineWorker,
      getNextBuildDebuggerPortOffset: () => 0,
    },
  };

  const nextBuildModule = require("next/dist/build");
  const nextBuild = nextBuildModule.default ?? nextBuildModule;

  await nextBuild(process.cwd(), false, false, false, false);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
