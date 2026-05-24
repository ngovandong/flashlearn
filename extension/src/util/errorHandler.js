export function getFirstError(data) {
  if (typeof data === "string") {
    return "Server Error";
  }
  const firstKeyError = Object.keys(data)[0];
  const firstErrors = data[firstKeyError];
  if (Array.isArray(firstErrors)) {
    return `${firstKeyError}: ${firstErrors[0]}`;
  } else {
    return firstErrors;
  }
}
