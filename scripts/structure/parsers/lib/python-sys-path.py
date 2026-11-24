# @level infrastructure
"""Roadkeeper: the Python reader's (python-reader.py) reading of a file's calls and assignments, loaded by it by path:
the names its top level sets to the root by `__file__`'s folders up, and the folders its `sys.path` calls add, over the
tree Python's `ast` parsed, under the reader's bound on nesting. Runs no project code, writes nothing."""
import ast


def split_dotted_name(expr):
    """A base's dotted name as its parts, `Base[T]`'s its value's; None for another expression."""
    expr = expr.value if isinstance(expr, ast.Subscript) else expr
    parts = []
    while isinstance(expr, ast.Attribute):
        parts.insert(0, expr.attr)
        expr = expr.value
    return [expr.id] + parts if isinstance(expr, ast.Name) else None


def call_name(node):
    """A call's function as its dotted parts, `os.path.join(…)`'s ["os", "path", "join"], with no keyword; else None."""
    plain_call = isinstance(node, ast.Call) and not node.keywords
    return split_dotted_name(node.func) if plain_call else None


def calls_named(node, names, count):
    """Whether a node is a call, with `count` arguments and no keyword, to a function whose dotted name is in `names`."""
    return call_name(node) in names and len(node.args) == count


def method_called(node):
    """A call's method name, `x.resolve()`'s "resolve", when it takes no keyword; None for another node."""
    is_method = isinstance(node, ast.Call) and not node.keywords and isinstance(node.func, ast.Attribute)
    return node.func.attr if is_method else None


# the calls that keep the path they are given: `os.path.abspath(__file__)` is still the file
PATH_OF = (["os", "path", "abspath"], ["abspath"], ["os", "path", "realpath"], ["realpath"], ["Path"], ["pathlib", "Path"])
DIRNAME = (["os", "path", "dirname"], ["dirname"])  # the calls naming the folder a path is in
JOINS = (["os", "path", "join"], ["Path"], ["pathlib", "Path"])  # the calls joining the parts after their first
TO_TEXT = (["str"], ["os", "fspath"])  # the calls turning a path into the text sys.path holds


def read_index(node):
    """A subscript's index when it is a literal whole number at least 0; None otherwise."""
    index = node.slice.value if isinstance(node.slice, getattr(ast, "Index", ())) else node.slice  # Index before 3.9
    whole = isinstance(index, ast.Constant) and type(index.value) is int
    return index.value if whole and index.value >= 0 else None


def step_folders_up(node):
    """One step of a chain of folders up from the file: (the expression inside, the folders it adds); None for a node
    that is no step."""
    is_parents_index = isinstance(node, ast.Subscript) and isinstance(node.value, ast.Attribute) and node.value.attr == "parents"
    if calls_named(node, PATH_OF, 1):
        return node.args[0], 0
    if calls_named(node, DIRNAME, 1):
        return node.args[0], 1
    if method_called(node) in ("resolve", "absolute") and not node.args:
        return node.func.value, 0
    if isinstance(node, ast.Attribute) and node.attr == "parent":
        return node.value, 1
    if is_parents_index and read_index(node) is not None:
        return node.value.value, read_index(node) + 1
    return None


def count_folders_up(node):
    """How many folders up from the file an expression names: 0 for `__file__`, also through `os.path.abspath`,
    `realpath`, `Path`, `.resolve()` and `.absolute()`; one more for each `os.path.dirname` and `.parent`, k + 1 for
    `.parents[k]`; None for another expression."""
    if isinstance(node, ast.Name):
        return 0 if node.id == "__file__" else None
    step = step_folders_up(node)
    up = None if step is None else count_folders_up(step[0])
    return None if up is None else up + step[1]


def read_root(node, depth, bound):
    """The root as an expression names it, {"via"}: null for a chain of folders up from the file, `depth` of them; the
    import binding, {"level", "module", "rest"}, of a name or attribute an import binds; None for another expression."""
    if count_folders_up(node) == depth:
        return {"via": None}
    parts = split_dotted_name(node) if isinstance(node, (ast.Name, ast.Attribute)) else None
    binding = bound.get(parts[0]) if parts else None
    rest = binding["rest"] + parts[1:] if binding else []
    return {"via": dict(binding, rest=rest)} if rest else None


def split_join(node):
    """A join's (head, literal parts' expressions): `os.path.join(H, …)`, `Path(H, …)`, `H.joinpath(…)`, `H / p`; None
    for another node."""
    if call_name(node) in JOINS and node.args:
        return node.args[0], node.args[1:]
    if method_called(node) == "joinpath":
        return node.func.value, node.args
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
        return node.left, [node.right]
    return None


def read_root_folder(node, depth, bound):
    """A folder written as the root joined with literal parts, {"via", "parts"}: `os.path.join(R, "a", "b")`,
    `Path(R, "a")`, `R / "a"`, `R.joinpath("a")`, any of them in `str()` or `os.fspath()`; None for another form."""
    if calls_named(node, TO_TEXT, 1):
        return read_root_folder(node.args[0], depth, bound)
    join = split_join(node)
    if join is None:
        root = read_root(node, depth, bound)
        return root and dict(root, parts=[])
    literal = all(isinstance(n, ast.Constant) and isinstance(n.value, str) for n in join[1])
    folder = read_root_folder(join[0], depth, bound) if literal else None
    return folder and dict(folder, parts=folder["parts"] + [n.value for n in join[1]])


# the `sys.path` calls read, each by its dotted name, with its count of arguments
SYS_PATH_ADDS = {("sys", "path", "insert"): 2, ("sys", "path", "append"): 1}


def list_sys_path_folders(calls, depth, bound):
    """Each folder the file's `sys.path.insert(<i>, X)` and `sys.path.append(X)` put on the path, X the root joined with
    literal parts: {"front", "via", "parts", "line"}, `front` for an insert. Another X none."""
    found = []
    for c in calls:
        name = tuple(call_name(c) or ())
        if SYS_PATH_ADDS.get(name) != len(c.args):
            continue
        folder = read_root_folder(c.args[-1], depth, bound)
        if folder is not None:
            found.append(dict(folder, front=name[-1] == "insert", line=c.lineno))
    return found


def list_root_names(tree, depth):
    """The names the file's top level sets to the root by a chain of folders up from the file, `depth` of them."""
    sets_root = lambda s: isinstance(s, (ast.Assign, ast.AnnAssign)) and s.value is not None and count_folders_up(s.value) == depth
    return [t.id for s in tree.body if sets_root(s) for t in list_assigned_targets(s) if isinstance(t, ast.Name)]


def list_assigned_targets(s):
    """The targets a statement assigns to, a plain, annotated or augmented assignment's; none for another statement."""
    if isinstance(s, ast.Assign):
        return s.targets
    if isinstance(s, (ast.AnnAssign, ast.AugAssign)):
        return [s.target]
    return []
