"""Dev-only acceptance fixtures.

Not part of the production package: the Docker build excludes this directory
(see `.dockerignore`), and nothing imports it outside the acceptance runbook
(`uv run poe seed:acceptance`) and its tests.
"""
