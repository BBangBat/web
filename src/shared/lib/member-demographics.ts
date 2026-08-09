import type { AgeGroup, Gender } from "@/entities/types";

export const GENDER_LABEL: Record<Gender, string> = {
  FEMALE: "여성",
  MALE: "남성",
  UNKNOWN: "응답하지 않음",
};

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  TEENS: "10대",
  TWENTIES: "20대",
  THIRTIES: "30대",
  FORTIES: "40대",
  FIFTIES: "50대",
  SIXTIES_PLUS: "60대 이상",
  UNKNOWN: "응답하지 않음",
};

export const GENDER_OPTIONS = (Object.entries(GENDER_LABEL) as [Gender, string][])
  .map(([value, label]) => ({ value, label }));

export const AGE_GROUP_OPTIONS = (Object.entries(AGE_GROUP_LABEL) as [AgeGroup, string][])
  .map(([value, label]) => ({ value, label }));
