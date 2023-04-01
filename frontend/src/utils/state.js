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
  return (
    obj1.name === obj2.name &&
    obj1.description === obj2.description &&
    obj1.image === obj2.image
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
