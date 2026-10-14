// curl and wget fetching a page to the screen: GET or HEAD only, nothing uploaded, no file written.

/** curl options that send data, upload, write files or load a config that could do either. */
const CURL_CHANGES = new Set([
  "-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "--data-ascii", "--json", "-F", "--form",
  "--form-string", "-T", "--upload-file", "-o", "--output", "-O", "--remote-name", "--remote-name-all", "-J",
  "--remote-header-name", "-c", "--cookie-jar", "-D", "--dump-header", "-K", "--config", "--output-dir",
  "--create-dirs", "--trace", "--trace-ascii", "--libcurl", "--stderr", "-Z", "--parallel",
]); // prettier-ignore
/** The same as single letters, which may be bunched up as in -sSLo. */
const CURL_SHORT_CHANGES = "dFTOoJcDKZ";
const CURL_METHOD = new Set(["-X", "--request"]);
const READING_METHODS = new Set(["GET", "HEAD"]);
/** wget options that send data, crawl, or write files besides the page itself. */
const WGET_CHANGES = new Set([
  "--post-data", "--post-file", "--method", "--body-data", "--body-file", "-o", "--output-file", "-a",
  "--append-output", "-r", "--recursive", "-m", "--mirror", "-N", "--timestamping", "-k", "--convert-links", "-p",
  "--page-requisites", "-x", "--force-directories", "-c", "--continue", "--save-cookies", "-P", "--directory-prefix",
]); // prettier-ignore
const WGET_SHORT_CHANGES = "oarmNkpxcP";
/** wget writes the page to a file unless told to print it (-O -) or only check it exists. */
const WGET_TO_SCREEN = /^(-[^-]*O-|--output-document=-)$/;

export function isReadOnlyCurl(args: string[]): boolean {
  return args.every(
    (arg, i) => !CURL_CHANGES.has(optionName(arg)) && !hasShortFlag(arg, CURL_SHORT_CHANGES) && readsWith(args, i),
  );
}

export function isReadOnlyWget(args: string[]): boolean {
  const toScreen = args.some((arg, i) => WGET_TO_SCREEN.test(arg) || (/^-[^-]*O$/.test(arg) && args[i + 1] === "-"));
  if (!toScreen && !args.includes("--spider")) return false;
  return args.every(
    (arg) => !WGET_CHANGES.has(optionName(arg)) && !hasShortFlag(withoutOutputDash(arg), WGET_SHORT_CHANGES),
  );
}

/** An -X or --request at `i` asks for GET or HEAD; any other argument passes. */
function readsWith(args: string[], i: number): boolean {
  const method = methodAt(args[i], args[i + 1] ?? "");
  return method === undefined || READING_METHODS.has(method.toUpperCase());
}

/** The method an argument asks for, written after it or as the next argument; undefined when it asks for none. */
function methodAt(arg: string, next: string): string | undefined {
  if (CURL_METHOD.has(optionName(arg))) return arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : next;
  const short = /^-[^-]*X(.*)$/.exec(arg);
  return short ? short[1] || next : undefined;
}

function optionName(arg: string): string {
  return arg.split("=")[0];
}

/** A bunch of single-letter options such as -sSL holding any of `letters`; the letters after X are its method. */
function hasShortFlag(arg: string, letters: string): boolean {
  if (!/^-[^-]/.test(arg)) return false;
  const flags = arg.slice(1).split("X")[0];
  return flags.split("").some((flag) => letters.includes(flag));
}

/** In -qO- the O prints to the screen, so it isn't a file to write. */
function withoutOutputDash(arg: string): string {
  return arg.replace(/O-?$/, "");
}
