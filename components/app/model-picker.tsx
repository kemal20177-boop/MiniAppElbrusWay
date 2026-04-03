"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/app/icon";
import { quickModelFamilies } from "@/lib/site";
import { type UiModel } from "@/lib/model-ui";

const CARDS_DEFAULT = 6;

function applyMode(models: UiModel[], mode?: "chat" | "image" | "video" | "audio") {
  if (mode === "image") return models.filter((model) => model.supportsImages);
  if (mode === "video") return models.filter((model) => model.supportsVideo);
  if (mode === "audio") return models.filter((model) => model.supportsAudio);
  return models.filter((model) => model.supportsChat !== false);
}

function familyIcon(family: string) {
  if (family === "claude") return "doc";
  if (family === "gemini") return "grid";
  if (family === "grok") return "spark";
  if (family.includes("banana")) return "image";
  if (family === "deepseek") return "spark";
  return "chat";
}

export function ModelPicker({
  models,
  value,
  onChange,
  title = "Выбор модели",
  description = "Выберите модель под вашу задачу.",
  filter,
  mode
}: {
  models: UiModel[];
  value: string;
  onChange: (modelId: string) => void;
  title?: string;
  description?: string;
  filter?: (model: UiModel) => boolean;
  mode?: "chat" | "image" | "video" | "audio";
}) {
  const [family, setFamily] = useState("auto");
  const [showAll, setShowAll] = useState(false);

  const availableFamilies = useMemo(() => {
    const scoped = applyMode(filter ? models.filter(filter) : models, mode);
    const familiesWithModels = new Set(scoped.map((m) => m.family));
    return quickModelFamilies.filter(
      (f) => f.key === "auto" || familiesWithModels.has(f.key)
    );
  }, [models, filter, mode]);

  const filtered = useMemo(() => {
    const scoped = filter ? models.filter(filter) : models;
    const modeScoped = applyMode(scoped, mode);
    if (family === "auto") return modeScoped;
    return modeScoped.filter((m) => m.family === family);
  }, [family, filter, mode, models]);

  const visible = filtered.length > 0
    ? filtered
    : (() => {
        const scoped = filter ? models.filter(filter) : models;
        return applyMode(scoped, mode);
      })();

  const displayed = showAll ? visible : visible.slice(0, CARDS_DEFAULT);
  const hasMore = visible.length > CARDS_DEFAULT;

  return (
    <section className="surface model-picker">
      <div className="section-stack">
        <div>
          <div className="eyebrow">Модели</div>
          <h3 className="surface-title">{title}</h3>
          <p className="surface-copy">{description}</p>
        </div>

        <div className="family-row">
          {availableFamilies.map((item) => (
            <button
              key={item.key}
              type="button"
              className={family === item.key ? "chip chip-active" : "chip"}
              onClick={() => { setFamily(item.key); setShowAll(false); }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="model-grid">
          {displayed.map((model) => (
            <button
              key={model.id}
              type="button"
              className={value === model.id ? "model-card active" : "model-card"}
              onClick={() => onChange(model.id)}
            >
              <div className="model-card-head">
                <span className="icon-badge">
                  <AppIcon name={familyIcon(model.family)} size={16} />
                </span>
                <span className="mini-badge">{model.badge}</span>
              </div>
              <div className="model-card-title">{model.name}</div>
              <div className="model-card-copy">{model.summary}</div>
            </button>
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            className="button-ghost compact-button"
            style={{ alignSelf: "center" }}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? "Скрыть"
              : `Показать все (${visible.length})`}
          </button>
        )}

        {value && (
          <div className="selected-model-pill">
            <span className="selected-model-label">Выбрано</span>
            <strong>{models.find((m) => m.id === value)?.name || value}</strong>
          </div>
        )}
      </div>
    </section>
  );
}
