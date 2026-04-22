#!/bin/bash
cd /mnt/k/Antigravity_Projects/gitbase/happytool_electron

echo "=== Files with addEventListener but no removeEventListener ==="
for file in $(find . -type f \( -name "*.tsx" -o -name "*.ts" \) | grep -v node_modules | grep -v dist); do
  if grep -q 'addEventListener' "$file" && ! grep -q 'removeEventListener' "$file"; then
    echo "$file"
  fi
done

echo "=== Files with setInterval but no clearInterval ==="
for file in $(find . -type f \( -name "*.tsx" -o -name "*.ts" \) | grep -v node_modules | grep -v dist); do
  if grep -q 'setInterval' "$file" && ! grep -q 'clearInterval' "$file"; then
    echo "$file"
  fi
done

echo "=== Object arrays potentially leaking if missing slice/pop/splice ==="
echo "Checked visually later"
