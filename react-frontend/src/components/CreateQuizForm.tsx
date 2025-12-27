import React, { useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useConnection } from '../contexts/ConnectionContext';
import useNotification from '../hooks/useNotification';
import { useNavigate } from 'react-router-dom';
import { CREATE_QUIZ } from '../graphql/quizMutations';
import type { QuestionParamsInput } from '../graphql/quizTypes';


// Local interface to match form fields with backend types
interface LocalQuestion
  extends Omit<QuestionParamsInput, 'correctOptions' | 'questionType'> {
  correct_options: number[];
  question_type: 'single' | 'multiple';
}

const CreateQuizForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timeLimit, setTimeLimit] = useState<number>(300); // Default 5 minutes
  const [mode, setMode] = useState<string>('public'); // "public" or "registration"
  const [startMode, setStartMode] = useState<string>('auto'); // "auto" or "manual"
  const [questions, setQuestions] = useState<LocalQuestion[]>([
    {
      text: '',
      options: ['', '', '', ''],
      correct_options: [],
      points: 10,
      question_type: 'single',
      id: '',
    },
  ]);

  const { user, primaryWallet } = useDynamicContext();
  const { connectToLinera, queryApplication } = useConnection();
  const [loading, setLoading] = useState(false);
  const { success, error } = useNotification();
  const navigate = useNavigate();

  // Reset form to initial state
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime('');
    setEndTime('');
    setTimeLimit(300);
    setMode('public');
    setStartMode('auto');
    setQuestions([
      {
        text: '',
        options: ['', '', '', ''],
        correct_options: [],
        points: 10,
        question_type: 'single',
        id: '',
      },
    ]);
  };

  const handleQuestionChange = (
    index: number,
    field: keyof LocalQuestion,
    value: string | number | number[] | 'single' | 'multiple',
  ) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuestions(updatedQuestions);
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(updatedQuestions);
  };

  const addOption = (questionIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options.push('');
    setQuestions(updatedQuestions);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[questionIndex].options.length <= 1) return;

    // Remove the option
    updatedQuestions[questionIndex].options.splice(optionIndex, 1);

    // Update correct_options indices
    updatedQuestions[questionIndex].correct_options = updatedQuestions[
      questionIndex
    ].correct_options
      .filter(idx => idx !== optionIndex)
      .map(idx => (idx > optionIndex ? idx - 1 : idx));

    setQuestions(updatedQuestions);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: '',
        options: ['', '', '', ''],
        correct_options: [],
        points: 10,
        question_type: 'single',
        id: '',
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      const updatedQuestions = questions.filter((_, i) => i !== index);
      setQuestions(updatedQuestions);
    }
  };

  const handleCorrectOptionChange = (
    questionIndex: number,
    optionIndex: number,
    isChecked: boolean,
  ) => {
    const updatedQuestions = [...questions];
    const question = updatedQuestions[questionIndex];

    if (question.question_type === 'single') {
      // For single choice, only one correct answer
      updatedQuestions[questionIndex].correct_options = isChecked
        ? [optionIndex]
        : [];
    } else {
      // For multiple choice, toggle the option
      if (isChecked) {
        // Add if not already present
        if (!question.correct_options.includes(optionIndex)) {
          updatedQuestions[questionIndex].correct_options.push(optionIndex);
        }
      } else {
        // Remove if present
        updatedQuestions[questionIndex].correct_options =
          question.correct_options.filter(idx => idx !== optionIndex);
      }
    }

    setQuestions(updatedQuestions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      error('标题和描述不能为空');
      return;
    }

    if (!startTime || !endTime) {
      error('请选择测验开始和结束时间');
      return;
    }

    // Validate time range
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const now = new Date();

    if (startDate <= now) {
      error('开始时间必须是未来时间');
      return;
    }

    if (endDate <= startDate) {
      error('结束时间必须晚于开始时间');
      return;
    }

    if (timeLimit <= 0) {
      error('时间限制必须大于0秒');
      return;
    }

    // 检查所有问题是否都填写完整
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.text.trim()) {
        error(`第${i + 1}题的问题文本不能为空`);
        return;
      }

      for (let j = 0; j < question.options.length; j++) {
        if (!question.options[j].trim()) {
          error(`第${i + 1}题的第${j + 1}个选项不能为空`);
          return;
        }
      }

      if (question.correct_options.length === 0) {
        error(`请为第${i + 1}题选择正确答案`);
        return;
      }
    }

    if (!user || !primaryWallet) {
      error('请先登录');
      return;
    }

    try {
      setLoading(true);
      // Connect to Linera using ConnectionContext
      await connectToLinera();

      // Convert time to millisecond timestamp string
      const startTimestamp = startDate.getTime().toString();
      const endTimestamp = endDate.getTime().toString();

      // Format questions for submission
      const formattedQuestions = questions.map((q, index) => ({
        text: q.text,
        options: q.options,
        correctOptions: q.correct_options,
        points: q.points,
        questionType: q.question_type,
        id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      // Use Linera SDK for mutation via ConnectionContext
      await queryApplication({
        query: CREATE_QUIZ,
        variables: {
          field0: {
            title: title.trim(),
            description: description.trim(),
            questions: formattedQuestions,
            timeLimit: timeLimit,
            startTime: startTimestamp,
            endTime: endTimestamp,
            nickname: user.username || 'QuizCreator',
            mode: mode,
            startMode: startMode,
          },
        },
      });

      success('测验创建成功！');
      // 重置表单
      resetForm();
      // 跳转到测验列表页
      navigate('/'); // 假设首页是测验列表页
    } catch (err: unknown) {
      console.error('创建测验失败:', err);
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      error(`创建测验失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="create-quiz-form">
        <h2>创建测验</h2>
        <p>请先登录以创建测验</p>
      </div>
    );
  }

  return (
    <div className="create-quiz-form">
      <div className="content-wrapper">
        <div className="content-header">
          <h2>创建测验</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">
              测验标题{' '}
              <span className="help-text">为您的测验输入一个清晰的标题</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="输入测验标题"
              required
              className={loading ? 'loading-input' : ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">
              测验描述{' '}
              <span className="help-text">简要描述测验的内容和目的</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="输入测验描述"
              required
              rows={4}
              className={loading ? 'loading-input' : ''}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startTime">
                开始时间 <span className="help-text">选择测验开始的时间</span>
              </label>
              <input
                type="datetime-local"
                id="startTime"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                required
                className={loading ? 'loading-input' : ''}
              />
            </div>

            <div className="form-group">
              <label htmlFor="endTime">
                结束时间 <span className="help-text">选择测验结束的时间</span>
              </label>
              <input
                type="datetime-local"
                id="endTime"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                required
                className={loading ? 'loading-input' : ''}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="timeLimit">
              时间限制（秒）{' '}
              <span className="help-text">
                设置参加者完成测验的总时间（1-3600秒）
              </span>
            </label>
            <input
              type="number"
              id="timeLimit"
              value={timeLimit}
              onChange={e => setTimeLimit(parseInt(e.target.value))}
              min="1"
              max="3600"
              required
              className={loading ? 'loading-input' : ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="mode">
              测验模式 <span className="help-text">选择测验的参与方式</span>
            </label>
            <div className="mode-options">
              <label>
                <input
                  type="radio"
                  name="mode"
                  value="public"
                  checked={mode === 'public'}
                  onChange={() => setMode('public')}
                  disabled={loading}
                />
                公开模式 - 所有用户都可以参加
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  value="registration"
                  checked={mode === 'registration'}
                  onChange={() => setMode('registration')}
                  disabled={loading}
                />
                报名模式 - 用户需要先报名才能参加
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="startMode">
              开始方式 <span className="help-text">选择测验的开始方式</span>
            </label>
            <div className="start-mode-options">
              <label>
                <input
                  type="radio"
                  name="startMode"
                  value="auto"
                  checked={startMode === 'auto'}
                  onChange={() => setStartMode('auto')}
                  disabled={loading}
                />
                自动开始 - 在设定的开始时间自动开始
              </label>
              <label>
                <input
                  type="radio"
                  name="startMode"
                  value="manual"
                  checked={startMode === 'manual'}
                  onChange={() => setStartMode('manual')}
                  disabled={loading}
                />
                手动开始 - 需要创建者手动启动测验
              </label>
            </div>
          </div>

          <h3>问题</h3>
          {questions.map((question, index) => (
            <div key={index} className="question-group">
              <div className="question-header">
                <h4>问题 {index + 1}</h4>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => removeQuestion(index)}
                  disabled={questions.length <= 1}
                >
                  删除
                </button>
              </div>

              <div className="form-group">
                <label htmlFor={`question-${index}`}>
                  问题文本{' '}
                  <span className="help-text">请输入清晰明确的问题文本</span>
                </label>
                <input
                  type="text"
                  id={`question-${index}`}
                  value={question.text}
                  onChange={e =>
                    handleQuestionChange(index, 'text', e.target.value)
                  }
                  placeholder="输入问题文本"
                  required
                  className={loading ? 'loading-input' : ''}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor={`question-type-${index}`}>
                  问题类型{' '}
                  <span className="help-text">
                    选择问题的类型：单选题或多选题
                  </span>
                </label>
                <div className="question-type-options">
                  <label>
                    <input
                      type="radio"
                      name={`question-type-${index}`}
                      value="single"
                      checked={question.question_type === 'single'}
                      onChange={() =>
                        handleQuestionChange(index, 'question_type', 'single')
                      }
                      disabled={loading}
                    />
                    单选题
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`question-type-${index}`}
                      value="multiple"
                      checked={question.question_type === 'multiple'}
                      onChange={() =>
                        handleQuestionChange(index, 'question_type', 'multiple')
                      }
                      disabled={loading}
                    />
                    多选题
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor={`points-${index}`}>
                  分值{' '}
                  <span className="help-text">设置该问题的分值（1-100分）</span>
                </label>
                <input
                  type="number"
                  id={`points-${index}`}
                  value={question.points}
                  onChange={e =>
                    handleQuestionChange(
                      index,
                      'points',
                      parseInt(e.target.value),
                    )
                  }
                  min="1"
                  max="100"
                  required
                  className={loading ? 'loading-input' : ''}
                  disabled={loading}
                />
              </div>

              <div className="options-group">
                <label>选项</label>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="option-item">
                    <div className="option-control">
                      {question.question_type === 'single' ? (
                        <input
                          type="radio"
                          id={`option-${index}-${optionIndex}`}
                          name={`correct-option-${index}`}
                          checked={question.correct_options.includes(
                            optionIndex,
                          )}
                          onChange={e =>
                            handleCorrectOptionChange(
                              index,
                              optionIndex,
                              e.target.checked,
                            )
                          }
                          required
                          disabled={loading}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          id={`option-${index}-${optionIndex}`}
                          checked={question.correct_options.includes(
                            optionIndex,
                          )}
                          onChange={e =>
                            handleCorrectOptionChange(
                              index,
                              optionIndex,
                              e.target.checked,
                            )
                          }
                          disabled={loading}
                        />
                      )}
                      <label htmlFor={`option-${index}-${optionIndex}`}>
                        {String.fromCharCode(65 + optionIndex)}.
                      </label>
                    </div>
                    <div className="option-input">
                      <input
                        type="text"
                        value={option}
                        onChange={e =>
                          handleOptionChange(index, optionIndex, e.target.value)
                        }
                        placeholder={`选项 ${String.fromCharCode(
                          65 + optionIndex,
                        )}`}
                        required
                        className={loading ? 'loading-input' : ''}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => removeOption(index, optionIndex)}
                        disabled={question.options.length <= 1 || loading}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="success-button"
                  onClick={() => addOption(index)}
                  disabled={loading}
                >
                  添加选项
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="success-button"
            onClick={addQuestion}
            disabled={loading}
          >
            添加问题
          </button>

          <div className="form-actions">
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? '创建中...' : '创建测验'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuizForm;
