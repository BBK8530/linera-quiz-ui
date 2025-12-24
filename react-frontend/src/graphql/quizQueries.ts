import { gql } from '@apollo/client';

export const GET_QUIZZES = gql`
  query GetQuizzes {
    quizzes {
      id
      title
      description
      duration
      creator_nickname
      is_started
      is_ended
      registered_count
      questions {
        id
        text
        options
        correct_answer
      }
      created_at
    }
  }
`;

export const GET_QUIZ = gql`
  query GetQuiz($quizId: ID!) {
    quiz(id: $quizId) {
      id
      title
      description
      duration
      creator_nickname
      is_started
      is_ended
      registered_count
      questions {
        id
        text
        options
        correct_answer
      }
    }
  }
`;

export const GET_USER = gql`
  query GetUser($walletAddress: String!) {
    user(walletAddress: $walletAddress) {
      nickname
      walletAddress
      createdAt
    }
  }
`;

export const GET_LEADERBOARD = gql`
  query GetLeaderboard($quizId: ID!) {
    leaderboard(quiz_id: $quizId) {
      user_nickname
      score
      time_used
      rank
    }
  }
`;
