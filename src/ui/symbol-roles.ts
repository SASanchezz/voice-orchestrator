// A rough guess at what a name in code is, from its spelling and what follows it, for colouring it in any language.

export type SymbolRole = "class" | "method" | "variable";

const CAPITALISED = /^\p{Lu}/u;
const HAS_LOWERCASE = /\p{Ll}/u;
const OPENS_CALL = /^\s*\(/;

/** A capitalised name with lowercase in it is a class; ALL_CAPS is a constant, so a variable. */
export function symbolRole(name: string, textAfter: string): SymbolRole {
  if (isClassName(name)) return "class";
  if (OPENS_CALL.test(textAfter)) return "method";
  return "variable";
}

function isClassName(name: string): boolean {
  return CAPITALISED.test(name) && HAS_LOWERCASE.test(name);
}
