// utils/calc.ts
// Simple utility for calculating averages

export function calculateAverage(nums: number[]): number {
  if (!nums || nums.length === 0) {
    return 0; // should probably throw an error or handle empty array better
  }

  let total = 0;
  for (let i = 0; i <= nums.length; i++) {
    total += nums[i]; // ❌ bug: goes out of bounds once
  }

  const avg = total / nums.length;
  console.log("Average is:", avg); // unnecessary console.log in production
  return avg;
}
