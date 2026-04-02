export const siteConfig = {
  name: "ElbrusWay AI",
  description: "Понятный AI-сервис для чата, изображений, видео, аудио, документов и файлов",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://elbrusway.ru"
};

export const defaultModelId = "openai/gpt-4o-mini";

export const modelPickerTabs = [
  {
    key: "popular",
    label: "Популярные",
    title: "Быстрый старт",
    summary: "Модели, с которых проще всего начать без чтения длинных списков."
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    title: "ChatGPT",
    summary: "Универсальный выбор для чата, идей, анализа и повседневной работы."
  },
  {
    key: "claude",
    label: "Claude",
    title: "Claude",
    summary: "Сильный вариант для длинных материалов, аккуратных формулировок и сложных разборов."
  },
  {
    key: "gemini",
    label: "Gemini",
    title: "Gemini",
    summary: "Удобен для мультимодальных задач, файлов и визуального контента."
  },
  {
    key: "grok",
    label: "Grok",
    title: "Grok",
    summary: "Быстрый ход для коротких ответов, альтернативных идей и живого тона."
  },
  {
    key: "images",
    label: "Изображения",
    title: "Модели для изображений",
    summary: "Подходят для генерации и визуальных экспериментов."
  },
  {
    key: "video",
    label: "Видео",
    title: "Модели для video flow",
    summary: "Используются для сценариев, сторибордов и подготовки задачи."
  },
  {
    key: "audio",
    label: "Аудио",
    title: "Модели для аудио",
    summary: "Подходят для расшифровки и озвучки."
  }
] as const;

export const quickModelFamilies = [
  {
    key: "popular",
    label: "Популярные",
    title: "Быстрый старт",
    summary: "Если не хочется разбираться в различиях, начните с популярных моделей."
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    title: "ChatGPT",
    summary: "Универсальный выбор для повседневных задач, идей, текста и быстрых ответов."
  },
  {
    key: "claude",
    label: "Claude",
    title: "Claude",
    summary: "Подходит для длинных материалов, аккуратных формулировок и сложных разборов."
  },
  {
    key: "gemini",
    label: "Gemini",
    title: "Gemini",
    summary: "Удобен для мультимодальных задач, работы с файлами и визуальным контентом."
  },
  {
    key: "grok",
    label: "Grok",
    title: "Grok",
    summary: "Быстрый вариант для свежих идей, коротких ответов и альтернативного стиля общения."
  },
  {
    key: "images",
    label: "Изображения",
    title: "Изображения",
    summary: "Подборка моделей для генерации и редактирования визуального контента."
  },
  {
    key: "video",
    label: "Видео",
    title: "Видео",
    summary: "Выбор моделей и flow для сториборда, структуры ролика и постановки задачи."
  },
  {
    key: "audio",
    label: "Аудио",
    title: "Аудио",
    summary: "Модели для расшифровки аудио и озвучки текста."
  }
] as const;

export const planCatalog = [
  {
    id: "FREE",
    name: "Старт",
    price: "0 ₽",
    tokens: "50 000 токенов в день",
    features: ["Чат и быстрые сценарии", "Первые изображения и работа с файлами", "Понятный вход без сложной настройки"]
  },
  {
    id: "BASE",
    name: "Личный",
    price: "490 ₽",
    tokens: "15 млн токенов в месяц",
    features: ["Сильные модели на каждый день", "Изображения, поиск и документы", "История материалов и проектов"]
  },
  {
    id: "PRO",
    name: "Профи",
    price: "990 ₽",
    tokens: "40 млн токенов в месяц",
    features: ["Больше топовых моделей", "Быстрый доступ к медиа-сценариям", "Подходит для постоянной рабочей нагрузки"]
  },
  {
    id: "ULTRA",
    name: "Команда",
    price: "1 990 ₽",
    tokens: "100 млн токенов в месяц",
    features: ["Работа с проектами и редактором", "Больше лимитов и гибкости", "Для интенсивного использования"]
  }
] as const;

export const modelCatalog = [
  {
    id: "openai/gpt-4o-mini",
    provider: "OpenAI",
    name: "ChatGPT",
    summary: "Универсальный выбор для чата и повседневных задач.",
    priceHint: "Free"
  },
  {
    id: "anthropic/claude-3.7-sonnet",
    provider: "Anthropic",
    name: "Claude",
    summary: "Сильный вариант для длинных текстов и аккуратных разборов.",
    priceHint: "От Base"
  },
  {
    id: "google/gemini-2.5-flash",
    provider: "Google",
    name: "Gemini",
    summary: "Подходит для мультимодальных сценариев и работы с файлами.",
    priceHint: "От Base"
  },
  {
    id: "xai/grok-beta",
    provider: "xAI",
    name: "Grok",
    summary: "Быстрый режим для коротких ответов и идей.",
    priceHint: "От Pro"
  }
] as const;

export const homeUseCases = [
  "Запустить чат и быстро выбрать подходящую модель",
  "Сделать изображение для поста, презентации или идеи",
  "Подготовить сценарий и постановку задачи для ролика",
  "Расшифровать аудио или подготовить озвучку текста",
  "Собрать документ, сохранить файл и привязать всё к проекту"
] as const;
