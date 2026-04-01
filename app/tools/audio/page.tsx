import { WorkspacePlaceholder } from "@/components/app/workspace-placeholder";

export default function AudioToolPage() {
  return (
    <WorkspacePlaceholder
      badge="Audio"
      title="Аудио и озвучка"
      description="Здесь будет вынесен audio pipeline: transcription, TTS, voice work и сохранение артефактов в документы или проект."
      actions={[{ href: "/chat", label: "Открыть чат", primary: true }]}
    />
  );
}
