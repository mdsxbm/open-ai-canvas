import { type ReactNode } from "react";
import { Clapperboard, Film, Image as ImageIcon, Images, LayoutGrid, Music2 } from "lucide-react";
import { useNavigate } from "react-router";

import { resourceFileUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import { CanvasNodeType } from "@/types/canvas";
import { resolveBackendApiUrl } from "@/stores/use-config-store";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

// 作品画廊共享模块：home 首屏氛围区与 flow 投拍页首屏画廊复用，
// 借鉴 neodomain.cn 的"作品广场"语言——分类导航 + 大图网格 + 真实画布缩略图。
// 抽到本文件避免两个页面各维护一份分类/封面/卡片逻辑（AGENTS.md 第 2 条）。

export type GalleryCategory = "all" | "film" | "image" | "audio" | "script";

export const CATEGORY_RAILS: { key: GalleryCategory; label: string; icon: ReactNode }[] = [
    { key: "all", label: "全部", icon: <LayoutGrid className="size-3.5" /> },
    { key: "film", label: "影片", icon: <Film className="size-3.5" /> },
    { key: "image", label: "画作", icon: <ImageIcon className="size-3.5" /> },
    { key: "audio", label: "音频", icon: <Music2 className="size-3.5" /> },
    { key: "script", label: "脚本", icon: <Clapperboard className="size-3.5" /> },
];

// 按画布主导节点类型分类，作为画廊筛选维度（画布无项目 sourceType，用节点类型更贴切）
export function classifyCanvas(project: CanvasProject): Exclude<GalleryCategory, "all"> {
    const types = new Set(project.nodes.map((node) => node.type));
    if (types.has(CanvasNodeType.Video)) return "film";
    if (types.has(CanvasNodeType.Image)) return "image";
    if (types.has(CanvasNodeType.Audio)) return "audio";
    return "script";
}

// 取画布第一张图片节点作为画廊封面，复用资源存储合同（resource:<id> 与后端 URL 解析）
export function getCanvasCoverUrl(project: CanvasProject): string | null {
    const imageNode = project.nodes.find((node) => node.type === CanvasNodeType.Image);
    if (!imageNode) return null;
    const resourceId = resourceIdFromStorageKey(imageNode.metadata?.storageKey);
    if (resourceId) return resourceFileUrl(resourceId);
    const content = imageNode.metadata?.content;
    if (content && /^(https?:|blob:|data:image\/|\/api\/)/.test(content)) return resolveBackendApiUrl(content);
    return null;
}

export function formatRelativeTime(value: string) {
    const diffMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
    const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
    if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");
    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffDays) < 30) return formatter.format(diffDays, "day");
    return new Date(value).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

// 画廊卡片：封面 + 分类标签 + 标题 + 节点数/更新时间，点击进入画布编辑
export function GalleryCard({ project }: { project: CanvasProject }) {
    const navigate = useNavigate();
    const cover = getCanvasCoverUrl(project);
    const ownCategory = classifyCanvas(project);
    const label = CATEGORY_RAILS.find((item) => item.key === ownCategory)?.label ?? "作品";
    return (
        <article className="app-home-gallery-card group" onClick={() => navigate(`/canvas/${project.id}`)}>
            <div className="app-home-gallery-cover">
                {cover ? (
                    <img src={cover} alt={project.title} loading="lazy" decoding="async" className="app-home-gallery-image" />
                ) : (
                    <div className="app-home-gallery-cover-empty"><Images className="size-6" /><span>空白画布</span></div>
                )}
                <span className="app-home-gallery-tag">{label}</span>
            </div>
            <div className="app-home-gallery-meta">
                <h3 className="app-home-gallery-title">{project.title}</h3>
                <span className="app-home-gallery-info">{project.nodes.length} 节点 · {formatRelativeTime(project.updatedAt)}</span>
            </div>
        </article>
    );
}
