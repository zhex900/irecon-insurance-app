import fs from "fs";
import path from "path";

const hookMappings = {
  useApiSearch: "search/use-api",
  useDebouncedSearchQuery: "search/use-debounced-query",
  useNetworkStatus: "network/use-status",
  useHydrated: "network/use-hydrated",
  useFileUpload: "utilities/use-file-upload",
  useSuccessToast: "utilities/use-success-toast",
  useMobile: "utilities/use-mobile",
  useHandledActionData: "utilities/use-handled-action-data",
  useUrlFilterDraft: "utilities/use-url-filter-draft",
};

function updateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    let updated = false;
    let newContent = content;

    for (const [oldHook, newPath] of Object.entries(hookMappings)) {
      const importRegex = new RegExp(
        `import\\s+{[^}]*\\b${oldHook}\\b[^}]*}\\s+from\\s+["']([^"']+)["']`,
        "g",
      );
      const importAllRegex = new RegExp(
        `import\\s+\\*\\s+as\\s+[^\\s]+\\s+from\\s+["'][^"']*\\b${oldHook}\\b[^"']*["']`,
        "g",
      );

      // Check for direct imports
      if (importRegex.test(content)) {
        newContent = newContent.replace(
          new RegExp(`from\\s+["'][^"']*\\b${oldHook}[^"']*["']`, "g"),
          `from "~/hooks/${newPath}"`,
        );
        updated = true;
      }

      // Check for wildcard imports
      if (importAllRegex.test(content)) {
        newContent = newContent.replace(
          new RegExp(`from\\s+["'][^"']*\\b${oldHook}[^"']*["']`, "g"),
          `from "~/hooks/${newPath}"`,
        );
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(filePath, newContent, "utf8");
      console.log(`Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Find all TypeScript/JavaScript files in the project
function findAllFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and build directories
      if (
        !item.includes("node_modules") &&
        !item.includes("dist") &&
        !item.includes("build")
      ) {
        files.push(...findAllFiles(fullPath));
      }
    } else if (
      item.endsWith(".ts") ||
      item.endsWith(".tsx") ||
      item.endsWith(".js") ||
      item.endsWith(".jsx")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

// Run the updater
try {
  const allFiles = findAllFiles(".");
  let updatedCount = 0;

  for (const file of allFiles) {
    if (updateFile(file)) {
      updatedCount++;
    }
  }

  console.log(`\nUpdated ${updatedCount} files.`);
} catch (error) {
  console.error("Error:", error.message);
}
