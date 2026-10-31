// Telling from a line of code, in most languages, whether it defines a name. A pattern match, not a compiler: it may
// list a look-alike, which is why the page shows every candidate with its code.

import type { DefinitionKind } from "../ui/change-views.js";

const MODIFIER =
  "(?:(?:export|default|public|private|protected|internal|static|async|abstract|override|readonly|get|set|final|virtual|inline|pub)\\s+)";
const DECLARING_WORD =
  "(?:class|interface|type|enum|struct|trait|protocol|namespace|module|function\\*?|func|fn|def|const|let|var|val|typedef|macro|#define)";
const GENERICS = "(?:<[^>]*>)?";
const NAME_END = "(?![\\p{L}\\p{N}_$])";

const NOT_CODE = /^\s*(?:\/\/|\/\*|\*|#\s)/;
const IMPORT = /^\s*(?:import|from|use|require|#include|export\s*(?:\{|\*))/;

function pattern(source: string): RegExp {
  return new RegExp(source, "u");
}

/** The patterns for one name, each with what a match makes the line. */
function patternsFor(symbol: string): [RegExp, DefinitionKind][] {
  const name = `${symbol.replaceAll("$", "\\$")}${NAME_END}`;
  return [
    [pattern(`(?:^|[\\s(])${DECLARING_WORD}\\s+(?:\\([^)]*\\)\\s*)?${name}`), "definition"],
    [pattern(`^${name}\\s*=[^=]`), "definition"],
    [
      pattern(
        `^\\s*${MODIFIER}*(?:[\\w$.<>\\[\\]]+\\s+)?${name}\\s*${GENERICS}\\(.*\\)\\s*(?::[^=;{]+)?\\{[^}]*\\}?\\s*$`,
      ),
      "definition",
    ],
    [pattern(`^\\s*${MODIFIER}+(?:[\\w$.<>\\[\\]]+\\s+)?${name}\\s*${GENERICS}\\(\\s*$`), "definition"],
    [pattern(`^\\s*${MODIFIER}*${name}\\??\\s*${GENERICS}\\(.*\\)\\s*:\\s*[^=;{]+;?\\s*$`), "definition"],
    [pattern(`^\\s*${MODIFIER}*${name}\\s*[:=]\\s*(?:async\\s*)?(?:function|\\(|[\\w$]+\\s*=>)`), "definition"],
    [pattern(`\\b(?:implements|extends|impl)\\b[^{]*[\\s,<]${name}`), "implementation"],
    [pattern(`\\b(?:class|struct|extension)\\s+[\\w$]+[^{]*[(:,]\\s*${name}`), "implementation"],
    [pattern(`^\\s*${MODIFIER}+${name}\\??\\s*[:=]`), "member"],
    [pattern(`^\\s*${name}\\??\\s*:\\s*[^=]+[;,]?\\s*$`), "member"],
  ];
}

/** Sorts one name's search results: each line's kind, or undefined when the line only mentions the name. */
export function definitionMatcher(symbol: string): (line: string) => DefinitionKind | undefined {
  const patterns = patternsFor(symbol);
  return (line) => {
    if (NOT_CODE.test(line) || IMPORT.test(line)) return undefined;
    return patterns.find(([linePattern]) => linePattern.test(line))?.[1];
  };
}
