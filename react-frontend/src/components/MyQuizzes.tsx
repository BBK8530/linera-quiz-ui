import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useConnection } from '../contexts/ConnectionContext';
import { useNavigate } from 'react-router-dom';
import useNotification from '../hooks/useNotification';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  duration: number;
  creatorNickname: string;
  isStarted: boolean;
  isEnded: boolean;
  registeredCount: number;
  questions: Question[];
  createdAt: string;
}

interface User {
  nickname: string;
  walletAddress: string;
  createdAt: string;
}

const MyQuizzes: React.FC = () => {
  const { primaryWallet } = useDynamicContext();
  const { connectToLinera, queryApplication, onNewBlock, offNewBlock } =
    useConnection();
  const navigate = useNavigate();
  const { success, error } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasFetchedUser, setHasFetchedUser] = useState(false);

  // Add query state tracking using useRef to avoid function re-creation
  const isQueryingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pageSize = 6;
  const sortOptions = [
    { value: 'createdAt', label: 'Recently Created' },
    { value: 'title', label: 'Sort by Title' },
    { value: 'questions', label: 'Number of Questions' },
  ];

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (!primaryWallet?.address) return;

    // Only fetch if not already fetched
    if (hasFetchedUser) return;

    try {
      // Ensure connected to Linera
      await connectToLinera();

      const query = `
        query GetUser($walletAddress: String!) {
          user(walletAddress: $walletAddress) {
            nickname
            walletAddress
            createdAt
          }
        }
      `;

      const variables = {
        walletAddress: primaryWallet.address.toLowerCase(),
      };

      const result = (await queryApplication({
        query,
        variables,
      })) as { data: { user: User } };
      setUser(result.data.user);
      setHasFetchedUser(true);
    } catch (err) {
      // Silent error handling to avoid console noise
    }
  }, [
    primaryWallet?.address,
    hasFetchedUser,
    connectToLinera,
    queryApplication,
  ]);

  // Process quiz data with search and sorting
  const processQuizData = useCallback(
    (quizzes: Quiz[]) => {
      setAllQuizzes(quizzes);
      let processed = [...quizzes];

      // Only show quizzes created by current user
      if (user?.nickname) {
        processed = processed.filter(
          quiz => quiz.creatorNickname === user.nickname,
        );
      }

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
          return Number(b.createdAt) - Number(a.createdAt);
        } else if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        } else if (sortBy === 'questions') {
          return b.questions.length - a.questions.length;
        }
        return 0;
      });

      setFilteredQuizzes(processed);
    },
    [searchTerm, sortBy, user?.nickname],
  );

  // Fetch quizzes using unified connection management
  const fetchQuizzes = useCallback(
    async (immediate = false) => {
      const walletAddress = primaryWallet?.address;
      if (!walletAddress) return;

      // Strict check: if already querying, return immediately
      if (isQueryingRef.current) {
        if (loading) {
          setLoading(false);
        }
        return;
      }

      // Debounce logic: if not immediate, set delay
      if (!immediate && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const executeQuery = async () => {
        try {
          isQueryingRef.current = true;
          setLoading(true);

          // Ensure wallet address is still valid
          if (
            !primaryWallet?.address ||
            primaryWallet.address !== walletAddress
          ) {
            setLoading(false);
            isQueryingRef.current = false;
            return;
          }

          // Ensure connected to Linera
          await connectToLinera();

          const result = (await queryApplication({
            query: `query { quizSet { id title description duration creatorNickname isStarted isEnded registeredCount questions { id text options correctAnswer } createdAt } }`,
          })) as { data: { quizSet: Quiz[] } };

          if (result.data?.quizSet) {
            setAllQuizzes(result.data.quizSet);
          }
        } catch (err) {
          // Silent error handling to avoid console noise
        } finally {
          isQueryingRef.current = false;
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
        // Set debounce delay
        const timer = setTimeout(executeQuery, 500);
        debounceTimerRef.current = timer;
      }
    },
    [primaryWallet?.address, connectToLinera, queryApplication, loading],
  );

  useEffect(() => {
    if (primaryWallet?.address) {
      fetchUserData();
      fetchQuizzes(true); // Immediate execution on wallet change
    }
  }, [primaryWallet?.address, fetchUserData, fetchQuizzes]);

  useEffect(() => {
    // Re-process data when search/sort changes
    if (allQuizzes.length > 0) {
      processQuizData(allQuizzes);
    }
  }, [searchTerm, sortBy, user?.nickname, allQuizzes, processQuizData]);

  // Component cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 定义新区块事件处理函数
  const handleNewBlock = useCallback(() => {
    // 重新获取用户的测验数据
    fetchQuizzes(true);
  }, [fetchQuizzes]);

  // 注册新区块事件监听器，当收到新区块时刷新用户的测验列表
  useEffect(() => {
    // 注册新区块事件回调
    onNewBlock(handleNewBlock);

    // 组件卸载时注销回调
    return () => {
      offNewBlock(handleNewBlock);
    };
  }, [onNewBlock, offNewBlock, handleNewBlock]);

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(Number(timestamp) / 1000); // Convert from microseconds to milliseconds
      return date.toLocaleDateString('en-US');
    } catch {
      return 'Invalid date';
    }
  };

  const copyQuizLink = (quizId: string) => {
    const link = `${window.location.origin}/quiz/${quizId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        success('Quiz link copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        error(`Failed to copy link. Please try again: ${link}`);
      });
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
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="quiz-card skeleton skeleton-card">
                <div className="skeleton-title"></div>
                <div className="skeleton-text"></div>
                <div className="skeleton-text"></div>
                <div className="skeleton-text"></div>
                <div className="skeleton-text"></div>
                <div className="skeleton-button"></div>
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
            placeholder="Search your quizzes..."
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
          {paginatedQuizzes.map((quiz: Quiz) => (
            <div key={quiz.id} className="quiz-card">
              <h3>{quiz.title}</h3>
              <p className="quiz-description">{quiz.description}</p>
              <div className="quiz-meta quiz-meta--list">
                <span>
                  <strong>Questions:</strong> {quiz.questions.length}
                </span>
                <span>
                  <strong>Created at:</strong> {formatDate(quiz.createdAt)}
                </span>
              </div>
              <div className="quiz-status">
                {quiz.isEnded && <span className="status ended">已结束</span>}
                {quiz.isStarted && !quiz.isEnded && (
                  <span className="status started">进行中</span>
                )}
                {!quiz.isStarted && !quiz.isEnded && (
                  <span className="status pending">待开始</span>
                )}
              </div>
              <div className="quiz-actions">
                <button
                  className="action-button primary"
                  onClick={() => navigate(`/quiz-rank/${quiz.id}`)}
                >
                  View Rankings
                </button>
                <button
                  className="action-button secondary"
                  onClick={() => copyQuizLink(quiz.id)}
                >
                  Copy Link
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-container">
          <div className="empty-icon">📄</div>
          <h3>No quizzes found</h3>
          <p>
            You haven't created any quizzes yet. Click "Create Quiz" to get
            started!
          </p>
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

export default MyQuizzes;
