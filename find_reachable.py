import os
import re
import json

def resolve_path(current_file, import_path, aliases):
    if import_path.startswith('.'):
        # Relative import
        base_dir = os.path.dirname(current_file)
        path = os.path.normpath(os.path.join(base_dir, import_path))
    else:
        # Check aliases
        for alias, targets in aliases.items():
            alias_prefix = alias.replace('/*', '')
            if import_path.startswith(alias_prefix):
                target = targets[0].replace('/*', '')
                path = import_path.replace(alias_prefix, target)
                # The target in tsconfig is relative to client/app or client/ depending on context
                # tsconfig.app.json is in client/, paths are relative to client/
                path = os.path.normpath(os.path.join('client', path))
                break
        else:
            return None # External or unresolved

    # Try adding extensions
    extensions = ['.tsx', '.ts', '.js', '.jsx', '/index.tsx', '/index.ts', '/index.js', '/index.jsx', '.css', '.png', '.svg', '.jpg']
    for ext in extensions:
        full_path = path + ext
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return full_path
    if os.path.exists(path) and os.path.isfile(path):
        return path
    return None

def get_imports(file_path):
    if not os.path.exists(file_path): return []
    try:
        with open(file_path, 'r', errors='ignore') as f:
            content = f.read()
    except:
        return []

    # Match import ... from "..." or import "..."
    imports = re.findall(r'import\s+.*?from\s+["\'](.*?)["\']', content)
    imports += re.findall(r'import\s+["\'](.*?)["\']', content)
    imports += re.findall(r'export\s+.*?from\s+["\'](.*?)["\']', content)
    return imports

# Load aliases
with open('client/tsconfig.app.json', 'r') as f:
    config = json.load(f)
    aliases = config['compilerOptions']['paths']

reachable = set()
to_visit = ['client/app/main.tsx']

while to_visit:
    current = to_visit.pop()
    if current in reachable: continue
    reachable.add(current)

    for imp in get_imports(current):
        resolved = resolve_path(current, imp, aliases)
        if resolved and resolved not in reachable:
            to_visit.append(resolved)

# Get all source files
all_files = []
for root, dirs, files in os.walk('client/app'):
    for f in files:
        if f.endswith(('.ts', '.tsx', '.css', '.svg', '.png', '.jpg')):
            # Exclude tests
            if not any(f.endswith(x) for x in ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']):
                path = os.path.join(root, f)
                all_files.append(path)

unused = set(all_files) - reachable
for f in sorted(list(unused)):
    print(f)
