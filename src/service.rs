#![cfg_attr(target_arch = "wasm32", no_main)]

use async_graphql::{EmptySubscription, Request, Response, Schema};
use linera_sdk::graphql::GraphQLMutationRoot;
use linera_sdk::linera_base_types::WithServiceAbi;
use linera_sdk::views::View;
use linera_sdk::{Service, ServiceRuntime};
use quiz::state::QuizState;
use quiz::{Operation, QuestionView, QuizAttempt, QuizSetView, UserAttemptView};
use std::sync::Arc;

linera_sdk::service!(QuizService);

pub struct QuizService {
    state: Arc<QuizState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

struct QueryRoot {
    state: Arc<QuizState>,
    runtime: Arc<ServiceRuntime<QuizService>>,
}

#[async_graphql::Object]
impl QueryRoot {
    async fn quiz_set(&self, quiz_id: u64) -> Option<QuizSetView> {
        match self.state.quiz_sets.get(&quiz_id).await {
            Ok(option) => option.map(|quiz| QuizSetView {
                id: quiz.id,
                title: quiz.title.clone(),
                description: quiz.description.clone(),
                creator: quiz.creator,
                questions: quiz
                    .questions
                    .iter()
                    .map(|q| QuestionView {
                        id: q.id.clone(),
                        text: q.text.clone(),
                        options: q.options.clone(),
                        points: q.points,
                        question_type: q.question_type.clone(),
                    })
                    .collect(),
                start_time: quiz.start_time.micros().to_string(),
                end_time: quiz.end_time.micros().to_string(),
                created_at: quiz.created_at.micros().to_string(),
            }),
            Err(_) => None,
        }
    }

    async fn quiz_sets(&self) -> Vec<QuizSetView> {
        let mut quiz_sets = Vec::new();

        let _ = self
            .state
            .quiz_sets
            .for_each_index_value(|_key, quiz| {
                let quiz = quiz.into_owned();
                let quiz_view = QuizSetView {
                    id: quiz.id,
                    title: quiz.title.clone(),
                    description: quiz.description.clone(),
                    creator: quiz.creator,
                    questions: quiz
                        .questions
                        .iter()
                        .map(|q| QuestionView {
                            id: q.id.clone(),
                            text: q.text.clone(),
                            options: q.options.clone(),
                            points: q.points,
                            question_type: q.question_type.clone(),
                        })
                        .collect(),
                    start_time: quiz.start_time.micros().to_string(),
                    end_time: quiz.end_time.micros().to_string(),
                    created_at: quiz.created_at.micros().to_string(),
                };
                quiz_sets.push(quiz_view);
                Ok(())
            })
            .await;

        quiz_sets
    }

    async fn user_attempts(&self, user: String) -> Vec<QuizAttempt> {
        let mut attempts = Vec::new();

        let _ = self
            .state
            .user_attempts
            .for_each_index_value(|(quiz_id, u), attempt| {
                if u == user {
                    let attempt = attempt.into_owned();
                    let attempt_view = UserAttemptView {
                        quiz_id: attempt.quiz_id,
                        user: attempt.user,
                        answers: attempt.answers,
                        score: attempt.score,
                        time_taken: attempt.time_taken,
                        completed_at: attempt.completed_at.micros().to_string(),
                    };
                    attempts.push(QuizAttempt {
                        quiz_id,
                        attempt: attempt_view,
                    });
                }
                Ok(())
            })
            .await;

        attempts
    }

    async fn leaderboard(&self) -> Vec<UserAttemptView> {
        let mut entries = std::collections::HashMap::new();

        let _ = self
            .state
            .user_attempts
            .for_each_index_value(|(_quiz_id, user), attempt| {
                let attempt = attempt.into_owned();
                let entry = entries.entry(user).or_insert((0, u64::MAX));
                if entry.0 < u32::MAX - attempt.score {
                    entry.0 += attempt.score;
                } else {
                    entry.0 = u32::MAX;
                }
                if attempt.time_taken < entry.1 {
                    entry.1 = attempt.time_taken;
                }
                Ok(())
            })
            .await;

        let mut leaderboard: Vec<_> = entries
            .into_iter()
            .map(|(user, (score, time_taken))| UserAttemptView {
                quiz_id: 0,
                user,
                answers: Vec::new(),
                score,
                time_taken,
                completed_at: self.runtime.system_time().micros().to_string(),
            })
            .collect();
        leaderboard.sort_by(|a, b| b.score.cmp(&a.score).then(a.time_taken.cmp(&b.time_taken)));
        leaderboard
    }

    async fn quiz_leaderboard(&self, quiz_id: u64) -> Vec<UserAttemptView> {
        let mut entries = std::collections::HashMap::new();

        let _ = self
            .state
            .user_attempts
            .for_each_index_value(|(q_id, user), attempt| {
                if q_id == quiz_id {
                    let attempt = attempt.into_owned();
                    let entry = entries.entry(user).or_insert((0, u64::MAX, String::new()));
                    if attempt.score > entry.0
                        || (attempt.score == entry.0 && attempt.time_taken < entry.1)
                    {
                        entry.0 = attempt.score;
                        entry.1 = attempt.time_taken;
                        entry.2 = attempt.completed_at.micros().to_string();
                    }
                }
                Ok(())
            })
            .await;

        let mut leaderboard: Vec<_> = entries
            .into_iter()
            .map(
                |(user, (score, time_taken, completed_at))| UserAttemptView {
                    quiz_id,
                    user,
                    answers: Vec::new(),
                    score,
                    time_taken,
                    completed_at: completed_at,
                },
            )
            .collect();
        leaderboard.sort_by(|a, b| b.score.cmp(&a.score).then(a.time_taken.cmp(&b.time_taken)));
        leaderboard
    }

    async fn user_participations(&self, user: String) -> Vec<u64> {
        match self.state.user_participations.get(&user).await {
            Ok(Some(v)) => v,
            Ok(None) => Vec::default(),
            Err(_) => Vec::default(),
        }
    }
    async fn get_user_created_quizzes(&self, nickname: String) -> Vec<QuizSetView> {
        let mut created_quizzes = Vec::new();
        let _ = self
            .state
            .quiz_sets
            .for_each_index_value(|_key, quiz| {
                let quiz = quiz.into_owned();
                if quiz.creator == nickname {
                    created_quizzes.push(QuizSetView {
                        id: quiz.id,
                        title: quiz.title.clone(),
                        description: quiz.description.clone(),
                        creator: quiz.creator,
                        questions: quiz
                            .questions
                            .iter()
                            .map(|q| QuestionView {
                                id: q.id.clone(),
                                text: q.text.clone(),
                                options: q.options.clone(),
                                points: q.points,
                                question_type: q.question_type.clone(),
                            })
                            .collect(),
                        start_time: quiz.start_time.micros().to_string(),
                        end_time: quiz.end_time.micros().to_string(),
                        created_at: quiz.created_at.micros().to_string(),
                    });
                }
                Ok(())
            })
            .await;
        created_quizzes
    }

    async fn get_user_participated_quizzes(&self, nickname: String) -> Vec<QuizSetView> {
        let mut participated_quizzes = Vec::new();
        let quiz_ids = self
            .state
            .user_participations
            .get(&nickname)
            .await
            .unwrap()
            .unwrap_or_default();
        for &quiz_id in &quiz_ids {
            if let Some(quiz_set) = self.state.quiz_sets.get(&quiz_id).await.unwrap() {
                participated_quizzes.push(QuizSetView {
                    id: quiz_set.id,
                    title: quiz_set.title.clone(),
                    description: quiz_set.description.clone(),
                    creator: quiz_set.creator.clone(),
                    questions: quiz_set
                        .questions
                        .iter()
                        .map(|q| QuestionView {
                            id: q.id.clone(),
                            text: q.text.clone(),
                            options: q.options.clone(),
                            points: q.points,
                            question_type: q.question_type.clone(),
                        })
                        .collect(),
                    start_time: quiz_set.start_time.micros().to_string(),
                    end_time: quiz_set.end_time.micros().to_string(),
                    created_at: quiz_set.created_at.micros().to_string(),
                });
            }
        }
        participated_quizzes
    }
}

impl WithServiceAbi for QuizService {
    type Abi = quiz::QuizAbi;
}

impl Service for QuizService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = QuizState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load QuizState");
        QuizService {
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Request) -> Response {
        let schema = Schema::build(
            QueryRoot {
                state: self.state.clone(),
                runtime: self.runtime.clone(),
            },
            Operation::mutation_root(self.runtime.clone()),
            EmptySubscription,
        )
        .finish();
        schema.execute(request).await
    }
}
