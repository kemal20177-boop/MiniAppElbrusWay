export type PlanId = "FREE" | "BASE" | "PRO" | "ULTRA" | "BUSINESS";

export const plans: Record<
  PlanId,
  { name: string; priceRub: number; tokensPerMonth: number; requestsPerHour: number; description: string }
> = {
  FREE: {
    name: "Старт",
    priceRub: 0,
    tokensPerMonth: 50_000,
    requestsPerHour: 10,
    description: "Базовый доступ для знакомства"
  },
  BASE: {
    name: "Личный",
    priceRub: 490,
    tokensPerMonth: 15_000_000,
    requestsPerHour: 300,
    description: "Повседневная работа с текстом и кодом"
  },
  PRO: {
    name: "Профи",
    priceRub: 990,
    tokensPerMonth: 40_000_000,
    requestsPerHour: 600,
    description: "Интенсивное использование всех возможностей"
  },
  ULTRA: {
    name: "Команда",
    priceRub: 1990,
    tokensPerMonth: 100_000_000,
    requestsPerHour: 1200,
    description: "Командная работа и максимальные лимиты"
  },
  BUSINESS: {
    name: "Бизнес",
    priceRub: 9900,
    tokensPerMonth: 700_000_000,
    requestsPerHour: 5000,
    description: "Корпоративный лимит и приоритет"
  }
};

export const tokenPackages = [
  { id: "pack_5m", name: "5M токенов", tokens: 5_000_000, priceRub: 149 },
  { id: "pack_20m", name: "20M токенов", tokens: 20_000_000, priceRub: 490 },
  { id: "pack_50m", name: "50M токенов", tokens: 50_000_000, priceRub: 990 },
  { id: "pack_200m", name: "200M токенов", tokens: 200_000_000, priceRub: 2990 }
] as const;

export function getPlanExpiry(months = 1) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}
