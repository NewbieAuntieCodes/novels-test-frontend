import type { TagTemplate } from '../../types';

// Define the templates here.
export const tagTemplates: TagTemplate[] = [
  {
    genre: "修仙小说",
    tags: [
      // --- Characters ---
      { name: "角色", color: '#FFADAD' },
        // Lu Yang (Protagonist)
        { name: "陆阳", color: '#FF5959', parentName: "角色" },
        { name: "性格-陆阳", color: '#FF9A9A', parentName: "陆阳" },
        { name: "谨慎", color: '#FFC1C1', parentName: "性格-陆阳" },
        { name: "果断", color: '#FFC1C1', parentName: "性格-陆阳" },
        // Meng Jingzhou (Friend)
        { name: "孟景舟", color: '#FFB86C', parentName: "角色" },
        { name: "性格-孟景舟", color: '#FFD6A5', parentName: "孟景舟" },
        { name: "憨直", color: '#FFE6C4', parentName: "性格-孟景舟" },
        { name: "自信", color: '#FFE6C4', parentName: "性格-孟景舟" },
        { name: "乐观爽朗", color: '#FFE6C4', parentName: "性格-孟景舟" },
        // Yun Zhi (Master Sister)
        { name: "云芝", color: '#A0C4FF', parentName: "角色" },
        { name: "身份-云芝", color: '#BDB2FF', parentName: "云芝" },
        { name: "考官", color: '#D8D2FF', parentName: "身份-云芝" },
        { name: "问道宗大师姐", color: '#D8D2FF', parentName: "身份-云芝" },

      // --- World-Building ---
      { name: "世界观", color: '#FDFFB6' },
        { name: "物件", color: '#FFFECB', parentName: "世界观" },
        { name: "异宝", color: '#FFFFE0', parentName: "物件" },
        { name: "载具", color: '#F5F5DC', parentName: "异宝" },
        { name: "马车", color: '#F0E68C', parentName: "载具" },
        { name: "势力", color: '#9BF6FF', parentName: "世界观" },
        { name: "仙门", color: '#B3FDFF', parentName: "势力" },
        { name: "五大仙门", color: '#D0FFFF', parentName: "仙门" },
        { name: "问道宗", color: '#E0FFFF', parentName: "五大仙门" },
        { name: "收徒条件", color: '#ADD8E6', parentName: "问道宗" },
        { name: "山门", color: '#AFEEEE', parentName: "问道宗" },

      // --- Writing Technique ---
      { name: "写作手法", color: '#94E5D1' },
      { name: "幽默/搞笑", color: '#B3EAD5', parentName: "写作手法" },
    ]
  },
  {
    genre: "都市高武",
    tags: [
      // Top Level
      { name: "人物", color: '#FFADAD' },
      { name: "设定", color: '#FDFFB6' },
      { name: "情节", color: '#9BF6FF' },
      { name: "情感", color: '#A0C4FF' },

      // Children of 人物
      { name: "主角", color: '#FFD6A5', parentName: '人物' },
      { name: "配角", color: '#FFD6A5', parentName: '人物' },
      { name: "反派", color: '#FFD6A5', parentName: '人物' },
      { name: "路人", color: '#FFD6A5', parentName: '人物' },

      // Children of 设定
      { name: "功法/技能", color: '#CAFFBF', parentName: '设定' },
      { name: "境界/等级", color: '#CAFFBF', parentName: '设定' },
      { name: "势力/组织", color: '#CAFFBF', parentName: '设定' },
      { name: "物品/法宝", color: '#CAFFBF', parentName: '设定' },
      { name: "世界观", color: '#CAFFBF', parentName: '设定' },

      // Children of 情节
      { name: "冲突/战斗", color: '#BDB2FF', parentName: '情节' },
      { name: "伏笔", color: '#BDB2FF', parentName: '情节' },
      { name: "转折", color: '#BDB2FF', parentName: '情节' },
      { name: "对话", color: '#BDB2FF', parentName: '情节' },

      // Children of 情感
      { name: "亲情", color: '#FFC6FF', parentName: '情感' },
      { name: "友情", color: '#FFC6FF', parentName: '情感' },
      { name: "爱情", color: '#FFC6FF', parentName: '情感' },
    ]
  },
  {
    genre: "东方玄幻",
    tags: [
        { name: "角色", color: '#FFADAD' },
        { name: "世界", color: '#FDFFB6' },
        { name: "剧情", color: '#9BF6FF' },
        { name: "核心", color: '#A0C4FF' },

        { name: "主角", color: '#FFD6A5', parentName: '角色' },
        { name: "重要配角", color: '#FFD6A5', parentName: '角色' },
        { name: "反派角色", color: '#FFD6A5', parentName: '角色' },

        { name: "修炼体系", color: '#CAFFBF', parentName: '世界' },
        { name: "宗门/家族", color: '#CAFFBF', parentName: '世界' },
        { name: "法宝/丹药", color: '#CAFFBF', parentName: '世界' },
        { name: "地域/秘境", color: '#CAFFBF', parentName: '世界' },

        { name: "主线", color: '#BDB2FF', parentName: '剧情' },
        { name: "支线", color: '#BDB2FF', parentName: '剧情' },
        { name: "高潮", color: '#BDB2FF', parentName: '剧情' },
        
        { name: "金手指", color: '#FFC6FF', parentName: '核心' },
        { name: "爽点", color: '#FFC6FF', parentName: '核心' },
        { name: "毒点", color: '#FFC6FF', parentName: '核心' },
    ]
  },
];