import "server-only";

export type RouterPluginName = "web" | "file-parser";

export function buildRouterPlugins(params: { web?: boolean; fileParser?: boolean }) {
  const plugins: Array<{ id: string }> = [];
  if (params.web) plugins.push({ id: "web" });
  if (params.fileParser) plugins.push({ id: "file-parser" });
  return plugins;
}
