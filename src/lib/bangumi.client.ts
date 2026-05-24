'use client';

export interface BangumiCalendarData {
  weekday: {
    en: string;
  };
  items: {
    id: number;
    name: string;
    name_cn: string;
    rating: {
      score: number;
    };
    air_date: string;
    images: {
      large: string;
      common: string;
      medium: string;
      small: string;
      grid: string;
    };
    url: string;
  }[];
}

function normalizeCalendarData(data: BangumiCalendarData[]) {
  return data.map((item) => ({
    ...item,
    items: Array.isArray(item.items)
      ? item.items.filter((bangumiItem) => bangumiItem.images)
      : [],
  }));
}

export async function GetBangumiCalendarData(): Promise<BangumiCalendarData[]> {
  const loadCalendar = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Bangumi calendar response is invalid');
    }

    return normalizeCalendarData(data as BangumiCalendarData[]);
  };

  try {
    return await loadCalendar('/api/bangumi/calendar');
  } catch {
    // 兼容没有部署服务端代理的环境
    return loadCalendar('https://api.bgm.tv/calendar');
  }
}
