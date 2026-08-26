import { useState } from "react";
import { App, Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { Clapperboard, Download, FileText, Package, ScrollText, ShieldCheck } from "lucide-react";

import { UpgradeModal } from "@/components/entitlements/upgrade-modal";

// 项目导出下拉菜单（spec Task 14 / §3.8）
//
// 5 项导出：前 2 项免费（画布数据 / 分镜脚本），后 3 项为 Studio 档专享，
// 点击弹出「Studio 版专享」升级引导（TR-14-01/02）。
// 一期无真实订阅系统：所有用户按免费档处理，Studio 项恒为锁定态；
// 二期接入订阅后按用户 plan 判断解锁。

export type ExportMenuItem = {
    key: string;
    label: string;
    icon: React.ReactNode;
    studio: boolean;
};

const EXPORT_ITEMS: ExportMenuItem[] = [
    { key: "canvas-data", label: "导出画布数据（JSON）", icon: <Download className="size-3.5" />, studio: false },
    { key: "storyboard", label: "导出分镜脚本（文本）", icon: <FileText className="size-3.5" />, studio: false },
    { key: "hd-watermark-free", label: "4K 无水印成片导出", icon: <Clapperboard className="size-3.5" />, studio: true },
    { key: "delivery-package", label: "成片打包交付（多镜头合辑）", icon: <Package className="size-3.5" />, studio: true },
    { key: "copyright-report", label: "剧本版权存证报告", icon: <ScrollText className="size-3.5" />, studio: true },
];

export function ProjectExportMenu({ projectName, onExportCanvasData, onExportStoryboard }: {
    projectName: string;
    onExportCanvasData: () => void;
    onExportStoryboard: () => void;
}) {
    const { message } = App.useApp();
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    // 一期所有用户视为免费档；二期接入订阅后读取用户 plan 替换。
    const hasStudioEntitlement = false;

    const menuItems: MenuProps["items"] = EXPORT_ITEMS.map((item) => {
        const locked = item.studio && !hasStudioEntitlement;
        return {
            key: item.key,
            // aria-disabled 表达锁定态（TR-14-01：第 3/4/5 项含锁标识）。
            "aria-disabled": locked || undefined,
            label: (
                <span className={`flex items-center gap-2 ${locked ? "text-foreground/45" : ""}`}>
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {locked ? <ShieldCheck className="size-3.5 text-amber-500" aria-label="Studio 版专享" /> : null}
                </span>
            ),
        };
    });

    const onMenuClick: MenuProps["onClick"] = ({ key }) => {
        const item = EXPORT_ITEMS.find((entry) => entry.key === key);
        if (!item) return;
        if (item.studio && !hasStudioEntitlement) {
            setUpgradeOpen(true);
            return;
        }
        if (key === "canvas-data") onExportCanvasData();
        else if (key === "storyboard") onExportStoryboard();
        else message.info(`「${item.label}」将在权益解锁后开放`);
    };

    return (
        <>
            <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items: menuItems, onClick: onMenuClick }} data-testid="project-export-menu">
                <Button size="small" className="!h-9 !shrink-0 !px-2 sm:!px-3" icon={<Download className="size-4" />} aria-label={`导出 ${projectName}`}>
                    <span className="hidden sm:inline">导出</span>
                </Button>
            </Dropdown>
            <UpgradeModal
                open={upgradeOpen}
                onClose={() => setUpgradeOpen(false)}
                title="Studio 版专享"
                feature="高级导出能力"
                benefits={["4K 无水印成片导出，交付级画质", "多镜头成片打包交付，一键输出合辑", "剧本版权存证报告，保护原创权益"]}
            />
        </>
    );
}

export default ProjectExportMenu;
