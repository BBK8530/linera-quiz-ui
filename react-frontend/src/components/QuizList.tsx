import React, { useState, useEffect, useCallback } from 'react';
import { lineraAdapter } from '../providers/LineraAdapter';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

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

const QuizList: React.FC = () => {
  const { primaryWallet } = useDynamicContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  
  const pageSize = 6;
  const sortOptions = [
    { value: 'createdAt', label: 'Recently Created' },
    { value: 'title', label: 'Sort by Title' },
    { value: 'questions', label: 'Number of Questions' },
  ];

  // Process quiz data with search and sorting
  const processQuizData = useCallback((quizzes: Quiz[]) => {
    let processed = [...quizzes];

    // Search functionality
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      processed = processed.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(term) ||
          quiz.description.toLowerCase().includes(term)
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
  }, [searchTerm, sortBy]);

  // Fetch quizzes using Linera SDK
  const fetchQuizzes = useCallback(async () => {
    if (!primaryWallet?.address) return;
    
    try {
      setLoading(true);
      
      // Connect to Linera if not already connected
      await lineraAdapter.connect(primaryWallet);
      
      // Set application if not already set
      if (!lineraAdapter.isApplicationSet()) {
        await lineraAdapter.setApplication();
      }
      
      const result = await lineraAdapter.queryApplication<{ data: { quizzes: Quiz[] } }>({
        query: `query { quizzes { id title description duration creatorNickname isStarted isEnded registeredCount questions { id text options correctAnswer } createdAt } }`
      });
      
      if (result.data?.quizzes) {
        processQuizData(result.data.quizzes);
      }
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
    } finally {
      setLoading(false);
    }
  }, [primaryWallet, processQuizData]);

  useEffect(() => {
    if (primaryWallet?.address) {
      fetchQuizzes();
    }
  }, [primaryWallet?.address, fetchQuizzes]);

  useEffect(() => {
    // Re-process data when search/sort changes
    if (filteredQuizzes.length > 0) {
      processQuizData(filteredQuizzes);
    }
  }, [searchTerm, sortBy, currentPage, filteredQuizzes, processQuizData]);

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
        alert('Quiz link copied to clipboard!');
      })
      .catch((err) => {
        console.error('Failed to copy link: ', err);
        alert(`Failed to copy link. Please try again: ${link}`);
      });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (loading) return (
    <div className="quiz-list">
      <div className="quiz-list-filters">
        <div className="search-bar">
          <div className="skeleton-text" style={{height: '44px'}}></div>
        </div>
        <div className="sort-dropdown">
          <div className="skeleton-text" style={{height: '44px', width: '200px'}}></div>
        </div>
      </div>
      <div className="quiz-grid">
        {Array(6).fill(0).map((_, i) => (
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
    currentPage * pageSize
  );

  return (
    <div className="quiz-list">
      {/* Search and Filter */}
      <div className="quiz-list-filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search quizzes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="sort-dropdown">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            {sortOptions.map((option) => (
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
              <div className="quiz-meta">
                <span className="meta-item">
                  <strong>Questions:</strong> {quiz.questions.length}
                </span>
                <span className="meta-item">
                  <strong>Created at:</strong> {formatDate(quiz.createdAt)}
                </span>
              </div>
              <div className="quiz-status">
                {quiz.isEnded && <span className="status ended">已结束</span>}
                {quiz.isStarted && !quiz.isEnded && <span className="status started">进行中</span>}
                {!quiz.isStarted && !quiz.isEnded && <span className="status pending">待开始</span>}
              </div>
              <div className="quiz-actions">
                <button 
                  className="action-button primary"
                  onClick={() => window.location.href = `/quiz-rank/${quiz.id}`}
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
          <h3>No matching quizzes found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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