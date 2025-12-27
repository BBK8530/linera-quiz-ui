export const SET_NICKNAME = `
  mutation SetNickname($field0: SetNicknameParams!) {
    setNickname(field0: $field0)
  }
`;

export const CREATE_QUIZ = `
  mutation CreateQuiz($field0: CreateQuizParams!) {
    createQuiz(field0: $field0)
  }
`;

export const SUBMIT_ANSWERS = `
  mutation SubmitAnswers($field0: SubmitAnswersParams!) {
    submitAnswers(field0: $field0)
  }
`;

export const START_QUIZ = `
  mutation StartQuiz($field0: Int!) {
    startQuiz(field0: $field0)
  }
`;

export const REGISTER_FOR_QUIZ = `
  mutation RegisterForQuiz($field0: Int!) {
    registerForQuiz(field0: $field0)
  }
`;
