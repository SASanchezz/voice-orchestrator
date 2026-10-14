import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadOnlyCommand } from "./read-only-commands.js";

const READ_ONLY = [
  "git status",
  "git diff --stat HEAD~1",
  "git log --oneline -20 --grep push",
  "git -C ../repo show HEAD:src/app.ts",
  "git rev-list --count HEAD",
  "git remote -v",
  "git ls-files | grep deploy",
  "git check-ignore -v .env",
  "git branch -a",
  "git stash list",
  "ls -la deploy/",
  "cat src/deploy/config.yml",
  "head -50 README.md && tail -n 20 log.txt",
  "sed -n '1,80p' src/main.ts",
  "grep -rn 'delete from' src | head -20",
  "rg -n deploy --type ts",
  "find . -name '*.sql' -not -path './node_modules/*'",
  "wc -l src/*.ts; echo done; pwd",
  "cd db && ls && cat schema.sql",
  "curl -s https://example.com/docs | head",
  "curl -sSL -X GET https://example.com",
  "wget -qO- https://example.com",
  `python3 -c "import json; print(json.load(open('package.json'))['name'])"`,
  "node -e \"console.log(require('./package.json').version)\"",
  "python3 - <<'EOF'\nimport csv\nfor row in csv.reader(open('data.csv')):\n    print(row)\nEOF",
  'git diff "$(git merge-base main HEAD)"',
  "find src -name '*.ts' | xargs grep -l deploy",
  "ls 2>/dev/null || echo none",
];

const CHANGES = [
  "git commit -m 'read only'",
  "git branch new-feature",
  "git stash",
  "git diff --output=patch.diff",
  "ls > files.txt",
  "cat a.txt >> b.txt",
  "sed -i 's/a/b/' file.txt",
  "sed -n 'w out.txt' file.txt",
  "find . -name '*.tmp' -delete",
  "find . -exec rm {} +",
  "git status && npm install",
  "ls; rm -rf dist",
  "curl -X POST https://example.com/api",
  "curl -sX POST https://example.com/api",
  "curl -d 'a=1' https://example.com",
  "curl -o page.html https://example.com",
  "curl -sSLo page.html https://example.com",
  "wget https://example.com/file.zip",
  `python3 -c "open('out.txt', 'w').write('x')"`,
  `python3 -c "import subprocess; subprocess.run(['ls'])"`,
  "python3 script.py",
  "node -e \"require('fs').writeFileSync('x', '1')\"",
  "node build.js",
  "echo $(rm -rf tmp)",
  "./ls",
  "xargs rm",
  "sort -o sorted.txt data.txt",
  "grep 'deploy",
];

test("read-only commands, alone or joined, need no permission", () => {
  for (const command of READ_ONLY) assert.equal(isReadOnlyCommand(command), true, command);
});

test("commands that change, write, run or send anything are not read-only", () => {
  for (const command of CHANGES) assert.equal(isReadOnlyCommand(command), false, command);
});
