export function isChangeState(obj1, obj2) {
  const obj1Props = Object.getOwnPropertyNames(obj1);
  const obj2Props = Object.getOwnPropertyNames(obj2);

  if (obj1Props.length !== obj2Props.length) {
    return true;
  }

  for (let i = 0; i < obj1Props.length; i++) {
    const propName = obj1Props[i];
    if (obj1[propName] !== obj2[propName]) {
      return true;
    }
  }

  return false;
}

function isTermEqual(obj1, obj2) {
  const sameList = (a, b) =>
    JSON.stringify(a || []) === JSON.stringify(b || []);
  return (
    obj1.name === obj2.name &&
    obj1.meaning === obj2.meaning &&
    obj1.image === obj2.image &&
    (obj1.word_type || "") === (obj2.word_type || "") &&
    (obj1.pronunciation || "") === (obj2.pronunciation || "") &&
    (obj1.definition || "") === (obj2.definition || "") &&
    sameList(obj1.synonyms, obj2.synonyms) &&
    sameList(obj1.antonyms, obj2.antonyms) &&
    sameList(obj1.examples, obj2.examples) &&
    sameList(obj1.word_forms, obj2.word_forms) &&
    sameList(obj1.word_family, obj2.word_family) &&
    Boolean(obj1.ai_filled) === Boolean(obj2.ai_filled)
  );
}

export function filterChangedTerms(previousList, updatedList) {
  const changedTerms = updatedList.filter((term) => {
    if (!term.id) return false;
    // Find the corresponding term in the previous list
    const previousTerm = previousList.find((t) => t.id === term.id);
    // Check if the term is new or has changed
    return previousTerm && !isTermEqual(previousTerm, term);
  });
  return changedTerms;
}
