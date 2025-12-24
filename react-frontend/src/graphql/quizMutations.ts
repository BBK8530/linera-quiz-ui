import { gql } from '@apollo/client';

export const SET_NICKNAME = gql`
  mutation SetNickname($field0: SetNicknameParams!) {
    setNickname(field0: $field0)
  }
`;

export const CREATE_QUIZ = gql`
  mutation CreateQuiz($field0: CreateQuizParams!) {
    createQuiz(field0: $field0)
  }
`;

export const START_QUIZ = gql`
  mutation StartQuiz($quizId: ID!) {
    start_quiz(params: { quiz_id: $quizId }) {
      success
    }
  }
`;

export const SUBMIT_ANSWERS = gql`
  mutation SubmitAnswers($quizId: ID!, $answers: [SubmitAnswerInput!]!) {
    submit_answers(params: { quiz_id: $quizId, answers: $answers }) {
      success
      score
      time_used
    }
  }
`;

export const REGISTER_FOR_QUIZ = gql`
  mutation RegisterForQuiz($quizId: ID!) {
    register_for_quiz(params: { quiz_id: $quizId }) {
      success
    }
  }
`;
