//! Detects changes in user resource trees during update preparation.
//!
//! The updater does not replace these trees. This snapshot prevents an update
//! from proceeding if they change while their backup is being prepared.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::Read,
    path::{Path, PathBuf},
};

/// Entry cap for one snapshot; exceeding it reports a resource conflict.
const MAX_ENTRIES: usize = 100_000;
/// Error-code prefix followed by the changed path.
const CONFLICT: &str = "update_resource_conflict:";

/// One captured filesystem node.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
enum Item {
    Directory,
    File([u8; 32]),
}

/// File names and content hashes, including empty directories and missing roots.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceSnapshot(BTreeMap<PathBuf, Item>);

/// Error string carrying the path that changed.
fn conflict(path: &Path) -> String {
    format!("{CONFLICT}{}", path.display())
}

/// Record every node under `path`; a missing root is an empty record.
///
/// Symlinks, reparse points, unreadable files, and the entry cap are reported as
/// conflicts rather than skipped.
fn visit(path: &Path, entries: &mut BTreeMap<PathBuf, Item>) -> Result<(), String> {
    if entries.len() >= MAX_ENTRIES {
        return Err(conflict(path));
    }
    let metadata = match fs::symlink_metadata(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err(conflict(path)),
    };
    if metadata.file_type().is_symlink() {
        return Err(conflict(path));
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err(conflict(path));
        }
    }
    if metadata.is_dir() {
        entries.insert(path.to_path_buf(), Item::Directory);
        for entry in fs::read_dir(path).map_err(|_| conflict(path))? {
            let entry = entry.map_err(|_| conflict(path))?;
            visit(&entry.path(), entries)?;
        }
    } else if metadata.is_file() {
        let mut options = OpenOptions::new();
        options.read(true);
        // Refuse files already open for writing or deletion during the read.
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(1);
        }
        let mut file: File = options.open(path).map_err(|_| conflict(path))?;
        let mut hash = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let count = file.read(&mut buffer).map_err(|_| conflict(path))?;
            if count == 0 {
                break;
            }
            hash.update(&buffer[..count]);
        }
        entries.insert(path.to_path_buf(), Item::File(hash.finalize().into()));
    } else {
        return Err(conflict(path));
    }
    Ok(())
}

/// Capture all existing files and folders under the supplied user resource roots.
pub fn snapshot(roots: &[PathBuf]) -> Result<ResourceSnapshot, String> {
    let mut entries = BTreeMap::new();
    for root in roots {
        visit(root, &mut entries)?;
    }
    Ok(ResourceSnapshot(entries))
}

/// Fail with the changed path when a resource was modified, added, or deleted.
pub fn verify(previous: &ResourceSnapshot, roots: &[PathBuf]) -> Result<(), String> {
    let current = snapshot(roots)?;
    if current == *previous {
        return Ok(());
    }
    let path = previous
        .0
        .keys()
        .chain(current.0.keys())
        .find(|path| previous.0.get(*path) != current.0.get(*path))
        .ok_or("update_resource_conflict")?;
    Err(conflict(path))
}

/// External packages reside in the deployment root, outside bundled resources.
pub fn user_roots() -> Result<Vec<PathBuf>, String> {
    let root = crate::storage::user_root()?;
    Ok(["themes", "skins", "extensions"]
        .iter()
        .map(|name| root.join(name))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn detects_modification_addition_and_removal() {
        let root = tempfile::tempdir().unwrap();
        let tree = root.path().join("skins");
        fs::create_dir(&tree).unwrap();
        let file = tree.join("skin.json");
        fs::write(&file, b"old").unwrap();
        let roots = [tree.clone()];
        let first = snapshot(&roots).unwrap();
        fs::write(&file, b"new").unwrap();
        assert!(verify(&first, &roots).unwrap_err().contains("skin.json"));
        fs::write(&file, b"old").unwrap();
        fs::write(tree.join("new.png"), b"x").unwrap();
        assert!(verify(&first, &roots).unwrap_err().contains("new.png"));
        fs::remove_file(tree.join("new.png")).unwrap();
        fs::remove_file(file).unwrap();
        assert!(verify(&first, &roots).unwrap_err().contains("skin.json"));
    }
    #[cfg(windows)]
    #[test]
    fn rejects_a_file_open_for_writing() {
        let root = tempfile::tempdir().unwrap();
        let file = root.path().join("skin.json");
        fs::write(&file, b"x").unwrap();
        let writer = OpenOptions::new().write(true).open(&file).unwrap();
        assert!(snapshot(&[root.path().to_path_buf()]).is_err());
        drop(writer);
        assert!(snapshot(&[root.path().to_path_buf()]).is_ok());
    }
}
