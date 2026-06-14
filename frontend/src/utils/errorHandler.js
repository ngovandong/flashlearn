// get first errors if has many error
// const data = {
//   background: [
//     "The submitted data was not a file. Check the encoding type on the form.",
//   ],
//   description: ["This field may not be blank."],
//   name: ["This field may not be blank."],
// };
// or {"error":"this is an error"}

export function getFirstError(data) {
  if (typeof data === "string") {
    return "Something went wrong. Please try again.";
  }
  const firstKeyError = Object.keys(data)[0];
  const firstErrors = data[firstKeyError];
  if (Array.isArray(firstErrors)) {
    return `${firstKeyError}: ${firstErrors[0]}`;
  } else {
    return firstErrors;
  }
}
