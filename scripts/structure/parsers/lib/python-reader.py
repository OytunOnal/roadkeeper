# @level infrastructure
"""Roadkeeper: the Python reader behind the Parsers port (../parsers.mjs), run by lib/python-parser.mjs with the Python 3 on
the PATH. Python's own `ast` parses each file given; no project code runs, and nothing is written.

Reads a JSON request on stdin, {"root", "files"}, the files root-relative. With `--version` alone it prints the
Python's version and ends. Prints one JSON line:
- {"version", "files"}: each file read, in order, {"file", "imports", "declarations", "all", "bases"}:
  - each import {"module", "level", "names", "line", "typeOnly", "stdlib"}: the dotted module or null (`from . import
    x`), its relative depth (0 for an absolute one), the names a `from` import takes or null for an `import`, its line,
    whether it sits under `if TYPE_CHECKING:`, and whether it names the standard library;
  - each top-level declaration {"name", "kind"}, kind "fn", "class", "type" or "other", those in a top-level `if`'s or
    `try`'s branches too, `__all__` none;
  - `__all__`'s names when the file sets it as a literal list or tuple of strings, else null;
  - each class base an import binds, {"level", "module", "rest"}: the import's depth and module, and the dotted parts
    after it, ending on the base's name;
- {"version", "stop"}: the first file that stopped the read, {"file", "why", "line"}, `why` "syntax" when Python
  cannot parse it, "nesting" when its tree nests past MAX_NESTING; Python's message never.
"""
import ast, json, os, sys, sysconfig, warnings

MAX_NESTING = 256  # the bound on a source file every reader keeps (../../lib/source-bounds.mjs)
GUARD = "TYPE_CHECKING"  # the name whose `if` holds the imports for types alone
TRIES = (ast.Try,) + ((ast.TryStar,) if hasattr(ast, "TryStar") else ())  # `try`, and `try` with `except*` from 3.11


def format_version():
    """This Python's version, as major.minor.micro."""
    return "%d.%d.%d" % sys.version_info[:3]


def is_type_guard(test):
    """Whether an `if`'s test is TYPE_CHECKING, bare or as an attribute (`typing.TYPE_CHECKING`)."""
    bare = isinstance(test, ast.Name) and test.id == GUARD
    return bare or (isinstance(test, ast.Attribute) and test.attr == GUARD)


def list_standard_names():
    """The standard library's top-level module names: Python's own list from 3.10; before it, the built-in modules and
    the names in the standard library's folders."""
    if hasattr(sys, "stdlib_module_names"):
        return frozenset(sys.stdlib_module_names)
    stdlib = sysconfig.get_paths()["stdlib"]
    names = set(sys.builtin_module_names)
    for folder in (stdlib, os.path.join(stdlib, "lib-dynload")):
        names.update(entry.split(".")[0] for entry in (os.listdir(folder) if os.path.isdir(folder) else []))
    return frozenset(names)


STANDARD_NAMES = list_standard_names()  # read once: every import's first part is looked up in it


def is_standard(module, level):
    """Whether an import names the standard library: an absolute one whose first part is a standard module's name."""
    return level == 0 and bool(module) and module.split(".")[0] in STANDARD_NAMES


def list_import_rows(node, type_only):
    """The rows of one import statement, none for another node."""
    if isinstance(node, ast.Import):
        return [{"module": a.name, "level": 0, "names": None, "line": node.lineno, "typeOnly": type_only,
                 "stdlib": is_standard(a.name, 0)} for a in node.names]
    if isinstance(node, ast.ImportFrom):
        names = [a.name for a in node.names]
        return [{"module": node.module, "level": node.level, "names": names, "line": node.lineno, "typeOnly": type_only,
                 "stdlib": is_standard(node.module, node.level)}]
    return []


def list_children(node, type_only):
    """A node's children, each with whether it sits under TYPE_CHECKING: an `if TYPE_CHECKING:`'s body does."""
    if isinstance(node, ast.If) and is_type_guard(node.test):
        return [(node.test, type_only)] + [(c, True) for c in node.body] + [(c, type_only) for c in node.orelse]
    return [(c, type_only) for c in ast.iter_child_nodes(node)]


def walk_tree(tree):
    """The tree's import statements, in line order, each with whether it sits under TYPE_CHECKING, and its classes;
    None when the tree nests past MAX_NESTING."""
    imports, classes, stack = [], [], [(tree, 0, False)]
    while stack:
        node, depth, type_only = stack.pop()
        if depth > MAX_NESTING:
            return None
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            imports.append((node, type_only))
        elif isinstance(node, ast.ClassDef):
            classes.append(node)
        stack += [(child, depth + 1, guarded) for child, guarded in list_children(node, type_only)]
    return sorted(imports, key=lambda i: (i[0].lineno, i[0].col_offset)), classes


def find_bindings(node):
    """The names an import statement binds, each to where its dotted path starts, {"level", "module", "rest"}: the
    module the statement names and the parts it adds; `import a.b` binds `a` to `a` alone."""
    if isinstance(node, ast.Import):
        return {(a.asname or a.name.split(".")[0]): {"level": 0, "module": a.name if a.asname else a.name.split(".")[0], "rest": []}
                for a in node.names}
    return {(a.asname or a.name): {"level": node.level, "module": node.module, "rest": [a.name]} for a in node.names if a.name != "*"}


def split_dotted_name(expr):
    """A base's dotted name as its parts, `Base[T]`'s its value's; None for another expression."""
    expr = expr.value if isinstance(expr, ast.Subscript) else expr
    parts = []
    while isinstance(expr, ast.Attribute):
        parts.insert(0, expr.attr)
        expr = expr.value
    return [expr.id] + parts if isinstance(expr, ast.Name) else None


def find_imported_bases(imports, classes):
    """Each class base an import binds, where its dotted path starts, {"level", "module", "rest"}, the rest ending on the
    base's own name; a base defined in the file, or bound by no import, none."""
    bound = {}
    for node, _ in imports:
        bound.update(find_bindings(node))
    parts = [p for c in classes for p in map(split_dotted_name, c.bases) if p and p[0] in bound]
    return [dict(bound[p[0]], rest=bound[p[0]]["rest"] + p[1:]) for p in parts]


def list_target_names(target):
    """The names an assignment's target binds, an unpacking's each; none for an attribute or a subscript."""
    if isinstance(target, ast.Name):
        return [target.id]
    if isinstance(target, ast.Starred):
        return list_target_names(target.value)
    if isinstance(target, (ast.Tuple, ast.List)):
        return [n for t in target.elts for n in list_target_names(t)]
    return []


def is_type_alias(annotation):
    """Whether an annotation is TypeAlias, bare or as an attribute (`typing.TypeAlias`)."""
    bare = isinstance(annotation, ast.Name) and annotation.id == "TypeAlias"
    return bare or (isinstance(annotation, ast.Attribute) and annotation.attr == "TypeAlias")


def list_declared_names(s):
    """The names one top-level statement declares, (name, kind) each: def and async def fn, class class, a type alias
    type, any other assigned name other; an import none."""
    if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return [(s.name, "fn")]
    if isinstance(s, ast.ClassDef):
        return [(s.name, "class")]
    if isinstance(s, getattr(ast, "TypeAlias", ())):  # `type X = …`, from Python 3.12
        return [(s.name.id, "type")]
    if isinstance(s, ast.AnnAssign) and s.value is not None:
        return [(n, "type" if is_type_alias(s.annotation) else "other") for n in list_target_names(s.target)]
    if isinstance(s, ast.Assign):
        return [(n, "other") for t in s.targets for n in list_target_names(t)]
    return []


def list_branch_statements(s):
    """The statements of an `if`'s or a `try`'s branches, in order; none for another statement."""
    if isinstance(s, ast.If):
        return s.body + s.orelse
    if isinstance(s, TRIES):
        return s.body + [c for h in s.handlers for c in h.body] + s.orelse + s.finalbody
    return []


def list_top_statements(tree):
    """The file's top-level statements in order, those in a top-level `if`'s or `try`'s branches too, never a
    function's or a class's; None when the branches nest past MAX_NESTING."""
    found, stack = [], [(s, 0) for s in reversed(tree.body)]
    while stack:
        s, depth = stack.pop()
        if depth > MAX_NESTING:
            return None
        found.append(s)
        stack += [(c, depth + 1) for c in reversed(list_branch_statements(s))]
    return found


def list_declarations(tree):
    """The file's top-level declarations, {"name", "kind"} each, in order, a name's first kind kept, `__all__` none;
    None when its branches nest past MAX_NESTING."""
    statements, found = list_top_statements(tree), {}
    if statements is None:
        return None
    for s in statements:
        for name, kind in list_declared_names(s):
            found.setdefault(name, kind)
    return [{"name": n, "kind": k} for n, k in found.items() if n != "__all__"]


def read_literal_strings(value):
    """A literal list or tuple of strings' strings; None for any other value."""
    elements = value.elts if isinstance(value, (ast.List, ast.Tuple)) else [None]
    plain = all(isinstance(e, ast.Constant) and isinstance(e.value, str) for e in elements)
    return [e.value for e in elements] if plain else None


def list_assigned_targets(s):
    """The targets a statement assigns to, a plain, annotated or augmented assignment's; none for another statement."""
    if isinstance(s, ast.Assign):
        return s.targets
    if isinstance(s, (ast.AnnAssign, ast.AugAssign)):
        return [s.target]
    return []


def read_all_names(tree):
    """`__all__`'s names when the file's top level sets it, its last setting a literal list or tuple of strings and
    nothing growing it; else None."""
    names = None
    for s in tree.body:
        if any(isinstance(t, ast.Name) and t.id == "__all__" for t in list_assigned_targets(s)):
            names = None if isinstance(s, ast.AugAssign) or s.value is None else read_literal_strings(s.value)
    return names


def parse_file(path):
    """The file's tree, or the reason it does not parse: {"why", "line"}. Python's message is left out: before 3.10 it
    can quote the file's own line."""
    with open(path, "rb") as f:
        source = f.read()
    try:
        return ast.parse(source, filename=path)
    except SyntaxError as e:
        return {"why": "syntax", "line": e.lineno or 0}
    except ValueError:  # a null byte, before Python 3.12
        return {"why": "syntax", "line": 0}
    except (RecursionError, MemoryError):
        return {"why": "nesting", "line": 0}


def read_file(root, rel):
    """One file's row, {"file", "imports", "declarations", "all", "bases"}, or its stop."""
    tree = parse_file(os.path.join(root, rel))
    if isinstance(tree, dict):
        return {"stop": dict(tree, file=rel)}
    found = walk_tree(tree)  # first: past it, the declarations' own walks stay under the bound
    declarations = None if found is None else list_declarations(tree)
    if declarations is None:
        return {"stop": {"file": rel, "why": "nesting", "line": 0}}
    imports, classes = found
    rows = [r for node, type_only in imports for r in list_import_rows(node, type_only)]
    return {"file": rel, "imports": rows, "declarations": declarations, "all": read_all_names(tree), "bases": find_imported_bases(imports, classes)}


def read(request):
    """What the request's files hold, the first stop ending the read."""
    rows = []
    for rel in request["files"]:
        row = read_file(request["root"], rel)
        if "stop" in row:
            return {"version": format_version(), "stop": row["stop"]}
        rows.append(row)
    return {"version": format_version(), "files": rows}


def main():
    sys.dont_write_bytecode = True
    warnings.simplefilter("ignore")  # a file's own warnings, an escape sequence's say, are not the reader's output
    if sys.argv[1:] == ["--version"]:
        print(format_version())
        return
    # Node writes UTF-8, whatever the console's code page: a file name that is not ASCII reads as written
    sys.stdout.write(json.dumps(read(json.loads(sys.stdin.buffer.read().decode("utf-8")))))


if __name__ == "__main__":
    main()
