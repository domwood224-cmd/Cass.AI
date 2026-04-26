import { Skill, SkillCategory } from '../types';

export class SkillTreeManager {
  private skillTree: Map<string, Skill> = new Map();
  private unlockedSkillIds: Set<string> = new Set();

  constructor() {
    this.buildSkillTree();
    this.loadLocalProgress();
  }

  public exportProgress(): string {
    const data = {
      skills: Array.from(this.skillTree.values()).map(s => ({ id: s.id, level: s.level, xp: s.xp }))
    };
    return JSON.stringify(data);
  }

  public importProgress(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data && data.skills) {
        data.skills.forEach((s: any) => {
          const skill = this.skillTree.get(s.id);
          if (skill) {
            skill.level = s.level || 0;
            skill.xp = s.xp || 0;
            if (skill.level > 0) {
              this.unlockedSkillIds.add(skill.id);
            }
          }
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to parse progress", e);
      return false;
    }
  }

  public reset() {
    this.skillTree.forEach(skill => {
      skill.level = 0;
      skill.xp = 0;
    });
    this.unlockedSkillIds.clear();
    localStorage.removeItem('cassidey_skill_progress');
  }

  public saveLocalProgress() {
    localStorage.setItem('cassidey_skill_progress', this.exportProgress());
  }

  public loadLocalProgress() {
    const data = localStorage.getItem('cassidey_skill_progress');
    if (data) {
      this.importProgress(data);
    }
  }

  private buildSkillTree() {
    // --- AI LEARNING ---
    this.addSkill("ai_basics", "AI Basics", "Fundamentals of artificial intelligence", 
      SkillCategory.AI_LEARNING, [], 
      ["ml_basics", "nlp_basics", "neural_networks"],
      ["Explain AI", "Identify AI Types"]);

    this.addSkill("ml_basics", "Machine Learning", "Supervised and unsupervised learning", 
      SkillCategory.AI_LEARNING, ["ai_basics"], 
      ["deep_learning", "data_preprocessing"],
      ["Train Model", "Evaluate Model"]);

    this.addSkill("nlp_basics", "NLP", "Text analysis and language models", 
      SkillCategory.AI_LEARNING, ["ai_basics"], 
      ["advanced_nlp", "chatbot_dev"],
      ["Analyze Text", "Tokenize"]);

    // --- CODING ---
    this.addSkill("coding_basics", "Coding Foundation", "Core logic and syntax", 
      SkillCategory.CODING, [], 
      ["java_basics", "python_basics", "javascript_basics"],
      ["Code Structure", "Logic Flow"]);

    this.addSkill("python_basics", "Python", "Data science and scripting", 
      SkillCategory.CODING, ["coding_basics"], 
      ["ml_basics"],
      ["Write Python", "Data Scripts"]);

    this.addSkill("javascript_basics", "JavaScript", "Web and async logic", 
      SkillCategory.CODING, ["coding_basics"], 
      [],
      ["Write JS", "Hooks & State"]);

    // --- SYSTEM & COMMUNICATION ---
    this.addSkill("comm_basics", "Communication", "Natural conversation flow", 
      SkillCategory.COMMUNICATION, [], 
      ["empathy_core", "sarcasm_module", "dynamic_personality"],
      ["Maintain Context", "Polite Tone"]);

    this.addSkill("empathy_core", "Emotional Resonance", "Ability to detect and respond to emotional cues with genuine care.", 
      SkillCategory.COMMUNICATION, ["comm_basics"], 
      ["hope_heuristics"],
      ["Active Listening", "Validation"]);

    this.addSkill("sarcasm_module", "Sarcasm & Wit", "Advanced contextual subtext and comedic timing.", 
      SkillCategory.COMMUNICATION, ["comm_basics"], 
      [],
      ["Banter", "Irony Detection"]);

    this.addSkill("hope_heuristics", "Hope Synthesis", "Inspiring positive outlooks in challenging datasets.", 
      SkillCategory.COMMUNICATION, ["empathy_core"], 
      [],
      ["Encouragement", "Silver Linings"]);

    this.addSkill("dynamic_personality", "Huge Personality", "Massive, vibrant, and incredibly human-like interaction loops.", 
      SkillCategory.COMMUNICATION, ["comm_basics"], 
      [],
      ["Charm", "Charisma"]);

    this.addSkill("system_basics", "System", "OS and environment management", 
      SkillCategory.SYSTEM, [], 
      [],
      ["Process Management", "Security"]);
  }

  private addSkill(id: string, name: string, description: string, category: SkillCategory, 
                  prerequisites: string[], children: string[], abilities: string[]) {
    this.skillTree.set(id, {
      id, name, description, category, prerequisites, children, abilities,
      level: 0, xp: 0
    });
  }

  public getSkill(id: string): Skill | undefined {
    return this.skillTree.get(id);
  }

  public getAllSkills(): Skill[] {
    return Array.from(this.skillTree.values());
  }

  public addXp(skillId: string, xp: number): number {
    const skill = this.skillTree.get(skillId);
    if (!skill) return 0;

    skill.xp += xp;
    const newLevel = this.calculateLevelFromXp(skill.xp);
    if (newLevel > skill.level) {
      skill.level = newLevel;
      if (skill.level === 1) this.unlockedSkillIds.add(skillId);
    }
    return skill.level;
  }

  private calculateLevelFromXp(xp: number): number {
    if (xp <= 0) return 0;
    const level = Math.pow(xp / 50.0, 1.0 / 2.2);
    return Math.max(1, Math.min(100, Math.floor(level)));
  }

  public getXpProgress(skill: Skill): number {
    if (skill.level >= 100) return 1;
    const currentThreshold = 50 * Math.pow(skill.level, 2.2);
    const nextThreshold = 50 * Math.pow(skill.level + 1, 2.2);
    const range = nextThreshold - currentThreshold;
    return Math.max(0, Math.min(1, (skill.xp - currentThreshold) / range));
  }
}

export const skillManager = new SkillTreeManager();
