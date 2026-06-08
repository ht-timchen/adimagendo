export type StepAvailabilityReasonCode = "BOOKING_PREREQUISITE_NOT_MET";

export type WorkflowBookingProgress =
  | "NOT_STARTED"
  | "BOOKED_EXTERNALLY"
  | "CONFIRMED";

export type StepAvailability = {
  locked: boolean;
  available: boolean;
  completed: boolean;
  reasons: string[];
  reasonCodes: StepAvailabilityReasonCode[];
};

export type WorkflowChecklistTemplate = {
  key: string;
  title: string;
  sortOrder: number;
  prerequisiteKeys: string[];
  requiredMilestoneKeys: string[];
  unlockOffsetDays: number | null;
  bookingPrerequisiteKey: string | null;
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
  /** Latest bookingProgress per checklist template key (defaults to NOT_STARTED). */
  bookingProgressByKey: Map<string, WorkflowBookingProgress>;
  achievedMilestoneKeys: Set<string>;
  milestones: WorkflowStudyMilestone[];
};
