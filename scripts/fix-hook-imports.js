import fs from "fs";
import path from "path";

// Hook import mappings
const hookMappings = [
  // Search hooks
  {
    regex: /from ['"]~\/hooks\/use-api-search['"]/g,
    replacement: 'from "~/hooks/search"',
  },
  {
    regex: /from ['"]~\/hooks\/use-debounced-search-query['"]/g,
    replacement: 'from "~/hooks/search"',
  },

  // Network hooks
  {
    regex: /from ['"]~\/hooks\/use-network-status['"]/g,
    replacement: 'from "~/hooks/network"',
  },
  {
    regex: /from ['"]~\/hooks\/use-hydrated['"]/g,
    replacement: 'from "~/hooks/network"',
  },

  // Utility hooks
  {
    regex: /from ['"]~\/hooks\/use-success-toast['"]/g,
    replacement: 'from "~/hooks/utilities"',
  },
  {
    regex: /from ['"]~\/hooks\/use-file-upload['"]/g,
    replacement: 'from "~/hooks/utilities"',
  },
  {
    regex: /from ['"]~\/hooks\/use-handled-action-data['"]/g,
    replacement: 'from "~/hooks/utilities"',
  },
  {
    regex: /from ['"]~\/hooks\/use-url-filter-draft['"]/g,
    replacement: 'from "~/hooks/utilities"',
  },
  {
    regex: /from ['"]~\/hooks\/use-mobile['"]/g,
    replacement: 'from "~/hooks/utilities"',
  },
];

// Specific import updates for renamed exports
const exportMappings = [
  { regex: /useSuccessToast\b/g, replacement: "useActionSuccessToast" },
  { regex: /useMobile\b/g, replacement: "useIsMobile" },
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let updated = false;

    // Update import paths
    for (const { regex, replacement } of hookMappings) {
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        updated = true;
      }
    }

    // Update specific export names
    for (const { regex, replacement } of exportMappings) {
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Find all TypeScript/JavaScript files
function findAllFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, build, dist directories
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
