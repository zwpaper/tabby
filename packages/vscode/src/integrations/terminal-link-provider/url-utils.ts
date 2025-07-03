import * as vscode from "vscode";

/**
 * Extracts all HTTP(S) URLs from a given line of text.
 *
 * @param line - The input string to search for URLs.
 * @returns An array of objects, each containing the start index, length, and the parsed vscode.Uri for each found URL.
 *
 * Example:
 *   extractHttpUrls('See http://localhost:8080 and https://example.com')
 *   // => [
 *   //   { start: 4, length: 21, url: vscode.Uri.parse('http://localhost:8080') },
 *   //   { start: 27, length: 19, url: vscode.Uri.parse('https://example.com') }
 *   // ]
 */
function extractHttpUrls(
  line: string,
): { start: number; length: number; url: vscode.Uri }[] {
  const urlRegex =
    /https?:\/\/[\w\-\.\:]+(?:\/[\w\-\.\/%\?&=#@~\+\!\$\*'\(\),;:]*)?/g;
  const results: { start: number; length: number; url: vscode.Uri }[] = [];
  let match: RegExpExecArray | null = urlRegex.exec(line);
  while (match !== null) {
    const matchedUrl = match[0];
    // Remove trailing punctuation that is not a valid URL character
    const trimmedUrl = matchedUrl.replace(/[:;,\.]+$/g, "");
    try {
      results.push({
        start: match.index,
        length: trimmedUrl.length,
        url: vscode.Uri.parse(trimmedUrl),
      });
    } catch {}
    match = urlRegex.exec(line);
  }
  return results;
}

/**
 * Parses the authority component of a URL, extracting the host and port.
 * NOTE: IPv6 is not handled.
 */
function parseAuthority(authority: string): { host: string; port?: string } {
  if (!authority) {
    return { host: "" };
  }
  const idx = authority.lastIndexOf(":");
  if (idx !== -1) {
    return { host: authority.slice(0, idx), port: authority.slice(idx + 1) };
  }
  return { host: authority };
}

/**
 * Checks if a given URL is a local URL.
 *
 * @param url - The vscode.Uri to check.
 * @returns True if the URL is local, false otherwise.
 *
 * True examples:
 *   http://localhost
 *   http://127.0.0.1:8080/path/to/resource
 * False examples:
 *   http://example.com
 */
function isLocalUrl(url: vscode.Uri): boolean {
  const { host } = parseAuthority(url.authority);
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

/**
 * Converts a given URL to a new URL with the specified hostname.
 *
 * If a port is specified in the original URL, it will be prepended to the hostname in the new authority as "{port}-{hostname}".
 *
 * @param url - The original vscode.Uri to convert.
 * @param hostname - The new hostname to use in the authority.
 * @returns A new vscode.Uri with the updated authority.
 *
 * Example:
 *   convertUrl(vscode.Uri.parse('http://localhost:8080/path?query=1'), 'myhost')
 *   // => vscode.Uri.parse('http://8080-myhost/path?query=1')
 *
 *   convertUrl(vscode.Uri.parse('http://localhost/path'), 'myhost')
 *   // => vscode.Uri.parse('http://myhost/path')
 */
function convertUrl(url: vscode.Uri, hostname: string): vscode.Uri {
  const { port } = parseAuthority(url.authority);
  let newAuthority = hostname;
  if (port) {
    newAuthority = `${port}-${hostname}`;
  }
  return url.with({ authority: newAuthority });
}

export { extractHttpUrls, isLocalUrl, convertUrl };
