//! Shared user-supplied path policy for document resources, archives, packages,
//! themes, and update payloads.
//!
//! Every caller maps a rejected name to its own diagnostic, so this module only
//! reports whether a value is safe and never owns caller-facing error text.

/// Longest package or chart id accepted, in bytes.
///
/// The id becomes a `.json` entry inside a package. Keeping it below the common
/// 255-unit component limit leaves room for that suffix without letting a save
/// produce an archive that later path handling cannot reopen.
pub(crate) const MAX_PACKAGE_ID_BYTES: usize = 200;

/// Whether one path segment is a reserved Windows device name.
///
/// Device names are reserved with or without an extension, so the comparison
/// uses the part before the first dot. The ASCII names cover the legacy
/// `CON`/`PRN`/`AUX`/`NUL` set and the numbered `COM`/`LPT` ports.
fn is_windows_device_name(segment: &str) -> bool {
    let stem = segment.split_once('.').map_or(segment, |(stem, _)| stem);
    let stem = stem.trim_end_matches(' ');
    if stem.eq_ignore_ascii_case("CON")
        || stem.eq_ignore_ascii_case("PRN")
        || stem.eq_ignore_ascii_case("AUX")
        || stem.eq_ignore_ascii_case("NUL")
        || stem.eq_ignore_ascii_case("CONIN$")
        || stem.eq_ignore_ascii_case("CONOUT$")
    {
        return true;
    }
    let bytes = stem.as_bytes();
    bytes.len() == 4
        && (bytes[..3].eq_ignore_ascii_case(b"COM") || bytes[..3].eq_ignore_ascii_case(b"LPT"))
        && matches!(bytes[3], b'1'..=b'9')
}

/// Whether one segment is safe as a plain file or folder name.
fn valid_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment != "."
        && segment != ".."
        && !segment.ends_with('.')
        && !segment.ends_with(' ')
        && !segment
            .chars()
            .any(|ch| matches!(ch, '<' | '>' | '"' | '|' | '?' | '*'))
        && !is_windows_device_name(segment)
}

/// Normalize one project-relative path under the shared safety policy.
///
/// Both separators are accepted and returned as `/`. The result must stay a
/// plain relative path: root-relative, drive, UNC, device-namespace, alternate
/// stream, parent traversal, Windows device names, control characters, and
/// invalid Windows filename characters are rejected. `None` means the name is
/// unsafe; callers choose the diagnostic they expose.
pub(crate) fn relative_path(name: &str) -> Option<String> {
    if name.is_empty() || name.chars().any(char::is_control) {
        return None;
    }
    let normalized = name.replace('\\', "/");
    // A leading separator covers rooted and UNC/device-namespace names; a colon
    // covers drive letters, alternate data streams, and `C:relative` forms.
    if normalized.starts_with('/') || normalized.contains(':') {
        return None;
    }
    let mut parts = Vec::new();
    for part in normalized.split('/') {
        if !valid_segment(part) {
            return None;
        }
        parts.push(part);
    }
    if parts.is_empty() {
        return None;
    }
    Some(parts.join("/"))
}

/// Normalize one value that must name exactly one path segment.
///
/// This is the stricter form for package folders and file names: a separator of
/// either kind is rejected instead of being folded into a nested path.
pub(crate) fn single_segment(name: &str) -> Option<String> {
    relative_path(name).filter(|path| !path.contains('/'))
}

/// Validate and normalize a package or chart id.
///
/// Surrounding whitespace is trimmed as before. The result must be one safe
/// segment and may not exceed [`MAX_PACKAGE_ID_BYTES`], so the same id can be
/// used as a package folder, sidecar value, and chart entry stem.
pub(crate) fn package_id(name: &str) -> Option<String> {
    let name = name.trim();
    single_segment(name).filter(|id| id.len() <= MAX_PACKAGE_ID_BYTES)
}

#[cfg(test)]
mod tests {
    use super::{package_id, relative_path, single_segment, MAX_PACKAGE_ID_BYTES};

    #[test]
    fn relative_path_keeps_plain_project_paths() {
        assert_eq!(
            relative_path("media/song.ogg").as_deref(),
            Some("media/song.ogg")
        );
        assert_eq!(
            relative_path(r"media\songs\song.ogg").as_deref(),
            Some("media/songs/song.ogg")
        );
        assert_eq!(
            relative_path("theme folder/with space.json").as_deref(),
            Some("theme folder/with space.json")
        );
    }

    #[test]
    fn relative_path_rejects_absolute_platform_and_traversal_names() {
        for unsafe_name in [
            "",
            "/media/song.ogg",
            r"C:\charts\song.ogg",
            r"\\server\share\song.ogg",
            r"\\?\C:\charts\song.ogg",
            "../secret.ogg",
            r"media\..\secret.ogg",
            "media//song.ogg",
            "media/./song.ogg",
            "media/song.ogg/",
            "C:relative.ogg",
            "stream:name.ogg",
        ] {
            assert!(
                relative_path(unsafe_name).is_none(),
                "{unsafe_name:?} was accepted"
            );
        }
    }

    #[test]
    fn relative_path_rejects_windows_names_and_control_characters() {
        for unsafe_name in [
            "CON",
            "CON.mp4",
            "nul.txt",
            "COM1.ogg",
            "LPT9",
            "CONIN$",
            "trailing.",
            "trailing ",
            "bad<name",
            "bad>name",
            "bad\"name",
            "bad|name",
            "bad?name",
            "bad*name",
            "line\nbreak.ogg",
            "tab\tname.ogg",
        ] {
            assert!(
                relative_path(unsafe_name).is_none(),
                "{unsafe_name:?} was accepted"
            );
        }
    }

    #[test]
    fn single_segment_accepts_one_name_and_rejects_nested_or_reserved_names() {
        assert_eq!(single_segment("song.ogg").as_deref(), Some("song.ogg"));
        assert_eq!(
            single_segment("Theme.Name-1_2").as_deref(),
            Some("Theme.Name-1_2")
        );
        for unsafe_name in [
            "",
            ".",
            "..",
            "folder/file.json",
            r"folder\file.json",
            "CON",
            "name.",
            "name ",
            "line\nbreak",
        ] {
            assert!(
                single_segment(unsafe_name).is_none(),
                "{unsafe_name:?} was accepted"
            );
        }
    }

    #[test]
    fn package_id_trims_and_rejects_reserved_control_and_oversized_ids() {
        assert_eq!(package_id("  song  ").as_deref(), Some("song"));
        assert_eq!(package_id("name ").as_deref(), Some("name"));
        for unsafe_name in [
            "",
            "   ",
            ".",
            "..",
            "folder/song",
            r"folder\song",
            "CON",
            "NUL",
            "line\nbreak",
            "name.",
        ] {
            assert!(
                package_id(unsafe_name).is_none(),
                "{unsafe_name:?} was accepted"
            );
        }
        assert!(package_id(&"a".repeat(MAX_PACKAGE_ID_BYTES)).is_some());
        assert!(package_id(&"a".repeat(MAX_PACKAGE_ID_BYTES + 1)).is_none());
    }

    #[test]
    fn backup_writer_names_remain_accepted() {
        // `backup::archive_path` prefixes real user-data file names with this
        // fixed marker. These representative entries must keep restoring.
        for safe_name in [
            "user-data/redux.db",
            "user-data/redux.db-wal",
            "user-data/themes/dark.rpetheme",
            "user-data/extensions/sample/manifest.json",
            "user-data/skins/example/skin.json",
        ] {
            let relative = safe_name.strip_prefix("user-data/").unwrap();
            assert_eq!(relative_path(relative).as_deref(), Some(relative));
        }
    }
}
