import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useConnection } from '../contexts/ConnectionContext';
import { useNavigate } from 'react-router-dom';
import { GET_QUIZ_SETS } from '../graphql/quizQueries';
import type { QuizSet } from '../graphql/quizTypes';

const QuizList: React.FC = () => {
  const { primaryWallet } = useDynamicContext();
  const { queryApplication, onNewBlock, offNewBlock } = useConnection();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [currentPage, setCurrentPage] = useState(1);
  const [allQuizzes, setAllQuizzes] = useState<QuizSet[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(false);

  // 新增：查询去重相关状态 - 使用useRef避免函数重新创建
  const isQueryingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch quizzes with strict deduplication and debouncing
  const fetchQuizzes = useCallback(
    async (immediate = false) => {
      const walletAddress = primaryWallet?.address;
      if (!walletAddress) {
        return;
      }

      // 严格检查：是否已在查询中
      if (isQueryingRef.current) {
        // 如果已经在查询中，但当前loading状态为true，重置它
        if (loading) {
          setLoading(false);
        }
        return;
      }

      // 防抖逻辑：如果不是立即执行，设置延迟
      if (!immediate && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const executeQuery = async () => {
        try {
          isQueryingRef.current = true;
          if (!immediate) setLoading(true);

          // 再次检查钱包地址是否仍然有效
          if (
            !primaryWallet?.address ||
            primaryWallet.address !== walletAddress
          ) {
            setLoading(false);
            isQueryingRef.current = false;
            return;
          }

          const variables = {
            limit: pageSize,
            offset: (currentPage - 1) * pageSize,
            sortBy: 'createdAt',
            sortDirection: 'DESC',
          };

          const result = (await queryApplication({
            query: GET_QUIZ_SETS,
            variables,
          })) as { data?: { quizSets: QuizSet[] } };
          console.log(result);
          // 再次检查钱包地址
          if (
            !primaryWallet?.address ||
            primaryWallet.address !== walletAddress
          ) {
            setLoading(false);
            isQueryingRef.current = false;
            return;
          }

          if (result.data?.quizSets) {
            const quizSets = result.data.quizSets;
            setAllQuizzes(quizSets);
          }
        } catch {
          // 静默处理错误，避免控制台噪音
        } finally {
          isQueryingRef.current = false;
          // 无论是否立即执行，都重置loading状态
          // 确保在所有情况下loading状态都能正确退出
          setLoading(false);
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
        }
      };

      if (immediate) {
        await executeQuery();
      } else {
        // 设置防抖延迟
        const timer = setTimeout(executeQuery, 500); // 增加防抖时间到500ms
        debounceTimerRef.current = timer;
      }
    },
    [primaryWallet?.address, currentPage, pageSize, queryApplication],
  );

  // 主要查询逻辑 - 钱包变化时立即执行
  useEffect(() => {
    if (primaryWallet?.address) {
      fetchQuizzes(true); // 立即执行，不防抖
    }
  }, [primaryWallet?.address, fetchQuizzes]);

  // 分页变化时防抖执行
  useEffect(() => {
    if (primaryWallet?.address) {
      fetchQuizzes(false); // 使用防抖
    }
  }, [currentPage, primaryWallet?.address, fetchQuizzes]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 定义新区块事件处理函数
  const handleNewBlock = useCallback(() => {
    // 重新获取测验数据
    fetchQuizzes(true);
  }, [fetchQuizzes]);

  // 注册新区块事件监听器，当收到新区块时刷新测验列表
  useEffect(() => {
    // 注册新区块事件回调
    onNewBlock(handleNewBlock);

    // 组件卸载时注销回调
    return () => {
      offNewBlock(handleNewBlock);
    };
  }, [onNewBlock, offNewBlock, handleNewBlock]);

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
