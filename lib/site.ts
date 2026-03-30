export const siteConfig = {
  name: "ElbrusWay AI",
  description: "Все нейросети без VPN",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://elbrusway.ru"
};

export const defaultModelId = "openai/gpt-4o-mini";

export const planCatalog = [
  {
    id: "FREE",
    name: "Free",
    price: "0 ₽",
    tokens: "50 000 / день",
    features: ["Базовый чат", "5 моделей", "7 запросов в день"]
  },
  {
    id: "BASE",
    name: "Base",
    price: "490 ₽",
    tokens: "15 млн / мес",
    features: ["История чатов", "Веб-поиск", "Изображения"]
  },
  {
    id: "PRO",
    name: "Pro",
    price: "990 ₽",
    tokens: "40 млн / мес",
    features: ["Быстрые модели", "Приоритет очереди", "API ключи"]
  },
  {
    id: "ULTRA",
    name: "Ultra",
    price: "1 990 ₽",
    tokens: "100 млн / мес",
    features: ["Документы", "Командные пресеты", "Админ-аналитика"]
  }
] as const;

export const modelCatalog = [
  {
    id: "openai/gpt-4o",
    provider: "OpenAI",
    name: "GPT-4o",
    summary: "Универсальный текст, код и мультимодальность",
    priceHint: "От Base"
  },
  {
    id: "anthropic/claude-3.7-sonnet",
    provider: "Anthropic",
    name: "Claude 3.7 Sonnet",
    summary: "Сильный reasoning и длинный контекст",
    priceHint: "От Pro"
  },
  {
    id: "google/gemini-2.5-flash-image",
    provider: "Google",
    name: "Gemini Flash Image",
    summary: "Изображения и быстрые мультимодальные ответы",
    priceHint: "От Base"
  },
  {
    id: "deepseek/deepseek-chat",
    provider: "DeepSeek",
    name: "DeepSeek Chat",
    summary: "Экономичный режим для повседневных задач",
    priceHint: "Free"
  }
] as const;
