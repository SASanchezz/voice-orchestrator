// Files that hold secrets: keys, credentials, tokens, .env files (not their examples) and the folders that keep them.

const ENV_FILE = /^\.env($|[._*-])|^\.envrc$/i;
const ENV_EXAMPLE = /^\.env\.(example|sample)$/i;
const SECRET_FILE =
  /^(id_(rsa|dsa|ecdsa|ed25519)|\.npmrc|\.pypirc|\.netrc|\.git-credentials|\.pgpass|\.my\.cnf|\.htpasswd|master\.key|.+\.(pem|key|p12|pfx|keystore|jks|kdbx|keychain|keychain-db|ovpn))$/i;
const SECRET_FOLDER = /(^|\/)(\.ssh|\.aws|\.gnupg|\.kube|\.docker|\.azure|gcloud|Keychains)(\/|$)/i;
/** A word such as secrets or token in the file's own name, as in config/secrets.yml or auth_token.txt. */
const SECRET_WORD = /(^|[._-])(secrets?|credentials?|tokens?|passwords?|passwd|private[._-]?key)([._-]|$)/i;
/** Code and docs about secrets, such as token-service.ts or secrets.md, hold none. */
const CODE_OR_DOCS =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|cs|php|md|mdx|html|css|scss|snap)$/i;
/** What separates paths inside a word: HEAD:.env, --file=.env, open('.env'). */
const PATH_SEPARATORS = /[\s'"`()[\],;:=<>{}|&]+/;

/** Whether any path in the word names a file that holds secrets. */
export function namesSecretFile(word: string): boolean {
  return word.split(PATH_SEPARATORS).some(isSecretPath);
}

function isSecretPath(path: string): boolean {
  const name = path.replace(/\/+$/, "").split("/").pop() ?? "";
  if (!name || ENV_EXAMPLE.test(name)) return false;
  if (SECRET_FOLDER.test(path) || ENV_FILE.test(name) || SECRET_FILE.test(name)) return true;
  return looksLikeFile(path) && SECRET_WORD.test(name) && !CODE_OR_DOCS.test(name);
}

/** A bare word such as `token` is more likely something searched for than a file. */
function looksLikeFile(path: string): boolean {
  return path.includes("/") || path.includes(".");
}
