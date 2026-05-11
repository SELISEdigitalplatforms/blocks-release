import os
import re
import json

def resolve_path(current_file, import_path, aliases):
    # Skip non-file imports (like node_modules)
    if not import_path.startswith('.') and not any(import_path.startswith(a.replace('/*', '')) for a in aliases):
        return None

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
                path = os.path.normpath(os.path.join('client', path))
                # DEBUG
                if "deployment" in import_path:
                    print(f"DEBUG: Resolving {import_path} with alias {alias_prefix} to {path}")
                break
        else:
            return None

    # Try adding extensions
    extensions = ['.tsx', '.ts', '.js', '.jsx', '/index.tsx', '/index.ts', '/index.js', '/index.jsx', '.css', '.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif']
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

    # Match various import/export patterns
    # import ... from "..."
    # import "..."
    # export ... from "..."
    # dynamic import("...")
    # require("...")
    imports = re.findall(r'import\s+.*?from\s+["\'](.*?)["\']', content)
    imports += re.findall(r'import\s+["\'](.*?)["\']', content)
    imports += re.findall(r'export\s+.*?from\s+["\'](.*?)["\']', content)
    imports += re.findall(r'import\(["\'](.*?)["\']\)', content)
    imports += re.findall(r'require\(["\'](.*?)["\']\)', content)
    return imports

# Load aliases
with open('client/tsconfig.app.json', 'r') as f:
    config = json.load(f)
    aliases = config['compilerOptions']['paths']

reachable = set()
# Start from main.tsx and any other potential root files (like vite-env.d.ts if it imports stuff)
to_visit = ['client/app/main.tsx']

while to_visit:
    current = to_visit.pop()
    if current in reachable: continue
    reachable.add(current)

    for imp in get_imports(current):
        resolved = resolve_path(current, imp, aliases)
        if resolved and resolved not in reachable:
            to_visit.append(resolved)

# Get all files in client/app
all_files = []
for root, dirs, files in os.walk('client/app'):
    for f in files:
        # Skip hidden files
        if f.startswith('.'): continue
        path = os.path.join(root, f)
        all_files.append(path)

unused = set(all_files) - reachable

# Filter out test files from the "unused" list if they are for used files
# But usually, if a file is unused, its test is also unused.
# Let's just list everything that is not reachable from main.tsx.

# Sort by directory for better presentation
sorted_unused = sorted(list(unused))

for f in sorted_unused:
    print(f)
