function getMeaningFromResponse(response) {
  let meaning = "";

  response[0].forEach((line) => {
    const text = line[0];
    if (text && typeof text === "string") {
      meaning += text;
    }
  });

  return meaning;
}

export function translateText(
  text,
  targetLanguage = "vi",
  sourceLanguage = "auto"
) {
  const url = new URL("https://translate.google.com/translate_a/single");
  const params = {
    client: "gtx",
    sl: sourceLanguage,
    tl: targetLanguage,
    hl: targetLanguage,
    dt: "t",
    q: text,
  };
  url.search = new URLSearchParams(params).toString();

  return fetch(url)
    .then((response) => response.json())
    .then((data) => getMeaningFromResponse(data));
}
