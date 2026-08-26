// 幕山投拍向导模板 mock（Task 07）：仅用于 /flow 页模板投拍 Tab 占位，后续接入后端模板接口后替换。
export interface FlowTemplate {
    slug: string;
    name: string;
    category: string;
    description: string;
    projectSeed: {
        name: string;
        chapters: number;
        characters: number;
    };
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
    {
        slug: "urban-rebirth",
        name: "都市重生：归来的他",
        category: "都市爽文",
        description: "雨夜归来，旧楼已被霓虹重新涂色，他从一辆出租车上下来，皮鞋踏碎了十年前的水洼。",
        projectSeed: { name: "都市重生：归来的他", chapters: 12, characters: 6 },
    },
    {
        slug: "ancient-romance",
        name: "锦绣良缘：一舞倾心",
        category: "古风言情",
        description: "灯影浮沉，她从长廊尽头转身，一段水袖落进鼓点，整座京城忽然安静下来。",
        projectSeed: { name: "锦绣良缘：一舞倾心", chapters: 10, characters: 5 },
    },
    {
        slug: "cyberpunk-mystery",
        name: "霓虹密室：消失的代码",
        category: "赛博朋克悬疑",
        description: "黑客在凌晨三点敲下回车，监控里的女孩朝镜头笑了一下，然后从七十二层跃入代码海。",
        projectSeed: { name: "霓虹密室：消失的代码", chapters: 8, characters: 4 },
    },
    {
        slug: "xianxia-cultivation",
        name: "剑起苍穹：凡尘逆旅",
        category: "玄幻修真",
        description: "剑宗弟子下山那日，云海翻涌，他握着师父留下的半截断剑，第一次看见凡尘的烟火。",
        projectSeed: { name: "剑起苍穹：凡尘逆旅", chapters: 14, characters: 7 },
    },
    {
        slug: "doomsday-survival",
        name: "最后信号：废土之上",
        category: "末日生存",
        description: "信号塔倒下的第七十一天，他用最后一节电池录了一段音频，希望有人还在收听。",
        projectSeed: { name: "最后信号：废土之上", chapters: 9, characters: 3 },
    },
    {
        slug: "campus-youth",
        name: "那年盛夏：未寄出的信",
        category: "校园青春",
        description: "毕业前最后一节课，他写完了那封信，却把它夹进了归还图书馆的旧书里。",
        projectSeed: { name: "那年盛夏：未寄出的信", chapters: 6, characters: 4 },
    },
];
