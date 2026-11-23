// Changed files arranged as folders, for the Review view's list. A folder holding only one folder joins it into one
// row ("src/ui"), as editors show them. Only types are imported, so the page bundles it and Node tests it.

import type { ChangedFileView } from "./change-views.js";

export interface FileLeaf {
  name: string;
  file: ChangedFileView;
}

export interface FolderNode {
  /** One folder's name, or several joined by "/" when each held only the next. */
  name: string;
  /** From the repository's root, ending in "/"; tells folders apart. */
  path: string;
  folders: FolderNode[];
  files: FileLeaf[];
}

/** The folders and files under `root`, a path prefix every file shares ("" for none). */
export function changeTree(files: ChangedFileView[], root: string): FolderNode {
  const top = emptyFolder("", root);
  for (const file of files) addFile(top, file, file.path.slice(root.length).split("/"));
  return ordered({ ...top, folders: top.folders.map(compacted) });
}

export function filesUnder(folder: FolderNode): ChangedFileView[] {
  return [...folder.files.map((leaf) => leaf.file), ...folder.folders.flatMap(filesUnder)];
}

function emptyFolder(name: string, path: string): FolderNode {
  return { name, path, folders: [], files: [] };
}

function addFile(folder: FolderNode, file: ChangedFileView, parts: string[]): void {
  const [name, ...rest] = parts;
  if (!rest.length) {
    folder.files.push({ name, file });
    return;
  }
  addFile(childFolder(folder, name), file, rest);
}

function childFolder(folder: FolderNode, name: string): FolderNode {
  const existing = folder.folders.find((child) => child.name === name);
  if (existing) return existing;
  const child = emptyFolder(name, `${folder.path}${name}/`);
  folder.folders.push(child);
  return child;
}

function compacted(folder: FolderNode): FolderNode {
  const [only] = folder.folders;
  const holdsOneFolderOnly = folder.folders.length === 1 && !folder.files.length;
  if (holdsOneFolderOnly) return compacted({ ...only, name: `${folder.name}/${only.name}` });
  return { ...folder, folders: folder.folders.map(compacted) };
}

/** Folders before files, each by name. */
function ordered(folder: FolderNode): FolderNode {
  const folders = folder.folders.toSorted(byName).map(ordered);
  return { ...folder, folders, files: folder.files.toSorted(byName) };
}

function byName(first: { name: string }, second: { name: string }): number {
  return first.name.localeCompare(second.name);
}
