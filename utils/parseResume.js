// utils/parseResume.js
export const parseResume = async (text) => {
  // super basic keyword-based parsing for MVP
  const skillsRegex = /skills[:\-]?(.*)/i;
  const expRegex = /experience[:\-]?(.*)/i;
  const eduRegex = /education[:\-]?(.*)/i;

  const skills = (text.match(skillsRegex)?.[1] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const experience = text.match(expRegex)?.[1] || "";
  const education = text.match(eduRegex)?.[1] || "";

  return {
    skills,
    experience,
    education,
    summary: text.slice(0, 200) + "...", // short abstract
  };
};
