# MoonTV 短剧功能实现计划

## 目标

为 MoonTV 添加基于苹果 CMS 采集源的"热门短剧"功能，替换当前依赖豆瓣 API 的短剧板块。

## 背景

### 现状问题

1. 首页"热门短剧"板块用的是豆瓣 API (getDoubanRecommends, format=短剧)，只返回条目信息（封面+评分），没有播放链接
2. 点击短剧卡片进入豆瓣模式，还需搜索采集源才能播放，体验割裂
3. 侧边栏"短剧"入口链到 /douban?type=tv&category=tv&tag=短剧，同样没有直接播放

### 实测数据

9 个采集源有短剧分类：

- **旺旺短剧 (wwzy)** — 纯短剧源，3.3 万部，typeId=1
- **无尽 (wujin)** — typeId=41 短剧, typeId=62 擦边短剧
- **量子 (lzi)** — typeId=46 短剧
- **U 酷 (ukuapi88)** — typeId=32 短剧
- **最大 (zuid)** — typeId=54 爽文短剧, typeId=73 擦边短剧
- **豆瓣 (dbzy)** — typeId=37 短剧大全
- **魔都 (mdzy)** — typeId=38 短剧
- **iKun (ikun)** — typeId=45 爽文短剧
- **极速 (jisu)** — typeId=38 短剧

### 参考项目

MoonTVPlus (https://github.com/mtvpls/MoonTVPlus) 已实现此功能，代码在：

- `/mnt/c/Users/liu/Desktop/hermes/MoonTVPlus/src/lib/duanju.ts` — 核心源扫描+缓存逻辑
- `/mnt/c/Users/liu/Desktop/hermes/MoonTVPlus/src/app/api/duanju/` — 4 个 API 路由
- `/mnt/c/Users/liu/Desktop/hermes/MoonTVPlus/src/app/duanju/page.tsx` — 前端页面

## 实现方案

### 文件清单

#### 新增文件

1. **src/lib/duanju.ts** — 短剧源扫描与数据获取逻辑
2. **src/app/api/duanju/sources/route.ts** — 返回有短剧分类的采集源列表
3. **src/app/api/duanju/categories/route.ts** — 获取某源的短剧子分类
4. **src/app/api/duanju/videos/route.ts** — 按分类分页获取短剧视频列表
5. **src/app/api/duanju/recommends/route.ts** — 首页热播推荐（取第一个源第一页）
6. **src/app/duanju/page.tsx** — 短剧专属浏览页面

#### 修改文件

7. **src/app/page.tsx** — 首页"热门短剧"板块从豆瓣 API 切换到 duanju/recommends API
8. **src/components/sidebar/** — 侧边栏"短剧"入口从 /douban 改为 /duanju

### 核心逻辑设计

#### duanju.ts - 源扫描

```typescript
// 关键接口
interface DuanjuSource {
  key: string; // 源标识，如 'wwzy'
  name: string; // 源名称，如 '旺旺短剧'
  api: string; // 源API地址
  categories: Array<{
    type_id: number; // 分类ID
    type_name: string; // 分类名称
  }>;
}

interface DuanjuVideo {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks: string; // 如 "全62集"
  type_name: string;
  vod_year?: string;
  vod_play_url?: string; // 播放链接（详细接口才有）
}

// 核心函数
async function scanDuanjuSources(): Promise<DuanjuSource[]>;
// 遍历 getConfig().SourceConfig，请求 ?ac=list
// 筛选 class 中含 "短剧"/"微短剧" 的分类
// 返回有短剧分类的源列表
// 结果缓存在内存中，TTL=1小时

async function getDuanjuCategories(
  sourceKey: string
): Promise<Array<{ type_id; type_name }>>;
// 返回指定源的短剧分类列表

async function getDuanjuVideos(
  sourceKey: string,
  typeId: number,
  page: number
): Promise<{ list; total; pagecount }>;
// 请求 ?ac=videolist&t=typeId&pg=page
// 返回视频列表

async function getDuanjuRecommends(): Promise<DuanjuVideo[]>;
// 取第一个源第一页前20条
// 内存缓存1小时
```

#### 缓存策略

- **无 DB getGlobalValue 方法**，改用内存缓存（Map + TTL）
- 源扫描结果缓存 1 小时
- 推荐结果缓存 1 小时
- 分类和视频列表不缓存（实时请求）

#### API 路由

1. **GET /api/duanju/sources** → 返回 DuanjuSource[]
2. **GET /api/duanju/categories?source=wwzy** → 返回分类列表
3. **GET /api/duanju/videos?source=wwzy&type=1&page=1** → 返回视频列表
4. **GET /api/duanju/recommends** → 返回推荐列表（20 条）

所有 API 的 runtime = 'nodejs'（需要 fetch 外部 API）

#### 黄词过滤

- 复用现有的 yellowWords（从 @/lib/yellow 导入）
- 分类名和视频名都过滤含"擦边"的分类（或保留但标记）
- MoonTVPlus 的做法：分类过滤黄词，视频不过滤

#### 前端页面 /duanju

- 布局参考 MoonTVPlus 的 /duanju/page.tsx
- 顶部：源选择器（Tab 按钮）
- 中部：分类选择器（水平滚动按钮组）
- 主体：视频卡片网格（VideoCard from='search' 模式）
- 底部：IntersectionObserver 无限滚动加载更多
- 点击卡片打开已有的 DetailPanel 查看详情+播放

#### 首页改造

- 当前：`getDoubanRecommends({ kind: 'tv', format: '短剧', category: '国产' })` → 返回 DoubanItem[]
- 改为：`fetch('/api/duanju/recommends')` → 返回 SearchResult[] 格式的数据
- VideoCard 从 `from='douban'` 改为 `from='search'`
- "查看更多"链接从 `/douban?type=tv&category=tv&tag=短剧` 改为 `/duanju`

### 与我们项目现有代码的适配点

1. **getConfig()** — 从 @/lib/config 获取源配置，已是现有模式
2. **yellowWords** — 从 @/lib/yellow 导入，已是现有模式
3. **searchFromApi / downstream.ts** — 不复用，短剧场景直接请求 ?ac=videolist 而非搜索
4. **VideoCard from='search'** — 短剧卡片用此模式，有集数显示
5. **DetailPanel** — 点击短剧卡片走现有搜索 → 详情 → 播放流程
6. **无 DB 全局缓存** — 用内存缓存替代

### 注意事项

- 苹果 CMS V10 API 格式：`?ac=list` 获取分类, `?ac=videolist&t=typeId&pg=page` 按分类分页
- 旺旺短剧源(wwzy)是最丰富的纯短剧源，应作为默认首选源
- 部分源有"擦边短剧"分类，根据 DisableYellowFilter 配置决定是否显示
- 视频列表只有基本信息，点击后通过搜索获取播放链接（和现有搜索流程一致）
