"""The rules of the app as pure functions: no database, no HTTP, no framework.

Everything here takes plain values or pandas frames and returns new ones, so it can be
tested exhaustively (including property-based tests) and reused from any entry point:
the API today, a batch job or a notebook tomorrow.
"""
