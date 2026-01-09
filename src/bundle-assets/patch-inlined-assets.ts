function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	const len = bytes.byteLength;
	const CHUNK_SIZE = 32768;
	for (let i = 0; i < len; i += CHUNK_SIZE) {
		const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
		binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
	}
	return btoa(binary);
}

/** -----------------------------------------------------------
 * This function is used to patch the viewer.css file, since css cannot use blob URLs directly.
 * It will replace the original URLs with data URLs instead.
 * ------------------------------------------------------------
 */

function getPatchedViewerCSS(
	BLOB_BINARY_MAP: Record<string, { type: string; data: Uint8Array }>
): string {
	const originalCSS = BLOB_BINARY_MAP["pdf/web/viewer.css"];
	if (!originalCSS) return "";

	const text = new TextDecoder("utf-8").decode(originalCSS.data);

	// Match url(...)
	const relativeUrlPattern = /url\(\s*(['"]?)(?![a-z][\w+.-]*:|\/\/)([^'")]+)\1\s*\)/g;

	return text.replace(relativeUrlPattern, (match, quote, url) => {
		// Extract pure filename (remove path and query parameters)
		const basename = url.match(/([^\/?#]+)(?:\?.*)?$/)?.[1];

		if (!basename) return match;

		// Find matching resource
		const hitKey = Object.keys(BLOB_BINARY_MAP).find((k) => k.endsWith(basename));

		if (hitKey) {
			const resource = BLOB_BINARY_MAP[hitKey]!;
			const base64 = uint8ArrayToBase64(resource.data);
			const mimeType = resource.type || "application/octet-stream";

			return `url("data:${mimeType};base64,${base64}")`;
		} else {
			console.warn(`[Zotero Reader] CSS Resource not found: ${url}`);
			return match;
		}
	});
}

/** -----------------------------------------------------------
 * This function is used to patch the PDF viewer HTML file to use the blob URLs
 * for inline resources instead of the original URLs.
 * The following will be replaced in the viewer.html:
 * - fetch
 * - XMLHttpRequest
 * ------------------------------------------------------------
 */
export function patchPDFJSViewerHTML(
	BLOB_BINARY_MAP: Record<string, { type: string; data: Uint8Array }>,
	BLOB_URL_MAP: Record<string, string>
) {
	// Get original HTML bytes
	let originalHTML = BLOB_BINARY_MAP["pdf/web/viewer.html"];
	if (!originalHTML) return "";
	let originalHTMLText = originalHTML.data;
	const BOM = [0xef, 0xbb, 0xbf];
	if (
		originalHTMLText[0] === BOM[0] &&
		originalHTMLText[1] === BOM[1] &&
		originalHTMLText[2] === BOM[2]
	) {
		originalHTMLText = originalHTMLText.slice(3);
	}
	const text = new TextDecoder("utf-8").decode(originalHTMLText);

	// Parse into a DOM
	const parser = new DOMParser();
	const doc = parser.parseFromString(text, "text/html");

	// Guard: ensure <head> exists (PDF viewer.html should have it)
	const head = doc.head || doc.getElementsByTagName("head")[0];

	const cssLinks = doc.querySelectorAll('link[rel="stylesheet"][href="viewer.css"]');
	cssLinks.forEach((linkEl) => {
		const styleEl = doc.createElement("style");
		styleEl.textContent = getPatchedViewerCSS(BLOB_BINARY_MAP);
		linkEl.replaceWith(styleEl);
	});

	// Rewrite <script type="module" src="...">
	const moduleScripts = doc.querySelectorAll('script[type="module"][src]');
	moduleScripts.forEach((scriptEl) => {
		const src = scriptEl.getAttribute("src") || "";
		// Find a key whose basename matches (similar to your RegExp logic)
		const basenameMatch = src.match(/([^\/?#]+)(?:\?.*)?$/);
		const basename = basenameMatch?.[1];
		if (basename) {
			const hit = Object.keys(BLOB_URL_MAP).find((k) =>
				k.includes(basename)
			);
			if (hit) {
				scriptEl.setAttribute("src", BLOB_URL_MAP[hit]!);
			} else {
				console.warn(`No blob URL found for ${src}`);
			}
		}
	});

	// Build the patch scripts (order: first the map, then the monkey patch)
	const blobMapScript = doc.createElement("script");
	blobMapScript.type = "module";
	blobMapScript.textContent = `
        window.BLOB_URL_MAP = ${JSON.stringify(BLOB_URL_MAP)};
    `.trim();

	const patchScript = doc.createElement("script");
	patchScript.type = "module";
	patchScript.textContent = `
        function getBlobUrlForRequest(requestedUrl) {
            if (!requestedUrl) return null;
            const isRelative = !/^[a-zA-Z][a-zA-Z\\d+\\-.]*:/.test(requestedUrl) && !requestedUrl.startsWith("//");
            
            if (isRelative) {
                const match = requestedUrl.match(/([^\\/?#]+)(?:\\?.*)?$/);
                const basename = match ? match[1] : requestedUrl;
                
                const key = Object.keys(window.BLOB_URL_MAP).find(k => k.endsWith(basename));
                return key ? window.BLOB_URL_MAP[key] : null;
            }
            return null;
        }

        // Patch Fetch
        const realFetch = window.fetch;
        window.fetch = async function(input, init) {
            const url = typeof input === "string" ? input : (input.url || "");
            const blobUrl = getBlobUrlForRequest(url);
            if (blobUrl) {
                // console.debug("Patched Fetch:", url);
                return realFetch(blobUrl, init);
            }
            return realFetch(input, init);
        };

        // Patch XHR
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new OriginalXHR();
            const originalOpen = xhr.open;
            xhr.open = function(method, url, ...args) {
                const blobUrl = getBlobUrlForRequest(url);
                if (blobUrl) {
                    // console.debug("Patched XHR:", url);
                    return originalOpen.call(this, method, blobUrl, ...args);
                }
                return originalOpen.call(this, method, url, ...args);
            };
            return xhr;
        };
        Object.assign(window.XMLHttpRequest, OriginalXHR);

		
    // Test patched fetch
    // fetch('standard_fonts/FoxitFixedBoldItalic.pfb')
    //   .then(r => r.ok ? r.arrayBuffer() : null)
    //   .then(buf => {
    //     if (buf) console.debug('Font data (fetch):', buf.byteLength, 'bytes');
    //   });

    // Test patched XHR
    // const xhr = new XMLHttpRequest();
    // xhr.open('GET', 'standard_fonts/FoxitFixedBoldItalic.pfb', true);
    // xhr.responseType = 'arraybuffer';
    // xhr.onload = function () {
    //   if (this.response) {
    //     console.debug('Font data (XHR):', this.response.byteLength, 'bytes');
    //   }
    // };
    // xhr.send();
    `.trim();
	// 	patchScript.textContent = `
	//     /** Find matching resource key and return its blob URL */
	//     function getBlobUrlForRequest(requestedUrl) {
	//       const isRelative = (u) => !/^[a-zA-Z][a-zA-Z\\d+\\-.]*:/.test(u) && !u.startsWith("//");
	//       if (isRelative(requestedUrl)) {
	//         return globalThis.BLOB_URL_MAP[requestedUrl] ||
	//           globalThis.BLOB_URL_MAP[
	//             Object.keys(globalThis.BLOB_URL_MAP).find(key =>
	//               key.includes(requestedUrl.match(/([^\\/?#]+)(?:\\?.*)?$/)[1])
	//             )
	//           ];
	//       }
	//     }

	//     // ---------- patched fetch ----------
	//     const realFetch = window.fetch.bind(window);
	//     window.fetch = async function patchedFetch(input, init) {
	//       const url = typeof input === "string" ? input
	//         : input instanceof Request ? input.url
	//         : input instanceof URL ? input.toString()
	//         : "";
	//       const blobUrl = getBlobUrlForRequest(url);
	//       if (blobUrl) {
	//         // If the request is for a blob URL, we return the blob URL directly
	//         console.debug("Patched fetch for URL:", url, "-> Blob URL:", blobUrl);
	//         return realFetch(blobUrl, init);
	//       }
	//       return realFetch(input, init);
	//     };

	//     // ---------- patched XMLHttpRequest ----------
	//     const NativeXHR = window.XMLHttpRequest;
	//     function PatchedXHR() {
	//       const real = new NativeXHR();
	//       return new Proxy(real, {
	//         get(target, prop, receiver) {
	//           if (prop === 'open') {
	//             return function open(method, url, async = true, user, pw) {
	//               const mapped = getBlobUrlForRequest(url);
	//               // If the request is for a blob URL, we return the blob URL directly
	//               mapped && console.debug("Patched XHR open for URL:", url, "-> Blob URL:", mapped);
	//               return target.open.call(target, method, mapped || url, async, user, pw);
	//             };
	//           }
	//           const value = Reflect.get(target, prop, receiver);
	//             if (typeof value === 'function') return value.bind(target);
	//           return value;
	//         },
	//         set(target, prop, value) {
	//           (target)[prop] = value;
	//           return true;
	//         }
	//       });
	//     }
	//     Object.getOwnPropertyNames(NativeXHR).forEach(k => {
	//       if ((k in PatchedXHR)) {
	//         Object.defineProperty(
	//           PatchedXHR,
	//           k,
	//           Object.getOwnPropertyDescriptor(NativeXHR, k)
	//         );
	//       }
	//     });
	//     window.XMLHttpRequest = PatchedXHR;

	//   `.trim();

	// Insert both at head start (prepend order: second inserted first so final order is map then patch)
	if (head.firstChild) {
		head.insertBefore(patchScript, head.firstChild);
		head.insertBefore(blobMapScript, head.firstChild);
	} else {
		head.appendChild(blobMapScript);
		head.appendChild(patchScript);
	}

	// Serialize DOM back to HTML
	const doctype = Array.from(doc.childNodes).find(
		(n) => n.nodeType === Node.DOCUMENT_TYPE_NODE
	) as DocumentType | undefined;

	const serialized =
		(doctype ? `<!DOCTYPE ${doctype.name}>\n` : "<!DOCTYPE html>\n") +
		doc.documentElement.outerHTML;

	return serialized;
}
