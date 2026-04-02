"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/app/icon";
import { quickModelFamilies } from "@/lib/site";
import { type UiModel } from "@/lib/model-ui";

function familyIcon(family: string) {
  if (family === "claude") return "doc";
  if (family === "gemini") return "grid";
  if (family === "grok") return "spark";
  if (family.includes("banana")) return "image";
  return "chat";
}

export function ModelPicker({
  models,
  value,
  onChange,
  title = "Выбор модели",
  description = "Выберите модель под вашу задачу.",
  filter
}: {
  models: UiModel[];
  value: string;
  onChange: (modelId: string) => void;
  title?: string;
  description?: string;
  filter?: (model: UiModel) => boolean;
}) {
  const [family, setFamily] = useState("auto");

  const filtered = useMemo(() => {
    const scoped = filter ? models.filter(filter) : models;
    if (family === "auto") {
      return scoped;
    }
    return scoped.filter((item) => item.family === family);
  }, [family, filter, models]);

  const visible = filtered.length > 0 ? filtered : filter ? models.filter(filter) : models;

  return (
    <section className="surface model-picker">
      <div className="section-stack">
        <div>
          <div className="eyebrow">Модели</div>
          <h3 className="surface-title">{title}</h3>
          <p className="surface-copy">{description}</p>
        </div>
        <div className="family-row">
          {quickModelFamilies.map((item) => (
            <button
              key={item.key}
              type="button"
              className={family === item.key ? "chip chip-active" : "chip"}
              onClick={() => setFamily(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="model-grid">
          {visible.map((model) => (
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
      </div>
    </section>
  );
}
