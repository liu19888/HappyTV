/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { ArrowLeft, Loader2, Play, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';

import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

interface DuanjuCategory {
  type_id: string;
  type_name: string;
}

interface DuanjuSource {
  key: string;
  name: string;
  api: string;
  categories: DuanjuCategory[];
}

function DetailPanel({
  video,
  onClose,
}: {
  video: SearchResult | null;
  onClose: () => void;
}) {
  if (!video) return null;

  const firstEpisodeTitle = video.episodes_titles?.[0] || '第1集';
  const playHref = `/play?source=${video.source}&id=${video.id}&title=${encodeURIComponent(
    video.title
  )}${video.year ? `&year=${video.year}` : ''}&stype=tv`;

  return (
    <div className='fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4'>
      <div className='max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-gray-900 sm:rounded-2xl'>
        <div className='flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800'>
          <div className='min-w-0'>
            <h2 className='truncate text-lg font-semibold text-gray-900 dark:text-gray-100'>
              {video.title}
            </h2>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              {video.source_name}
              {video.year && video.year !== 'unknown' ? ` · ${video.year}` : ''}
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            aria-label='关闭'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='grid gap-4 overflow-y-auto p-4 sm:grid-cols-[12rem_1fr]'>
          <div className='relative mx-auto aspect-[2/3] w-36 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 sm:w-full'>
            <Image
              src={processImageUrl(video.poster)}
              alt={video.title}
              fill
              className='object-cover'
              referrerPolicy='no-referrer'
            />
          </div>

          <div className='min-w-0'>
            <div className='mb-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400'>
              {video.class && <span>{video.class}</span>}
              {video.vod_remarks && <span>{video.vod_remarks}</span>}
              {video.episodes.length > 0 && <span>{video.episodes.length} 集</span>}
            </div>

            {video.desc && (
              <p className='mb-4 max-h-36 overflow-y-auto whitespace-pre-line text-sm leading-6 text-gray-700 dark:text-gray-300'>
                {video.desc}
              </p>
            )}

            <Link
              href={playHref}
              className='mb-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700'
            >
              <Play className='h-4 w-4' />
              播放 {firstEpisodeTitle}
            </Link>

            <div className='grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4'>
              {video.episodes.map((_, index) => (
                <Link
                  key={`${video.id}-${index}`}
                  href={`${playHref}&episode=${index + 1}`}
                  className='truncate rounded-lg border border-gray-200 px-3 py-2 text-center text-xs text-gray-700 hover:border-green-500 hover:text-green-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-green-500 dark:hover:text-green-400'
                  title={video.episodes_titles?.[index] || `第${index + 1}集`}
                >
                  {video.episodes_titles?.[index] || `第${index + 1}集`}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DuanjuPageClient() {
  const [sources, setSources] = useState<DuanjuSource[]>([]);
  const [categories, setCategories] = useState<DuanjuCategory[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [videos, setVideos] = useState<SearchResult[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SearchResult | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSources = async () => {
      setIsLoadingSources(true);
      try {
        const response = await fetch('/api/duanju/sources');
        const data = await response.json();
        if (data.code === 200 && Array.isArray(data.data)) {
          setSources(data.data);
          if (data.data.length > 0) {
            setSelectedSource(data.data[0].key);
          }
        }
      } finally {
        setIsLoadingSources(false);
      }
    };

    fetchSources();
  }, []);

  useEffect(() => {
    if (!selectedSource) return;

    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      setCategories([]);
      setSelectedType('');
      setVideos([]);
      setCurrentPage(1);
      setHasMore(true);
      try {
        const response = await fetch(
          `/api/duanju/categories?source=${encodeURIComponent(selectedSource)}`
        );
        const data = await response.json();
        if (data.code === 200 && Array.isArray(data.data)) {
          setCategories(data.data);
          setSelectedType(data.data[0]?.type_id || '');
        }
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [selectedSource]);

  useEffect(() => {
    if (!selectedSource || !selectedType) return;

    const fetchVideos = async () => {
      setIsLoadingVideos(true);
      try {
        const response = await fetch(
          `/api/duanju/videos?source=${encodeURIComponent(
            selectedSource
          )}&type=${encodeURIComponent(selectedType)}&page=${currentPage}`
        );
        const data = await response.json();
        if (data.code === 200 && Array.isArray(data.data)) {
          setVideos((prev) =>
            currentPage === 1 ? data.data : [...prev, ...data.data]
          );
          setHasMore((data.page || currentPage) < (data.pagecount || data.pageCount || currentPage));
        }
      } finally {
        setIsLoadingVideos(false);
      }
    };

    fetchVideos();
  }, [selectedSource, selectedType, currentPage]);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingVideos) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { rootMargin: '240px 0px', threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingVideos]);

  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    setCurrentPage(1);
    setVideos([]);
    setHasMore(true);
  };

  return (
    <PageLayout activePath='/duanju'>
      <div className='px-4 py-4 sm:px-10 sm:py-8'>
        <div className='mb-6 flex items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
              短剧
            </h1>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              浏览采集源中的短剧内容
            </p>
          </div>
          <Link
            href='/'
            className='inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          >
            <ArrowLeft className='h-4 w-4' />
            返回首页
          </Link>
        </div>

        <div className='mb-5'>
          {isLoadingSources ? (
            <div className='flex h-11 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400'>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              加载采集源中...
            </div>
          ) : (
            <div className='flex gap-2 overflow-x-auto pb-2'>
              {sources.map((source) => (
                <button
                  key={source.key}
                  type='button'
                  onClick={() => setSelectedSource(source.key)}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    selectedSource === source.key
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {source.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='mb-8'>
          {isLoadingCategories ? (
            <div className='flex h-10 items-center text-sm text-gray-500 dark:text-gray-400'>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              加载分类中...
            </div>
          ) : (
            <div className='flex gap-2 overflow-x-auto pb-2'>
              {categories.map((category) => (
                <button
                  key={category.type_id}
                  type='button'
                  onClick={() => handleTypeChange(category.type_id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    selectedType === category.type_id
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                      : 'border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-green-500 dark:hover:text-green-400'
                  }`}
                >
                  {category.type_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isLoadingSources && sources.length === 0 && (
          <div className='py-16 text-center text-gray-500 dark:text-gray-400'>
            暂无包含短剧分类的采集源
          </div>
        )}

        {selectedSource && categories.length === 0 && !isLoadingCategories && (
          <div className='py-16 text-center text-gray-500 dark:text-gray-400'>
            当前采集源暂无可用短剧分类
          </div>
        )}

        {selectedType && (
          <>
            {isLoadingVideos && currentPage === 1 ? (
              <div className='flex h-40 items-center justify-center'>
                <Loader2 className='h-8 w-8 animate-spin text-green-600' />
              </div>
            ) : videos.length === 0 ? (
              <div className='py-16 text-center text-gray-500 dark:text-gray-400'>
                暂无短剧
              </div>
            ) : (
              <div className='grid grid-cols-3 gap-x-2 gap-y-14 px-0 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8 sm:gap-y-20 sm:px-2'>
                {videos.map((item) => (
                  <div key={`${item.source}-${item.id}`} className='w-full'>
                    <VideoCard
                      id={item.id}
                      title={item.title}
                      poster={item.poster}
                      episodes={item.episodes.length}
                      source={item.source}
                      source_name={item.source_name}
                      douban_id={item.douban_id}
                      year={item.year}
                      from='search'
                      type='tv'
                      onCardClick={() => setSelectedVideo(item)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div ref={loadMoreRef} className='flex items-center justify-center py-8'>
              {isLoadingVideos && currentPage > 1 && (
                <Loader2 className='h-6 w-6 animate-spin text-green-600' />
              )}
              {!hasMore && videos.length > 0 && (
                <span className='text-sm text-gray-500 dark:text-gray-400'>
                  没有更多了
                </span>
              )}
            </div>
          </>
        )}
      </div>
      <DetailPanel video={selectedVideo} onClose={() => setSelectedVideo(null)} />
    </PageLayout>
  );
}

export default function DuanjuPage() {
  return (
    <Suspense>
      <DuanjuPageClient />
    </Suspense>
  );
}
