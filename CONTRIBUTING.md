# Contributing to Ledgoryx

Thank you for your interest in improving Ledgoryx.

Ledgoryx is an open-source financial reconciliation and discrepancy investigation tool.

## Development environment

Requirements:
- Node.js 22
- npm
- Git

Clone the repository and install dependencies:

    git clone https://github.com/tidelog/ledgoryx.git
    cd ledgoryx
    npm ci

Start the development server:

    npm run dev

Open http://localhost:3000.

## Quality checks

Before submitting a pull request, run:

    npm test
    npx tsc --noEmit
    npm run lint
    npm run build
    npm audit --omit=dev --audit-level=moderate

## Engineering principles

1. Preserve deterministic reconciliation results.
2. Never use floating-point arithmetic for financial amounts.
3. Keep financial CSV processing local to the browser.
4. Do not introduce financial-data uploads without explicit architectural review.
5. Provide meaningful explanations for reconciliation decisions.
6. Add regression tests for bug fixes.
7. Reject malformed or ambiguous financial inputs rather than guessing.
8. Avoid adding unnecessary dependencies.
9. Do not commit secrets, credentials, or real customer financial data.
10. Maintain backward compatibility when possible.

## Pull requests

Before opening a pull request:

- Explain the problem and proposed solution.
- Include tests for changed behavior.
- Document changes to financial calculations.
- Confirm that all quality checks pass.
- Avoid unrelated formatting or refactoring changes.

Small, focused pull requests are preferred.

## Security vulnerabilities

Do not disclose exploitable vulnerabilities in public issues.

See SECURITY.md for reporting guidance.

## License

Contributions are made under the MIT License.
