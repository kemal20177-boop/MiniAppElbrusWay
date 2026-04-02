import { quickModelFamilies } from "@/lib/site";

export type UiModel = {
  id: string;
  name: string;
  family: string;
  summary: string;
  badge: string;
  supportsChat?: boolean;
  supportsImages?: boolean;
  supportsVideo?: boolean;
  supportsAudio?: boolean;
  supportsVision?: boolean;
  featured?: boolean;
};

export function mapModelToFamily(model: { id: string; name: string }) {
  const source = `${model.id} ${model.name}`.toLowerCase();
  if (source.includes("claude")) return "claude";
  if (source.includes("gemini")) return "gemini";
  if (source.includes("grok")) return "grok";
  if (source.includes("banana pro")) return "nano-banana-pro";
  if (source.includes("banana")) return "nano-banana-2";
  if (source.includes("gpt") || source.includes("openai") || source.includes("chatgpt")) return "chatgpt";
  return "auto";
}

export function buildUiModels(models: Array<Record<string, unknown>>): UiModel[] {
  return models.map((entry) => {
    const id = String(entry.id || "");
    const name = String(entry.label || entry.name || id);
    const family = String(entry.family || mapModelToFamily({ id, name }));
    const summary = String(
      entry.summary ||
        quickModelFamilies.find((item) => item.key === family)?.summary ||
        "Подходит для повседневной работы, вопросов, материалов и идей."
    );

    return {
      id,
      name,
      family,
      summary,
      badge: String(entry.badge || (entry.featured ? "Топ" : "Доступно")),
      supportsChat: Boolean(entry.supportsChat ?? true),
      supportsImages: Boolean(entry.supportsImages),
      supportsVideo: Boolean(entry.supportsVideo),
      supportsAudio: Boolean(entry.supportsAudio),
      supportsVision: Boolean(entry.supportsVision ?? entry.supportsImages),
      featured: Boolean(entry.featured)
    };
  });
}
