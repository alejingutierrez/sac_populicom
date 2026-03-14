import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const nodeModulesDir = path.join(rootDir, "node_modules");
const binDir = path.join(nodeModulesDir, ".bin");

const packages = [
  "turbo",
  "eslint",
  "typescript",
  "vitest",
  "next",
  "@playwright/test",
  "prettier",
  "@commitlint/cli",
  "husky",
  "prisma",
  "tsx"
];

const normalizeBinEntries = (packageName, binField) => {
  if (!binField) {
    return [];
  }

  if (typeof binField === "string") {
    const commandName = packageName.startsWith("@") ? packageName.split("/")[1] : packageName;
    return [[commandName, binField]];
  }

  return Object.entries(binField);
};

fs.mkdirSync(binDir, { recursive: true });

for (const packageName of packages) {
  const packageJsonPath = path.join(nodeModulesDir, packageName, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    continue;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const binEntries = normalizeBinEntries(packageName, packageJson.bin);

  for (const [commandName, relativeTarget] of binEntries) {
    const targetPath = path.relative(binDir, path.join(nodeModulesDir, packageName, relativeTarget));
    const linkPath = path.join(binDir, commandName);

    try {
      if (fs.existsSync(linkPath)) {
        fs.unlinkSync(linkPath);
      }

      fs.symlinkSync(targetPath, linkPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn(`Skipping ${commandName}: ${message}`);
    }
  }
}

console.log(`Linked local binaries into ${binDir}`);
