// Debug formatRate function
import { formatRate } from "./app/lib/utils.js";

console.log("Testing formatRate:");
console.log(`formatRate(0.001) = "${formatRate(0.001)}"`);
console.log(`formatRate(0.1) = "${formatRate(0.1)}"`);
console.log(`formatRate(0.053) = "${formatRate(0.053)}"`);
console.log(`formatRate(0.2) = "${formatRate(0.2)}"`);