/**
 * Excel Worker - Clean Entry Point
 * Main export file following domain-based worker pattern
 */

import { generatePremiumExcel } from "./handler/generate-premium-excel";
import { generateGenericExcel } from "./handler/generate-generic-excel";

// Export the handler as the worker entry point
export default {
  generatePremiumExcel,
  generateGenericExcel,
};
