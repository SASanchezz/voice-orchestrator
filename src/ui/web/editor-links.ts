// VS Code in the browser opens a web link it was asked to follow with window.open on its own page, which put it in a
// tab beside the web UI, in whatever Chrome profile that is. The Code view's frames share the page's origin, so the page
// takes over their window.open: a web link goes to the project's Chrome profile, like a link in its chat.

import { hasChromeProfile, openLink } from "./project-links.js";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/** Every page `frame` loads hands its web links to `project`'s Chrome profile. */
export function openEditorLinksInProjectProfile(frame: HTMLIFrameElement, project: string): void {
  frame.addEventListener("load", () => {
    const editorWindow = frame.contentWindow;
    if (editorWindow) routeWindowOpen(editorWindow, project);
  });
}

function routeWindowOpen(editorWindow: Window, project: string): void {
  const browserOpen = editorWindow.open.bind(editorWindow);
  editorWindow.open = (url, target, features) => {
    const href = url === undefined ? "" : String(url);
    const goesToProfile = isWebLink(href) && hasChromeProfile(project);
    if (!goesToProfile) return browserOpen(url, target, features);
    void openLink(href, project);
    // the link opens in another Chrome window, so there is no window to hand back, as with "noopener"
    return null;
  };
}

function isWebLink(href: string): boolean {
  return URL.canParse(href) && WEB_PROTOCOLS.has(new URL(href).protocol);
}
