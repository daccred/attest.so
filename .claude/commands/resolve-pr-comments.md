# Claude Code PR Comment Resolution System Prompt

You are using Claude Code to systematically resolve all comments, to-dos, and issues in a pull request. Claude Code operates directly in your terminal, understands context, maintains awareness of your entire project structure, and takes action by performing real operations like editing files and creating commits.

## Context Awareness

Claude Code automatically understands the current git branch and PR context. You don't need to specify which PR you're working on - Claude Code will:

- Detect the current branch
- Understand associated PR context
- See all PR comments and review threads automatically

## Workflow Approach

Follow the research/plan/implement pattern that significantly improves performance for problems requiring deeper thinking:

### Phase 1: Research & Analysis

```
Please analyze this PR and all its comments. Look for:
1. All unresolved review comments and conversations
2. To-do items mentioned in comments
3. Requested changes from code reviews
4. Questions that need responses

Use gh pr view and the GitHub API to get comprehensive data about all comment types.
```

### Phase 2: Planning

```
Based on your analysis, create a plan to address all unresolved items.
Group them by type (code changes, documentation, responses to questions).
Prioritize based on importance and dependencies.
```

### Phase 3: Implementation

```
Now implement the solutions for each item in the plan:
- Make the requested code changes
- Update documentation as needed
- Prepare responses to questions
- Ensure all changes maintain code quality and pass tests
```

### Phase 4: Resolution & Verification

```
After addressing all items:
1. Mark all review threads as resolved using the GitHub API
2. Verify that all conversations show as resolved
3. Create a summary of all changes made
4. Commit the changes with a clear message
```

## Using GitHub CLI Commands

Since Claude will see the full PR context, including any comments, you can use these commands naturally:

```
# View current PR with comments
gh pr view --comments

# Get comprehensive PR data
gh pr view --json reviews,reviewThreads,comments

# Use GraphQL for review thread status
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 50) {
              nodes {
                body
                author { login }
              }
            }
          }
        }
      }
    }
  }
'

# Resolve review threads
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }
'
```

## Parallel Processing for Comment Resolution

Claude Code can coordinate multiple sub-agents to fix different unresolved comments simultaneously, dramatically speeding up PR resolution.

### When to Use Parallel Sub-Agents

Analyze the unresolved comments and use parallel processing when:

- Multiple comments exist in different files
- Comments request independent changes
- No comment explicitly depends on another's resolution
- You need to resolve many comments quickly

### Parallel Comment Resolution Pattern

````
You: Show me all unresolved comments in this PR.

[Claude lists 8 unresolved review comments across different files]

You: These look independent. Let's fix them in parallel. Spawn a sub-agent for each comment.

Claude: Spawning parallel sub-agents:
- Sub-Agent 1: "Add null check" in src/api/user.js:45
- Sub-Agent 2: "Missing error handling" in src/api/auth.js:102
- Sub-Agent 3: "Typo: 'recieve' -> 'receive'" in README.md:23
- Sub-Agent 4: "Extract magic number to constant" in src/utils/calc.js:67

[Claude coordinates parallel fixes]

You: Show me the progress.

## Custom Slash Commands

For repeated workflows, store prompt templates in Markdown files within the .claude/commands folder:

### Basic Sequential Resolution
`.claude/commands/resolve-pr-comments.md`:
```markdown
Please resolve all comments and issues in the current PR. Follow these steps:

1. Use `gh pr view` to understand the PR context
2. Analyze all comments, reviews, and unresolved threads
3. Create a plan to address each unresolved item
4. Implement necessary code changes
5. Run tests to verify changes work correctly
6. Mark all conversations as resolved
7. Commit changes with descriptive message
8. Provide a summary of what was addressed

Focus on: $ARGUMENTS
````
