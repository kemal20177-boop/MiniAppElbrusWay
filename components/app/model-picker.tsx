"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/app/icon";
import { modelPickerTabs } from "@/lib/site";
import { type UiModel } from "@/lib/model-ui";

function familyIcon(key: string) {
  if (key === "claude") return "doc";
  if (key === "gemini") return "grid";
  if (key === "grok") return "spark";
  if (key === "images") return "image";
  if (key === "video") return "video";
  if (key === "audio") return "audio";
  return "chat";
}

export function ModelPicker({
  models,
  value,
  onChange,
  title = "Выбор модели",
  description = "Выберите модель под вашу задачу.",
  filter,
  mode = "chat"
}: {
  models: UiModel[];
  value: string;
  onChange: (modelId: string) => void;
  title?: string;
  description?: string;
  filter?: (model: UiModel) => boolean;
  mode?: "chat" | "image" | "video" | "audio";
}) {
  const [tab, setTab] = useState(mode === "image" ? "images" : mode === "video" ? "video" : mode === "audio" ? "audio" : "popular");

  const scoped = useMemo(() => {
    const byMode = models.filter((model) => {
      if (mode === "image") return model.supportsImages;
      if (mode === "video") return model.supportsVideo;
      if (mode === "audio") return model.supportsAudio;
      return model.supportsChat;
    });

    return filter ? byMode.filter(filter) : byMode;
  }, [filter, mode, models]);

  const visible = useMemo(() => {
    if (tab === "popular") {
      const featured = scoped.filter((model) => model.featured);
      return featured.length ? featured : scoped.slice(0, 8);
    }
    if (tab === "images") {
      return scoped.filter((model) => model.supportsImages);
    }
    if (tab === "video") {
      return scoped.filter((model) => model.supportsVideo);
    }
    if (tab === "audio") {
      return scoped.filter((model) => model.supportsAudio);
    }

    return scoped.filter((model) => model.family === tab);
  }, [scoped, tab]);

  const fallback = scoped.slice(0, 8);
  const selectedModel = scoped.find((model) => model.id === value) || visible[0] || fallback[0] || null;
  const activeTab = modelPickerTabs.find((item) => item.key === tab) || modelPickerTabs[0];

  return (
    <section className="surface model-picker-panel">
      <div className="section-stack">
        <div className="model-picker-header">
          <div>
            <div className="eyebrow">Модели</div>
            <h3 className="surface-title">{title}</h3>
            <p className="surface-copy">{description}</p>
          </div>
          {selectedModel ? (
            <div className="selected-model-hero">
              <div className="selected-model-label">Сейчас выбрано</div>
              <strong>{selectedModel.name}</strong>
              <span>{selectedModel.summary}</span>
            </div>
          ) : null}
        </div>

        <div className="model-tab-row" role="tablist" aria-label="Категории моделей">
          {modelPickerTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? "chip chip-active" : "chip"}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="model-tab-summary">
          <span className="icon-badge">
            <AppIcon name={familyIcon(activeTab.key)} size={16} />
          </span>
          <h3 className="surface-title">{title}</h3>
          <p className="surface-copy">{activeTab.summary}</p>
        </div>

        <div className="model-grid">
          {(visible.length ? visible : fallback).map((model) => (
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
              {model.provider ? <div className="model-card-provider">{model.provider}</div> : null}
            </button>
          ))}
        </div>

        {!visible.length && fallback.length ? (
          <div className="muted-text">В этой вкладке пока нет отдельной модели, поэтому показаны ближайшие доступные варианты.</div>
        ) : null}
        {!visible.length && !fallback.length ? (
          <div className="muted-text">Сейчас в вашем тарифе нет доступных моделей для этого сценария.</div>
        ) : null}
      </div>
    </section>
  );
}
