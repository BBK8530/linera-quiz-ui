import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnection } from '../contexts/ConnectionContext';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import useNotification from '../hooks/useNotification';
import { GET_QUIZ_SET, GET_QUIZ_LEADERBOARD } from '../graphql/quizQueries';
import { SUBMIT_ANSWERS } from '../graphql/quizMutations';
import type { QuizSetView, LeaderboardEntry } from '../graphql/quizTypes';
import { useUser } from '../contexts/UserContext';

interface ExtendedQuizSetView extends QuizSetView {
  participantCount: number;
}

interface LocalRanking extends LeaderboardEntry {
  rank: number;
}

const QuizTakingPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { primaryWallet } = useDynamicContext();
  const { queryApplication, onNewBlock, offNewBlock } = useConnection();
  const { error: notifyError } = useNotification();

  const [quiz, setQuiz] = useState<ExtendedQuizSetView | null>(null);
  const [rankings, setRankings] = useState<LocalRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: string]: number[];
  }>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeUntilStart, setTimeUntilStart] = useState(0);
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const { user } = useUser();

  // Fetch quiz rankings - 只有在获取到quiz后才调用
  const fetchQuizRankings = useCallback(async () => {
    if (!quizId || !quiz) {
      console.log('⚠️ Cannot fetch rankings: missing quizId or quiz data');
      return;
    }

    try {
      console.log('📊 Fetching quiz rankings...');

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
        const rankingsData = rankingsResult.data
          .quizLeaderboard as LocalRanking[];
        setRankings(rankingsData);
        console.log(
          '✅ Quiz rankings updated:',
          rankingsData.length,
          'entries',
        );
      } else {
        console.log('⚠️ No rankings data found for quiz:', quizId);
        setRankings([]);
      }
    } catch (_err) {
      console.error('Failed to fetch quiz rankings:', _err);
      setRankings([]);
      // Silent error handling for rankings
    }
  }, [quizId, quiz, queryApplication]);

  // Fetch quiz details
  const fetchQuizDetails = useCallback(
    async (isRetry = false) => {
      if (!quizId) return;

      try {
        // 只有非重试情况下才显示加载状态
        if (!isRetry) {
          setLoading(true);
          setErrorMessage(null);
        }

        // Fetch quiz details using ConnectionContext
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
          'quizSet' in quizResult.data &&
          quizResult.data.quizSet
        ) {
          const quizData = quizResult.data.quizSet as ExtendedQuizSetView;
          setQuiz(quizData);

          // Calculate time remaining based on startTime and endTime
          const now = new Date();

          // Handle microsecond timestamp (1 microsecond = 1/1,000,000 seconds)
          const convertMicrosecondTimestamp = (
            timestamp: string | number,
          ): Date => {
            const numTimestamp = Number(timestamp);
            if (isNaN(numTimestamp) || numTimestamp <= 0) {
              throw new Error('Invalid timestamp');
            }
            // Microseconds to milliseconds
            const unixMs = numTimestamp / 1000;
            return new Date(unixMs);
          };

          try {
            const endTime = convertMicrosecondTimestamp(quizData.endTime);
            const startTime = convertMicrosecondTimestamp(quizData.startTime);

            // Check if quiz time has expired
            const timeRemainingMs = endTime.getTime() - now.getTime();
            setTimeRemaining(Math.max(0, Math.floor(timeRemainingMs / 1000)));

            // Check if quiz has already started
            const hasStarted = now.getTime() >= startTime.getTime();
            setIsQuizStarted(hasStarted);

            // Calculate time until start if quiz hasn't started yet
            if (!hasStarted) {
              const timeUntilStartMs = startTime.getTime() - now.getTime();
              setTimeUntilStart(
                Math.max(0, Math.floor(timeUntilStartMs / 1000)),
              );
            } else {
              setTimeUntilStart(0);
            }

            // 只有成功获取quiz后才获取排行榜数据
            setTimeout(() => {
              fetchQuizRankings();
            }, 100);
          } catch (err) {
            console.error('Error parsing timestamps:', err);
            setErrorMessage('Invalid quiz time data');
          }
        } else {
          // 如果不是重试，设置为错误状态
          if (!isRetry) {
            setErrorMessage('Quiz not found');
          }
          // 重试情况下不更新状态，只记录日志
          else {
            console.log('Quiz not found in this block, will retry...');
          }
        }
      } catch (err) {
        console.error('Failed to fetch quiz details:', err);
        // 错误处理策略同上
        if (!isRetry) {
          setErrorMessage(
            `Failed to fetch quiz details: ${
              err instanceof Error ? err.message : 'Unknown error'
            }`,
          );
        } else {
          console.log(
            'Error fetching quiz in retry, will try again on next block...',
          );
        }
      } finally {
        // 只有非重试情况下才更新加载状态
        if (!isRetry) {
          setLoading(false);
        }
      }
    },
    [quizId, queryApplication, fetchQuizRankings],
  );

  // Handle quiz submission
  const handleQuizSubmit = useCallback(async () => {
    if (!quiz || !primaryWallet?.address) return;

    try {
      setLoading(true);

      // Submit answers to Linera
      const mutation = SUBMIT_ANSWERS;

      const formattedAnswers = Object.entries(selectedAnswers)
        .map(([questionId, selectedIndex]) => {
          const question = quiz.questions.find(q => q.id === questionId);
          if (!question) return null;

          // 根据后端结构体格式化答案
          return {
            questionId: questionId,
            selectedAnswers: selectedIndex as number[],
          };
        })
        .filter(Boolean) as Array<{
        questionId: string;
        selectedAnswers: number[];
      }>;

      // Calculate actual time taken in milliseconds
      const timeTaken =
        quizStartTime > 0 ? Math.floor(Date.now() - quizStartTime) : 0;
      console.log(user);
      const result = await queryApplication({
        query: mutation,
        variables: {
          field0: {
            quizId: quiz.id,
            answers: formattedAnswers,
            timeTaken: timeTaken,
            nickname: user?.nickname || primaryWallet?.address || 'Anonymous',
          },
        },
      });
      console.log('提交答案结果:', result);
      setIsQuizCompleted(true);

      // Refresh rankings
      fetchQuizRankings();
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      // 使用通知系统处理错误，不影响答题体验
      notifyError(
        `提交答案失败: ${err instanceof Error ? err.message : '未知错误'}`,
      );

      // 不设置错误状态，避免影响用户界面
      // 用户可以继续答题或重新提交
    } finally {
      setLoading(false);
    }
  }, [
    quiz,
    primaryWallet,
    selectedAnswers,
    fetchQuizRankings,
    queryApplication,
    setLoading,
    setErrorMessage,
    setIsQuizCompleted,
    quizStartTime,
  ]);

  // Handle new block event - refresh data
  const handleNewBlock = useCallback(() => {
    console.log('🔄 New block received...', { hasQuiz: !!quiz });

    // 只有在还没有获取到quiz数据时才尝试重新获取
    if (!quiz) {
      console.log('🔄 Retrying to fetch quiz details...');
      fetchQuizDetails(true); // 传递true表示这是重试
    } else {
      // 如果已经获取到quiz数据，只更新排行榜
      console.log('🔄 Refreshing quiz rankings...');
      fetchQuizRankings();
    }
  }, [quiz, fetchQuizDetails, fetchQuizRankings]);

  // Register new block listener - 在组件挂载后就开始监听，但只在没quiz时重试
  useEffect(() => {
    console.log('🔌 Setting up new block listener...');
    onNewBlock(handleNewBlock);

    return () => {
      console.log('🛑 Cleaning up new block listener...');
      offNewBlock(handleNewBlock);
    };
  }, [onNewBlock, offNewBlock, handleNewBlock]);

  // Initial data fetch - only once when component mounts
  useEffect(() => {
    console.log('🚀 Initial quiz data fetch...');
    fetchQuizDetails(); // 初始查询
  }, []); // Empty dependency array to ensure it only runs once

  // 当quiz数据加载完成后自动获取排行榜
  useEffect(() => {
    if (quiz) {
      fetchQuizRankings();
    }
  }, [quiz, fetchQuizRankings]);

  // Timer countdown for quiz duration
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isQuizStarted && timeRemaining > 0 && !isQuizCompleted) {
      timer = setInterval(() => {
        setTimeRemaining(prevTime => prevTime - 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isQuizStarted, timeRemaining, isQuizCompleted, handleQuizSubmit]);

  // Timer countdown for quiz start
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (timeUntilStart > 0 && !isQuizStarted) {
      timer = setInterval(() => {
        setTimeUntilStart(prevTime => prevTime - 1);
      }, 1000);
    } else if (timeUntilStart === 0 && !isQuizStarted && quiz) {
      // When countdown reaches zero, refresh quiz data to check if it's time to start
      fetchQuizDetails(true);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timeUntilStart, isQuizStarted, quiz, fetchQuizDetails]);

  const handleStartQuiz = () => {
    setIsQuizStarted(true);
    setQuizStartTime(Date.now()); // 记录答题开始时间
  };

  const handleAnswerSelect = (
    questionId: string,
    optionIndex: number,
    isMultiple: boolean = false,
  ) => {
    console.log('选择答案:', { questionId, optionIndex, isMultiple });

    setSelectedAnswers(prev => {
      // 统一使用数组存储
      const currentAnswers = prev[questionId] || [];

      if (isMultiple) {
        // 多选题逻辑 - 存储索引数组
        const answerIndex = currentAnswers.indexOf(optionIndex);

        let newAnswers;
        if (answerIndex > -1) {
          // 如果答案已存在，则移除
          newAnswers = currentAnswers.filter(index => index !== optionIndex);
          console.log('移除答案:', { questionId, optionIndex, newAnswers });
        } else {
          // 如果答案不存在，则添加
          newAnswers = [...currentAnswers, optionIndex];
          console.log('添加答案:', { questionId, optionIndex, newAnswers });
        }

        return {
          ...prev,
          [questionId]: newAnswers,
        };
      } else {
        // 单选题逻辑 - 存储单个索引的数组
        const newState = {
          ...prev,
          [questionId]: [optionIndex], // 单选题也使用数组
        };
        console.log('单选题选择:', { questionId, optionIndex, newState });
        return newState;
      }
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="quiz-taking-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h3>Loading Quiz</h3>
          <p>Please wait while we fetch the quiz data...</p>
          <div className="loading-progress">
            <div className="loading-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  // 通用错误处理函数
  const renderErrorState = (
    title: string,
    message: string,
    showRetry: boolean = true,
  ) => (
    <div className="quiz-taking-page">
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>{title}</h3>
        <p className="error-message">{message}</p>
        <div className="error-actions">
          {showRetry && (
            <button
              className="action-button secondary"
              onClick={() => fetchQuizDetails()}
            >
              Retry
            </button>
          )}
          <button
            className="action-button primary"
            onClick={() => navigate('/')}
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    </div>
  );

  if (errorMessage) {
    return renderErrorState('Error Loading Quiz', errorMessage);
  }

  if (!quiz) {
    return renderErrorState(
      'Quiz Not Found',
      "The quiz you're looking for doesn't exist or has been removed.",
      false, // Quiz not found errors don't need retry
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;

  return (
    <div className="quiz-taking-page">
      <div className="quiz-container">
        <div className="quiz-header">
          <h2>{quiz.title}</h2>
          <p className="quiz-description">{quiz.description}</p>
          <div className="quiz-meta quiz-meta--center">
            <span>Creator: {quiz.creatorNickname}</span>
            <span>Questions: {quiz.questions.length}</span>
            {isQuizStarted && (
              <span className="timer">Time: {formatTime(timeRemaining)}</span>
            )}
          </div>
        </div>

        {!isQuizStarted && timeUntilStart > 0 && (
          <div className="quiz-starting-soon-section">
            <h3>Quiz Starting Soon!</h3>
            <div className="countdown-container">
              <div className="countdown-timer">
                {formatTime(timeUntilStart)}
              </div>
              <div className="countdown-label">Time Until Quiz Starts</div>
            </div>
            <div className="quiz-info-card">
              <div className="quiz-info-item">
                <span className="info-label">Quiz Starts At:</span>
                <span className="info-value">
                  {(() => {
                    try {
                      const startMs = Number(quiz.startTime) / 1000;
                      return new Date(startMs).toLocaleString();
                    } catch {
                      return 'Unknown';
                    }
                  })()}
                </span>
              </div>
              <div className="quiz-info-item">
                <span className="info-label">Duration:</span>
                <span className="info-value">
                  {(() => {
                    try {
                      const startMs = Number(quiz.startTime) / 1000;
                      const endMs = Number(quiz.endTime) / 1000;
                      const durationMs = endMs - startMs;
                      return Math.round(durationMs / 60000) + ' minutes';
                    } catch {
                      return 'Unknown';
                    }
                  })()}
                </span>
              </div>
              <div className="quiz-info-item">
                <span className="info-label">Questions:</span>
                <span className="info-value">{quiz.questions.length}</span>
              </div>
            </div>
            <p className="waiting-message">
              Please wait until the quiz becomes available...
            </p>
          </div>
        )}

        {!isQuizStarted && timeUntilStart === 0 && !isQuizCompleted && (
          <div className="quiz-start-section">
            <h3>Ready to start the quiz?</h3>
            <div className="quiz-info-card">
              <div className="quiz-info-item">
                <span className="info-label">Duration:</span>
                <span className="info-value">
                  {(() => {
                    try {
                      const startMs = Number(quiz.startTime) / 1000;
                      const endMs = Number(quiz.endTime) / 1000;
                      const durationMs = endMs - startMs;
                      return Math.round(durationMs / 60000) + ' minutes';
                    } catch {
                      return 'Unknown';
                    }
                  })()}
                </span>
              </div>
              <div className="quiz-info-item">
                <span className="info-label">Questions:</span>
                <span className="info-value">{quiz.questions.length}</span>
              </div>
              <div className="quiz-info-item">
                <span className="info-label">Mode:</span>
                <span className="info-value">
                  {quiz.mode.charAt(0).toUpperCase() + quiz.mode.slice(1)}
                </span>
              </div>
              <div className="quiz-info-item">
                <span className="info-label">Participants:</span>
                <span className="info-value">{quiz.participantCount}</span>
              </div>
              <div className="quiz-info-item">
                <span className="info-label">Start Time:</span>
                <span className="info-value">
                  {(() => {
                    try {
                      const startMs = Number(quiz.startTime) / 1000;
                      return new Date(startMs).toLocaleString();
                    } catch {
                      return 'Unknown';
                    }
                  })()}
                </span>
              </div>
              <div className="quiz-info-item">
                <span className="info-label">End Time:</span>
                <span className="info-value">
                  {(() => {
                    try {
                      const endMs = Number(quiz.endTime) / 1000;
                      return new Date(endMs).toLocaleString();
                    } catch {
                      return 'Unknown';
                    }
                  })()}
                </span>
              </div>
            </div>
            <div className="quiz-rules">
              <h4>Quiz Rules:</h4>
              <ul>
                <li>You must complete the quiz within the time limit</li>
                <li>Answers cannot be changed after submission</li>
                <li>
                  Both single and multiple choice questions may be included
                </li>
                <li>
                  Your score will be displayed immediately after submission
                </li>
              </ul>
            </div>
            <button
              className="action-button primary large"
              onClick={handleStartQuiz}
              disabled={!primaryWallet?.address}
            >
              {!primaryWallet?.address
                ? 'Please connect wallet first'
                : 'Start Quiz'}
            </button>
          </div>
        )}

        {isQuizStarted && !isQuizCompleted && (
          <div className="quiz-content">
            <div className="quiz-header-info">
              <div className="timer-container">
                <span
                  className={`timer ${
                    timeRemaining < 60 ? 'timer-warning' : ''
                  } ${timeRemaining < 30 ? 'timer-danger' : ''} ${
                    timeRemaining === 0 ? 'timer-expired' : ''
                  }`}
                >
                  {timeRemaining > 0
                    ? `Time Remaining: ${formatTime(timeRemaining)}`
                    : "Time's Up! Quiz has ended."}
                </span>
              </div>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
              <div className="progress-details">
                <span className="progress-text">
                  Question {currentQuestionIndex + 1} of {quiz.questions.length}
                </span>
                <span className="question-type-badge">
                  {currentQuestion.type.charAt(0).toUpperCase() +
                    currentQuestion.type.slice(1)}
                </span>
              </div>
            </div>

            <div className="question-section">
              <div className="question-header">
                <span className="question-number">
                  Q{currentQuestionIndex + 1}:
                </span>
                <h3 className="question-text">{currentQuestion.text}</h3>
              </div>
              <div className="options-container">
                {currentQuestion.options.map((option, index) => {
                  // 统一使用数组包含检查
                  const isSelected = (
                    selectedAnswers[currentQuestion.id] || []
                  ).includes(index);

                  return (
                    <label
                      key={index}
                      className={`option ${isSelected ? 'selected' : ''} ${
                        currentQuestion.type === 'multiple'
                          ? 'option-multiple'
                          : 'option-single'
                      }`}
                      onClick={e => {
                        e.preventDefault();
                        handleAnswerSelect(
                          currentQuestion.id,
                          index,
                          currentQuestion.type === 'multiple',
                        );
                      }}
                    >
                      {currentQuestion.type === 'multiple' && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            e.stopPropagation();
                            handleAnswerSelect(currentQuestion.id, index, true);
                          }}
                          className="option-checkbox"
                        />
                      )}
                      <span className="option-number">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <span className="option-text">{option}</span>
                      {currentQuestion.type === 'single' && (
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          checked={isSelected}
                          onChange={e => {
                            e.stopPropagation();
                            handleAnswerSelect(
                              currentQuestion.id,
                              index,
                              false,
                            );
                          }}
                          className="option-radio"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="navigation-buttons">
              <div className="answer-status">
                <span
                  className={`status-indicator ${
                    (selectedAnswers[currentQuestion.id] || []).length > 0
                      ? 'answered'
                      : 'unanswered'
                  }`}
                >
                  {selectedAnswers[currentQuestion.id]
                    ? '✓ Answered'
                    : '✗ Not Answered'}
                </span>
              </div>

              <div className="button-group">
                <button
                  className="action-button secondary"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  Previous
                </button>

                {currentQuestionIndex === quiz.questions.length - 1 ? (
                  <button
                    className="action-button primary"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Are you sure you want to submit the quiz? Once submitted, you cannot change your answers.',
                        )
                      ) {
                        handleQuizSubmit();
                      }
                    }}
                    disabled={timeRemaining === 0}
                  >
                    Submit Quiz
                  </button>
                ) : (
                  <button
                    className="action-button primary"
                    onClick={handleNextQuestion}
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {isQuizCompleted && (
          <div className="quiz-result-section">
            <div className="result-header">
              <h3>Quiz Completed!</h3>
              <div className="result-badge success">
                ✓ Submitted Successfully
              </div>
            </div>

            <div className="result-card">
              <div className="result-summary">
                <div className="result-item">
                  <span className="result-label">Total Questions:</span>
                  <span className="result-value">{quiz.questions.length}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Answered:</span>
                  <span className="result-value">
                    {Object.keys(selectedAnswers).length}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">Time Taken:</span>
                  <span className="result-value">
                    {(() => {
                      const timeTakenMs = Date.now() - quizStartTime;
                      const minutes = Math.floor(timeTakenMs / 60000);
                      const seconds = Math.floor((timeTakenMs % 60000) / 1000);
                      return `${minutes}m ${seconds}s`;
                    })()}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">Completion Date:</span>
                  <span className="result-value">
                    {new Date().toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="your-ranking">
                <h4>Your Ranking</h4>
                {rankings.length > 0 ? (
                  <div className="ranking-list">
                    {rankings.slice(0, 10).map((ranking, index) => (
                      <div
                        key={index}
                        className={`ranking-item ${
                          ranking.nickname === primaryWallet?.address
                            ? 'your-ranking-item'
                            : ''
                        }`}
                      >
                        <span className="rank">#{ranking.rank}</span>
                        <span className="nickname">{ranking.nickname}</span>
                        <span className="score">
                          {ranking.score}/{quiz.questions.length}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-rankings">
                    Rankings are being calculated...
                  </p>
                )}
              </div>
            </div>

            <div className="result-actions">
              <button
                className="action-button primary"
                onClick={() => navigate('/')}
              >
                Back to Quizzes
              </button>
              <button
                className="action-button secondary"
                onClick={() => {
                  // 重新加载页面以开始新的测验
                  window.location.reload();
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 只有获取到quiz后才显示排行榜 */}
      {quiz && (
        <div className="rankings-sidebar">
          <h3>Quiz Rankings</h3>
          {rankings.length > 0 ? (
            <div className="rankings-list">
              {rankings.slice(0, 10).map((ranking, index) => (
                <div key={index} className="ranking-item">
                  <span className="rank">#{ranking.rank}</span>
                  <span className="nickname">{ranking.nickname}</span>
                  <span className="score">
                    {ranking.score}/{quiz.questions.length}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-rankings">No rankings available yet</p>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizTakingPage;
