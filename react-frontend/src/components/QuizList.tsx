import React, { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useNavigate } from 'react-router-dom';
import {
  GET_QUIZ_SETS_APOLLO,
  QUIZ_EVENTS_SUBSCRIPTION_APOLLO,
} from '../graphql/quizQueries';
import { useQuery, useSubscription } from '@apollo/client/react';
import type { QuizSet } from '../graphql/quizTypes';

const QuizList: React.FC = () => {
  const { primaryWallet } = useDynamicContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [currentPage, setCurrentPage] = useState(1);
  const [allQuizzes, setAllQuizzes] = useState<QuizSet[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(false);

  const pageSize = 6;
  const sortOptions = [
    { value: 'createdAt', label: '最近创建' },
    { value: 'title', label: '按标题排序' },
    { value: 'questions', label: '按问题数量排序' },
  ];

  // Process quiz data with search and sorting
  const processQuizData = useCallback(
    (quizzes: QuizSet[]) => {
      let processed = [...quizzes];

      // Search functionality
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        processed = processed.filter(
          quiz =>
            quiz.title.toLowerCase().includes(term) ||
            quiz.description.toLowerCase().includes(term),
        );
      }

      // Sort functionality
      processed.sort((a, b) => {
        if (sortBy === 'createdAt') {
          // 使用 startTime 代替 createdAt 进行排序
          // 时间戳为微秒，直接比较数值即可
          return Number(b.startTime) - Number(a.startTime);
        } else if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        } else if (sortBy === 'questions') {
          return b.questions.length - a.questions.length;
        }
        return 0;
      });

      setFilteredQuizzes(processed);
    },
    [searchTerm, sortBy],
  );

  // 使用 Apollo Client 查询主链数据
  const {
    loading: apolloLoading,
    data,
    refetch,
  } = useQuery<{ quizSets?: QuizSet[] }>(GET_QUIZ_SETS_APOLLO, {
    variables: {
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      sortBy: 'createdAt',
      sortDirection: 'DESC',
    },
  });

  // 监听数据变化，当数据加载完成时更新测验列表
  useEffect(() => {
    if (data?.quizSets) {
      setAllQuizzes(data.quizSets);
    }
  }, [data]);

  // 设置加载状态为 Apollo 查询的加载状态
  useEffect(() => {
    setLoading(apolloLoading);
  }, [apolloLoading]);

  // 订阅测验事件
  useSubscription(QUIZ_EVENTS_SUBSCRIPTION_APOLLO, {
    onData: ({ data }: { data?: any }) => {
      if (data.data?.quiz_events) {
        const event = data.data.quiz_events;
        // 根据事件类型更新测验列表
        if (event.__typename === 'QuizCreated') {
          // 如果是新测验创建事件，重新获取测验列表
          refetch();
        } else if (event.__typename === 'AnswerSubmitted') {
          // 如果是答案提交事件，更新相应测验的参与者数量
          setAllQuizzes(prevQuizzes => {
            return prevQuizzes.map(quiz => {
              if (quiz.id === event.quizId) {
                return {
                  ...quiz,
                  participantCount: (quiz.participantCount || 0) + 1,
                };
              }
              return quiz;
            });
          });
        }
      }
    },
    onError: (error: any) => {
      console.error('Subscription error:', error);
    },
  });

  // 钱包变化时重新获取数据
  useEffect(() => {
    if (primaryWallet?.address) {
      refetch();
    }
  }, [primaryWallet?.address, refetch]);

  // 分页变化时重新获取数据
  useEffect(() => {
    refetch();
  }, [currentPage, refetch]);

  useEffect(() => {
    // Re-process data when search/sort changes
    if (allQuizzes.length > 0) {
      processQuizData(allQuizzes);
    }
  }, [searchTerm, sortBy, currentPage, allQuizzes, processQuizData]);

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(Number(timestamp) / 1000); // Convert from microseconds to milliseconds
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const openQuizDetails = (quizId: string) => {
    navigate(`/quiz/${quizId}`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (loading)
    return (
      <div className="quiz-list">
        <div className="quiz-list-filters">
          <div className="search-bar">
            <div className="skeleton-text" style={{ height: '44px' }}></div>
          </div>
          <div className="sort-dropdown">
            <div
              className="skeleton-text"
              style={{ height: '44px', width: '200px' }}
            ></div>
          </div>
        </div>
        <div className="quiz-grid">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="quiz-card skeleton skeleton-card">
                <div className="skeleton-title"></div>
                <div className="skeleton-text"></div>
                <div className="skeleton-text"></div>
              </div>
            ))}
        </div>
      </div>
    );

  const totalPages = Math.ceil(filteredQuizzes.length / pageSize);
  const paginatedQuizzes = filteredQuizzes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="quiz-list">
      {/* Search and Filter */}
      <div className="quiz-list-filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="搜索所有测验..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="sort-dropdown">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="sort-select"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quiz Grid */}
      {paginatedQuizzes.length > 0 ? (
        <div className="quiz-grid">
          {paginatedQuizzes.map((quiz: QuizSet) => (
            <div key={quiz.id} className="quiz-card">
              <div className="quiz-card-header">
                <h3>{quiz.title}</h3>
                <button
                  className="copy-link-icon"
                  onClick={() => openQuizDetails(quiz.id.toString())}
                  title="查看测验详情"
                >
                  📝
                </button>
              </div>
              <p className="quiz-description">{quiz.description}</p>
              <div className="quiz-meta quiz-meta--list">
                <span>
                  <strong>创建者:</strong> {quiz.creatorNickname}
                </span>
                <span>
                  <strong>模式:</strong> {quiz.mode}
                </span>
                <span className="meta-item">
                  <strong>问题数量:</strong> {quiz.questions.length}
                </span>
                <span className="meta-item">
                  <strong>参与者:</strong> {quiz.participantCount}
                </span>
                <span className="meta-item">
                  <strong>开始时间:</strong> {formatDate(quiz.startTime)}
                </span>
                <span className="meta-item">
                  <strong>结束时间:</strong> {formatDate(quiz.endTime)}
                </span>
              </div>
              <div className="quiz-status">
                {/* 根据 startTime 和 endTime 判断状态 */}
                {new Date() > new Date(Number(quiz.endTime) / 1000) && (
                  <span className="status ended">已结束</span>
                )}
                {new Date() >= new Date(Number(quiz.startTime) / 1000) &&
                  new Date() <= new Date(Number(quiz.endTime) / 1000) && (
                    <span className="status started">进行中</span>
                  )}
                {new Date() < new Date(Number(quiz.startTime) / 1000) && (
                  <span className="status pending">待开始</span>
                )}
              </div>
              <div className="quiz-actions">
                {/* 根据测验状态显示不同的操作按钮 */}

                {/* 去做题按钮：只在测验进行中时显示 */}
                {new Date() >= new Date(Number(quiz.startTime) / 1000) &&
                  new Date() <= new Date(Number(quiz.endTime) / 1000) && (
                    <button
                      className="action-button primary"
                      onClick={() => navigate(`/quiz/${quiz.id}`)}
                    >
                      去做题
                    </button>
                  )}

                {/* 查看排名按钮：所有测验都可以查看排名 */}
                <button
                  className="action-button secondary"
                  onClick={() => navigate(`/quiz-rank/${quiz.id}`)}
                >
                  查看排名
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-container">
          <div className="empty-icon">📄</div>
          <h3>未找到匹配的测验</h3>
          <p>请尝试调整搜索条件或筛选器</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              className={`page-button ${currentPage === page ? 'active' : ''}`}
              onClick={() => handlePageChange(page)}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuizList;
