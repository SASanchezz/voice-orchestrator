// Python and Node one-liners that only read: code given with -c / -e / -p or in a heredoc, with nothing in it that
// writes, deletes, runs programs, opens a connection or sends data. Anything it can't tell is not read-only.

/** Python code that may change files, run programs or talk to a server or database. */
const PYTHON_CHANGES = new RegExp(
  [
    String.raw`\bopen\s*\([^)]*,\s*(mode\s*=\s*)?['"][rbt]*[wax+][rbtwax+]*['"]`,
    String.raw`\.open\s*\(\s*(mode\s*=\s*)?['"][rbt]*[wax+][rbtwax+]*['"]`,
    String.raw`\bos\.(remove|unlink|rmdir|removedirs|rename|renames|replace|mkdir|makedirs|chmod|chown|truncate|symlink|link|system|popen|spawn\w*|exec\w*|kill\w*|write|putenv|unsetenv|setuid|fork)\b`,
    String.raw`\.(write|writelines|write_text|write_bytes|touch|unlink|rmdir|mkdir|rename|chmod|symlink_to|hardlink_to|connect|execute|executemany|executescript|commit|post|put|patch|delete|send|sendall)\s*\(`,
    String.raw`\b(subprocess|shutil|socket|ctypes|multiprocessing|importlib|pty|signal|sqlite3|tempfile)\b`,
    String.raw`\b(exec|eval|compile|__import__|breakpoint)\s*\(`,
  ].join("|"),
);
/** Node code that may change files, run programs or talk to a server. */
const NODE_CHANGES = new RegExp(
  [
    String.raw`\bfs(\.promises)?\.\w*(write|append|rm|unlink|mkdir|rename|copy|cp|chmod|chown|truncate|symlink|link|open|utimes|watch)`,
    String.raw`\b(writeFile|appendFile|createWriteStream|rm|rmdir|unlink|mkdir|rename|copyFile|cp|chmod|chown|truncate|symlink|utimes|open)(Sync)?\s*\(`,
    String.raw`\b(child_process|worker_threads|cluster|dgram)\b`,
    String.raw`\brequire\s*\(\s*['"](node:)?(net|http|https|http2|tls)['"]`,
    String.raw`\bimport\s*\(`,
    String.raw`\b(exec|execSync|execFile\w*|spawn\w*|fork|eval)\s*\(`,
    String.raw`\bfetch\s*\([^)]*,`,
    String.raw`\bprocess\.(kill|binding|dlopen|chdir|setuid)\b`,
    String.raw`\bnew\s+Function\b`,
  ].join("|"),
);
const PYTHON_CODE_FLAG = "-c";
/** Options to run before the code that can't load other code. */
const PYTHON_SAFE_OPTIONS = /^-[IBEsSuqObd]+$/;
const NODE_CODE_FLAGS = new Set(["-e", "--eval", "-p", "--print"]);
/** Node options that load other code before the one-liner. */
const NODE_PRELOADS = new Set(["-r", "--require", "--import", "--loader", "--experimental-loader"]);
const READ_STDIN = "-";

export function isReadOnlyPython(args: string[], stdin: string[]): boolean {
  const code = pythonCode(args, stdin);
  return code !== undefined && !PYTHON_CHANGES.test(code);
}

export function isReadOnlyNode(args: string[], stdin: string[]): boolean {
  if (args.some((arg) => NODE_PRELOADS.has(arg.split("=")[0]))) return false;
  const code = nodeCode(args, stdin);
  return code !== undefined && !NODE_CHANGES.test(code);
}

/** The code of `python -c CODE` or `python - <<EOF`; undefined for a script file or anything else. */
function pythonCode(args: string[], stdin: string[]): string | undefined {
  const flag = args.indexOf(PYTHON_CODE_FLAG);
  if (flag !== -1)
    return args.slice(0, flag).every((arg) => PYTHON_SAFE_OPTIONS.test(arg)) ? args[flag + 1] : undefined;
  return readsStdin(args) ? stdin.join("\n") || undefined : undefined;
}

function nodeCode(args: string[], stdin: string[]): string | undefined {
  const flag = args.findIndex((arg) => NODE_CODE_FLAGS.has(arg));
  if (flag !== -1) return args[flag + 1];
  return readsStdin(args) ? stdin.join("\n") || undefined : undefined;
}

function readsStdin(args: string[]): boolean {
  return !args.length || (args.length === 1 && args[0] === READ_STDIN);
}
