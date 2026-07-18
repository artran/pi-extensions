# Integration, publication, and cleanup

Enter this branch only after Ray explicitly authorizes the relevant action. Authorization to merge a named task includes Worktrunk's normal post-merge removal; it does not authorize pushing or force deletion.

## Personal repository integration

The target history is linear: one curated task commit rebased onto the target, followed by a fast-forward. A merge commit is outside the target strategy.

1. Re-read installed help for `wt step squash` and `wt merge`. Inspect schema-2 Worktrunk state and verify the authorized topic branch, target branch, and absolute paths. Require a clean topic worktree whose journal commits contain the complete validated change.
2. Fetch the target's remote. Require a clean primary worktree and fast-forward it to upstream. A dirty or diverged primary worktree stops integration before topic history is rewritten.
3. Re-run applicable validation if the reported results no longer describe the topic HEAD.
4. In the topic worktree run `wt step squash <target> --stage=none`, using structured output when supported. Inspect the resulting one-commit diff and message against repository style and amend the message when needed. The squash is complete when the topic is one self-contained commit ahead of the synchronized target and its worktree is clean.
5. Run `wt merge --no-squash <target>` so Worktrunk rebases, runs approved pre-merge hooks, fast-forwards the target, and removes the integrated worktree without generating a second squash commit. Keep fast-forward behavior enabled.
6. If rebase conflicts have an unambiguous intended result, resolve them, complete the rebase, and rerun every applicable check. Preserve an ambiguous conflict state and ask Ray with the exact files and competing interpretations.
7. Inspect `wt list --format=json` and target history. Integration is complete only when the target contains exactly the curated commit, validation passed after the final rebase, no merge commit was created, and the topic worktree/branch received the expected normal cleanup.

## External publication

Repository contribution instructions override personal naming, commit, and integration rules. Keep the default branch untouched. After explicit publication authorization:

1. Synchronize against the contribution target and validate the exact published HEAD.
2. Push the topic with upstream tracking.
3. Open or prepare the PR through the repository's documented forge flow.
4. Report the pushed ref, PR URL when created, checks, and any deviation from contribution instructions.

Publication is complete when the remote branch contains the validated local HEAD and the requested PR state exists. Local `wt merge` is not part of external publication.

## Cleanup without integration

Inspect schema-2 state first and name every candidate. `wt remove <branch>` is appropriate only after Ray requests cleanup and Worktrunk considers the worktree clean and branch integrated or empty.

For a dirty worktree, show staged, modified, and untracked state before requesting branch-specific approval for `--force`. For an unmerged branch, show ahead/behind and diff state before requesting branch-specific approval for `-D`. One force approval does not cover another branch or the other force mode.

Cleanup is complete when Worktrunk no longer lists the requested worktree and every branch has the requested retained/deleted state. Preserve every unrequested worktree and branch.
