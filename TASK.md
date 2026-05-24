# 任务：参照LunaTV实现真正的动漫板块

## 问题
当前HappyTV(MoonTV)侧边栏的"动漫"和"短剧"是假板块——点击后只显示豆瓣tv分类下的通用内容，没有动漫专属数据源和筛选器。

## 目标
参照LunaTV(MoonTechLab/LunaTV)的实现，让动漫板块成为有真实数据、有筛选功能的完整板块。去掉"短剧"（LunaTV也没有短剧板块）。

## 参考文件
luna_ref/ 目录下有LunaTV的所有相关源码，请仔细对照参考：
- `luna_ref/bangumi.client.ts` - Bangumi番组计划API（每日放送功能）
- `luna_ref/douban.client.ts` - 豆瓣API客户端（含getDoubanRecommends新函数）
- `luna_ref/DoubanSelector.tsx` - 选择器组件（含anime模式支持）
- `luna_ref/MultiLevelSelector.tsx` - 多级筛选器（类型/地区/年份等）
- `luna_ref/WeekdaySelector.tsx` - 星期选择器（每日放送用）
- `luna_ref/CapsuleSwitch.tsx` - 胶囊开关组件
- `luna_ref/VirtualGrid.tsx` - 虚拟滚动网格
- `luna_ref/douban_page.tsx` - douban页面（含anime分支逻辑）
- `luna_ref/recommends_route.ts` - 豆瓣推荐API路由

## 需要修改的文件

### 1. src/components/Sidebar.tsx
- 去掉"短剧"菜单项
- 改动漫链接为 `/douban?type=anime`（LunaTV方式）
- 动漫图标用 Cat（lucide-react），跟LunaTV一致

### 2. src/lib/bangumi.client.ts （新建）
- 从 luna_ref/bangumi.client.ts 直接复制

### 3. src/lib/douban.client.ts
- 添加 DoubanRecommendsParams 接口
- 添加 getDoubanRecommends 函数
- 添加 fetchDoubanRecommends 函数
- 添加 DoubanRecommendApiResponse 接口
- 参照 luna_ref/douban.client.ts，但保留本项目现有的代理配置方式（getDoubanProxyConfig从utils导入）
- 注意：本项目的 getDoubanProxyConfig 在 lib/utils.ts 里，不在 douban.client.ts 里

### 4. src/app/api/douban/recommends/route.ts （新建）
- 从 luna_ref/recommends_route.ts 参照创建
- 豆瓣推荐API `/rexxar/api/v2/${kind}/recommend`

### 5. src/components/WeekdaySelector.tsx （新建）
- 从 luna_ref/WeekdaySelector.tsx 直接复制

### 6. src/components/CapsuleSwitch.tsx （新建）
- 从 luna_ref/CapsuleSwitch.tsx 直接复制

### 7. src/components/MultiLevelSelector.tsx （新建）
- 从 luna_ref/MultiLevelSelector.tsx 直接复制

### 8. src/components/DoubanSelector.tsx
- 大幅修改，添加anime类型支持
- anime类型下显示：每日放送 / 番剧 两个primary选项
- 每日放送模式下显示WeekdaySelector
- 番剧模式下显示MultiLevelSelector
- 传递 onMultiLevelChange 和 onWeekdayChange 回调
- 参照 luna_ref/DoubanSelector.tsx

### 9. src/app/douban/page.tsx
- 添加anime类型处理逻辑
- anime + 每日放送：调用 GetBangumiCalendarData
- anime + 番剧：调用 getDoubanRecommends
- 添加 multiLevelValues 状态和 selectedWeekday 状态
- 添加 handleMultiLevelChange 和 handleWeekdayChange 回调
- 修改 getPageTitle 支持 anime
- VideoCard 传递 isBangumi 属性（anime+每日放送时）
- 参照 luna_ref/douban_page.tsx

### 10. src/components/VideoCard.tsx
- 添加 isBangumi 可选prop
- 当isBangumi=true时，点击跳转到Bangumi详情而非豆瓣

## 重要注意事项
1. 不要照搬LunaTV的代理配置方式！本项目用 lib/utils.ts 里的 getDoubanProxyConfig，保持不变
2. douban.client.ts 的代理切换逻辑保持本项目现有风格（switch-case per proxyType）
3. MobileBottomNav.tsx 也需要同步更新动漫链接
4. 不要动项目已有的搜索功能
5. 完成后运行 pnpm build 验证编译通过
6. luna_ref/ 目录只是参考，不要把它包含在最终构建中
