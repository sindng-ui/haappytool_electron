import os

file_path = 'components/NupkgSigner/vendor/jszip-bundle.js'
export_line = '\n// ESM Export Patch\nexport default (typeof self !== "undefined" ? self.JSZip : (typeof window !== "undefined" ? window.JSZip : global.JSZip));\n'

with open(file_path, 'a', encoding='utf-8') as f:
    f.write(export_line)

print("Successfully appended ESM export to", file_path)
