export type PlanId = "FREE" | "BASE" | "PRO" | "ULTRA" | "BUSINESS";

export const plans: Record<
  PlanId,
  { name: string; priceRub: number; tokensPerMonth: number; requestsPerHour: number; description: string }
> = {
  FREE: {
    name: "Free",
    priceRub: 0,
    tokensPerMonth: 50000,
    requestsPerHour: 7,
    description: "Базовый доступ для знакомства с платформой"
  },
  BASE: {
    name: "Base",
    priceRub: 490,
    tokensPerMonth: 15_000_000,
    requestsPerHour: 200,
    description: "Повседневная работа с текстом, кодом и web-поиском"
  },
  PRO: {
    name: "Pro",
    priceRub: 990,
    tokensPerMonth: 40_000_000,
    requestsPerHour: 500,
    description: "Интенсивное использование, API-ключи и приоритет"
  },
  ULTRA: {
    name: "Ultra",
    priceRub: 1990,
    tokensPerMonth: 100_000_000,
    requestsPerHour: 1000,
    description: "Командная работа, документы и мультимодальность"
  },
  BUSINESS: {
    name: "Business",
    priceRub: 9900,
    tokensPerMonth: 700_000_000,
    requestsPerHour: 5000,
    description: "Корпоративный лимит и повышенная квота запросов"
  }
};

export const tokenPackages = [
  { id: "pack_5m", name: "5M tokens", tokens: 5_000_000, priceRub: 149 },
  { id: "pack_20m", name: "20M tokens", tokens: 20_000_000, priceRub: 490 },
  { id: "pack_50m", name: "50M tokens", tokens: 50_000_000, priceRub: 990 },
  { id: "pack_200m", name: "200M tokens", tokens: 200_000_000, priceRub: 2990 }
] as const;

export function getPlanExpiry(months = 1) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}
