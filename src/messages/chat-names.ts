/** A name as it is compared: lower case, letters and digits only, so "Acme Team!" matches "acme team". */
export function looseName(name: string): string {
  return name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function isNamed(name: string, spoken: string): boolean {
  return looseName(name) === looseName(spoken);
}

/** The item whose name is the spoken one, or else the first whose name contains it. */
export function findNamed<Item>(items: Item[], spoken: string, nameOf: (item: Item) => string): Item | undefined {
  const wanted = looseName(spoken);
  const exact = items.find((item) => looseName(nameOf(item)) === wanted);
  return exact ?? items.find((item) => looseName(nameOf(item)).includes(wanted));
}
