# 首页三个 UI 问题修复

项目路径：/mnt/c/Users/liu/Desktop/claude/MoonTV-main
构建命令：node scripts/convert-config.js && pnpm build
不要执行 pnpm build（npm registry 代理问题），只修改代码即可，Hermes 会负责构建。

## 问题 1：热门短剧内容不是真正短剧

当前代码（src/app/page.tsx 约第 88 行）：

```
getDoubanRecommends({ kind: 'tv', format: '短剧' }),
```

豆瓣 API `format=短剧` 返回了大量非短剧内容（9 号秘事是英剧、酒鬼都市女人们是韩剧、疯狂动物城+是动画电影等），筛选效果很差。

**解决方案**：改为同时传入 `category: '国产'` 和 `format: '短剧'`，这样筛选更精准，只返回国产短剧（古相思曲、万万没想到、屌丝男士等）。

具体修改：

- `src/app/page.tsx` 中的 `getDoubanRecommends({ kind: 'tv', format: '短剧' })` 改为 `getDoubanRecommends({ kind: 'tv', format: '短剧', category: '国产' })`

## 问题 2：新番放送封面图模糊

当前代码（src/app/page.tsx 约第 461 行）：

```
poster={show.images?.common || ''}
```

Bangumi API 返回的图片尺寸：

- `common` (c/路径) — 中等尺寸，偏模糊
- `large` (l/路径) — 大图，高清
- `medium` (m/路径) — 小图
- `grid` (g/路径) — 网格尺寸

**解决方案**：将 `show.images?.common` 改为 `show.images?.large`，使用高清封面。

具体修改：

- `src/app/page.tsx` 中的 `poster={show.images?.common || ''}` 改为 `poster={show.images?.large || show.images?.common || ''}`

## 问题 3：热门短剧应放在新番放送下面

当前页面板块顺序：

1. 热门电影
2. 热门剧集
3. 热门综艺
4. **热门短剧** ← 在这里
5. **新番放送** ← 在这里

用户要求的顺序：

1. 热门电影
2. 热门剧集
3. 热门综艺
4. **新番放送** ← 先这个
5. **热门短剧** ← 再这个

具体修改：

- 在 `src/app/page.tsx` 中，将"新番放送"的整个 section（约 425-465 行）移到"热门短剧"的 section（约 379-420 行）之前，即交换两个 section 的位置。
