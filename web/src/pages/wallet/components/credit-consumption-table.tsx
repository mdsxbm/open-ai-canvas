import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";

/**
 * 积分消耗价目表（spec §3.9.2）：公开区间价，只做透明展示，
 * 实际扣费以任务详情的渠道单价为准，不在此处写死结算逻辑。
 */
type ConsumptionRow = {
    key: string;
    capability: string;
    spec: string;
    cost: string;
    note: string;
};

const CONSUMPTION_ROWS: ConsumptionRow[] = [
    { key: "text", capability: "文本生成", spec: "每 1k token", cost: "0.1 – 0.5 积分", note: "按模型档位与上下文长度浮动" },
    { key: "t2i", capability: "文生图", spec: "1024×1024 · 每张", cost: "1 – 3 积分", note: "不同模型档位略有差异" },
    { key: "i2i", capability: "图生图（带参考）", spec: "1024×1024 · 每张", cost: "2 – 5 积分", note: "参考图越多消耗越高" },
    { key: "video-720", capability: "视频生成", spec: "720p · 5 秒", cost: "15 – 30 积分 / 段", note: "时长按秒线性累计" },
    { key: "video-1080", capability: "视频生成", spec: "1080p · 5 秒", cost: "30 – 60 积分 / 段", note: "更高分辨率以任务详情报价为准" },
    { key: "tts", capability: "TTS 对白", spec: "每分钟", cost: "0.3 – 1 积分", note: "定制克隆音色略有上浮" },
    { key: "redraw", capability: "真人转绘", spec: "30 秒内 · 每条", cost: "约 200 – 350 积分", note: "Beta 期折扣价" },
    { key: "protagonist", capability: "主角模式预检", spec: "每次批量生成前", cost: "0 积分", note: "健康度检查不消耗积分" },
];

const COLUMNS: ColumnsType<ConsumptionRow> = [
    { title: "能力", dataIndex: "capability", width: 170 },
    { title: "规格", dataIndex: "spec", width: 170 },
    { title: "消耗积分", dataIndex: "cost", width: 160, render: (value: string) => <span className="font-medium tabular-nums">{value}</span> },
    { title: "备注", dataIndex: "note", ellipsis: true },
];

export function CreditConsumptionTable() {
    return (
        <div data-testid="credit-consumption-table">
            <div className="mb-3 flex flex-col gap-1">
                <h3 className="text-base font-semibold">积分消耗价目表</h3>
                <p className="m-0 text-xs leading-5 text-foreground/55">以下为公开区间价，帮助你在开拍前预估消耗；实际扣费以每次任务确认页的渠道单价为准。</p>
            </div>
            <Table<ConsumptionRow>
                className="app-data-table"
                rowKey="key"
                size="middle"
                columns={COLUMNS}
                dataSource={CONSUMPTION_ROWS}
                pagination={false}
            />
        </div>
    );
}
