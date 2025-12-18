// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/*! ABI of the Quiz Application */

use async_graphql::{InputObject, SimpleObject};
use linera_sdk::graphql::GraphQLMutationRoot;
use linera_sdk::linera_base_types::{ContractAbi, ServiceAbi};
use serde::{Deserialize, Serialize};

pub mod state;

pub struct QuizAbi;

/// 创建Quiz集合的参数
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct CreateQuizParams {
    pub title: String,
    pub description: String,
    pub questions: Vec<QuestionParams>,
    pub time_limit: u64,    // 秒
    pub start_time: String, // 毫秒时间戳字符串
    pub end_time: String,   // 毫秒时间戳字符串
    pub nick_name: String,
}

/// 问题参数
#[derive(Debug, Serialize, Deserialize, Clone, SimpleObject, InputObject)]
#[graphql(input_name = "QuestionParamsInput")]
pub struct QuestionParams {
    pub text: String,
    pub options: Vec<String>,
    pub correct_options: Vec<u32>,
    pub points: u32,
    #[serde(rename = "type")]
    pub question_type: String,
    pub id: String,
}

/// 答案选项结构体，包含题目ID和对应的答案
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct AnswerOption {
    pub question_id: String,
    pub selected_answers: Vec<u32>, // 答案选项索引列表，支持多选
}

/// 提交答案的参数
#[derive(Debug, Serialize, Deserialize, InputObject)]
pub struct SubmitAnswersParams {
    pub quiz_id: u64,
    pub answers: Vec<AnswerOption>, // 每个问题的答案选项索引列表，支持多选
    pub time_taken: u64,        // 毫秒
    pub nick_name: String,
}

/// 排行榜条目
#[derive(Debug, Serialize, Deserialize, SimpleObject, Clone)]
pub struct LeaderboardEntry {
    pub user: String,
    pub score: u32,
    pub time_taken: u64,
}

/// 应用支持的操作
#[derive(Debug, Serialize, Deserialize, GraphQLMutationRoot)]
pub enum Operation {
    /// 创建新的Quiz集合
    CreateQuiz(CreateQuizParams),
    /// 提交Quiz答案
    SubmitAnswers(SubmitAnswersParams),
}

/// 应用支持的查询
#[derive(Debug, Serialize, Deserialize)]
pub enum Query {
    /// 获取所有Quiz集合
    GetQuizSets,
    /// 获取Quiz集合详情
    GetQuizSet(u64),
    /// 获取用户的Quiz尝试记录
    GetUserAttempts(String),
    /// 获取Quiz排行榜
    GetLeaderboard,
    /// 获取单个Quiz的排行榜
    GetQuizLeaderboard(u64),
    /// 获取用户参与的测验集合
    GetUserParticipations(String),
    /// 获取用户创建的测验集合
    GetUserCreatedQuizzes(String),
    /// 获取用户参与的测验集合详情
    GetUserParticipatedQuizzes(String),
}

/// 用户答题尝试视图
#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct UserAttemptView {
    pub quiz_id: u64,
    pub user: String,
    pub answers: Vec<Vec<u32>>,
    pub score: u32,
    pub time_taken: u64,
    pub completed_at: String, // 微秒时间戳字符串
}

/// 测验尝试记录
#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct QuizAttempt {
    pub quiz_id: u64,
    pub attempt: UserAttemptView,
}

/// Quiz集合视图
#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct QuizSetView {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub creator: String,
    pub questions: Vec<QuestionView>,
    pub start_time: String, // 微秒时间戳字符串
    pub end_time: String,   // 微秒时间戳字符串
    pub created_at: String, // 微秒时间戳字符串
}

/// 问题视图
#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct QuestionView {
    pub id: String,
    pub text: String,
    pub options: Vec<String>,
    pub points: u32,
    #[serde(rename = "type")]
    pub question_type: String,
}

/// 查询响应
#[derive(Debug, Serialize, Deserialize)]
pub enum QueryResponse {
    /// 所有Quiz集合
    QuizSets(Vec<QuizSetView>),
    /// Quiz集合详情
    QuizSet(Option<QuizSetView>),
    /// 用户尝试记录列表
    UserAttempts(Vec<QuizAttempt>),
    Leaderboard(Vec<UserAttemptView>),
    QuizLeaderboard(Vec<UserAttemptView>),
    UserParticipations(Vec<u64>),
    /// 用户创建的测验集合
    UserCreatedQuizzes(Vec<QuizSetView>),
    /// 用户参与的测验集合
    UserParticipatedQuizzes(Vec<QuizSetView>),
}

impl ContractAbi for QuizAbi {
    type Operation = Operation;
    type Response = ();
}

impl ServiceAbi for QuizAbi {
    type Query = async_graphql::Request;
    type QueryResponse = async_graphql::Response;
}