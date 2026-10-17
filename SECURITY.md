# Security Policy

## Supported versions

Security fixes are currently developed against the latest commit on the main branch.

No stable versioned release has been published yet.

## Reporting vulnerabilities

Please do not publish vulnerability details in GitHub issues or discussions.

Use GitHub's private vulnerability reporting feature if it is enabled for this repository.

If private vulnerability reporting is unavailable, do not post exploit details publicly. Request a private reporting channel through a general repository issue without including sensitive technical details.

## Security architecture

Ledgoryx currently:
- Processes financial CSV files inside the browser.
- Does not require a database.
- Does not expose an API for uploading transaction files.
- Uses deterministic reconciliation rules.
- Validates imported CSV structure and financial amounts.
- Applies spreadsheet formula-injection protections to CSV exports.
- Supports Docker self-hosting.
- Uses a non-root, read-only production container.

## Security boundaries

The current application is not a multi-user financial platform.

It does not currently provide:
- User authentication.
- Role-based access control.
- Organization-level data isolation.
- Server-side audit trails.
- Encrypted persistent financial-data storage.

The Docker Compose deployment binds to localhost by default.

Do not expose the application directly to the public internet without appropriate authentication, HTTPS, and network controls.

## Financial data

Do not submit actual customer financial records in bug reports, pull requests, or test fixtures.

Use synthetic datasets when reporting reconciliation issues.

Downloaded reports may contain sensitive financial information and must be handled accordingly.

## Dependency security

Production and development dependencies are reviewed separately.

Development-tooling advisories should not be ignored, but they must be assessed independently from production runtime exposure.

## Disclosure

Please allow maintainers reasonable time to investigate and remediate a reported vulnerability before public disclosure.
