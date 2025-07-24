# Task Triage and Prioritization System

I need you to analyze my tasks/features and codebase to create an emergency triage system. I have 5 projects and one week to complete them all.

## Step 1: Task Refinement
Here are my raw tasks/feature thoughts in this file:
[$ARGUMENTS]


For each task above:
1. Clarify what it actually entails technically
2. Identify which project/codebase it belongs to
3. Break down any compound tasks into atomic units
4. Flag any tasks that have dependencies on other tasks

## Step 2: Codebase Analysis
Analyze the codebase(s) and for each task determine:
1. **Current State**: What's already implemented vs. what's missing
2. **Complexity Score** (1-5):
   - 1 = Simple CRUD/UI change
   - 2 = Straightforward feature with clear patterns in codebase
   - 3 = Moderate complexity, requires some architectural decisions
   - 4 = Complex feature touching multiple systems
   - 5 = Requires significant refactoring or architectural changes
3. **Technical Debt Impact**: Will this task work with current spaghetti code or require cleanup first?
4. **Estimated Hours**: Realistic time estimate (with CC assistance)

## Step 3: Business Impact Assessment
For each task, categorize the business impact:
- **CRITICAL**: System won't function without this / Customer-facing showstopper
- **HIGH**: Major feature that was promised / Significant UX degradation without it
- **MEDIUM**: Important but system works without it / Can ship with workaround
- **LOW**: Nice-to-have / Internal optimization

## Step 4: Create Triage Matrix
Generate a table with these columns:
| Task ID | Project | Description | Complexity (1-5) | Business Impact | Completion % | Est. Hours | CC Suitability | Priority Score |

Where:
- **CC Suitability** = "Autonomous" (CC can do alone), "Guided" (needs some input), "Paired" (requires active collaboration)
- **Priority Score** = (Business Impact Weight × 10) + (100 - Completion %) - (Complexity × 2)
  - Critical = 40, High = 30, Medium = 20, Low = 10

## Step 5: Generate Execution Plan
Based on the matrix, create three parallel work streams:

**Stream 1 - "The Finisher" (CC Autonomous)**
- List all tasks with: Completion% > 70% OR Complexity <= 2
- These can run independently with minimal check-ins

**Stream 2 - "The Heavy Lifter" (Paired Programming)**  
- List highest priority score tasks that need human decisions
- Include specific decision points that need my input

**Stream 3 - "The Scout" (CC Analysis)**
- List all analysis/documentation tasks
- Include codebase mapping, refactoring plans, test generation

## Step 6: Risk Assessment
Identify:
1. Which tasks are blocking others?
2. Which tasks have unclear requirements?
3. Which projects are at highest risk of not completing?
4. What's the minimum viable version for each project?

## Step 7: Daily Schedule
Create a day-by-day breakdown:
- Day 1-2: What must be started immediately?
- Day 3-4: Mid-week checkpoints and pivots
- Day 5-6: Final push priorities
- Day 7: Buffer for testing/fixes

## Output Format
Provide:
1. The complete triage matrix (sortable by priority)
2. Three work streams with specific task assignments
3. A visual/text representation of the critical path
4. Red flags that need immediate human attention
5. A confidence score (0-100%) for each project completing on time

Start by listing all the files in the current directory to understand the codebase structure, then proceed with the analysis.