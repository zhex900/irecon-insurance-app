/**
 * Excel Worker - Clean Entry Point
 * Main export file following domain-based worker pattern
 */

import { generateGenericExcel } from "./handler/generate-generic-excel";
import { generatePremiumExcel } from "./handler/generate-premium-excel";

// Export the handler as the worker entry point
export default {
  generatePremiumExcel: generatePremiumExcel,
  generateGenericExcel: generateGenericExcel,
};
