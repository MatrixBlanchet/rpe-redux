# Fonts

This directory owns the bundled application UI typefaces and their notices:
Saira for Latin text and Source Han Sans CN for CJK, kana, and full-width
punctuation. Both are SIL Open Font License 1.1; the license texts and the
product notice stay beside the font files. The `@font-face` rules in
`src/design/styles/tokens.less` reference these files, and Vite copies
`src/public/assets/fonts/` to `assets/fonts/` in the packaged frontend.

| File                            | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `Saira-Regular.ttf`             | Latin UI face.                           |
| `SourceHanSansCN-Regular.otf`   | CJK, kana, and full-width punctuation.   |
| `LICENSE-Saira.txt`             | Saira license text.                      |
| `LICENSE-SourceHanSans.txt`     | Source Han Sans license text.            |
| `NOTICE.txt`                    | Required product notice for the bundle.  |

Keep the filenames and license files with any replacement. A font change updates
both `@font-face` declarations, the licenses, and `NOTICE.txt` in the same edit.
