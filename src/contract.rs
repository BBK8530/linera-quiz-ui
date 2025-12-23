// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::linera_base_types::TimeDelta;
use linera_sdk::{
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use crate::state::{Question, QuizSet, QuizState, UserAttempt};
use quiz::{CreateQuizParams, LeaderboardEntry, Operation, SubmitAnswersParams};


pub struct QuizContract {
    state: QuizState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(QuizContract);

impl WithContractAbi for QuizContract {
    type Abi = quiz::QuizAbi;
}

impl Contract for QuizContract {
    type Message = ();
    type InstantiationArgument = ();
    type Parameters = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = QuizState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load QuizState");
        QuizContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: ()) {
        // 初始化下一个Quiz ID为1
        let current_value = self.state.next_quiz_id.get();
        if *current_value == 0 {
            self.state.next_quiz_id.set(1);
        }
    }

    async fn execute_operation(&mut self, operation: Operation) -> Self::Response {
        match operation {
            Operation::CreateQuiz(params) => {
                self.create_quiz(params).await;
            }
            Operation::SubmitAnswers(params) => {
                self.submit_answers(params).await;
            }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }

    async fn execute_message(&mut self, _message: ()) {
        // Not implemented yet
    }
}

impl QuizContract {
    async fn create_quiz(&mut self, params: CreateQuizParams) {
        let current_time = self.runtime.system_time();

        // 验证测验时间范围
        let start_time_millis = params
            .start_time
            .parse::<u64>()
            .expect("Invalid start time format");

        // 检查时间戳长度是否合理（毫秒级时间戳应该是13位左右）
        assert!(
            start_time_millis.to_string().len() >= 10 && start_time_millis.to_string().len() <= 14,
            "Start time seems invalid (should be a millisecond timestamp)"
        );

        let start_time: linera_sdk::linera_base_types::Timestamp = start_time_millis
            .checked_mul(1000)
            .expect("Start time overflow when converting to microseconds")
            .into(); // 毫秒转微秒

        let end_time_millis = params
            .end_time
            .parse::<u64>()
            .expect("Invalid end time format");

        // 检查时间戳长度是否合理（毫秒级时间戳应该是13位左右）
        assert!(
            end_time_millis.to_string().len() >= 10 && end_time_millis.to_string().len() <= 14,
            "End time seems invalid (should be a millisecond timestamp)"
        );

        let end_time: linera_sdk::linera_base_types::Timestamp = end_time_millis
            .checked_mul(1000)
            .expect("End time overflow when converting to microseconds")
            .into(); // 毫秒转微秒

        assert!(
            start_time > current_time,
            "Start time must be in the future"
        );
        assert!(end_time > start_time, "End time must be after start time");
        // 检查时间范围是否合理（不超过100年）
        assert!(
            end_time.delta_since(start_time) <= TimeDelta::from_secs(3600 * 24 * 365 * 100),
            "Time range is too long (maximum 100 years)"
        );

        let quiz_id = *self.state.next_quiz_id.get();
        let _creator_owner = self
            .runtime
            .authenticated_signer()
            .expect("Failed to get authenticated signer: no user authenticated");
        let creator = params.nick_name.clone();

        let quiz_set = QuizSet {
            id: quiz_id,
            title: params.title,
            description: params.description,
            creator,
            questions: params
                .questions
                .into_iter()
                .enumerate()
                .map(|(index, q)| {
                    // 使用测验ID和题目索引生成唯一ID
                    let id = format!("q{}-{}", quiz_id, index);
                    
                    // 根据正确答案的个数设置type
                    let question_type = if q.correct_options.len() > 1 { "checkbox" } else { "radio" };
                    
                    Question {
                        id,
                        text: q.text,
                        options: q.options,
                        correct_options: q.correct_options,
                        points: q.points,
                        question_type: question_type.to_string(),
                    }
                })
                .collect(),
            time_limit: params.time_limit,
            start_time,
            end_time,
            created_at: current_time,
        };

        // 存储新Quiz
        let _ = self.state.quiz_sets.insert(&quiz_id, quiz_set);
        // 更新下一个Quiz ID
        let next_id = quiz_id.checked_add(1).expect("Quiz ID overflow");
        self.state.next_quiz_id.set(next_id);
    }

    async fn submit_answers(&mut self, params: SubmitAnswersParams) {
        let user = params.nick_name.clone();

        let quiz_id = params.quiz_id;
        let now = self.runtime.system_time();

        // 检查Quiz是否存在
        let quiz_set = self
            .state
            .quiz_sets
            .get(&quiz_id)
            .await
            .expect("Failed to retrieve quiz from storage")
            .expect("QuizSet not found");

        // 检查测验时间范围
        assert!(now >= quiz_set.start_time, "Quiz has not started yet");
        assert!(now <= quiz_set.end_time, "Quiz has ended");

        // 检查用户是否已提交过该Quiz
        if self
            .state
            .user_attempts
            .get(&(quiz_id, user.clone()))
            .await
            .unwrap()
            .is_some()
        {
            panic!("User has already attempted this quiz");
        }

        // 创建题目ID到题目的映射，用于快速查找
        let mut question_map = std::collections::HashMap::new();
        for question in &quiz_set.questions {
            question_map.insert(question.id.clone(), question);
        }

        // 验证答案数量是否匹配问题数量
        assert_eq!(
            params.answers.len(),
            quiz_set.questions.len(),
            "Answer count mismatch with questions"
        );

        // 计算得分
        let mut score = 0;
        let mut answers_by_index = vec![vec![]; quiz_set.questions.len()];
        
        for answer_option in &params.answers {
            // 查找对应的题目
            let question = question_map
                .get(&answer_option.question_id)
                .expect(&format!("Question not found: {}", answer_option.question_id));
            
            // 查找题目在原数组中的索引，用于保持原有存储结构
            let question_index = quiz_set.questions
                .iter()
                .position(|q| q.id == answer_option.question_id)
                .expect(&format!("Question index not found: {}", answer_option.question_id));
            
            // 存储答案到对应索引位置
            answers_by_index[question_index] = answer_option.selected_answers.clone();
            
            // 检查用户选择的答案是否与所有正确选项完全匹配（顺序无关）
            let mut user_answers_sorted = answer_option.selected_answers.clone();
            user_answers_sorted.sort();
            let mut correct_options_sorted = question.correct_options.clone();
            correct_options_sorted.sort();

            if user_answers_sorted == correct_options_sorted {
                score += question.points;
            }
        }

        // 创建答题记录
        let attempt = UserAttempt {
            quiz_id,
            user: user.clone(),
            answers: answers_by_index,
            score,
            time_taken: params.time_taken,
            completed_at: now,
        };

        // 存储答题记录
        let _ = self
            .state
            .user_attempts
            .insert(&(quiz_id, user.clone()), attempt.clone());
        // 记录答题事件
        self.state.quiz_events.push(attempt);

        // 记录用户参与
        let mut participations = self
            .state
            .user_participations
            .get(&user)
            .await
            .unwrap()
            .unwrap_or_default();
        participations.push(quiz_id);
        let _ = self.state.user_participations.insert(&user, participations);

        // 更新排行榜
        self.update_leaderboard(quiz_id, user, score).await;
    }

    async fn update_leaderboard(&mut self, quiz_id: u64, user: String, score: u32) {
        // 这里简单实现一个排行榜更新逻辑
        // 实际项目中可能需要更复杂的排序和存储策略
        let mut entries = self
            .state
            .leaderboard
            .get(&quiz_id)
            .await
            .unwrap()
            .unwrap_or_default();

        // 查找用户是否已有条目
        let existing_index = entries.iter().position(|entry| entry.user == user);

        if let Some(index) = existing_index {
            // 更新现有条目
            entries[index].score = score;
        } else {
            // 添加新条目
            entries.push(LeaderboardEntry {
                user,
                score,
                time_taken: 0, // 这里可以从attempt中获取time_taken
            });
        }

        // 按分数排序（从高到低）
        entries.sort_by(|a, b| b.score.cmp(&a.score));

        // 保存更新后的排行榜
        let _ = self.state.leaderboard.insert(&quiz_id, entries);
    }
}
