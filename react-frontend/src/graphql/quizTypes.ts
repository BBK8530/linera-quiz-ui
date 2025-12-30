// GraphQL Types for Quiz Application - Aligned with backend schema

// Types matching backend schema

export interface QuestionView {
  id: string;
  text: string;
  options: string[];
  points: number;
  type: string;
}

export interface QuizSetView {
  id: number;
  title: string;
  description: string;
  creator: string;
  creatorNickname: string;
  questions: QuestionView[];
  startTime: string;
  endTime: string;
  createdAt: string;
  mode: string;
  startMode: string;
  isStarted: boolean;
  registeredUsers: string[];
  participantCount: number;
}

export interface UserAttemptView {
  quizId: number;
  user: string;
  nickname: string;
  answers: number[][];
  score: number;
  timeTaken: number;
  completedAt: string;
}

export interface QuizAttempt {
  quizId: number;
  attempt: UserAttemptView;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  timeTaken: number;
  completedAt: string;
  rank?: number;
}

export interface SetNicknameParams {
  nickname: string;
}

export interface QuestionParamsInput {
  id: string;
  text: string;
  options: string[];
  correctOptions: number[];
  points: number;
  questionType: string;
}

export interface AnswerOption {
  questionId: string;
  selectedAnswers: number[];
}

export interface SubmitAnswersParams {
  quizId: number;
  answers: AnswerOption[];
  timeTaken: number;
  nickname: string;
}

export interface CreateQuizParams {
  title: string;
  description: string;
  questions: QuestionParamsInput[];
  timeLimit: number;
  startTime: string;
  endTime: string;
  nickname: string;
  mode: string;
  startMode: string;
}

// Additional types from backend schema
export interface UserView {
  walletAddress: string;
  nickname: string;
  createdAt: string;
}

export type SortDirection = 'ASC' | 'DESC';


// Backward compatibility aliases
export type Question = QuestionView;
export type QuizSet = QuizSetView;
export type UserAttempt = UserAttemptView;
export type QuestionParams = QuestionParamsInput;
