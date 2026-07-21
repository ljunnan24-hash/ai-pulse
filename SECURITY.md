# Security Policy

## Supported version

Security fixes are applied to the latest commit on the default branch.

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities or exposed credentials. Email `2089128910@qq.com` with:

- a concise description of the issue;
- reproduction steps or a minimal proof of concept;
- the affected route, component, or commit;
- the potential impact;
- any suggested mitigation.

Do not access, modify, or retain data that does not belong to you. Acknowledgement and remediation timing depend on severity and reproducibility.

## Secrets

The repository must never contain API keys, SMTP credentials, database passwords, JWT secrets, TLS private keys, production exports, or private user data. If a credential is exposed, revoke and rotate it immediately; removing it from the latest commit is not sufficient.
