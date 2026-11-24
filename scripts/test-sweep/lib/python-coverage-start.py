# @level infrastructure
"""Roadkeeper: Python's coverage started in every Python process of a test sweep's run. python-coverage.mjs lays this
file as `sitecustomize.py` in a folder it puts first on PYTHONPATH, and names its data folder in DATA_VARIABLE; Python
imports it at start, before the process's own code. It imports `coverage` from the Python running it, the project's own
install, and measures the process, writing no data file of coverage's own; at exit it writes the lines each file ran,
{"files": {absolute path: [line, ...]}}, as a JSON file of a new name into the data folder. Where `coverage` cannot be
imported or started, it writes a JSON file of {"missing": true} there instead. A process whose variables name no data
folder is not measured. Then it runs the project's own `sitecustomize`, the next on the path, which it stands in front
of."""
import atexit, importlib.machinery, importlib.util, json, os, sys

# the data folder's path, set by python-coverage.mjs, which holds the same three names: a copy across the language
# boundary
DATA_VARIABLE = "ROADKEEPER_PYTHON_COVERAGE"
LINES_PREFIX = "lines-"  # a file of the lines a process ran; python-coverage.mjs's copy
MISSING_PREFIX = "missing-"  # a file saying a process could not start coverage; python-coverage.mjs's copy


def write_data(prefix, data):
    """`data` written as JSON into the data folder, under a name no other process takes."""
    path = os.path.join(os.environ[DATA_VARIABLE], "%s%s.json" % (prefix, os.urandom(8).hex()))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


def started_coverage():
    """This process measured by the coverage its Python imports: the Coverage object, or None when it cannot start."""
    try:
        import coverage
        measured = coverage.Coverage(data_file=None, config_file=False)
        measured.start()
        return measured
    except Exception:  # no coverage installed, or one that cannot start: said in the data folder, the run goes on
        return None


def write_lines(measured):
    """The lines each file the process ran, written into the data folder."""
    try:
        measured.stop()
        data = measured.get_data()
        write_data(LINES_PREFIX, {"files": {f: sorted(data.lines(f) or []) for f in data.measured_files()}})
    except Exception:  # a process ending as its coverage fails: said in the data folder as no coverage
        write_data(MISSING_PREFIX, {"missing": True})


def load_project_sitecustomize():
    """The project's own `sitecustomize`, the next one on the path past this file's folder, run in this module's place,
    as Python would have run it without the sweep; a failure in it said on stderr, as Python's start says one."""
    here = os.path.normcase(os.path.dirname(os.path.abspath(__file__)))
    rest = [p for p in sys.path if os.path.normcase(os.path.abspath(p or os.curdir)) != here]
    spec = importlib.machinery.PathFinder.find_spec("sitecustomize", rest)
    if spec is None or spec.loader is None:
        return
    module = importlib.util.module_from_spec(spec)
    sys.modules["sitecustomize"] = module
    try:
        spec.loader.exec_module(module)
    except Exception as e:  # Python's own start says a failing sitecustomize and goes on
        print("Error in sitecustomize; set PYTHONVERBOSE for traceback:\n%s: %s" % (type(e).__name__, e), file=sys.stderr)


if os.environ.get(DATA_VARIABLE):
    _measured = started_coverage()
    if _measured is None:
        write_data(MISSING_PREFIX, {"missing": True})
    else:
        atexit.register(write_lines, _measured)
load_project_sitecustomize()
