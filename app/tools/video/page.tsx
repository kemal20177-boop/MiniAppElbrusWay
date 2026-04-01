import { WorkspacePlaceholder } from "@/components/app/workspace-placeholder";

export default function VideoToolPage() {
  return (
    <WorkspacePlaceholder
      badge="Video"
      title="Генерация видео"
      description="Выделенный маршрут под video generation, storyboard и дальнейший экспорт результатов в проектное пространство."
      actions={[{ href: "/chat", label: "Открыть чат", primary: true }]}
    />
  );
}
