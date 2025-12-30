export const GET_QUIZ_SETS = `
  query GetQuizSets($limit: Int, $offset: Int, $sortBy: String, $sortDirection: SortDirection) {
    quizSets(limit: $limit, offset: $offset, sortBy: $sortBy, sortDirection: $sortDirection) {
      id
      title
      description
      creatorNickname
      questions {
        id
      }
      startTime
      endTime
      mode
      startMode
      isStarted
      participantCount
      createdAt
    }
  }
`;

export const GET_QUIZ_SET = `
  query GetQuizSet($quizId: Int!) {
    quizSet(quizId: $quizId) {
      id
      title
      description
      creatorNickname
      startTime
      endTime
      mode
      startMode
      isStarted
      participantCount
      questions {
        id
        text
        options
        points
        type
      }
      createdAt
    }
  }
`;

export const GET_USER_ATTEMPTS = `
  query GetUserAttempts($user: String!, $limit: Int, $offset: Int, $sortBy: String, $sortDirection: SortDirection) {
    userAttempts(user: $user, limit: $limit, offset: $offset, sortBy: $sortBy, sortDirection: $sortDirection) {
      quizId
      attempt {
        quizId
        user
        nickname
        score
        timeTaken
        completedAt
      }
    }
  }
`;

export const GET_LEADERBOARD = `
  query GetLeaderboard {
    leaderboard {
      nickname
      score
      timeTaken
      completedAt
    }
  }
`;

export const GET_QUIZ_LEADERBOARD = `
  query GetQuizLeaderboard($quizId: Int!) {
    quizLeaderboard(quizId: $quizId) {
      nickname
      score
      timeTaken
      completedAt
    }
  }
`;

export const GET_USER_PARTICIPATIONS = `
  query GetUserParticipations($user: String!) {
    userParticipations(user: $user)
  }
`;

export const GET_USER_CREATED_QUIZZES = `
  query GetUserCreatedQuizzes($nickname: String!, $limit: Int, $offset: Int, $sortBy: String, $sortDirection: SortDirection) {
    getUserCreatedQuizzes(nickname: $nickname, limit: $limit, offset: $offset, sortBy: $sortBy, sortDirection: $sortDirection) {
      id
      title
      description
      creatorNickname
      startTime
      endTime
      mode
      startMode
      isStarted
      participantCount
    }
  }
`;

export const GET_USER_PARTICIPATED_QUIZZES = `
  query GetUserParticipatedQuizzes($walletAddress: String!, $limit: Int, $offset: Int, $sortBy: String, $sortDirection: SortDirection) {
    getUserParticipatedQuizzes(walletAddress: $walletAddress, limit: $limit, offset: $offset, sortBy: $sortBy, sortDirection: $sortDirection) {
      id
      title
      description
      creatorNickname
      startTime
      endTime
      mode
      startMode
      isStarted
      participantCount
    }
  }
`;

export const GET_USER = `
  query GetUser($walletAddress: String!) {
    user(walletAddress: $walletAddress) {
      walletAddress
      nickname
      createdAt
    }
  }
`;

export const GET_USER_BY_NICKNAME = `
  query GetUserByNickname($nickname: String!) {
    userByNickname(nickname: $nickname) {
      walletAddress
      nickname
      createdAt
    }
  }
`;

export const GET_QUIZ_PARTICIPANTS = `
  query GetQuizParticipants($quizId: Int!) {
    getQuizParticipants(quizId: $quizId)
  }
`;

export const IS_USER_PARTICIPATED = `
  query IsUserParticipated($quizId: Int!, $walletAddress: String!) {
    isUserParticipated(quizId: $quizId, walletAddress: $walletAddress)
  }
`;

// ---------------------- Apollo Client 版本 ----------------------
import { gql } from '@apollo/client';

export const GET_QUIZ_SETS_APOLLO = gql`
  query GetQuizSets(
    $limit: Int
    $offset: Int
    $sortBy: String
    $sortDirection: SortDirection
  ) {
    quizSets(
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      id
      title
      description
      creatorNickname
      questions {
        id
      }
      startTime
      endTime
      mode
      startMode
      isStarted
      participantCount
      createdAt
    }
  }
`;

export const GET_QUIZ_SET_APOLLO = gql`
  query GetQuizSet($quizId: Int!) {
    quizSet(quizId: $quizId) {
      id
      title
      description
      creatorNickname
      startTime
      endTime
      mode
      startMode
      isStarted
      participantCount
      questions {
        id
        text
        options
        points
        type
      }
      createdAt
    }
  }
`;

export const GET_USER_ATTEMPTS_APOLLO = gql`
  query GetUserAttempts(
    $user: String!
    $limit: Int
    $offset: Int
    $sortBy: String
    $sortDirection: SortDirection
  ) {
    userAttempts(
      user: $user
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      quizId
      attempt {
        quizId
        user
        nickname
        score
        timeTaken
        completedAt
      }
    }
  }
`;

export const GET_LEADERBOARD_APOLLO = gql`
  query GetLeaderboard {
    leaderboard {
      nickname
      score
      timeTaken
      completedAt
    }
  }
`;

export const GET_QUIZ_LEADERBOARD_APOLLO = gql`
  query GetQuizLeaderboard($quizId: Int!) {
    quizLeaderboard(quizId: $quizId) {
      nickname
      score
      timeTaken
      completedAt
    }
  }
`;

export const GET_USER_PARTICIPATIONS_APOLLO = gql`
  query GetUserParticipations($user: String!) {
    userParticipations(user: $user)
  }
`;

export const GET_USER_CREATED_QUIZZES_APOLLO = gql`
  query GetUserCreatedQuizzes(
    $nickname: String!
    $limit: Int
    $offset: Int
    $sortBy: String
    $sortDirection: SortDirection
  ) {
    getUserCreatedQuizzes(
      nickname: $nickname
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      id
      title
      description
      creatorNickname
      startTime
      endTime
      mode
      startMode
      isStarted
      participantCount
    }
  }
`;

export const GET_USER_PARTICIPATED_QUIZZES_APOLLO = gql`
  query GetUserParticipatedQuizzes(
    $walletAddress: String!
    $limit: Int
    $offset: Int
    $sortBy: String
    $sortDirection: SortDirection
  ) {
    getUserParticipatedQuizzes(
      walletAddress: $walletAddress
      limit: $limit
      offset: $offset
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      id
      title
      description
      creatorNickname
      startTime
      endTime
      mode
      startMode
      isStarted
      participantCount
    }
  }
`;

export const GET_USER_APOLLO = gql`
  query GetUser($walletAddress: String!) {
    user(walletAddress: $walletAddress) {
      walletAddress
      nickname
      createdAt
    }
  }
`;

export const GET_USER_BY_NICKNAME_APOLLO = gql`
  query GetUserByNickname($nickname: String!) {
    userByNickname(nickname: $nickname) {
      walletAddress
      nickname
      createdAt
    }
  }
`;

export const GET_QUIZ_PARTICIPANTS_APOLLO = gql`
  query GetQuizParticipants($quizId: Int!) {
    getQuizParticipants(quizId: $quizId)
  }
`;

export const IS_USER_PARTICIPATED_APOLLO = gql`
  query IsUserParticipated($quizId: Int!, $walletAddress: String!) {
    isUserParticipated(quizId: $quizId, walletAddress: $walletAddress)
  }
`;

// 添加订阅查询
export const QUIZ_EVENTS_SUBSCRIPTION_APOLLO = gql`
  subscription Notifications($chainId: ChainId!) {
    notifications(chainId: $chainId)
  }
`;
