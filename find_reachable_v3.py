import os
import re
import json

def resolve_path(current_file, import_path, sorted_aliases):
    if import_path.startswith('.'):
        # Relative import
        base_dir = os.path.dirname(current_file)
        path = os.path.normpath(os.path.join(base_dir, import_path))
    else:
        # Check aliases
        for alias_prefix, target_prefix in sorted_aliases:
            if import_path.startswith(alias_prefix):
                path = import_path.replace(alias_prefix, target_prefix)
                path = os.path.normpath(os.path.join('client', path))
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
    imports = re.findall(r'import\s+.*?from\s+["\'](.*?)["\']', content)
    imports += re.findall(r'import\s+["\'](.*?)["\']', content)
    imports += re.findall(r'export\s+.*?from\s+["\'](.*?)["\']', content)
    imports += re.findall(r'import\(["\'](.*?)["\']\)', content)
    imports += re.findall(r'require\(["\'](.*?)["\']\)', content)
    return imports

# Load aliases and sort them by length of prefix descending
with open('client/tsconfig.app.json', 'r') as f:
    config = json.load(f)
    raw_aliases = config['compilerOptions']['paths']
    
sorted_aliases = []
for alias, targets in raw_aliases.items():
    prefix = alias.replace('/*', '')
    target = targets[0].replace('/*', '')
    sorted_aliases.append((prefix, target))

sorted_aliases.sort(key=lambda x: len(x[0]), reverse=True)

reachable = set()
to_visit = ['client/app/main.tsx']

while to_visit:
    current = to_visit.pop()
    if current in reachable: continue
    reachable.add(current)
    
    for imp in get_imports(current):
        resolved = resolve_path(current, imp, sorted_aliases)
        if resolved and resolved not in reachable:
            to_visit.append(resolved)

# Get all source files
all_files = []
for root, dirs, files in os.walk('client/app'):
    for f in files:
        if f.startswith('.'): continue
        path = os.path.join(root, f)
        all_files.append(path)

unused = set(all_files) - reachable
sorted_unused = sorted(list(unused))

for f in sorted_unused:
    print(f)
