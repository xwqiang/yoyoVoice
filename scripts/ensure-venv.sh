#!/bin/bash
# Create backend/.venv with fallbacks when python3-venv is not installed (common on Debian/Ubuntu).

ensure_venv() {
  local venv_dir="${1:?venv path required}"
  local python="${PYTHON:-python3}"
  local venv_py="$venv_dir/bin/python3"

  _venv_usable() {
    [ -x "$venv_py" ] && "$venv_py" -c "import sys" 2>/dev/null
  }

  if [ -d "$venv_dir" ] && ! _venv_usable; then
    echo "Removing broken virtualenv at $venv_dir"
    rm -rf "$venv_dir"
  fi

  if _venv_usable; then
    return 0
  fi

  echo "Creating virtualenv at $venv_dir..."

  if "$python" -m venv "$venv_dir" 2>/dev/null && _venv_usable; then
    return 0
  fi

  rm -rf "$venv_dir"

  if "$python" -m virtualenv "$venv_dir" 2>/dev/null && _venv_usable; then
    return 0
  fi

  rm -rf "$venv_dir"

  if "$python" -m pip install --user virtualenv >/dev/null 2>&1; then
    if "$python" -m virtualenv "$venv_dir" 2>/dev/null && _venv_usable; then
      return 0
    fi
    rm -rf "$venv_dir"
  fi

  local pyver
  pyver=$("$python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "3")

  cat >&2 <<EOF
ERROR: Failed to create virtual environment.

On Debian/Ubuntu, install the venv package for your Python version:
  sudo apt update
  sudo apt install python${pyver}-venv

Then remove the broken venv and retry:
  rm -rf $venv_dir

Alternatively, install pip and virtualenv:
  sudo apt install python3-pip
  python3 -m pip install --user virtualenv
EOF
  exit 1
}

install_venv_deps() {
  local venv_dir="${1:?venv path required}"
  local requirements="${2:?requirements path required}"
  shift 2
  "$venv_dir/bin/pip" install -r "$requirements" "$@"
}
