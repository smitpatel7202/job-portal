const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI = null;
let model = null;

function getModel() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  if (!model) {
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return model;
}

/**
 * Analyze candidate resume text against job description.
 * Returns normalized object:
 * {
 *   matchScore: Number (0-100),
 *   missingSkills: string[],
 *   aiRoadmap: [{ skill, link }]
 * }
 */
async function analyzeResumeAgainstJob({ resumeText, jobDescription }) {
  try {
    const mdl = getModel();

    const prompt = `
You are an expert technical recruiter.

Compare this candidate with the job:

JOB DESCRIPTION (includes required skills):
------------------------------------------
${jobDescription}

CANDIDATE RESUME (skills + experience):
---------------------------------------
${resumeText}

Return ONLY a strict JSON object (no markdown, no commentary) with this shape:
{
  "matchScore": number,          // integer 0-100, calibrated on skills fit
  "missingSkills": string[],     // skills from the job that are clearly missing or weak
  "aiRoadmap": [
    { "skill": string, "link": string }  // max 8 items, high-quality learning links
  ]
}

Rules:
- Focus on concrete skills (languages, frameworks, tools, cloud, data, etc.).
- "missingSkills" must come from the job requirements, not random guesses.
- If the candidate is very strong, "missingSkills" can be an empty array.
- "matchScore" should roughly reflect how many required skills the candidate has.
`;

    const result = await mdl.generateContent(prompt);
    const text = result.response.text().trim();

    // Try to extract JSON from the response safely
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('AI response did not contain JSON');
    }

    const jsonString = text.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonString);

    // Match score: be tolerant of slightly different keys
    const rawMatch =
      parsed.matchScore ??
      parsed.match_percentage ??
      parsed.matchPercent ??
      parsed.matchPercentage;

    const matchScore =
      typeof rawMatch === 'number'
        ? Math.max(0, Math.min(100, Math.round(rawMatch)))
        : 0;

    // Missing skills: accept common variants
    const missingSkillsSource =
      (Array.isArray(parsed.missingSkills) && parsed.missingSkills) ||
      (Array.isArray(parsed.missing_skills) && parsed.missing_skills) ||
      [];

    const missingSkills = missingSkillsSource
      .map(s => String(s).trim())
      .filter(Boolean);

    // Roadmap: normalize to { skill, link }
    let aiRoadmap = [];
    if (Array.isArray(parsed.aiRoadmap)) {
      aiRoadmap = parsed.aiRoadmap;
    } else if (Array.isArray(parsed.roadmapLinks)) {
      aiRoadmap = parsed.roadmapLinks.map(item => ({
        skill: item.topic || item.skill || '',
        link: item.url || item.link || ''
      }));
    }

    aiRoadmap = aiRoadmap
      .map(item => ({
        skill: item && item.skill ? String(item.skill).trim() : '',
        link: item && item.link ? String(item.link).trim() : ''
      }))
      .filter(item => item.skill && item.link);

    return {
      matchScore,
      missingSkills,
      aiRoadmap
    };
  } catch (error) {
    console.error('AI analysis error:', error.message || error);
    return {
      matchScore: 0,
      missingSkills: [],
      aiRoadmap: []
    };
  }
}

module.exports = {
  analyzeResumeAgainstJob
};
