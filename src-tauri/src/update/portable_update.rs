//! In-place application of a signed portable update payload.
//!
//! The update helper extracts a signed ZIP beside the install root, then moves
//! each file into place while keeping a rollback copy. User data and webview
//! profiles are never part of the payload and are rejected if they appear.
use std::{
    collections::BTreeSet,
    ffi::OsStr,
    fs::{self, File},
    io::{self, Read},
    path::{Path, PathBuf},
};

/// Largest number of entries accepted from one payload.
pub(crate) const MAX_ENTRIES: usize = 20_000;
/// Largest uncompressed payload accepted after extraction.
pub(crate) const MAX_UNCOMPRESSED: u64 = 2 * 1024 * 1024 * 1024;
/// Largest single file accepted from one payload.
pub(crate) const MAX_FILE: u64 = 1024 * 1024 * 1024;
/// Longest accepted relative path in bytes.
pub(crate) const MAX_PATH: usize = 32_000;
/// Executable name used by the packaged portable payload.
const PAYLOAD_EXE: &str = "rpe-redux.exe";
/// Folders that belong to the user and must never be replaced by a payload.
const USER_ROOTS: [&str; 3] = ["user-data", "webview-data", "portable.marker"];

fn issue(error: impl std::fmt::Display) -> String {
    format!("portable_update_failed:{error}")
}

/// Reject absolute, parent-traversing, and reserved user-data entries.
fn relative_entry(name: &Path) -> Result<PathBuf, String> {
    let name = name.to_str().ok_or("portable_update_path_invalid")?;
    if name.is_empty() || name.len() > MAX_PATH {
        return Err("portable_update_path_invalid".into());
    }
    // Archive entries use `/` while a walked Windows tree uses `\`; both are
    // normalized to one relative path before extraction or installation.
    let relative =
        crate::storage::path_safety::relative_path(name).ok_or("portable_update_path_invalid")?;
    let root = relative
        .split('/')
        .next()
        .ok_or("portable_update_path_invalid")?
        .to_ascii_lowercase();
    if USER_ROOTS.iter().any(|reserved| root == *reserved) {
        return Err("portable_update_user_data".into());
    }
    Ok(PathBuf::from(relative))
}

/// Extract every file from `zip_path` into `destination`, returning relative paths.
pub(crate) fn extract(zip_path: &Path, destination: &Path) -> Result<Vec<PathBuf>, String> {
    let file = File::open(zip_path).map_err(issue)?;
    let mut archive = zip::ZipArchive::new(file).map_err(issue)?;
    if archive.len() > MAX_ENTRIES {
        return Err("portable_update_too_many_entries".into());
    }
    fs::create_dir_all(destination).map_err(issue)?;
    let mut files = Vec::new();
    let mut total = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(issue)?;
        let name = entry
            .enclosed_name()
            .ok_or("portable_update_path_invalid")?;
        let relative = relative_entry(&name)?;
        if entry.is_symlink() {
            return Err("portable_update_symlink".into());
        }
        if entry.is_dir() {
            fs::create_dir_all(destination.join(&relative)).map_err(issue)?;
            continue;
        }
        let size = entry.size();
        if size > MAX_FILE {
            return Err("portable_update_file_too_large".into());
        }
        let remaining = MAX_UNCOMPRESSED.saturating_sub(total);
        if size > remaining {
            return Err("portable_update_too_large".into());
        }
        let target = destination.join(&relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(issue)?;
        }
        let mut output = File::create(&target).map_err(issue)?;
        // The central directory can lie about the uncompressed size, so cap
        // the actual stream as well and reject a short or long entry.
        let copied = io::copy(&mut entry.by_ref().take(size + 1), &mut output).map_err(issue)?;
        if copied != size {
            return Err("portable_update_size_mismatch".into());
        }
        total = total
            .checked_add(copied)
            .filter(|value| *value <= MAX_UNCOMPRESSED)
            .ok_or("portable_update_too_large")?;
        files.push(relative);
    }
    Ok(files)
}

/// Walk an extracted tree and return every regular file relative to its root.
fn tree_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory).map_err(issue)? {
            let entry = entry.map_err(issue)?;
            let path = entry.path();
            let file_type = entry.file_type().map_err(issue)?;
            if file_type.is_symlink() {
                return Err("portable_update_symlink".into());
            }
            if file_type.is_dir() {
                pending.push(path);
            } else if file_type.is_file() {
                let relative = path
                    .strip_prefix(root)
                    .map_err(|_| "portable_update_path_invalid")?
                    .to_path_buf();
                files.push(relative_entry(&relative)?);
            }
        }
    }
    files.sort();
    Ok(files)
}

/// Move a regular file, falling back to copy + remove across volumes.
fn move_file(source: &Path, target: &Path) -> Result<(), String> {
    if fs::rename(source, target).is_ok() {
        return Ok(());
    }
    fs::copy(source, target).map_err(issue)?;
    fs::remove_file(source).map_err(issue)
}

/// Map the packaged executable name to the name this installation uses.
fn mapped(relative: &Path, exe_name: &OsStr) -> PathBuf {
    if relative == Path::new(PAYLOAD_EXE) {
        PathBuf::from(exe_name)
    } else {
        relative.to_path_buf()
    }
}

/// Files replaced by `apply`; the rollback tree stays on disk until the caller
/// confirms that the replacement executable can start.
#[derive(Debug)]
pub(crate) struct Applied {
    installed: Vec<PathBuf>,
    backed_up: Vec<(PathBuf, PathBuf)>,
    rollback_root: PathBuf,
}

impl Applied {
    /// Restore every replaced file and remove files that did not exist before.
    ///
    /// Every restore is attempted even when an earlier one fails, and the
    /// rollback tree is kept whenever any path could not be recovered so a later
    /// start can inspect it manually.
    pub(crate) fn rollback(self) -> Result<(), String> {
        let backup_targets: BTreeSet<&Path> = self
            .backed_up
            .iter()
            .map(|(target, _)| target.as_path())
            .collect();
        let mut problems = Vec::new();
        for path in self.installed.iter().rev() {
            if backup_targets.contains(path.as_path()) {
                continue;
            }
            remove_if_present(path, &mut problems);
        }
        for (target, backup) in self.backed_up.iter().rev() {
            remove_if_present(target, &mut problems);
            if let Err(error) = move_file(backup, target) {
                problems.push(format!("could not restore {}: {error}", target.display()));
            }
        }
        if problems.is_empty() {
            remove_rollback_tree(&self.rollback_root, &mut problems);
        }
        reported(problems)
    }

    /// Drop the rollback copies after the candidate executable reported a
    /// healthy start.
    pub(crate) fn commit(self) -> Result<(), String> {
        let mut problems = Vec::new();
        remove_rollback_tree(&self.rollback_root, &mut problems);
        reported(problems)
    }
}

/// Result of checking a replacement executable after its files were installed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CandidateOutcome {
    /// The candidate stayed alive and reported the update nonce.
    Healthy,
    /// The candidate executable could not be spawned.
    LaunchFailed,
    /// The candidate exited before reporting health.
    ExitedBeforeHealth,
    /// The candidate reported health and then exited.
    ExitedAfterHealth,
    /// The candidate stayed alive without reporting health before the deadline.
    HealthTimeout,
    /// The process handle could not be queried, so the candidate is unverified.
    ProbeFailed,
}

/// Action for the rollback tree retained by `apply`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RollbackAction {
    /// Keep the replacement and delete the rollback tree.
    Commit,
    /// Restore the previous files from the rollback tree.
    Restore,
}

/// Decide whether a candidate outcome keeps the replacement or restores it.
pub(crate) fn rollback_action(outcome: CandidateOutcome) -> RollbackAction {
    match outcome {
        CandidateOutcome::Healthy => RollbackAction::Commit,
        CandidateOutcome::LaunchFailed
        | CandidateOutcome::ExitedBeforeHealth
        | CandidateOutcome::ExitedAfterHealth
        | CandidateOutcome::HealthTimeout
        | CandidateOutcome::ProbeFailed => RollbackAction::Restore,
    }
}

/// Stable diagnostic code for an unhealthy candidate outcome.
pub(crate) fn candidate_error_code(outcome: CandidateOutcome) -> Option<&'static str> {
    match outcome {
        CandidateOutcome::Healthy => None,
        CandidateOutcome::LaunchFailed => Some("portable_update_launch_failed"),
        CandidateOutcome::ExitedBeforeHealth => Some("portable_update_candidate_exited"),
        CandidateOutcome::ExitedAfterHealth => {
            Some("portable_update_candidate_exited_after_health")
        }
        CandidateOutcome::HealthTimeout => Some("portable_update_health_timeout"),
        CandidateOutcome::ProbeFailed => Some("portable_update_health_probe_failed"),
    }
}

/// Format an unhealthy candidate outcome as `code:detail` for the failure record.
pub(crate) fn candidate_failure(outcome: CandidateOutcome, detail: &str) -> String {
    let code = candidate_error_code(outcome).unwrap_or("portable_update_unhealthy");
    if detail.is_empty() {
        code.to_owned()
    } else {
        format!("{code}:{detail}")
    }
}

/// Combine a failed step with the result of its restore attempt.
pub(crate) fn with_rollback(error: String, rollback: Result<(), String>) -> String {
    match rollback {
        Ok(()) => error,
        Err(rollback) => format!("{error}; rollback failed: {rollback}"),
    }
}

/// Remove a file, treating an already-missing path as success.
fn remove_if_present(path: &Path, problems: &mut Vec<String>) {
    if let Err(error) = fs::remove_file(path) {
        if error.kind() != io::ErrorKind::NotFound {
            problems.push(format!("could not remove {}: {error}", path.display()));
        }
    }
}

/// Remove the rollback directory, treating an already-missing path as success.
fn remove_rollback_tree(path: &Path, problems: &mut Vec<String>) {
    if let Err(error) = fs::remove_dir_all(path) {
        if error.kind() != io::ErrorKind::NotFound {
            problems.push(format!(
                "could not remove rollback tree {}: {error}",
                path.display()
            ));
        }
    }
}

/// Turn collected restore problems into one reported error.
fn reported(problems: Vec<String>) -> Result<(), String> {
    if problems.is_empty() {
        Ok(())
    } else {
        Err(problems.join("; "))
    }
}

/// Replace the install files from `staging`, restoring the old tree on failure.
///
/// A successful call keeps every replaced file under `rollback`; the caller
/// commits that copy only after the new executable reports a healthy start.
pub(crate) fn apply(
    staging: &Path,
    install_root: &Path,
    rollback: &Path,
    exe_name: &OsStr,
) -> Result<Applied, String> {
    let files = tree_files(staging)?;
    if files.is_empty() {
        return Err("portable_update_empty".into());
    }
    if !files.iter().any(|file| file == Path::new(PAYLOAD_EXE)) {
        return Err("portable_update_exe_missing".into());
    }
    let mut installed: Vec<PathBuf> = Vec::new();
    let mut backed_up: Vec<(PathBuf, PathBuf)> = Vec::new();
    let result = (|| -> Result<(), String> {
        for relative in files {
            let source = staging.join(&relative);
            let relative = mapped(&relative, exe_name);
            let target = install_root.join(&relative);
            if target.exists() {
                if !target.is_file() {
                    return Err("portable_update_target_conflict".into());
                }
                let backup = rollback.join(&relative);
                if let Some(parent) = backup.parent() {
                    fs::create_dir_all(parent).map_err(issue)?;
                }
                move_file(&target, &backup)?;
                backed_up.push((target.clone(), backup));
            }
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(issue)?;
            }
            move_file(&source, &target)?;
            installed.push(target);
        }
        Ok(())
    })();
    let applied = Applied {
        installed,
        backed_up,
        rollback_root: rollback.to_path_buf(),
    };
    match result {
        Ok(()) => Ok(applied),
        Err(error) => Err(with_rollback(error, applied.rollback())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

    fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let file = File::create(path).unwrap();
        let mut writer = ZipWriter::new(file);
        for (name, bytes) in entries {
            writer
                .start_file(
                    *name,
                    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
                )
                .unwrap();
            writer.write_all(bytes).unwrap();
        }
        writer.finish().unwrap();
    }

    #[test]
    fn extracts_and_applies_payload_files() {
        let root = tempfile::tempdir().unwrap();
        let zip_path = root.path().join("payload.zip");
        write_zip(
            &zip_path,
            &[
                ("rpe-redux.exe", b"new exe"),
                ("resources/service.txt", b"new service"),
                ("themes/default.txt", b"new theme"),
            ],
        );
        let staging = root.path().join("staging");
        let files = extract(&zip_path, &staging).unwrap();
        assert_eq!(files.len(), 3);

        let install = root.path().join("install");
        fs::create_dir_all(install.join("user-data")).unwrap();
        fs::write(install.join("user-data/library.db"), b"keep").unwrap();
        fs::write(install.join("rpe-redux.exe"), b"old exe").unwrap();
        fs::create_dir_all(install.join("resources")).unwrap();
        fs::write(install.join("resources/service.txt"), b"old service").unwrap();
        fs::write(install.join("keep.txt"), b"keep").unwrap();

        let rollback = root.path().join("rollback");
        let applied = apply(&staging, &install, &rollback, OsStr::new("rpe-redux.exe")).unwrap();
        assert!(rollback.is_dir());
        applied.commit().unwrap();
        assert!(!rollback.exists());

        assert_eq!(fs::read(install.join("rpe-redux.exe")).unwrap(), b"new exe");
        assert_eq!(
            fs::read(install.join("resources/service.txt")).unwrap(),
            b"new service"
        );
        assert_eq!(
            fs::read(install.join("themes/default.txt")).unwrap(),
            b"new theme"
        );
        assert_eq!(fs::read(install.join("keep.txt")).unwrap(), b"keep");
        assert_eq!(
            fs::read(install.join("user-data/library.db")).unwrap(),
            b"keep"
        );
    }

    #[test]
    fn maps_the_payload_exe_to_the_installed_name() {
        let root = tempfile::tempdir().unwrap();
        let zip_path = root.path().join("payload.zip");
        write_zip(&zip_path, &[(PAYLOAD_EXE, b"new")]);
        let staging = root.path().join("staging");
        extract(&zip_path, &staging).unwrap();
        let install = root.path().join("install");
        fs::create_dir_all(&install).unwrap();
        fs::write(install.join("renamed.exe"), b"old").unwrap();

        apply(
            &staging,
            &install,
            &root.path().join("rollback"),
            OsStr::new("renamed.exe"),
        )
        .unwrap()
        .commit()
        .unwrap();

        assert_eq!(fs::read(install.join("renamed.exe")).unwrap(), b"new");
        assert!(!install.join(PAYLOAD_EXE).exists());
    }

    #[test]
    fn rolls_back_earlier_files_when_a_later_target_conflicts() {
        let root = tempfile::tempdir().unwrap();
        let zip_path = root.path().join("payload.zip");
        write_zip(
            &zip_path,
            &[
                ("a.txt", b"new a"),
                ("b.txt", b"new b"),
                (PAYLOAD_EXE, b"new exe"),
            ],
        );
        let staging = root.path().join("staging");
        extract(&zip_path, &staging).unwrap();
        let install = root.path().join("install");
        fs::create_dir_all(&install).unwrap();
        fs::write(install.join("a.txt"), b"old a").unwrap();
        // A directory in place of a file makes the second replacement fail.
        fs::create_dir_all(install.join("b.txt")).unwrap();

        let error = apply(
            &staging,
            &install,
            &root.path().join("rollback"),
            OsStr::new("rpe-redux.exe"),
        )
        .unwrap_err();
        assert_eq!(error, "portable_update_target_conflict");
        assert_eq!(fs::read(install.join("a.txt")).unwrap(), b"old a");
    }

    #[test]
    fn keeps_rollback_until_health_and_restores_it_on_failure() {
        let root = tempfile::tempdir().unwrap();
        let zip_path = root.path().join("payload.zip");
        write_zip(
            &zip_path,
            &[
                (PAYLOAD_EXE, b"new exe"),
                ("resources/service.txt", b"new service"),
            ],
        );
        let staging = root.path().join("staging");
        extract(&zip_path, &staging).unwrap();
        let install = root.path().join("install");
        fs::create_dir_all(install.join("resources")).unwrap();
        fs::write(install.join(PAYLOAD_EXE), b"old exe").unwrap();
        fs::write(install.join("resources/service.txt"), b"old service").unwrap();
        fs::write(install.join("keep.txt"), b"keep").unwrap();

        let rollback = root.path().join("rollback");
        let applied = apply(&staging, &install, &rollback, OsStr::new(PAYLOAD_EXE)).unwrap();
        assert_eq!(fs::read(install.join(PAYLOAD_EXE)).unwrap(), b"new exe");
        assert_eq!(fs::read(rollback.join(PAYLOAD_EXE)).unwrap(), b"old exe");

        let error = with_rollback(
            "portable_update_unhealthy:candidate exited".into(),
            applied.rollback(),
        );
        assert_eq!(error, "portable_update_unhealthy:candidate exited");
        assert_eq!(fs::read(install.join(PAYLOAD_EXE)).unwrap(), b"old exe");
        assert_eq!(
            fs::read(install.join("resources/service.txt")).unwrap(),
            b"old service"
        );
        assert_eq!(fs::read(install.join("keep.txt")).unwrap(), b"keep");
        assert!(!rollback.exists());
    }

    #[test]
    fn reports_a_failed_rollback_beside_the_candidate_failure() {
        assert_eq!(
            with_rollback("launch failed".into(), Err("disk full".into())),
            "launch failed; rollback failed: disk full"
        );
    }

    #[test]
    fn rolls_back_for_every_unhealthy_candidate_outcome() {
        let table = [
            (CandidateOutcome::Healthy, RollbackAction::Commit, None),
            (
                CandidateOutcome::LaunchFailed,
                RollbackAction::Restore,
                Some("portable_update_launch_failed"),
            ),
            (
                CandidateOutcome::ExitedBeforeHealth,
                RollbackAction::Restore,
                Some("portable_update_candidate_exited"),
            ),
            (
                CandidateOutcome::ExitedAfterHealth,
                RollbackAction::Restore,
                Some("portable_update_candidate_exited_after_health"),
            ),
            (
                CandidateOutcome::HealthTimeout,
                RollbackAction::Restore,
                Some("portable_update_health_timeout"),
            ),
            (
                CandidateOutcome::ProbeFailed,
                RollbackAction::Restore,
                Some("portable_update_health_probe_failed"),
            ),
        ];
        for (outcome, action, code) in table {
            assert_eq!(rollback_action(outcome), action, "{outcome:?}");
            assert_eq!(candidate_error_code(outcome), code, "{outcome:?}");
        }
        assert_eq!(
            candidate_failure(CandidateOutcome::HealthTimeout, ""),
            "portable_update_health_timeout"
        );
        assert_eq!(
            candidate_failure(CandidateOutcome::LaunchFailed, "missing dll"),
            "portable_update_launch_failed:missing dll"
        );
    }

    #[test]
    fn keeps_the_rollback_tree_when_restoring_a_file_fails() {
        let root = tempfile::tempdir().unwrap();
        let zip_path = root.path().join("payload.zip");
        write_zip(
            &zip_path,
            &[
                (PAYLOAD_EXE, b"new exe"),
                ("resources/service.txt", b"new service"),
            ],
        );
        let staging = root.path().join("staging");
        extract(&zip_path, &staging).unwrap();
        let install = root.path().join("install");
        fs::create_dir_all(install.join("resources")).unwrap();
        fs::write(install.join(PAYLOAD_EXE), b"old exe").unwrap();
        fs::write(install.join("resources/service.txt"), b"old service").unwrap();

        let rollback = root.path().join("rollback");
        let applied = apply(&staging, &install, &rollback, OsStr::new(PAYLOAD_EXE)).unwrap();
        // A directory at the executable path makes both removal and restore fail.
        fs::remove_file(install.join(PAYLOAD_EXE)).unwrap();
        fs::create_dir(install.join(PAYLOAD_EXE)).unwrap();

        let error = with_rollback(
            candidate_failure(CandidateOutcome::HealthTimeout, ""),
            applied.rollback(),
        );
        assert!(
            error.starts_with("portable_update_health_timeout; rollback failed:"),
            "{error}"
        );
        assert!(rollback.is_dir(), "{error}");
        assert!(rollback.join(PAYLOAD_EXE).is_file(), "{error}");
    }

    #[test]
    fn rejects_traversal_and_user_data_entries() {
        let root = tempfile::tempdir().unwrap();
        let traversal = root.path().join("traversal.zip");
        write_zip(&traversal, &[("../evil.txt", b"x")]);
        assert!(extract(&traversal, &root.path().join("out")).is_err());

        let user = root.path().join("user.zip");
        write_zip(&user, &[("user-data/library.db", b"x")]);
        assert_eq!(
            extract(&user, &root.path().join("out2")).unwrap_err(),
            "portable_update_user_data"
        );

        let reserved = root.path().join("reserved.zip");
        write_zip(&reserved, &[("CON", b"x")]);
        assert_eq!(
            extract(&reserved, &root.path().join("out3")).unwrap_err(),
            "portable_update_path_invalid"
        );

        let invalid = root.path().join("invalid.zip");
        write_zip(&invalid, &[("themes/bad.", b"x")]);
        assert_eq!(
            extract(&invalid, &root.path().join("out4")).unwrap_err(),
            "portable_update_path_invalid"
        );
    }
}
