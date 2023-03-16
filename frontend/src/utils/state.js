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
