export type ProtocolChecklistStep = {
  key: string;
  sortOrder: number;
  prerequisiteKeys?: string[];
  requiredMilestoneKeys?: string[];
};

export type ProtocolMilestone = {
  key: string;
  requiredKeys: string[];
};

export type ProtocolValidationResult = {
  errors: string[];
  warnings: string[];
};

/**
 * Validates checklist prerequisites, milestones, cycles, and sortOrder consistency.
 * Errors fail seed; warnings are logged but do not fail unless paired with errors.
 */
export function validateProtocol(
  checklistSteps: ProtocolChecklistStep[],
  milestones: ProtocolMilestone[]
): ProtocolValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const checklistKeys = new Set(checklistSteps.map((s) => s.key));
  const milestoneKeys = new Set(milestones.map((m) => m.key));
  const sortOrderByKey = new Map(
    checklistSteps.map((s) => [s.key, s.sortOrder] as const)
  );

  if (checklistKeys.size !== checklistSteps.length) {
    const seen = new Set<string>();
    for (const step of checklistSteps) {
      if (seen.has(step.key)) {
        errors.push(`Duplicate ChecklistTemplate key: "${step.key}"`);
      }
      seen.add(step.key);
    }
  }

  for (const step of checklistSteps) {
    const prereqs = step.prerequisiteKeys ?? [];

    for (const prereqKey of prereqs) {
      if (!checklistKeys.has(prereqKey)) {
        errors.push(
          `ChecklistTemplate "${step.key}": prerequisiteKey "${prereqKey}" does not exist`
        );
        continue;
      }

      if (prereqKey === step.key) {
        errors.push(
          `ChecklistTemplate "${step.key}": self-dependency is not allowed`
        );
      }

      const prereqSortOrder = sortOrderByKey.get(prereqKey);
      if (prereqSortOrder !== undefined && prereqSortOrder >= step.sortOrder) {
        warnings.push(
          `ChecklistTemplate "${step.key}" (sortOrder ${step.sortOrder}) should appear after prerequisite "${prereqKey}" (sortOrder ${prereqSortOrder})`
        );
      }
    }

    const requiredMilestones = step.requiredMilestoneKeys ?? [];
    const seenMilestoneKeys = new Set<string>();
    for (const milestoneKey of requiredMilestones) {
      if (!milestoneKeys.has(milestoneKey)) {
        errors.push(
          `ChecklistTemplate "${step.key}": requiredMilestoneKey "${milestoneKey}" does not exist`
        );
      }
      if (seenMilestoneKeys.has(milestoneKey)) {
        errors.push(
          `ChecklistTemplate "${step.key}": duplicate requiredMilestoneKey "${milestoneKey}"`
        );
      }
      seenMilestoneKeys.add(milestoneKey);
    }
  }

  for (const milestone of milestones) {
    for (const requiredKey of milestone.requiredKeys) {
      if (!checklistKeys.has(requiredKey)) {
        errors.push(
          `StudyMilestone "${milestone.key}": requiredKey "${requiredKey}" does not exist`
        );
      }
    }
  }

  const cycle = findDependencyCycle(checklistSteps, checklistKeys);
  if (cycle) {
    errors.push(
      `Dependency cycle detected: ${cycle.join(" → ")} → ${cycle[0]}`
    );
  }

  return { errors, warnings };
}

/** Builds prereq → dependent edges and returns one cycle path if present. */
function findDependencyCycle(
  steps: ProtocolChecklistStep[],
  allKeys: Set<string>
): string[] | null {
  const dependents = new Map<string, string[]>();

  for (const key of allKeys) {
    dependents.set(key, []);
  }

  for (const step of steps) {
    for (const prereqKey of step.prerequisiteKeys ?? []) {
      if (!allKeys.has(prereqKey)) continue;
      dependents.get(prereqKey)!.push(step.key);
    }
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const parent = new Map<string, string | null>();

  function dfs(node: string): string[] | null {
    if (stack.has(node)) {
      const cycle: string[] = [node];
      let current: string | null = parent.get(node) ?? null;
      while (current && current !== node) {
        cycle.unshift(current);
        current = parent.get(current) ?? null;
      }
      return cycle;
    }
    if (visited.has(node)) return null;

    visited.add(node);
    stack.add(node);

    for (const next of dependents.get(node) ?? []) {
      parent.set(next, node);
      const found = dfs(next);
      if (found) return found;
    }

    stack.delete(node);
    return null;
  }

  for (const key of allKeys) {
    const found = dfs(key);
    if (found) return found;
  }

  return null;
}

export function assertProtocolValid(result: ProtocolValidationResult): void {
  for (const warning of result.warnings) {
    console.warn(`[protocol:warn] ${warning}`);
  }

  if (result.errors.length === 0) return;

  console.error("[protocol] Validation failed:");
  for (const error of result.errors) {
    console.error(`  - ${error}`);
  }
  throw new Error(
    `Protocol validation failed with ${result.errors.length} error(s)`
  );
}
