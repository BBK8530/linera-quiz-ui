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
use log::{debug, error, info};

use crate::state::{Question, QuizMode, QuizSet, QuizStartMode, QuizState, User, UserAttempt};
use quiz::{CreateQuizParams, LeaderboardEntry, Operation, SetNicknameParams, SubmitAnswersParams};

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
            Operation::SetNickname(params) => self.set_nickname(params).await,
            Operation::CreateQuiz(params) => self.create_quiz(params).await,
            Operation::SubmitAnswers(params) => self.submit_answers(params).await,
            Operation::StartQuiz(quiz_id) => self.start_quiz(quiz_id).await,
            Operation::RegisterForQuiz(quiz_id) => self.register_for_quiz(quiz_id).await,
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
    async fn set_nickname(&mut self, params: SetNicknameParams) -> Result<(), quiz::QuizError> {
        let current_time = self.runtime.system_time();
        let wallet_address = self
            .runtime
            .authenticated_signer()
            .ok_or(quiz::QuizError::InsufficientPermissions)?
            .to_string();

        // 添加日志记录
        info!(
            "set_nickname called with parameters: nickname={}, wallet_address={}",
            params.nickname, wallet_address
        );

        // 检查昵称是否已被使用
        debug!(
            "Checking if nickname '{}' is already taken",
            params.nickname
        );
        if self
            .state
            .nickname_to_wallet
            .get(&params.nickname)
            .await
            .map_err(|_| {
                error!(
                    "Error checking nickname existence for '{}': database error",
                    params.nickname
                );
                quiz::QuizError::InternalError
            })?
            .is_some()
        {
            debug!(
                "Nickname '{}' is already taken, returning error",
                params.nickname
            );
            return Err(quiz::QuizError::NicknameAlreadyTaken);
        }

        // 检查用户是否已存在
        debug!(
            "Checking if user with wallet_address '{}' already exists",
            wallet_address
        );
        if let Some(existing_user) = self.state.users.get(&wallet_address).await.map_err(|_| {
            error!(
                "Error checking user existence for address '{}': database error",
                wallet_address
            );
            quiz::QuizError::InternalError
        })? {
            debug!(
                "User already exists, updating nickname from '{}' to '{}'",
                existing_user.nickname, params.nickname
            );
            // 更新昵称，先删除旧昵称的映射
            self.state
                .nickname_to_wallet
                .remove(&existing_user.nickname)
                .map_err(|_| {
                    error!(
                        "Error removing old nickname mapping '{}' -> '{}': database error",
                        existing_user.nickname, wallet_address
                    );
                    quiz::QuizError::InternalError
                })?;
        } else {
            debug!("User does not exist yet, creating new user entry");
        }

        // 创建或更新用户
        let user = User {
            wallet_address: wallet_address.clone(),
            nickname: params.nickname.clone(),
            created_at: current_time,
        };

        // 存储用户信息
        debug!(
            "Storing user information for wallet_address '{}' with nickname '{}'",
            wallet_address, params.nickname
        );
        self.state
            .users
            .insert(&wallet_address, user)
            .map_err(|_| {
                error!(
                    "Error storing user information for address '{}': database error",
                    wallet_address
                );
                quiz::QuizError::InternalError
            })?;

        // 建立昵称到钱包地址的映射
        debug!(
            "Creating nickname mapping '{}' -> '{}'",
            params.nickname, wallet_address
        );
        self.state
            .nickname_to_wallet
            .insert(&params.nickname, wallet_address.clone())
            .map_err(|_| {
                error!(
                    "Error creating nickname mapping '{}' -> '{}': database error",
                    params.nickname, wallet_address
                );
                quiz::QuizError::InternalError
            })?;

        info!(
            "Successfully set nickname '{}' for wallet_address '{}'",
            params.nickname, wallet_address
        );
        Ok(())
    }

    async fn create_quiz(&mut self, params: CreateQuizParams) -> Result<(), quiz::QuizError> {
        let current_time = self.runtime.system_time();
        let wallet_address = self
            .runtime
            .authenticated_signer()
            .ok_or(quiz::QuizError::InsufficientPermissions)?
            .to_string();

        // 验证用户是否存在
        let user = self
            .state
            .users
            .get(&wallet_address)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .ok_or(quiz::QuizError::UserNotFound)?;

        // 验证测验时间范围
        let start_time_millis = params
            .start_time
            .parse::<u64>()
            .map_err(|_| quiz::QuizError::InvalidParameters)?;

        // 检查时间戳长度是否合理（毫秒级时间戳应该是13位左右）
        if !(start_time_millis.to_string().len() >= 10 && start_time_millis.to_string().len() <= 14)
        {
            return Err(quiz::QuizError::InvalidParameters);
        }

        let start_time: linera_sdk::linera_base_types::Timestamp = start_time_millis
            .checked_mul(1000)
            .ok_or(quiz::QuizError::InvalidParameters)?
            .into(); // 毫秒转微秒

        let end_time_millis = params
            .end_time
            .parse::<u64>()
            .map_err(|_| quiz::QuizError::InvalidParameters)?;

        // 检查时间戳长度是否合理（毫秒级时间戳应该是13位左右）
        if !(end_time_millis.to_string().len() >= 10 && end_time_millis.to_string().len() <= 14) {
            return Err(quiz::QuizError::InvalidParameters);
        }

        let end_time: linera_sdk::linera_base_types::Timestamp = end_time_millis
            .checked_mul(1000)
            .ok_or(quiz::QuizError::InvalidParameters)?
            .into(); // 毫秒转微秒

        if !(start_time > current_time) {
            return Err(quiz::QuizError::InvalidParameters);
        }
        if !(end_time > start_time) {
            return Err(quiz::QuizError::InvalidParameters);
        }
        // 检查时间范围是否合理（不超过100年）
        if !(end_time.delta_since(start_time) <= TimeDelta::from_secs(3600 * 24 * 365 * 100)) {
            return Err(quiz::QuizError::InvalidParameters);
        }

        // 解析Quiz模式
        let mode = match params.mode.as_str() {
            "public" => QuizMode::Public,
            "registration" => QuizMode::Registration,
            _ => return Err(quiz::QuizError::InvalidQuizMode),
        };

        // 解析Quiz开始方式
        let start_mode = match params.start_mode.as_str() {
            "auto" => QuizStartMode::Auto,
            "manual" => QuizStartMode::Manual,
            _ => return Err(quiz::QuizError::InvalidStartMode),
        };

        let quiz_id = *self.state.next_quiz_id.get();

        // 生成题目ID和选项ID
        let questions = params
            .questions
            .into_iter()
            .enumerate()
            .map(|(index, q)| {
                // 使用测验ID和题目索引生成唯一ID
                let id = format!("q{}-{}", quiz_id, index);

                // 根据正确答案的个数设置type
                let question_type = if q.correct_options.len() > 1 {
                    "checkbox"
                } else {
                    "radio"
                };

                Question {
                    id,
                    text: q.text,
                    options: q.options,
                    correct_options: q.correct_options,
                    points: q.points,
                    question_type: question_type.to_string(),
                }
            })
            .collect();

        let quiz_set = QuizSet {
            id: quiz_id,
            title: params.title,
            description: params.description,
            creator: wallet_address.clone(),
            creator_nickname: user.nickname.clone(),
            questions,
            time_limit: params.time_limit,
            start_time,
            end_time,
            created_at: current_time,
            mode,
            start_mode,
            is_started: false,
            registered_users: Vec::new(),
            participant_count: 0,
        };

        // 存储新Quiz
        self.state
            .quiz_sets
            .insert(&quiz_id, quiz_set)
            .map_err(|_| quiz::QuizError::InternalError)?;

        // 更新用户创建的测验列表
        let mut created_quizzes = self
            .state
            .user_created_quizzes
            .get(&wallet_address)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .unwrap_or_default();
        created_quizzes.push(quiz_id);
        self.state
            .user_created_quizzes
            .insert(&wallet_address, created_quizzes)
            .map_err(|_| quiz::QuizError::InternalError)?;

        // 更新下一个Quiz ID
        let next_id = quiz_id
            .checked_add(1)
            .ok_or(quiz::QuizError::InternalError)?;
        self.state.next_quiz_id.set(next_id);
        Ok(())
    }

    async fn submit_answers(&mut self, params: SubmitAnswersParams) -> Result<(), quiz::QuizError> {
        let wallet_address = self
            .runtime
            .authenticated_signer()
            .ok_or(quiz::QuizError::InsufficientPermissions)?
            .to_string();
        let now = self.runtime.system_time();

        // 检查Quiz是否存在
        let mut quiz_set = self
            .state
            .quiz_sets
            .get(&params.quiz_id)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .ok_or(quiz::QuizError::QuizNotFound)?;

        // 检查测验是否已开始
        if !quiz_set.is_started {
            // 如果是自动开始模式，检查是否到了开始时间
            if quiz_set.start_mode == QuizStartMode::Auto && now >= quiz_set.start_time {
                // 自动开始测验
                quiz_set.is_started = true;
                self.state
                    .quiz_sets
                    .insert(&params.quiz_id, quiz_set.clone())
                    .map_err(|_| quiz::QuizError::InternalError)?;
            } else {
                return Err(quiz::QuizError::QuizNotStarted);
            }
        }

        // 检查测验是否已结束
        if !(now <= quiz_set.end_time) {
            return Err(quiz::QuizError::InvalidParameters);
        }

        // 检查用户是否已提交过该Quiz
        if self
            .state
            .user_attempts
            .get(&(params.quiz_id, wallet_address.clone()))
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .is_some()
        {
            return Err(quiz::QuizError::UserAlreadyAttempted);
        }

        // 检查用户是否有权限参与
        match quiz_set.mode {
            QuizMode::Public => {
                // 公开模式，检查用户是否设置了昵称
                let user = self
                    .state
                    .users
                    .get(&wallet_address)
                    .await
                    .map_err(|_| quiz::QuizError::InternalError)?
                    .ok_or(quiz::QuizError::UserNotFound)?;
                if user.nickname != params.nickname {
                    return Err(quiz::QuizError::InvalidParameters);
                }
            }
            QuizMode::Registration => {
                // 报名模式，检查用户是否已报名
                let user = self
                    .state
                    .users
                    .get(&wallet_address)
                    .await
                    .map_err(|_| quiz::QuizError::InternalError)?
                    .ok_or(quiz::QuizError::UserNotFound)?;
                if user.nickname != params.nickname {
                    return Err(quiz::QuizError::InvalidParameters);
                }

                if !quiz_set.registered_users.contains(&wallet_address) {
                    return Err(quiz::QuizError::UserNotRegistered);
                }
            }
        }

        // 创建题目ID到题目的映射，用于快速查找
        let mut question_map = std::collections::HashMap::new();
        for question in &quiz_set.questions {
            question_map.insert(question.id.clone(), question);
        }

        // 验证答案数量是否匹配问题数量
        if params.answers.len() != quiz_set.questions.len() {
            return Err(quiz::QuizError::InvalidParameters);
        }

        // 计算得分
        let mut score = 0;
        let mut answers_by_index = vec![vec![]; quiz_set.questions.len()];

        for answer_option in &params.answers {
            // 查找对应的题目
            let question = question_map
                .get(&answer_option.question_id)
                .ok_or(quiz::QuizError::InvalidParameters)?;

            // 查找题目在原数组中的索引，用于保持原有存储结构
            let question_index = quiz_set
                .questions
                .iter()
                .position(|q| q.id == answer_option.question_id)
                .ok_or(quiz::QuizError::InvalidParameters)?;

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
            quiz_id: params.quiz_id,
            user: wallet_address.clone(),
            nickname: params.nickname.clone(),
            answers: answers_by_index,
            score,
            time_taken: params.time_taken,
            completed_at: now,
        };

        // 存储答题记录
        self.state
            .user_attempts
            .insert(&(params.quiz_id, wallet_address.clone()), attempt.clone())
            .map_err(|_| quiz::QuizError::InternalError)?;
        // 记录答题事件
        self.state.quiz_events.push(attempt);

        // 更新测验参与者列表
        let mut participants = self
            .state
            .quiz_participants
            .get(&params.quiz_id)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .unwrap_or_default();
        if !participants.contains(&wallet_address) {
            participants.push(wallet_address.clone());
            self.state
                .quiz_participants
                .insert(&params.quiz_id, participants)
                .map_err(|_| quiz::QuizError::InternalError)?;
        }

        // 更新测验参与者计数
        quiz_set.participant_count += 1;
        self.state
            .quiz_sets
            .insert(&params.quiz_id, quiz_set)
            .map_err(|_| quiz::QuizError::InternalError)?;

        // 记录用户参与
        let mut participations = self
            .state
            .user_participations
            .get(&wallet_address)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .unwrap_or_default();
        participations.push(params.quiz_id);
        self.state
            .user_participations
            .insert(&wallet_address, participations)
            .map_err(|_| quiz::QuizError::InternalError)?;

        // 更新排行榜
        self.update_leaderboard(params.quiz_id, wallet_address, score)
            .await?;
        Ok(())
    }

    async fn start_quiz(&mut self, quiz_id: u64) -> Result<(), quiz::QuizError> {
        let wallet_address = self
            .runtime
            .authenticated_signer()
            .ok_or(quiz::QuizError::InsufficientPermissions)?
            .to_string();
        let now = self.runtime.system_time();

        // 检查Quiz是否存在
        let mut quiz_set = self
            .state
            .quiz_sets
            .get(&quiz_id)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .ok_or(quiz::QuizError::QuizNotFound)?;

        // 检查是否是创建者
        if quiz_set.creator != wallet_address {
            return Err(quiz::QuizError::InsufficientPermissions);
        }

        // 检查是否是手动开始模式
        if quiz_set.start_mode != QuizStartMode::Manual {
            return Err(quiz::QuizError::InvalidParameters);
        }

        // 检查测验是否已开始
        if quiz_set.is_started {
            return Err(quiz::QuizError::InvalidParameters);
        }

        // 检查测验是否在时间范围内
        if !(now >= quiz_set.start_time) {
            return Err(quiz::QuizError::InvalidParameters);
        }
        if !(now <= quiz_set.end_time) {
            return Err(quiz::QuizError::InvalidParameters);
        }

        // 开始测验
        quiz_set.is_started = true;
        self.state
            .quiz_sets
            .insert(&quiz_id, quiz_set)
            .map_err(|_| quiz::QuizError::InternalError)?;
        Ok(())
    }

    async fn register_for_quiz(&mut self, quiz_id: u64) -> Result<(), quiz::QuizError> {
        let wallet_address = self
            .runtime
            .authenticated_signer()
            .ok_or(quiz::QuizError::InsufficientPermissions)?
            .to_string();
        let now = self.runtime.system_time();

        // 检查Quiz是否存在
        let mut quiz_set = self
            .state
            .quiz_sets
            .get(&quiz_id)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .ok_or(quiz::QuizError::QuizNotFound)?;

        // 检查是否是报名模式
        if quiz_set.mode != QuizMode::Registration {
            return Err(quiz::QuizError::InvalidParameters);
        }

        // 检查测验是否已开始或已结束
        if quiz_set.is_started {
            return Err(quiz::QuizError::InvalidParameters);
        }
        if !(now < quiz_set.end_time) {
            return Err(quiz::QuizError::InvalidParameters);
        }

        // 检查用户是否已存在
        let _user = self
            .state
            .users
            .get(&wallet_address)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
            .ok_or(quiz::QuizError::UserNotFound)?;

        // 检查用户是否已报名
        if quiz_set.registered_users.contains(&wallet_address) {
            return Err(quiz::QuizError::UserAlreadyRegistered);
        }

        // 报名
        quiz_set.registered_users.push(wallet_address);
        self.state
            .quiz_sets
            .insert(&quiz_id, quiz_set)
            .map_err(|_| quiz::QuizError::InternalError)?;
        Ok(())
    }

    async fn update_leaderboard(
        &mut self,
        quiz_id: u64,
        user: String,
        score: u32,
    ) -> Result<(), quiz::QuizError> {
        // 这里简单实现一个排行榜更新逻辑
        // 实际项目中可能需要更复杂的排序和存储策略
        let mut entries = self
            .state
            .leaderboard
            .get(&quiz_id)
            .await
            .map_err(|_| quiz::QuizError::InternalError)?
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
        self.state
            .leaderboard
            .insert(&quiz_id, entries)
            .map_err(|_| quiz::QuizError::InternalError)?;
        Ok(())
    }
}
