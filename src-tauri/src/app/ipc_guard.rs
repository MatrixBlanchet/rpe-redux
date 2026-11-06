//! Host-side IPC capability token for path-bearing native commands.
//!
//! Tauri 2.12 records the requesting frame URL on its internal `InvokeRequest`
//! but drops it before custom commands receive an `InvokeMessage`; only the
//! coarse local/remote ACL origin survives. The main document therefore gets a
//! per-process token from a guarded initialization script. The script also
//! attaches that token to custom-protocol IPC requests, and protected commands
//! reject calls without it. Subframes, including the extension sandbox, cannot
//! run the guarded block or read the token because they are sandboxed.

use tauri::http::HeaderMap;

/// Header set on custom-protocol IPC requests by the main-frame script.
pub(crate) const TOKEN_HEADER: &str = "x-redux-host-token";

/// Error returned when a protected command has no valid token.
pub(crate) const INVALID_TOKEN: &str = "host_token_invalid";

/// A per-process IPC capability token.
#[derive(Clone)]
pub(crate) struct HostToken {
    value: String,
}

impl HostToken {
    /// Generate a random per-process token.
    pub(crate) fn new() -> Self {
        // Two v4 UUIDs provide 244 random bits; hex keeps the value safe to
        // embed in an initialization script without escaping.
        let value = format!(
            "{}{}",
            uuid::Uuid::new_v4().simple(),
            uuid::Uuid::new_v4().simple()
        );
        Self { value }
    }

    /// JavaScript injected into every frame; the top-frame guard keeps the
    /// token out of subframes.
    pub(crate) fn initialization_script(&self) -> String {
        let token = serde_json::to_string(&self.value).expect("host token is a string");
        format!(
            r#"(() => {{
  if (window !== window.top) return;
  const token = {token};
  const header = "{TOKEN_HEADER}";
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === "function") {{
    globalThis.fetch = function (input, init) {{
    try {{
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (url.startsWith("http://ipc.localhost/") ||
          url.startsWith("https://ipc.localhost/") ||
          url.startsWith("ipc://localhost/")) {{
        const headers = new Headers(
          (init && init.headers) ||
          (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined)
        );
        headers.set(header, token);
        init = Object.assign({{}}, init, {{ headers }});
      }}
    }} catch (_) {{}}
    return originalFetch.apply(this, arguments);
    }};
  }}
  // WebView2 postMessage fallback still carries the same capability header.
  try {{
    const webview = globalThis.chrome && globalThis.chrome.webview;
    if (webview && typeof webview.postMessage === "function") {{
      const originalPost = webview.postMessage.bind(webview);
      webview.postMessage = function (message) {{
        try {{
          const data = JSON.parse(message);
          if (data && typeof data.cmd === "string" && data.__TAURI_INVOKE_KEY__) {{
            data.options = data.options || {{}};
            const headers = Object.assign({{}}, data.options.headers || {{}});
            headers[header] = token;
            data.options.headers = headers;
            message = JSON.stringify(data);
          }}
        }} catch (_) {{}}
        return originalPost(message);
      }};
    }}
  }} catch (_) {{}}
}})();"#
        )
    }

    /// Check a supplied token in constant time.
    pub(crate) fn verify(&self, supplied: Option<&str>) -> bool {
        let Some(supplied) = supplied else {
            return false;
        };
        constant_time_eq(self.value.as_bytes(), supplied.as_bytes())
    }

    /// Reject a protected command when the request does not carry the token.
    pub(crate) fn require(&self, headers: &HeaderMap) -> Result<(), String> {
        let supplied = headers
            .get(TOKEN_HEADER)
            .and_then(|value| value.to_str().ok());
        if self.verify(supplied) {
            Ok(())
        } else {
            Err(INVALID_TOKEN.into())
        }
    }
}

/// Compare two byte strings without an early exit on the first difference.
fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut difference = 0u8;
    for (left, right) in left.iter().zip(right) {
        difference |= left ^ right;
    }
    difference == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_tokens_are_long_and_distinct() {
        let first = HostToken::new();
        let second = HostToken::new();
        assert_eq!(first.value.len(), 64);
        assert_ne!(first.value, second.value);
    }

    #[test]
    fn verification_accepts_only_the_exact_token() {
        let token = HostToken::new();
        assert!(token.verify(Some(&token.value)));
        assert!(!token.verify(None));
        assert!(!token.verify(Some("")));
        assert!(!token.verify(Some(&token.value[..63])));
        assert!(!token.verify(Some(&format!("{}0", &token.value[1..]))));
    }

    #[test]
    fn initialization_script_is_main_frame_only_and_attaches_the_header() {
        let token = HostToken::new();
        let script = token.initialization_script();
        assert!(script.contains("window !== window.top"));
        assert!(script.contains(TOKEN_HEADER));
        assert!(script.contains("https://ipc.localhost/"));
        assert!(script.contains("chrome.webview"));
        assert!(script.contains(&token.value));
    }

    #[test]
    fn header_check_reports_a_stable_error() {
        let token = HostToken::new();
        let mut headers = HeaderMap::new();
        assert_eq!(token.require(&headers).unwrap_err(), INVALID_TOKEN);
        headers.insert(TOKEN_HEADER, token.value.parse().unwrap());
        assert!(token.require(&headers).is_ok());
    }
}
