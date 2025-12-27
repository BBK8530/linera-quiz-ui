import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnection } from '../contexts/ConnectionContext';
import { GET_QUIZ_SET, GET_QUIZ_LEADERBOARD } from '../graphql/quizQueries';
import type { LeaderboardEntry, QuizSetView } from '../graphql/quizTypes';

// Local interface to match component needs
interface LocalRanking extends LeaderboardEntry {
  rank: number;
}

const QuizRankings: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { queryApplication, onNewBlock, offNewBlock } = useConnection();

  const [quiz, setQuiz] = useState<QuizSetView | null>(null);
  const [rankings, setRankings] = useState<LocalRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'score' | 'completedAt' | 'nickname'>(
    'score',
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const pageSize = 10;

  // Fetch quiz details
  const fetchQuizDetails = useCallback(async () => {
    if (!quizId) return;

    try {
      // Fetch quiz details
      const quizResult = await queryApplication({
        query: GET_QUIZ_SET,
        variables: { quizId: parseInt(quizId) },
      });

      if (
        quizResult &&
        typeof quizResult === 'object' &&
        'data' in quizResult &&
        quizResult.data &&
        typeof quizResult.data === 'object' &&
        'quizSet' in quizResult.data
      ) {
        setQuiz(quizResult.data.quizSet as QuizSetView);
      } else {
        setError('Quiz not found');
      }
    } catch (err) {
      console.error('Failed to fetch quiz details:', err);
      setError('Failed to fetch quiz details');
    }
  }, [quizId, queryApplication]);

  // Fetch quiz rankings
  const fetchQuizRankings = useCallback(async () => {
    if (!quizId) return;

    try {
      const rankingsResult = await queryApplication({
        query: GET_QUIZ_LEADERBOARD,
        variables: { quizId: parseInt(quizId) },
      });

      if (
        rankingsResult &&
        typeof rankingsResult === 'object' &&
        'data' in rankingsResult &&
        rankingsResult.data &&
        typeof rankingsResult.data === 'object' &&
        'quizLeaderboard' in rankingsResult.data
      ) {
        setRankings(rankingsResult.data.quizLeaderboard as LocalRanking[]);
      }
    } catch (err) {
      console.error('Failed to fetch quiz rankings:', err);
      setError('Failed to fetch quiz rankings');
    } finally {
      setLoading(false);
    }
  }, [quizId, queryApplication]);

  // Handle new block event - refresh data
  const handleNewBlock = useCallback(() => {
    console.log(
      '🔄 New block received, refreshing quiz details and rankings...',
    );
    fetchQuizDetails();
    fetchQuizRankings();
  }, [fetchQuizDetails, fetchQuizRankings]);

  // Register new block listener
  useEffect(() => {
    onNewBlock(handleNewBlock);
    return () => {
      offNewBlock(handleNewBlock);
    };
  }, [onNewBlock, offNewBlock, handleNewBlock]);

  // Initial data fetch
  useEffect(() => {
    fetchQuizDetails();
    fetchQuizRankings();
  }, [fetchQuizDetails, fetchQuizRankings]);

  // Sort rankings
  const sortedRankings = [...rankings].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'score':
        comparison = a.score - b.score;
        break;
      case 'completedAt':
        comparison = Number(a.completedAt) - Number(b.completedAt);
        break;
      case 'nickname':
        comparison = a.nickname.localeCompare(b.nickname);
        break;
      default:
        comparison = a.rank - b.rank;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Handle sort
  const handleSort = (field: 'score' | 'completedAt' | 'nickname') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Pagination
  const totalPages = Math.ceil(sortedRankings.length / pageSize);
  const paginatedRankings = sortedRankings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(Number(timestamp) / 1000); // Convert from microseconds to milliseconds
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="quiz-rankings">
        <div className="rankings-header">
          <h2>Quiz Rankings</h2>
          <div
            className="skeleton-text"
            style={{ height: '44px', width: '200px' }}
          ></div>
        </div>
        <div className="rankings-table-container">
          <table className="rankings-table">
            <thead>
              <tr>
                <th className="rank-column">
                  <div
                    className="skeleton-text"
                    style={{ width: '40px', height: '20px' }}
                  ></div>
                </th>
                <th className="nickname-column">
                  <div
                    className="skeleton-text"
                    style={{ width: '150px', height: '20px' }}
                  ></div>
                </th>
                <th className="score-column">
                  <div
                    className="skeleton-text"
                    style={{ width: '100px', height: '20px' }}
                  ></div>
                </th>
                <th className="time-column">
                  <div
                    className="skeleton-text"
                    style={{ width: '150px', height: '20px' }}
                  ></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {Array(pageSize)
                .fill(0)
                .map((_, i) => (
                  <tr key={i} className="skeleton-row">
                    <td>
                      <div
                        className="skeleton-text"
                        style={{ width: '40px', height: '20px' }}
                      ></div>
                    </td>
                    <td>
                      <div
                        className="skeleton-text"
                        style={{ width: '150px', height: '20px' }}
                      ></div>
                    </td>
                    <td>
                      <div
                        className="skeleton-text"
                        style={{ width: '100px', height: '20px' }}
                      ></div>
                    </td>
                    <td>
                      <div
                        className="skeleton-text"
                        style={{ width: '150px', height: '20px' }}
                      ></div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-rankings">
        <div className="rankings-header">
          <h2>Quiz Rankings</h2>
        </div>
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button
            className="action-button primary"
            onClick={() => navigate('/')}
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-rankings">
        <div className="rankings-header">
          <h2>Quiz Rankings</h2>
        </div>
        <div className="error-container">
          <p className="error-message">Quiz not found</p>
          <button
            className="action-button primary"
            onClick={() => navigate('/')}
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-rankings">
      <div className="quiz-info">
        <h2>{quiz.title}</h2>
        <p className="quiz-description">{quiz.description}</p>
        <div className="quiz-meta quiz-meta--rankings">
          <span>
            <strong>Creator:</strong> {quiz.creatorNickname}
          </span>
          <span>
            <strong>Questions:</strong> {quiz.questions.length}
          </span>
          <span className="meta-item">
            <strong>Status:</strong>{' '}
            {new Date() > new Date(Number(quiz.endTime) / 1000)
              ? '已结束'
              : quiz.isStarted
              ? '进行中'
              : '待开始'}
          </span>
        </div>
        <button
          className="action-button primary"
          onClick={() => navigate(`/quiz/${quiz.id}`)}
        >
          Take This Quiz
        </button>
      </div>

      <div className="rankings-header">
        <h3>Rankings</h3>
        <div className="sort-controls">
          <label>Sort by: </label>
          <select
            className="sort-select"
            value={sortBy}
            onChange={e =>
              handleSort(e.target.value as 'score' | 'completedAt' | 'nickname')
            }
          >
            <option value="score">Score</option>
            <option value="completedAt">Completed At</option>
            <option value="nickname">Nickname</option>
          </select>
          <button
            className="sort-order-button"
            onClick={() => handleSort(sortBy)}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="rankings-table-container">
        {rankings.length > 0 ? (
          <table className="rankings-table">
            <thead>
              <tr>
                <th className="rank-column">Rank</th>
                <th className="nickname-column">Nickname</th>
                <th className="score-column">Score</th>
                <th className="time-column">Completed At</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRankings.map((ranking, index) => (
                <tr key={index} className="ranking-row">
                  <td className="rank-column">
                    <span className={`rank-badge rank-${ranking.rank}`}>
                      #{ranking.rank}
                    </span>
                  </td>
                  <td className="nickname-column">
                    <span className="nickname">{ranking.nickname}</span>
                  </td>
                  <td className="score-column">
                    <span className="score">
                      {ranking.score}/{quiz.questions.length}
                    </span>
                  </td>
                  <td className="time-column">
                    <span className="completed-at">
                      {formatDate(ranking.completedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-container">
            <div className="empty-icon">🏆</div>
            <h3>No rankings available yet</h3>
            <p>
              Be the first to complete this quiz and appear on the rankings!
            </p>
          </div>
        )}
      </div>

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

export default QuizRankings;
