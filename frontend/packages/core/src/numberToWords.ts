export function numberToEnglishWords(num: number): string {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const teens = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];

  if (num === 0) return "zero";

  const helper = (n: number): string => {
    let str = "";
    if (n >= 1000000) {
      str += helper(Math.floor(n / 1000000)) + " million ";
      n %= 1000000;
    }
    if (n >= 1000) {
      str += helper(Math.floor(n / 1000)) + " thousand ";
      n %= 1000;
    }
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " hundred ";
      n %= 100;
      if (n > 0) {
        str += "and ";
      }
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
      if (n > 0) {
        str += ones[n] + " ";
      }
    } else if (n >= 10) {
      str += teens[n - 10] + " ";
    } else if (n > 0) {
      str += ones[n] + " ";
    }
    return str;
  };

  return helper(num).trim().replace(/\s+/g, " ");
}
