import { gql } from '@apollo/client';

// 获取所有测验集合
export const GET_ALL_QUIZ_SETS = gql`
  query GetAllQuizSets {
    quizSets {
      id
      title
      description
      creator
      startTime
      endTime
      createdAt
      questions {
        id
        text
        options
        points
        type
      }
    }
  }
`;

// 获取单个测验集合详情
export const GET_QUIZ_SET = gql`
  query GetQuizSet($quizId: ID!) {
    quizSet(quizId: $quizId) {
      id
      title
      description
      creator
      startTime
      endTime
      createdAt
      questions {
        id
        text
        options
        points
        type
      }
    }
  }
`;

// 获取用户测验尝试记录
export const GET_USER_ATTEMPTS = gql`
  query GetUserAttempts($user: String!) {
    userAttempts(user: $user) {
      quizId
      attempt {
        quizId
        user
        answers
        score
        timeTaken
        completedAt
      }
    }
  }
`;

// 获取总排行榜
export const GET_LEADERBOARD = gql`
  query GetLeaderboard {
    leaderboard {
      user
      score
      timeTaken
    }
  }
`;

// 获取单个测验的排行榜
export const GET_QUIZ_LEADERBOARD = gql`
  query GetQuizLeaderboard($quizId: ID!) {
    quizLeaderboard(quizId: $quizId) {
      quizId
      user
      score
      completedAt
      timeTaken
    }
  }
`;

// 获取用户资料
export const GET_USER_PROFILE = gql`
  query GetUserProfile($user: String!) {
    userProfile(user: $user) {
      nickname
      account
    }
  }
`;

// 获取用户创建的测验集合
export const GET_USER_CREATED_QUIZZES = gql`
  query GetUserCreatedQuizzes($nickname: String!) {
    getUserCreatedQuizzes(nickname: $nickname) {
      id
      title
      description
      creator
      startTime
      endTime
      createdAt
      questions {
        id
        text
        options
        points
        type
      }
    }
  }
`;

// 获取用户参与的测验集合
export const GET_USER_PARTICIPATED_QUIZZES = gql`
  query GetUserParticipatedQuizzes($user: String!) {
    userParticipatedQuizzes(user: $user) {
      id
      title
      description
      creator
      startTime
      endTime
      createdAt
      questions {
        id
        text
        options
        points
        type
      }
    }
  }
`;