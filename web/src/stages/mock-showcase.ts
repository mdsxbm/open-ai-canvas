// 幕山首映 Showcase 作品 mock（Task 08）：仅用于 /stage 公开页作品墙占位，
// 后续接入后端作品接口后替换。每条作品的 process 必须固定 5 段，
// 顺序为 剧本 → 角色 → 分镜 → 精渲 → 合成。
export interface ShowcaseProcessStep {
    stage: string;      // 阶段名（剧本/角色/分镜/精渲/合成）
    title: string;      // 该阶段产出标题
    duration: string;   // 用时，如 "2 分 30 秒"
    note?: string;      // 一句话说明
}

export interface ShowcaseWork {
    id: string;
    title: string;      // 作品名
    category: "剧本驱动" | "画面驱动" | "风格转绘";
    duration: string;   // 如 "1 分 12 秒"
    author: string;
    coverSlug: string;  // 占位封面用
    finalVideoUrl?: string;
    process: ShowcaseProcessStep[]; // 固定 5 段：剧本/角色/分镜/精渲/合成
}

export const SHOWCASE_WORKS: ShowcaseWork[] = [
    // —— 剧本驱动（都市爽文）4 条 ——
    {
        id: "urban-return-rainy-night",
        title: "归来的他：第十年的雨夜",
        category: "剧本驱动",
        duration: "1 分 28 秒",
        author: "林之夏",
        coverSlug: "urban-return",
        process: [
            { stage: "剧本", title: "拆解「归来 → 重逢 → 反杀」三幕节奏", duration: "2 分 30 秒", note: "保留爽点密度，每 15 秒一个钩子" },
            { stage: "角色", title: "生成男主十年前后一致性参考", duration: "1 分 50 秒", note: "锁定眉骨疤痕与旧皮衣" },
            { stage: "分镜", title: "规划雨夜中景与霓虹特写", duration: "3 分 10 秒", note: "8 段运镜，含一个慢推" },
            { stage: "精渲", title: "高清渲染出租车下车关键帧", duration: "2 分 20 秒", note: "1080p，雨丝方向统一" },
            { stage: "合成", title: "拼接成片 + 雨声与电子琴配乐", duration: "1 分 40 秒", note: "成片 1 分 28 秒" },
        ],
    },
    {
        id: "urban-hidden-tycoon",
        title: "隐形富豪：租来的总裁",
        category: "剧本驱动",
        duration: "1 分 12 秒",
        author: "沈页",
        coverSlug: "urban-tycoon",
        process: [
            { stage: "剧本", title: "拆解「伪装 → 露富 → 反转」节奏", duration: "2 分 10 秒", note: "三段钩子，反转前置一帧" },
            { stage: "角色", title: "生成总裁与替身双主角一致性", duration: "1 分 40 秒", note: "双身份共享同一张脸" },
            { stage: "分镜", title: "规划办公室对峙与天台揭穿", duration: "2 分 50 秒", note: "7 段运镜，仰俯切换" },
            { stage: "精渲", title: "高清渲染合同签字手部特写", duration: "2 分 0 秒", note: "笔尖墨迹细节" },
            { stage: "合成", title: "拼接成片 + 城市夜景配乐", duration: "1 分 30 秒", note: "成片 1 分 12 秒" },
        ],
    },
    {
        id: "urban-rebirth-heiress",
        title: "重生千金：旧账新算",
        category: "剧本驱动",
        duration: "1 分 05 秒",
        author: "苏简",
        coverSlug: "urban-heiress",
        process: [
            { stage: "剧本", title: "拆解重生时间线与复仇节点", duration: "2 分 20 秒", note: "闪回与现实双线交叉" },
            { stage: "角色", title: "生成女主前世今生双形态参考", duration: "1 分 30 秒", note: "妆造差异锁一致性" },
            { stage: "分镜", title: "规划宴会厅长镜头与闪回", duration: "3 分 0 秒", note: "单镜 12 秒不切" },
            { stage: "精渲", title: "高清渲染酒杯落地慢镜", duration: "1 分 50 秒", note: "液体飞溅物理感" },
            { stage: "合成", title: "拼接成片 + 弦乐与钟声配乐", duration: "1 分 20 秒", note: "成片 1 分 05 秒" },
        ],
    },
    {
        id: "urban-comeback-idol",
        title: "顶流退役：归来仍是少年",
        category: "剧本驱动",
        duration: "1 分 18 秒",
        author: "陈也",
        coverSlug: "urban-idol",
        process: [
            { stage: "剧本", title: "拆解「退场 → 蛰伏 → 重登台」节奏", duration: "2 分 40 秒", note: "情绪弧线收束于聚光灯亮" },
            { stage: "角色", title: "生成主角少年与十年后参考", duration: "1 分 45 秒", note: "眼神与下颌线渐变" },
            { stage: "分镜", title: "规划舞台聚光灯与后排暗角", duration: "2 分 30 秒", note: "光位与机位同步" },
            { stage: "精渲", title: "高清渲染开场追光关键帧", duration: "2 分 10 秒", note: "体积光雾感" },
            { stage: "合成", title: "拼接成片 + 钢琴与合成器配乐", duration: "1 分 35 秒", note: "成片 1 分 18 秒" },
        ],
    },
    // —— 画面驱动（古风言情）4 条 ——
    {
        id: "ancient-dance-fate",
        title: "锦绣良缘：一舞倾心",
        category: "画面驱动",
        duration: "1 分 32 秒",
        author: "顾宛",
        coverSlug: "ancient-dance",
        process: [
            { stage: "剧本", title: "拆解长廊转身的瞬间叙事", duration: "2 分 0 秒", note: "以一舞串起三场情绪" },
            { stage: "角色", title: "生成女主水袖与发髻一致性", duration: "1 分 50 秒", note: "服饰纹样锁四套" },
            { stage: "分镜", title: "规划灯影浮沉的长镜头", duration: "3 分 20 秒", note: "单镜 8 段不切" },
            { stage: "精渲", title: "高清渲染水袖落鼓的关键帧", duration: "2 分 30 秒", note: "布料解算二次细化" },
            { stage: "合成", title: "拼接成片 + 古筝与鼓点配乐", duration: "1 分 50 秒", note: "成片 1 分 32 秒" },
        ],
    },
    {
        id: "ancient-moonlight-general",
        title: "长安月下：将门嫡女",
        category: "画面驱动",
        duration: "1 分 24 秒",
        author: "沈砚",
        coverSlug: "ancient-moon",
        process: [
            { stage: "剧本", title: "拆解月下独行的情感弧线", duration: "1 分 50 秒", note: "无对白，纯画面推进" },
            { stage: "角色", title: "生成女主铠甲与常服双形态", duration: "1 分 40 秒", note: "甲片与发带一致性" },
            { stage: "分镜", title: "规划长安街景的横移长镜", duration: "3 分 0 秒", note: "横移 15 秒一镜" },
            { stage: "精渲", title: "高清渲染月光洒肩关键帧", duration: "2 分 20 秒", note: "冷月光与暖灯影对比" },
            { stage: "合成", title: "拼接成片 + 笛与箫配乐", duration: "1 分 30 秒", note: "成片 1 分 24 秒" },
        ],
    },
    {
        id: "ancient-jiangnan-rain",
        title: "江南烟雨：白衣公子",
        category: "画面驱动",
        duration: "1 分 09 秒",
        author: "江临",
        coverSlug: "ancient-rain",
        process: [
            { stage: "剧本", title: "拆解油纸伞下的偶遇节奏", duration: "1 分 40 秒", note: "两人视线只交一次" },
            { stage: "角色", title: "生成主角白衣与折扇一致性", duration: "1 分 30 秒", note: "衣摆飘动方向统一" },
            { stage: "分镜", title: "规划石桥烟雨的固定镜", duration: "2 分 50 秒", note: "固定机位 + 烟雾流动" },
            { stage: "精渲", title: "高清渲染伞沿滴水关键帧", duration: "2 分 0 秒", note: "水滴折射高光" },
            { stage: "合成", title: "拼接成片 + 古琴与雨声配乐", duration: "1 分 20 秒", note: "成片 1 分 09 秒" },
        ],
    },
    {
        id: "ancient-north-snow-sword",
        title: "北境风雪：孤城一剑",
        category: "画面驱动",
        duration: "1 分 41 秒",
        author: "越北",
        coverSlug: "ancient-snow",
        process: [
            { stage: "剧本", title: "拆解孤城守夜的张力曲线", duration: "2 分 10 秒", note: "雪声压住对白" },
            { stage: "角色", title: "生成主角披风与长剑参考", duration: "1 分 45 秒", note: "剑鞘纹与披风毛边" },
            { stage: "分镜", title: "规划风雪城墙的远景到特写", duration: "3 分 10 秒", note: "远景 6 段 + 特写 4 段" },
            { stage: "精渲", title: "高清渲染剑出鞘雪花关键帧", duration: "2 分 40 秒", note: "雪花被剑风带起" },
            { stage: "合成", title: "拼接成片 + 埙与风声配乐", duration: "1 分 50 秒", note: "成片 1 分 41 秒" },
        ],
    },
    // —— 风格转绘 2 条 ——
    {
        id: "style-oil-mountain-mist",
        title: "油画风：山雾低诉",
        category: "风格转绘",
        duration: "48 秒",
        author: "阿涂",
        coverSlug: "style-oil",
        process: [
            { stage: "剧本", title: "拆解山雾叙事的留白节奏", duration: "1 分 30 秒", note: "无对白，靠雾流动推进" },
            { stage: "角色", title: "生成山雾中的人影轮廓参考", duration: "1 分 10 秒", note: "只露剪影，无正脸" },
            { stage: "分镜", title: "规划远景缓推与定格", duration: "2 分 20 秒", note: "缓推 8 秒 + 定格 4 秒" },
            { stage: "精渲", title: "高清渲染油画笔触关键帧", duration: "2 分 30 秒", note: "油画风格转绘，笔触方向一致" },
            { stage: "合成", title: "拼接成片 + 大提琴配乐", duration: "1 分 0 秒", note: "成片 48 秒" },
        ],
    },
    {
        id: "style-ink-rural-return",
        title: "水墨意：归园田居",
        category: "风格转绘",
        duration: "52 秒",
        author: "墨白",
        coverSlug: "style-ink",
        process: [
            { stage: "剧本", title: "拆解归园田居的诗意节拍", duration: "1 分 40 秒", note: "三段留白对应晨午暮" },
            { stage: "角色", title: "生成农夫与茅屋的墨色参考", duration: "1 分 0 秒", note: "浓淡墨分层五级" },
            { stage: "分镜", title: "规划田园横移与近景特写", duration: "2 分 10 秒", note: "横移 + 两处特写" },
            { stage: "精渲", title: "高清渲染水墨晕染关键帧", duration: "2 分 20 秒", note: "水墨风格转绘，边缘渗化" },
            { stage: "合成", title: "拼接成片 + 古琴配乐", duration: "1 分 10 秒", note: "成片 52 秒" },
        ],
    },
];
