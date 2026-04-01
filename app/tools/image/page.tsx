import { WorkspacePlaceholder } from "@/components/app/workspace-placeholder";

export default function ImageToolPage() {
  return (
    <WorkspacePlaceholder
      badge="Image"
      title="Генерация изображений"
      description="Отдельный режим под image generation и image-to-image сценарии. Пока это базовый маршрут в общей IA продукта."
      actions={[{ href: "/chat", label: "Открыть чат", primary: true }]}
    />
  );
}
