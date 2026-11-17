# Mergify workflow

KLiK POS uses Mergify to propagate a merged pull request to selected branches
through reviewed backport pull requests.

## Backport labels

After a pull request has merged, apply one or both labels in GitHub:

- `backport develop` creates a backport pull request targeting `develop`.
- `backport version-16` creates a backport pull request targeting `version-16`.

Mergify cherry-picks the merged pull request into the target branch and opens a
new pull request. The new pull request must pass CI and be reviewed before it
is merged. If the cherry-pick conflicts, Mergify creates the pull request with
the conflicts for manual resolution.

The same operation can be requested in a pull request comment after merge:

```text
@Mergifyio backport develop version-16
```

## Repository setup

The Mergify GitHub App must be installed on the repository with permission to
read pull requests, create branches and pull requests, apply labels, and
update pull requests. The `develop` and `version-16` branches must exist.

Create the two labels with exactly these names in GitHub. Branch protection
should require the repository's `Server` and `pre-commit` checks before a
backport pull request can merge.

Mergify reads `.mergify.yml` from the repository's default branch. Do not add
another Mergify configuration under `.github/`; only one configuration file
should be active.
