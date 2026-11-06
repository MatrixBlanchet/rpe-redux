use std::env;
use std::path::PathBuf;

fn main() {
    let manifest = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let target_name = "redux-service";
    let source = manifest.join("resources").join(target_name);
    let source_size = std::fs::metadata(&source)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if source_size == 0 {
        panic!(
            "backend helper is missing or empty at {}; run `npm run build` before building the desktop app",
            source.display()
        );
    }
    println!("cargo:rerun-if-changed={}", source.display());
    let encoder = manifest.join("resources").join("ffmpeg").join("ffmpeg.exe");
    // Recording, and therefore the bundled encoder, is a Windows-only feature.
    if cfg!(windows)
        && std::fs::metadata(&encoder)
            .map(|metadata| metadata.len())
            .unwrap_or(0)
            == 0
    {
        panic!(
            "bundled FFmpeg is missing at {}; run `node scripts/prepareFfmpeg.mjs`",
            encoder.display()
        );
    }
    println!("cargo:rerun-if-changed={}", encoder.display());
    println!("cargo:rerun-if-env-changed=REDUX_UPDATE_PUBLIC_KEY");
    tauri_build::build()
}
