"""Write the API's OpenAPI schema without starting a server.

    uv run python -m app.openapi                     # print to stdout
    uv run python -m app.openapi path/openapi.json  # write a file

The frontend generates its TypeScript types from this file (`make api-types`), so the two
halves stay in step.
"""

import json
import os
import sys
from pathlib import Path

# Building the schema never touches the database, so a placeholder URL is enough here.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://unused@localhost/unused")

from app.main import create_app  # imported after the placeholder on purpose


def main(argv: list[str]) -> None:
    schema = create_app().openapi()
    text = json.dumps(schema, indent=2, sort_keys=True) + "\n"
    if len(argv) > 1:
        Path(argv[1]).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main(sys.argv)
