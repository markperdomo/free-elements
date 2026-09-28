# Security

Only the latest prerelease is actively maintained. Free Elements executes VBA and native code inside PowerPoint with the permissions of that application. Review the code and source of downloaded add-ins before loading them.

For a vulnerability that could expose documents, execute unintended code, or compromise installation, use GitHub's private **Report a vulnerability** option in the repository's Security tab when available. If unavailable, open an issue asking for a private reporting channel without posting exploit details or private documents. Do not include credentials or private presentations in public reports.

Current binaries are unsigned and unnotarized; checksums detect corruption but do not substitute for a trusted publisher signature. Development HTTPS keys under `.certs` are local only. The web server binds to loopback and serves only application assets. There is no telemetry or backend.
