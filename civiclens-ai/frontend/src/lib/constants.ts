import type { Priority, Status } from "./types";

// Keep in sync with backend/app/services/grievance_ai.py
export const CATEGORIES = [
  "Water Supply",
  "Electricity",
  "Roads & Transport",
  "Sanitation & Waste",
  "Healthcare",
  "Education",
  "Ration & PDS",
  "Pension & Welfare",
  "Land & Revenue",
  "Police & Safety",
  "Other",
] as const;

export const STATUSES: Status[] = ["submitted", "in_review", "in_progress", "resolved", "rejected"];
export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export const DEMO_LOGINS = {
  citizen: { email: "citizen@civiclens.demo", password: "Citizen@123" },
  officer: { email: "officer@civiclens.demo", password: "Officer@123" },
};
