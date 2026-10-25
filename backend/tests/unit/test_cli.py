from pathlib import Path

from typer.testing import CliRunner

from app.ingestion.cli import _set_env, cli


def test_set_env_replaces_keys_and_keeps_everything_else(tmp_path: Path) -> None:
    env = tmp_path / ".env"
    env.write_text("# my settings\nDATABASE_URL=old\nLOG_LEVEL=DEBUG\n")

    _set_env(env, {"DATABASE_URL": "new", "TEST_DATABASE_URL": "test"})

    assert env.read_text() == (
        "# my settings\nDATABASE_URL=new\nLOG_LEVEL=DEBUG\nTEST_DATABASE_URL=test\n"
    )


def test_set_env_creates_the_file(tmp_path: Path) -> None:
    env = tmp_path / ".env"

    _set_env(env, {"DATABASE_URL": "x"})

    assert env.read_text() == "DATABASE_URL=x\n"


def test_doctor_explains_an_unreachable_database(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.core import config, db

    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://nobody@127.0.0.1:1/wind")
    config.get_settings.cache_clear()
    db.get_engine.cache_clear()
    try:
        result = CliRunner().invoke(cli, ["doctor"])
    finally:
        config.get_settings.cache_clear()
        db.get_engine.cache_clear()

    assert result.exit_code == 1
    assert "cannot connect" in result.output
    assert "make local-db" in result.output
