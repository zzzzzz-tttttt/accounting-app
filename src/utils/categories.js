// 分类体系
export const CATEGORIES = {
  "吃喝": {
    emoji: "🍽",
    tags: ["餐饮", "水果零食", "买菜", "烟酒"]
  },
  "购物消费": {
    emoji: "🛍",
    tags: ["购物", "穿搭美容", "生活日用", "家居家电"]
  },
  "出行交通": {
    emoji: "🚌",
    tags: ["交通", "爱车", "酒店旅行"]
  },
  "休闲娱乐": {
    emoji: "🎮",
    tags: ["休闲娱乐", "网络虚拟", "运动"]
  },
  "居住生活": {
    emoji: "🏠",
    tags: ["住房", "生活服务"]
  },
  "家庭人际": {
    emoji: "👨‍👩‍👧",
    tags: ["养娃", "宠物", "人情社交", "发红包"]
  },
  "成长提升": {
    emoji: "📚",
    tags: ["学习教育", "医疗保健"]
  },
  "金融财务": {
    emoji: "💰",
    tags: ["金融保险", "转账", "互助保障"]
  },
  "公益其他": {
    emoji: "❤️",
    tags: ["公益", "其他"]
  }
}

// 收入分类
export const INCOME_CATEGORIES = {
  "收入": {
    emoji: "💵",
    tags: ["工资薪资", "奖金", "兼职收入", "投资收益", "其他收入"]
  }
}

// 根据标签找所属大类
export function getSuperCategory(tag) {
  for (const [superCat, data] of Object.entries(CATEGORIES)) {
    if (data.tags.includes(tag)) return { name: superCat, emoji: data.emoji }
  }
  for (const [superCat, data] of Object.entries(INCOME_CATEGORIES)) {
    if (data.tags.includes(tag)) return { name: superCat, emoji: data.emoji }
  }
  return { name: "其他", emoji: "📌" }
}

export function getCategoryEmoji(superCatName) {
  return CATEGORIES[superCatName]?.emoji || INCOME_CATEGORIES[superCatName]?.emoji || "📌"
}
