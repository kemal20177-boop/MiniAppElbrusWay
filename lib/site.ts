export const siteConfig = {
  name: "ElbrusWay AI",
  description: "Все главные нейросети в одном кабинете",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://elbrusway.ru"
};

export const defaultModelId = "openai/gpt-4o-mini";

export const planCatalog = [
  {
    id: "FREE",
    name: "Старт",
    price: "0 ₽",
    tokens: "50 000 токенов в день",
    features: ["Быстрый доступ к чату", "Базовые модели на каждый день", "Первые сценарии без оплаты"]
  },
  {
    id: "BASE",
    name: "Личный",
    price: "490 ₽",
    tokens: "15 млн токенов в месяц",
    features: ["История диалогов и файлов", "Поиск по интернету", "Работа с изображениями"]
  },
  {
    id: "PRO",
    name: "Профи",
    price: "990 ₽",
    tokens: "40 млн токенов в месяц",
    features: ["Больше сильных моделей", "Быстрая обработка запросов", "Подходит для регулярной работы"]
  },
  {
    id: "ULTRA",
    name: "Команда",
    price: "1 990 ₽",
    tokens: "100 млн токенов в месяц",
    features: ["Документы и редактор", "Общие материалы по проектам", "Расширенный контроль и статистика"]
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
