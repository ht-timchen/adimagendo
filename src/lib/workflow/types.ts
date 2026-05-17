export type StepAvailability = {
  locked: boolean;
  available: boolean;
  completed: boolean;
  reasons: string[];
};

export type WorkflowChecklistTemplate = {
  key: string;
  title: string;
  sortOrder: number;
  prerequisiteKeys: string[];
  requiredMilestoneKeys: string[];
  unlockOffsetDays: number | null;
};

export type WorkflowStudyMilestone = {
  key: string;
  title: string;
  requiredKeys: string[];
  sortOrder: number;
};

export type WorkflowEvaluationContext = {
  enrollmentDate: Date;
  now: Date;
  templatesByKey: Map<string, WorkflowChecklistTemplate>;
  completedKeys: Set<string>;
  achievedMilestoneKeys: Set<string>;
  milestones: WorkflowStudyMilestone[];
};
